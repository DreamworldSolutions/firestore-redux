import get from "lodash-es/get";
import values from "lodash-es/values";
import filter from "lodash-es/filter";

/**
 * @param {Object} state Redux State.
 * @param {String} collection Collection Id
 * @param {String} docId Document Id
 * @returns {Object} Document for given document Id from the given collection with it's local value.
 */
export const doc = (state, collection, docId) =>
  get(state, `firestore.docs.${collection}.${docId}`);

/**
 * @param {Object} state Redux State.
 * @param {String} collection Collection Id
 * @returns {Array} All documents for given collection Id with it's local value.
 */
export const docs = (state, collection) =>
  values(get(state, `firestore.docs.${collection}`));

/**
 * @returns {Array} All documents of given queryId & collection id.
 */
export const docsByQueryId = createSelector(
  (state, collection, queryId) => query(state, queryId),
  docs,
  (query, docs) => {}
);

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
 * @param {Object} queries List of queries e.g. {$queryId1: {id, requesterId, request, result}, $queryId2: {id, requesterId, request, result}}
 * @param {String} requesterId Requester Id
 * @returns {Array} List of LIVE query ids e.g. [$queryId1, queryId2, ...]
 */
export const liveQueriesByRequester = (queries, requesterId) => {
  const liveQueries = filter(
    values(queries),
    (query) => query.status === "LIVE" && query.requesterId === requesterId
  );
  return liveQueries.map(({ id }) => id);
};
