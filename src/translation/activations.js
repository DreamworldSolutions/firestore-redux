import cloneDeep from "lodash-es/cloneDeep.js";
import forEach from "lodash-es/forEach.js";
import get from "lodash-es/get.js";
import * as actions from "./redux/actions.js";
import * as translationSelectors from "./redux/selectors.js";
import ActivationDocIndex from "./activation-doc-index.js";
import { translatableFields } from "./schema.js";
import { toDocumentKey, fromDocumentKey } from "./wire-id.js";
import { Status } from "./enums.js";

/**
 * The activation lifecycle: which documents are in scope, and keeping that answer true as
 * activations start, change scope, and stop, and as documents arrive from Firestore.
 *
 * An activation behaves like a live query over whatever matches its `filterFunction` - a document
 * joins the moment it starts matching and leaves the moment it stops. See
 * wiki/translation/state.md#behaviors.
 */
export default class Activations {
  /**
   * @param {Object} translation The Translation instance owning this - read lazily for the store,
   *  which only exists after `firestoreRedux.init`.
   */
  constructor(translation) {
    this._translation = translation;
    this._index = new ActivationDocIndex();

    /**
     * activation id -> its live `filterFunction`. Mirrors what's in redux, but callable - redux
     * holds the same reference for inspection, this is what actually gets invoked.
     */
    this._filterFunctions = {};

    this._previousDocumentsByCollection = undefined;
    this._unsubscribeStore = undefined;
  }

  get _store() {
    return this._translation._store;
  }

  /**
   * Starts translation for a document scope. Already-loaded matching documents are translated once;
   * documents retrieved later that match are handled the same way.
   *
   * Starting an id that is already active reconciles its scope, exactly as `update` would, rather
   * than failing - a re-mounting view can call `start` again safely.
   *
   * @param {Object} param0
   *  @property {String} id Caller-chosen activation id. Mandatory.
   *  @property {Function} filterFunction `(doc, collection) => Boolean`. Mandatory.
   */
  start({ id, filterFunction } = {}) {
    this._assertUsable("start", id, filterFunction);

    const isAlreadyActive = !!this._filterFunctions[id];
    this._filterFunctions[id] = filterFunction;
    this._store.dispatch(actions._addActivation({ id, filterFunction }));

    if (isAlreadyActive) {
      this._reconcileActivationScope(id);
    } else {
      this._scanLoadedDocuments(id);
    }

    this._watchRetrievedDocuments();
  }

  /**
   * Changes an existing activation's scope. Newly-matching documents translate; no-longer-matching
   * ones are removed, unless another still-active activation also matches them.
   * @param {String} id Activation id. Must currently be started.
   * @param {Object} param1
   *  @property {Function} filterFunction New `(doc, collection) => Boolean`. Mandatory.
   */
  update(id, { filterFunction } = {}) {
    this._assertUsable("update", id, filterFunction);

    if (!this._filterFunctions[id]) {
      throw `firestore-redux > translation.update : '${id}' is not a started activation.`;
    }

    this._filterFunctions[id] = filterFunction;
    this._store.dispatch(actions._addActivation({ id, filterFunction }));
    this._reconcileActivationScope(id);
  }

  /**
   * Stops and removes an activation. Documents it covered are kept if another still-active
   * activation matches them.
   * @param {String} id Activation id.
   */
  stop(id) {
    if (!this._filterFunctions[id]) {
      return;
    }

    delete this._filterFunctions[id];
    this._store.dispatch(actions._removeActivation(id));

    this._index
      .removeActivation(id)
      .forEach((documentKey) => this._removeUnmatchedTranslation(documentKey));

    if (!Object.keys(this._filterFunctions).length) {
      this._stopWatchingRetrievedDocuments();
    }
  }

