export const SET_LANGUAGE = "FIRESTORE_REDUX_TRANSLATION_SET_LANGUAGE";
export const SET_SCHEMA = "FIRESTORE_REDUX_TRANSLATION_SET_SCHEMA";
export const ADD_ACTIVATION = "FIRESTORE_REDUX_TRANSLATION_ADD_ACTIVATION";
export const REMOVE_ACTIVATION = "FIRESTORE_REDUX_TRANSLATION_REMOVE_ACTIVATION";
export const SET_TRANSLATED_DOC = "FIRESTORE_REDUX_TRANSLATION_SET_TRANSLATED_DOC";
export const SET_TRANSLATED_FIELDS = "FIRESTORE_REDUX_TRANSLATION_SET_TRANSLATED_FIELDS";
export const SET_DOC_STATUS = "FIRESTORE_REDUX_TRANSLATION_SET_DOC_STATUS";
export const APPLY_TRANSLATIONS = "FIRESTORE_REDUX_TRANSLATION_APPLY_TRANSLATIONS";
export const REMOVE_DOC_TRANSLATIONS = "FIRESTORE_REDUX_TRANSLATION_REMOVE_DOC_TRANSLATIONS";

/**
 * Replaces the whole schema in one call. A schema is optional - without one, only string fields
 * that don't look numeric, boolean, date/time-shaped or enum-shaped are translated.
 * @param {Object} schema `Map<collectionId, Map<documentId-or-'*', Map<fieldPath, { contentType, skip }>>>`
 */
export const setSchema = (schema) => {
  return {
    type: SET_SCHEMA,
    schema: schema || {},
  };
};

/**
 * Sets the single, app-wide target language every activation translates into. Not per-activation -
 * there is one value for the whole app.
 * @param {String} language Target language.
 */
export const setLanguage = (language) => {
  return {
    type: SET_LANGUAGE,
    language,
  };
};

/**
 * Stores an activation's scope. Activations carry no language of their own.
 * @param {Object} param0
 *  @property {String} id Activation Id, chosen by the caller.
 *  @property {Function} filterFunction `(doc, collection) => Boolean`. Kept as a live in-memory reference.
 * @private
 */
export const _addActivation = ({ id, filterFunction }) => {
  return {
    type: ADD_ACTIVATION,
    id,
    filterFunction,
  };
};

/**
 * Removes an activation. Doesn't touch the documents it covered - see `_removeDocTranslations`.
 * @param {String} id Activation Id.
 * @private
 */
export const _removeActivation = (id) => {
  return {
    type: REMOVE_ACTIVATION,
    id,
  };
};

/**
 * Stores a document's translated clone - a full copy of the original, with translatable fields
 * replaced by their translated values as those arrive.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @param {Object} doc Translated clone.
 * @private
 */
export const _setTranslatedDoc = (collection, docId, doc) => {
  return {
    type: SET_TRANSLATED_DOC,
    collection,
    docId,
    doc,
  };
};

/**
 * Writes translated values into an existing clone, leaving every other field of it untouched.
 * No-op when the document has no clone yet.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @param {Object} fields Map of field path to its translated value. e.g. `{ 'owner.name': 'निर्मल' }`
 * @private
 */
export const _setTranslatedFields = (collection, docId, fields) => {
  return {
    type: SET_TRANSLATED_FIELDS,
    collection,
    docId,
    fields,
  };
};

/**
 * Stores a document's translation status, in its own branch so it can never collide with a real
 * document field named `status` or `failedFields`.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @param {Object} param2
 *  @property {String} status One of `IN_PROGRESS`, `SUCCESS`, `PARTIAL_FAILURE`, `FAILED`.
 *  @property {Array} failedFields Field paths that failed on the most recent attempt.
 * @private
 */
export const _setDocStatus = (collection, docId, { status, failedFields }) => {
  return {
    type: SET_DOC_STATUS,
    collection,
    docId,
    status,
    failedFields,
  };
};

/**
 * Applies many documents' translation results in a single dispatch.
 *
 * The per-document actions above each notify every store subscriber, and a translate response covers
 * up to `MAX_ITEMS_PER_REQUEST` items spanning as many documents - dispatching per document made the
 * app re-render once per document instead of once per response. On a large board that is the
 * difference between a responsive page and a frozen one.
 *
 * @param {Array} entries `[{ collection, docId, doc, fields, status, failedFields }]`. Every field
 *  past `docId` is optional: `doc` seeds the translated clone, `fields` merges values into it, and
 *  `status`/`failedFields` record the outcome. Applied in the order given.
 */
export const _applyTranslations = (entries) => {
  return {
    type: APPLY_TRANSLATIONS,
    entries,
  };
};

/**
 * Removes many documents' translations in a single dispatch.
 *
 * Stopping an activation drops every document it covered, and a large board covers thousands - one
 * dispatch each would re-render the whole app once per document, which is what made stopping a
 * "View As" session appear to freeze.
 *
 * @param {Array} docs `[{ collection, docId }]` to remove.
 */
export const _removeDocTranslations = (docs) => {
  return {
    type: REMOVE_DOC_TRANSLATIONS,
    docs,
  };
};
