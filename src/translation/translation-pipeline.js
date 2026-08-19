import cloneDeep from "lodash-es/cloneDeep.js";
import forEach from "lodash-es/forEach.js";
import get from "lodash-es/get.js";
import isEmpty from "lodash-es/isEmpty.js";
import * as actions from "../redux/translation/actions.js";
import * as translationSelectors from "../redux/translation/selectors.js";
import * as firestoreSelectors from "../redux/selectors.js";
import { toWireId, toDocumentKey } from "./wire-id.js";
import { Status } from "./enums.js";

/**
 * Quiet window a document waits out before its changed fields join a batch. Reset by every further
 * change to that document, and kept per document so a burst of edits across many documents doesn't
 * serialize behind one shared timer.
 */
export const DEBOUNCE_WINDOW = 300;

/** Caps on a single translate request. */
export const MAX_ITEMS_PER_REQUEST = 50;
export const MAX_CHARS_PER_REQUEST = 20000;

/** Cap on translate requests in flight at once. */
export const MAX_CONCURRENT_REQUESTS = 3;

/**
 * How long queued items wait for company before a request goes out.
 *
 * Documents arrive from Firestore a few at a time, across separate dispatches, so sending the moment
 * one document is queued produces a request per document. This window lets the ones arriving around
 * the same moment share a request instead. It is not a debounce: it never restarts, so the wait is
 * bounded no matter how steadily documents keep arriving.
 */
export const BATCH_COLLECT_WINDOW = 300;

/**
 * Everything between "these fields need translating" and "the result is in redux": debouncing,
 * batching, calling the Translator, and recording success or failure per field.
 *
 * See wiki/translation/architecture.md#chunking-and-wire-addressing.
 */
export default class TranslationPipeline {
  /**
   * @param {Object} translation The Translation instance owning this pipeline - read lazily for the
   *  store and the configured Translator, neither of which exists when this is constructed.
   */
  constructor(translation) {
    this._translation = translation;

    // docKey -> { collection, docId, fields: Map<fieldPath, field> } waiting out its quiet window.
    this._debouncedChanges = {};
    // docKey -> timer id.
    this._debounceTimers = {};

    // Items waiting for a batch, oldest first. Batches are taken from the newest end.
    this._queuedItems = [];
    this._sequence = 0;

    this._inFlightCount = 0;
    // Set while a collection window is open; see `_scheduleBatchSend`.
    this._batchSendTimer = undefined;

    // docKey -> { attempted, remaining: Set<fieldPath>, failed: [] } for the attempt in progress.
    // A document's fields can span several batches, so its status is only written once the last of
    // them comes back.
    this._attempts = {};
  }

  get _store() {
    return this._translation._store;
  }

  get _translator() {
    return this._translation._translator;
  }

  /**
   * Entry point for every caller: the initial scan, a document update, and a language change all
   * arrive here. Nothing happens until both a Translator and a language are configured.
   *
   * @param {Object} param0
   *  @property {String} collection Collection / Subcollection ID.
   *  @property {String} docId Document Id.
   *  @property {Array} fields Translatable fields, as `translatableFields` returns them.
   *  @property {Boolean} debounce `true` only for an existing-document update, where changes arrive
   *   as a rapid stream. The initial scan and a language change are one-shot, so they skip straight
   *   to chunking.
   */
  translate({ collection, docId, fields, debounce = false }) {
    if (isEmpty(fields) || !this._translator || !translationSelectors.language(this._store.getState())) {
      return;
    }

    if (!debounce) {
      this._queueFieldsForTranslation(collection, docId, fields);
      return;
    }

    const docKey = this._documentKey(collection, docId);
    const changes =
      this._debouncedChanges[docKey] ||
      (this._debouncedChanges[docKey] = { collection, docId, fields: new Map() });
    fields.forEach((field) => changes.fields.set(field.path, field));

    // Every further change to this document restarts its own window, and only its own.
    clearTimeout(this._debounceTimers[docKey]);
    this._debounceTimers[docKey] = setTimeout(() => {
      delete this._debounceTimers[docKey];
      delete this._debouncedChanges[docKey];
      this._queueFieldsForTranslation(changes.collection, changes.docId, [...changes.fields.values()]);
    }, DEBOUNCE_WINDOW);
  }