  /**
   * @param {String} caller Method name, for the error message.
   * @param {String} id Activation id.
   * @param {Function} filterFunction Scope function.
   * @private
   */
  _assertUsable(caller, id, filterFunction) {
    if (!this._store) {
      throw `firestore-redux > translation.${caller} : firestore-redux is not initialized yet.`;
    }

    if (!id || typeof id !== "string") {
      throw `firestore-redux > translation.${caller} : id must be a non-empty String. ${id}`;
    }

    if (typeof filterFunction !== "function") {
      throw `firestore-redux > translation.${caller} : filterFunction must be a Function.`;
    }
  }

  /**
   * Walks every document already loaded and translates the ones this activation matches - the
   * one-time scan `start` performs.
   * @param {String} activationId Activation id.
   * @private
   */
  _scanLoadedDocuments(activationId) {
    const filterFunction = this._filterFunctions[activationId];

    forEach(this._documentsByCollection(), (documents, collection) => {
      forEach(documents, (document, docId) => {
        if (!document || !filterFunction(document, collection)) {
          return;
        }

        this._index.addMatch(activationId, toDocumentKey(collection, docId));
        this._translateMatchedDocument(collection, docId, document);
      });
    });
  }

  /**
   * Re-runs one activation's filter over every loaded document and applies the difference: newly
   * matching documents translate, newly excluded ones are removed unless another activation keeps
   * them. Backs both `update` and a repeated `start`.
   * @param {String} activationId Activation id.
   * @private
   */
  _reconcileActivationScope(activationId) {
    const filterFunction = this._filterFunctions[activationId];
    const previousDocumentKeys = new Set(this._index.documentKeys(activationId));
    const matchingDocumentKeys = new Set();

    forEach(this._documentsByCollection(), (documents, collection) => {
      forEach(documents, (document, docId) => {
        if (document && filterFunction(document, collection)) {
          matchingDocumentKeys.add(toDocumentKey(collection, docId));
        }
      });
    });

    previousDocumentKeys.forEach((documentKey) => {
      if (matchingDocumentKeys.has(documentKey)) {
        return;
      }
      this._index.removeMatch(activationId, documentKey);
      this._removeUnmatchedTranslation(documentKey);
    });

    matchingDocumentKeys.forEach((documentKey) => {
      if (previousDocumentKeys.has(documentKey)) {
        return;
      }
      this._index.addMatch(activationId, documentKey);
      const { collection, docId } = fromDocumentKey(documentKey);
      this._translateMatchedDocument(collection, docId, this._document(collection, docId));
    });
  }

  /**
   * Creates a document's clone and sends its translatable fields. A document already translated by
   * another activation is left alone - overlapping activations share one entry rather than
   * duplicating or re-translating it.
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The original document.
   * @private
   */
  _translateMatchedDocument(collection, docId, document) {
    if (!document || get(this._store.getState(), `translations.docs.${collection}.${docId}`)) {
      return;
    }

    // Matching is tracked either way, but nothing translates until both a Translator and a language
    // are configured - so no entries are created yet.
    if (!this._translation._translator || !translationSelectors.language(this._store.getState())) {
      return;
    }

    // Non-translatable fields are readable immediately; translatable ones fill in as results arrive.
    this._store.dispatch(actions._setTranslatedDoc(collection, docId, cloneDeep(document)));

    const fields = translatableFields(
      document,
      collection,
      translationSelectors.schema(this._store.getState())
    );

    if (!fields.length) {
      // Nothing to attempt, so nothing can fail.
      this._store.dispatch(
        actions._setDocStatus(collection, docId, { status: Status.SUCCESS, failedFields: [] })
      );
      return;
    }

    this._translation._translateDocument({ collection, docId, fields, debounce: false });
  }

  /**
   * Removes a document's `docs`/`status` entries, but only once no activation matches it any more.
   * @param {String} documentKey Document key.
   * @private
   */
  _removeUnmatchedTranslation(documentKey) {
    if (this._index.hasAnyActivation(documentKey)) {
      return;
    }

    const { collection, docId } = fromDocumentKey(documentKey);
    this._store.dispatch(actions._removeDocTranslation(collection, docId));
  }

