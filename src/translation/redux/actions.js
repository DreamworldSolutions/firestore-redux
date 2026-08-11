export const SET_LANGUAGE = "FIRESTORE_REDUX_TRANSLATION_SET_LANGUAGE";
export const SET_SCHEMA = "FIRESTORE_REDUX_TRANSLATION_SET_SCHEMA";
export const ADD_ACTIVATION = "FIRESTORE_REDUX_TRANSLATION_ADD_ACTIVATION";
export const REMOVE_ACTIVATION = "FIRESTORE_REDUX_TRANSLATION_REMOVE_ACTIVATION";
export const SET_TRANSLATED_DOC = "FIRESTORE_REDUX_TRANSLATION_SET_TRANSLATED_DOC";
export const SET_DOC_STATUS = "FIRESTORE_REDUX_TRANSLATION_SET_DOC_STATUS";
export const REMOVE_DOC_TRANSLATION = "FIRESTORE_REDUX_TRANSLATION_REMOVE_DOC_TRANSLATION";

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
 * Sets the single, app-wide target language every activation translates into.
 * @param {String} language Target language.
 * @private
 */
export const _setLanguage = (language) => {
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
 * Removes an activation. Doesn't touch the documents it covered - see `_removeDocTranslation`.
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
 * Removes a document's `docs` and `status` entries together.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @private
 */
export const _removeDocTranslation = (collection, docId) => {
  return {
    type: REMOVE_DOC_TRANSLATION,
    collection,
    docId,
  };
};