  /**
   * Queues a document's fields for translation. The translate call starts from here, which is why
   * this is where `IN_PROGRESS` is written and the previous attempt's `failedFields` are cleared -
   * not the instant the raw value changed.
   * @private
   */
  _queueFieldsForTranslation(collection, docId, fields) {
    const docKey = this._documentKey(collection, docId);
    this._ensureDocumentClone(collection, docId);

    // `outcomes` holds one entry per field - `null` while in flight, `true`/`false` once settled -
    // so a field queued again mid-attempt is still one field, not two. A running tally can't do
    // that: it would count the re-queue as an extra attempt and skew the SUCCESS/PARTIAL/FAILED
    // decision below.
    const attempt = this._attempts[docKey] || (this._attempts[docKey] = { outcomes: new Map(), remaining: new Set() });

    const sourceValues = {};

    fields.forEach((field) => {
      attempt.remaining.add(field.path);
      // Re-attempting drops whatever the field settled to before; only the latest outcome counts.
      attempt.outcomes.set(field.path, null);

      sourceValues[field.path] = field.value;

      this._queuedItems.push({
        sequence: ++this._sequence,
        docKey,
        collection,
        docId,
        path: field.path,
        text: field.value,
        contentType: field.contentType,
      });
    });

    // The call starts now, so any stale translation of these fields goes now too - back to the
    // source value, never to null. A field whose call then fails is already showing what it should.
    this._store.dispatch(actions._setTranslatedFields(collection, docId, sourceValues));
    this._store.dispatch(
      actions._setDocStatus(collection, docId, { status: Status.IN_PROGRESS, failedFields: [] })
    );

    this._scheduleBatchSend();
  }

  /**
   * Opens a collection window, so items queued moments apart travel together instead of one request
   * per document. Already-open windows are left alone - the wait is bounded, never restarted.
   *
   * A queue that already holds a full request's worth has nothing to gain by waiting, so it goes now.
   * @private
   */
  _scheduleBatchSend() {
    if (this._queuedItems.length >= MAX_ITEMS_PER_REQUEST) {
      this._flushBatchSend();
      return;
    }

    if (this._batchSendTimer !== undefined) {
      return;
    }

    this._batchSendTimer = setTimeout(() => this._flushBatchSend(), BATCH_COLLECT_WINDOW);
  }

  /** Closes any open collection window and sends what has gathered. @private */
  _flushBatchSend() {
    clearTimeout(this._batchSendTimer);
    this._batchSendTimer = undefined;
    this._sendQueuedBatches();
  }

  /**
   * Drops everything queued or waiting for a document, so a fresh attempt doesn't merge with the one
   * it replaces. Requests already in flight can't be recalled - their responses are discarded on
   * arrival instead, see `_applyTranslatorResponse`.
   * @param {String} collection Collection / Subcollection ID.
   * @param {String} docId Document Id.
   */
  cancelPendingTranslation(collection, docId) {
    const docKey = this._documentKey(collection, docId);

    clearTimeout(this._debounceTimers[docKey]);
    delete this._debounceTimers[docKey];
    delete this._debouncedChanges[docKey];
    delete this._attempts[docKey];

    this._queuedItems = this._queuedItems.filter((item) => item.docKey !== docKey);
  }

  /**
   * A translated document is a full clone of the original, so translated values have somewhere to
   * land. Creating it on the first attempt keeps every field the document already has readable while
   * translation is still in flight.
   * @private
   */
  _ensureDocumentClone(collection, docId) {
    const state = this._store.getState();
    if (get(state, `translations.docs.${collection}.${docId}`)) {
      return;
    }

    const original = firestoreSelectors.originalDoc(state, collection, docId);
    if (original) {
      this._store.dispatch(actions._setTranslatedDoc(collection, docId, cloneDeep(original)));
    }
  }

  /**
   * Sends as many batches as the concurrency cap allows; the rest wait in the queue for a slot.
   * @private
   */
  _sendQueuedBatches() {
    while (this._inFlightCount < MAX_CONCURRENT_REQUESTS && this._queuedItems.length) {
      this._sendBatch(this._takeNextBatch());
    }
  }

  /**
   * Takes the next batch off the queue, newest-relevant-first so the most recently requested content
   * resolves first, capped by item count and character count. Within the batch, items are restored to
   * the order they were queued in.
   * @returns {Array} Batch items.
   * @private
   */
  _takeNextBatch() {
    const batch = [];
    let chars = 0;

    for (let i = this._queuedItems.length - 1; i >= 0; i--) {
      const item = this._queuedItems[i];

      if (batch.length >= MAX_ITEMS_PER_REQUEST) {
        break;
      }

      // A single item longer than the whole cap still goes, alone, rather than jamming the queue.
      if (batch.length && chars + item.text.length > MAX_CHARS_PER_REQUEST) {
        break;
      }

      batch.push(item);
      chars += item.text.length;
      this._queuedItems.splice(i, 1);
    }

    return batch.reverse();
  }

