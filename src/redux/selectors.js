import get from "lodash-es/get";
import values from "lodash-es/values";
import filter from "lodash-es/filter";
import forEach from "lodash-es/forEach";
import memoize from "proxy-memoize";

/**
 * @param {Object} state Redux State.
 * @param {String} collection Collection Id
 * @param {String} docId Document Id
 * @returns {Object} Document for given document Id from the given collection with it's local value.
 */
export const doc = (state, collection, docId) =>
  get(state, `firestore.docs.${collection}.${docId}`);

/**
 * @param0
 *  @property {Object} state Redux state.
 *  @property {collection} collection Collection / Subcollection ID.
 * @returns {Array} All documents of given collection Id.
 */
export const allDocs = memoize(({ state, collection }) => {
  const docs = get(state, `firestore.docs.${collection}`);
  return values(docs);
}, { size: 100 });

/**
 * @param {Object} state Redux state
 * @param {String} collection Collection / Subcollection ID.
 * @returns {Object} Hash of whole collection.
 */
export const collection = (state, collection) => get(state, `firestore.docs.${collection}`);

/**
 * @param0
 *  @property {Object} state Redux state.
 *  @property {String} queryId Query Id
 * @returns {Array} All documents of given query Id.
 */
export const docsByQuery = memoize(({ state, queryId }) => {
  const query = get(state, `firestore.queries.${queryId}`) || {};
  const allDocs = get(state, `firestore.docs.${query.collection}`);
  let docs = [];
  forEach(query.result, (docId) => {
    allDocs && docs.push(allDocs[docId]);
  });
  return docs;
}, { size: 500 });

/**
 * @param {Object} state Redux State.
 * @param {String} id Query Id
 * @returns {Object} Query details. e.g {id, requesterId, request, status, error}
 */
export const query = (state, id) => get(state, `firestore.queries.${id}`, {});

/**
 * @param {Object} state Redux state
 * @param {String} id Query Id
 * @returns {String} Status of the query. Possible values: 'PENDING', 'LIVE' 'CLOSED' or 'FAILED'.
 */
export const queryStatus = (state, id) =>
  get(state, `firestore.queries.${id}.status`, "");

/**
 * @param {Object} state Redux state
 * @param {String} id Query Id
 * @returns {Object} Error dtails of the query. e.g. {code, message}
 */
export const queryError = (state, id) =>
  get(state, `firestore.queries.${id}.error`, {});

/**
 * @param {Object} state Redux state.
 * @param {String} id Query ID
 * @returns {Array} Query result
 */
export const queryResult = (state, id) =>
  get(state, `firestore.queries.${id}.result`, []);

/**
 * @param {String} requesterId Requester Id
 * @returns {Array} List of LIVE query ids e.g. [$queryId1, queryId2, ...]
 */
export const liveQueriesByRequester = memoize(({ state, requesterId }) => {
  const queries = get(state, `firestore.queries`);
  const liveQueries = filter(
    values(queries),
    (query) =>
      (query.status === "LIVE" || query.status === "PENDING") &&
      query.requesterId === requesterId
  );
  return liveQueries.map(({ id }) => id) || [];
}, { size: 100 });

/**
 * @param {Object} state.
 * @param {String} requesterId.
 * @returns {Array} All queries by requesterId.
 */
export const queriesByRequester = memoize(({ state, requesterId }) => {
  return filter(get(state, `firestore.queries`), { requesterId });
});

/**
 * @returns {Boolean} `true` when document exists in another query.
 */
export const isDocumentExistsInAnotherQueryResult = memoize(({ allQueries, queryId, collection, docId }) => {
  let docIds = [];
  forEach(allQueries, (query, id) => {
    if (query.collection === collection && id !== queryId && query.result && query.status === 'LIVE') {
      docIds.push(...query.result);
    }
  });

  return docIds.includes(docId);
})
