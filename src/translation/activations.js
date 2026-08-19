import cloneDeep from "lodash-es/cloneDeep.js";
import forEach from "lodash-es/forEach.js";
import get from "lodash-es/get.js";
import set from "lodash-es/set.js";
import isEqual from "lodash-es/isEqual.js";
import * as actions from "../redux/translation/actions.js";
import * as translationSelectors from "../redux/translation/selectors.js";
import ActivationDocIndex from "./activation-doc-index.js";
import { translatableFields } from "./schema.js";
import { toDocumentKey, fromDocumentKey } from "./wire-id.js";
import { Status } from "./enums.js";

/**
 * Stands in for `firestore.docs` before anything is loaded. A shared constant, not a fresh `{}` per
 * read - `_reconcileRetrievedDocuments` compares this by reference, and a new object every dispatch
 * would defeat that.
 */
const NO_DOCUMENTS = {};

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
    if (isAlreadyActive) {
      // Re-starting changes scope rather than failing, so an accidental second start with a
      // different filterFunction would silently replace the first one.
      console.warn(
        `firestore-redux > translation.start : '${id}' is already started, so its scope has been replaced. Use translation.update to change an activation's scope.`
      );
    }

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
      throw new Error(`firestore-redux > translation.update : '${id}' is not a started activation.`);
    }

    this._filterFunctions[id] = filterFunction;
    this._store.dispatch(actions._addActivation({ id, filterFunction }));
    this._reconcileActivationScope(id);
  }

  /**
   * Stops and removes an activation. Documents it covered are kept if another still-active
   * activation matches them.
   *
   * An unknown or already-stopped id is a no-op, not an error - teardown often runs more than once.
   * `update` throws in the same situation on purpose: stopping something that isn't running is
   * already the intended end state, updating it can't be.
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
      throw new Error(`firestore-redux > translation.${caller} : firestore-redux is not initialized yet.`);
    }

    if (!id || typeof id !== "string") {
      throw new Error(`firestore-redux > translation.${caller} : id must be a non-empty String. ${id}`);
    }

    if (typeof filterFunction !== "function") {
      throw new Error(`firestore-redux > translation.${caller} : filterFunction must be a Function.`);
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

    this._startFreshTranslation(collection, docId, document);
  }

  /**
   * Throws away whatever a document was translated into and translates it again from its original,
   * in whatever language is now current. Used when the language changes - a fresh attempt, not a
   * diff against the previous language's result.
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The original document.
   * @private
   */
  _retranslateDocument(collection, docId, document) {
    // Anything queued or debounced for the old language would otherwise merge into this attempt.
    this._translation._pipeline.cancelPendingTranslation(collection, docId);
    this._startFreshTranslation(collection, docId, document);
  }

  /**
   * Creates the clone and sends every translatable field. Shared by the first translation of a
   * document and by a re-translation after a language change.
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The original document.
   * @private
   */
  _startFreshTranslation(collection, docId, document) {
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
   * Re-translates every document any activation currently covers, into the language that is now
   * current. One pass over the whole matched set, however many activations produced it - there is
   * nothing activation-specific to reconcile, because activations carry no language of their own.
   *
   * Reads the matched set from the index rather than from `docs`, so a document that was matched
   * while no language was set - and therefore has no `docs` entry yet - is picked up here too.
   */
  retranslateMatchedDocuments() {
    const matchedDocumentKeys = new Set();
    Object.keys(this._filterFunctions).forEach((activationId) => {
      this._index.documentKeys(activationId).forEach((documentKey) =>
        matchedDocumentKeys.add(documentKey)
      );
    });

    matchedDocumentKeys.forEach((documentKey) => {
      const { collection, docId } = fromDocumentKey(documentKey);
      const document = this._document(collection, docId);
      if (document) {
        this._retranslateDocument(collection, docId, document);
      }
    });
  }

  /**
   * Applies an update to an already-translated document, field by field.
   *
   * A translatable field whose raw value changed is re-sent, debounced. A field that changed but
   * isn't translatable is copied straight into the clone. A field that didn't change keeps whatever
   * the clone already holds for it - including its existing translation. A changed translatable
   * field also keeps its previous translation until its translate call actually starts; the pipeline
   * resets it to the source value at that point.
   *
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The document as it now stands.
   * @param {Object} previousDocument The document as it stood before this update.
   * @private
   */
  _applyDocumentUpdate(collection, docId, document, previousDocument) {
    const existingClone = get(this._store.getState(), `translations.docs.${collection}.${docId}`);
    if (!existingClone) {
      this._translateMatchedDocument(collection, docId, document);
      return;
    }

    const schema = translationSelectors.schema(this._store.getState());
    const currentFields = translatableFields(document, collection, schema);

    const previousValuesByPath = {};
    translatableFields(previousDocument, collection, schema).forEach((field) => {
      previousValuesByPath[field.path] = field.value;
    });

    // Start from the new original - that copies every changed non-translatable field through
    // immediately - then lay the translations already held back over it.
    const updatedClone = cloneDeep(document);
    currentFields.forEach((field) => {
      const heldTranslation = get(existingClone, field.path);
      if (heldTranslation !== undefined) {
        set(updatedClone, field.path, heldTranslation);
      }
    });

    if (!isEqual(updatedClone, existingClone)) {
      this._store.dispatch(actions._setTranslatedDoc(collection, docId, updatedClone));
    }

    const changedFields = currentFields.filter(
      (field) => previousValuesByPath[field.path] !== field.value
    );

    if (changedFields.length) {
      this._translation._translateDocument({
        collection,
        docId,
        fields: changedFields,
        debounce: true,
      });
    }
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
   *
   * That last part is an assumption about the Firestore reducer: that it builds new objects only for
   * the branches an action actually touched. If that ever stops holding, this degrades rather than
   * breaks - every loaded document gets re-examined on every dispatch, but nothing is written and
   * nothing is re-translated, because the work downstream is guarded by value and not by identity
   * (`isEqual` before dispatching a clone, and a per-field value comparison before re-translating).
   * The cost would be CPU alone: no extra renders, no extra Translator calls.
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
          this._reconcileDocumentMatches(collection, docId, document, previousDocuments[docId]);
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
   * Re-evaluates every activation's filter against one document, then applies the difference:
   * membership first - a document arriving, or an update that makes it start or stop matching - and
   * then, for a document that is still matched, the per-field diff of the update itself.
   *
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   * @param {Object} document The document as it now stands.
   * @param {Object} previousDocument The document as it stood before, if it was already loaded.
   * @private
   */
  _reconcileDocumentMatches(collection, docId, document, previousDocument) {
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

    if (!this._index.hasAnyActivation(documentKey)) {
      if (previousActivationIds.length) {
        this._removeUnmatchedTranslation(documentKey);
      }
      return;
    }

    if (previousDocument) {
      this._applyDocumentUpdate(collection, docId, document, previousDocument);
      return;
    }

    this._translateMatchedDocument(collection, docId, document);
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
    return get(this._store.getState(), "firestore.docs") || NO_DOCUMENTS;
  }

  /** @returns {Object} One loaded document. @private */
  _document(collection, docId) {
    return get(this._store.getState(), `firestore.docs.${collection}.${docId}`);
  }
}
