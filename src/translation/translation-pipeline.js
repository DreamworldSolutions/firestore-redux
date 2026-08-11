import cloneDeep from "lodash-es/cloneDeep.js";
import forEach from "lodash-es/forEach.js";
import get from "lodash-es/get.js";
import isEmpty from "lodash-es/isEmpty.js";
import * as actions from "./redux/actions.js";
import * as translationSelectors from "./redux/selectors.js";
import * as firestoreSelectors from "../redux/selectors.js";
import { toWireId } from "./wire-id.js";
import { fidelityPreserved } from "./fidelity.js";
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
 * Everything between "these fields need translating" and "the result is in redux": debouncing,
 * batching, calling the Translator, validating fidelity, and recording success or failure per field.
 *
 * See wiki/translation/architecture.md#fidelity-chunking-and-wire-addressing.
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
    this._queue = [];
    this._sequence = 0;

    this._inFlightCount = 0;

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
      this.__submit(collection, docId, fields);
      return;
    }

    const docKey = this.__docKey(collection, docId);
    const changes =
      this._debouncedChanges[docKey] ||
      (this._debouncedChanges[docKey] = { collection, docId, fields: new Map() });
    fields.forEach((field) => changes.fields.set(field.path, field));

    // Every further change to this document restarts its own window, and only its own.
    clearTimeout(this._debounceTimers[docKey]);
    this._debounceTimers[docKey] = setTimeout(() => {
      delete this._debounceTimers[docKey];
      delete this._debouncedChanges[docKey];
      this.__submit(changes.collection, changes.docId, [...changes.fields.values()]);
    }, DEBOUNCE_WINDOW);
  }

  /**
   * Queues a document's fields for translation. The translate call starts from here, which is why
   * this is where `IN_PROGRESS` is written and the previous attempt's `failedFields` are cleared -
   * not the instant the raw value changed.
   * @private
   */
  __submit(collection, docId, fields) {
    const docKey = this.__docKey(collection, docId);
    this.__ensureClone(collection, docId);

    const attempt =
      this._attempts[docKey] || (this._attempts[docKey] = { attempted: 0, remaining: new Set(), failed: [] });

    fields.forEach((field) => {
      if (!attempt.remaining.has(field.path)) {
        attempt.remaining.add(field.path);
        attempt.attempted++;
      }

      this._queue.push({
        sequence: ++this._sequence,
        docKey,
        collection,
        docId,
        path: field.path,
        text: field.value,
        contentType: field.contentType,
      });
    });

    this._store.dispatch(
      actions._setDocStatus(collection, docId, { status: Status.IN_PROGRESS, failedFields: [] })
    );

    this.__drain();
  }

  /**
   * A translated document is a full clone of the original, so translated values have somewhere to
   * land. Creating it on the first attempt keeps every field the document already has readable while
   * translation is still in flight.
   * @private
   */
  __ensureClone(collection, docId) {
    const state = this._store.getState();
    if (get(state, `translations.docs.${collection}.${docId}`)) {
      return;
    }

    const original = firestoreSelectors.doc(state, collection, docId);
    if (original) {
      this._store.dispatch(actions._setTranslatedDoc(collection, docId, cloneDeep(original)));
    }
  }

  /**
   * Sends as many batches as the concurrency cap allows; the rest wait in the queue for a slot.
   * @private
   */
  __drain() {
    while (this._inFlightCount < MAX_CONCURRENT_REQUESTS && this._queue.length) {
      this.__send(this.__nextBatch());
    }
  }

  /**
   * Takes the next batch off the queue, newest-relevant-first so the most recently requested content
   * resolves first, capped by item count and character count. Within the batch, items are restored to
   * the order they were queued in.
   * @returns {Array} Batch items.
   * @private
   */
  __nextBatch() {
    const batch = [];
    let chars = 0;

    for (let i = this._queue.length - 1; i >= 0; i--) {
      const item = this._queue[i];

      if (batch.length >= MAX_ITEMS_PER_REQUEST) {
        break;
      }

      // A single item longer than the whole cap still goes, alone, rather than jamming the queue.
      if (batch.length && chars + item.text.length > MAX_CHARS_PER_REQUEST) {
        break;
      }

      batch.push(item);
      chars += item.text.length;
      this._queue.splice(i, 1);
    }

    return batch.reverse();
  }

  /**
   * @param {Array} batch Items to translate in one request.
   * @private
   */
  async __send(batch) {
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
      this.__applyResponse(batch, get(response, "items"));
    } finally {
      this._inFlightCount--;
      this.__drain();
    }
  }

  /**
   * Accepts or rejects each item on its own, then writes the accepted values into the clone.
   * @param {Array} batch Items that were sent.
   * @param {Object} responseItems Translator's response items, keyed by wire id.
   * @private
   */
  __applyResponse(batch, responseItems) {
    const byDoc = {};

    batch.forEach((item) => {
      const group =
        byDoc[item.docKey] ||
        (byDoc[item.docKey] = { collection: item.collection, docId: item.docId, translated: {}, failed: [] });

      const result = responseItems && responseItems[toWireId(item.collection, item.docId, item.path)];
      const accepted =
        !!result &&
        result.success === true &&
        typeof result.text === "string" &&
        fidelityPreserved(item.text, result.text, item.contentType);

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
      this.__settleAttempt(group);
    });
  }

  /**
   * Records this batch's outcome against the document's attempt, and writes the overall status once
   * every field of that attempt has come back - however many batches it was split across.
   * @private
   */
  __settleAttempt({ collection, docId, translated, failed }) {
    const docKey = this.__docKey(collection, docId);
    const attempt = this._attempts[docKey];
    if (!attempt) {
      return;
    }

    Object.keys(translated).forEach((path) => attempt.remaining.delete(path));
    failed.forEach((path) => {
      attempt.remaining.delete(path);
      attempt.failed.push(path);
    });

    if (attempt.remaining.size) {
      return;
    }

    delete this._attempts[docKey];

    const status = !attempt.failed.length
      ? Status.SUCCESS
      : attempt.failed.length === attempt.attempted
      ? Status.FAILED
      : Status.PARTIAL_FAILURE;

    this._store.dispatch(
      actions._setDocStatus(collection, docId, { status, failedFields: attempt.failed })
    );
  }

  /**
   * @returns {String} Key identifying a document across this pipeline's internal maps.
   * @private
   */
  __docKey(collection, docId) {
    return toWireId(collection, docId, "");
  }
}