  /**
   * @param {Array} batch Items to translate in one request.
   * @private
   */
  async _sendBatch(batch) {
    this._inFlightCount++;

    const targetLanguage = translationSelectors.language(this._store.getState());
    const items = {};
    batch.forEach((item) => {
      const wireItem = { text: item.text };
      // Left absent when the schema declared none - never defaulted to PLAIN.
      if (item.contentType !== undefined) {
        wireItem.contentType = item.contentType;
      }
      items[toWireId(item.collection, item.docId, item.path)] = wireItem;
    });

    let response;
    try {
      response = await this._translator({ targetLanguage, items });
    } catch (error) {
      // A failed call fails its items only - every other batch is unaffected.
      response = undefined;
    }

    try {
      this._applyTranslatorResponse(batch, get(response, "items"), targetLanguage);
    } finally {
      this._inFlightCount--;
      this._sendQueuedBatches();
    }
  }

  /**
   * Accepts or rejects each item on its own, then writes the accepted values into the clone.
   * @param {Array} batch Items that were sent.
   * @param {Object} responseItems Translator's response items, keyed by wire id.
   * @param {String} requestedLanguage The language this batch was sent for.
   * @private
   */
  _applyTranslatorResponse(batch, responseItems, requestedLanguage) {
    // The language changed while this was in flight, so these results are for a language nobody is
    // reading any more. Dropping them whole also leaves the fresh attempt's bookkeeping alone.
    if (requestedLanguage !== translationSelectors.language(this._store.getState())) {
      return;
    }

    const byDoc = {};

    batch.forEach((item) => {
      const group =
        byDoc[item.docKey] ||
        (byDoc[item.docKey] = { collection: item.collection, docId: item.docId, translated: {}, failed: [] });

      const result = responseItems && responseItems[toWireId(item.collection, item.docId, item.path)];
      // Whether a translation preserved the source's HTML/Markdown structure is the Translator's
      // responsibility, not this library's - see wiki/translation/translator-function-spec.md.
      const accepted = !!result && result.success === true && typeof result.text === "string";

      if (accepted) {
        group.translated[item.path] = result.text;
      } else {
        group.failed.push(item.path);
      }
    });

    forEach(byDoc, (group) => {
      if (!isEmpty(group.translated)) {
        this._store.dispatch(
          actions._setTranslatedFields(group.collection, group.docId, group.translated)
        );
      }
      this._settleDocumentAttempt(group);
    });
  }

  /**
   * Records this batch's outcome against the document's attempt, and writes the overall status once
   * every field of that attempt has come back - however many batches it was split across.
   * @private
   */
  _settleDocumentAttempt({ collection, docId, translated, failed }) {
    const docKey = this._documentKey(collection, docId);
    const attempt = this._attempts[docKey];
    if (!attempt) {
      return;
    }

    // A path missing from `outcomes` isn't part of this attempt - a response that outlived the
    // attempt it belonged to. Recording it would invent a field the attempt never queued.
    const recordOutcome = (path, succeeded) => {
      if (!attempt.outcomes.has(path)) {
        return;
      }
      attempt.remaining.delete(path);
      attempt.outcomes.set(path, succeeded);
    };

    Object.keys(translated).forEach((path) => recordOutcome(path, true));
    failed.forEach((path) => recordOutcome(path, false));

    if (attempt.remaining.size) {
      return;
    }

    delete this._attempts[docKey];

    const failedFields = [];
    attempt.outcomes.forEach((succeeded, path) => {
      if (succeeded === false) {
        failedFields.push(path);
      }
    });

    const status = !failedFields.length
      ? Status.SUCCESS
      : failedFields.length === attempt.outcomes.size
      ? Status.FAILED
      : Status.PARTIAL_FAILURE;

    this._store.dispatch(actions._setDocStatus(collection, docId, { status, failedFields }));
  }

  /**
   * @returns {String} Key identifying a document across this pipeline's internal maps.
   * @private
   */
  _documentKey(collection, docId) {
    return toDocumentKey(collection, docId);
  }
}
