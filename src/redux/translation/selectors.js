import get from "lodash-es/get.js";
import { PENDING } from "../../translation/enums.js";

/**
 * Shared so that every "nothing failed" answer is the same array instance. Returning a fresh `[]`
 * would give callers a new reference on every read, defeating memoized selectors downstream.
 */
const NO_FAILED_FIELDS = Object.freeze([]);

/**
 * @param {Object} state Redux state.
 * @returns {String|undefined} The current target language - a single, app-wide value. `undefined`
 *  until `translation.setLanguage` is called.
 */
export const language = (state) => get(state, `translations.language`);

/**
 * @param {Object} state Redux state.
 * @returns {Object} Whole translation schema, as last set by `translation.setSchema`. `{}` when none
 *  is declared - the automatic defaults then decide what translates.
 */
export const schema = (state) => get(state, `translations.schema`, {});

/**
 * A document's overall translation status, in the current language.
 * @param {Object} state Redux state.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @returns {String} One of `PENDING`, `IN_PROGRESS`, `SUCCESS`, `PARTIAL_FAILURE`, `FAILED` - always
 *  a String, never `undefined`. `PENDING` is synthesized here for a document with no stored entry;
 *  it is never written to state, so callers don't need an existence check before switching on this.
 */
export const status = (state, collection, docId) =>
  get(state, `translations.status.${collection}.${docId}.status`, PENDING);

/**
 * The fields whose translation failed on the most recent attempt.
 * @param {Object} state Redux state.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @returns {Array} Field paths in schema key format, e.g. `['address.city']`. Always an array, never
 *  `undefined` - empty both when `status` is `SUCCESS` and when it is `PENDING`.
 */
export const failedFields = (state, collection, docId) =>
  get(state, `translations.status.${collection}.${docId}.failedFields`, NO_FAILED_FIELDS);