  /**
   * Subscribes once, for as long as any activation is running, so documents arriving from Firestore
   * - a live-query push or a fresh query - are picked up the same way `start`'s scan picks up
   * already-loaded ones.
   * @private
   */
  _watchRetrievedDocuments() {
    if (this._unsubscribeStore) {
      return;
    }

    this._previousDocumentsByCollection = this._documentsByCollection();
    this._unsubscribeStore = this._store.subscribe(() => this._reconcileRetrievedDocuments());
  }

  /** @private */
  _stopWatchingRetrievedDocuments() {
    if (!this._unsubscribeStore) {
      return;
    }

    this._unsubscribeStore();
    this._unsubscribeStore = undefined;
    this._previousDocumentsByCollection = undefined;
  }

  /**
   * Finds what changed under `firestore.docs` since the last dispatch and reconciles only that.
   * Collections and documents that didn't change keep their object identity, so this costs a few
   * reference comparisons on a dispatch that touched nothing relevant.
   * @private
   */
  _reconcileRetrievedDocuments() {
    const documentsByCollection = this._documentsByCollection();
    if (documentsByCollection === this._previousDocumentsByCollection) {
      return;
    }

    const previousDocumentsByCollection = this._previousDocumentsByCollection || {};
    this._previousDocumentsByCollection = documentsByCollection;

    forEach(documentsByCollection, (documents, collection) => {
      const previousDocuments = previousDocumentsByCollection[collection] || {};
      if (documents === previousDocuments) {
        return;
      }

      forEach(documents, (document, docId) => {
        if (document !== previousDocuments[docId]) {
          this._reconcileDocumentMatches(collection, docId, document);
        }
      });

      forEach(previousDocuments, (document, docId) => {
        if (documents[docId] === undefined) {
          this._forgetDocument(collection, docId);
        }
      });
    });

    forEach(previousDocumentsByCollection, (documents, collection) => {
      if (documentsByCollection[collection] === undefined) {
        forEach(documents, (document, docId) => this._forgetDocument(collection, docId));
      }
    });
  }

  /**
   * Re-evaluates every activation's filter against one document and applies the difference. Handles
   * a document arriving for the first time, and an update that makes it start or stop matching.
   *
   * Re-translating a *changed* field of an already-matched document is a separate concern - see the
   * diffed-update behaviour in wiki/translation/state.md#behaviors item 3.
   *
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The document as it now stands.
   * @private
   */
  _reconcileDocumentMatches(collection, docId, document) {
    if (!document) {
      this._forgetDocument(collection, docId);
      return;
    }

    const documentKey = toDocumentKey(collection, docId);
    const previousActivationIds = this._index.activationIds(documentKey);

    forEach(this._filterFunctions, (filterFunction, activationId) => {
      if (filterFunction(document, collection)) {
        this._index.addMatch(activationId, documentKey);
      } else {
        this._index.removeMatch(activationId, documentKey);
      }
    });

    if (this._index.hasAnyActivation(documentKey)) {
      this._translateMatchedDocument(collection, docId, document);
      return;
    }

    if (previousActivationIds.length) {
      this._removeUnmatchedTranslation(documentKey);
    }
  }

  /**
   * Drops a document that left the client entirely, from the index and from `/translations`.
   * @private
   */
  _forgetDocument(collection, docId) {
    const documentKey = toDocumentKey(collection, docId);
    this._index.removeDocument(documentKey);
    this._store.dispatch(actions._removeDocTranslation(collection, docId));
  }

  /** @returns {Object} `firestore.docs`, keyed by collection. @private */
  _documentsByCollection() {
    return get(this._store.getState(), "firestore.docs", {});
  }

  /** @returns {Object} One loaded document. @private */
  _document(collection, docId) {
    return get(this._store.getState(), `firestore.docs.${collection}.${docId}`);
  }
}
