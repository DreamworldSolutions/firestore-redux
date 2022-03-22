import get from "lodash-es/get";
import values from "lodash-es/values";
import filter from "lodash-es/filter";
import forEach from "lodash-es/forEach";
import { createSelector } from "reselect";
import memoize from "proxy-memoize";

/**
 * @param {Object} state Redux State.
 * @param {String} collection Collection Id
 * @param {String} docId Document Id
 * @returns {Object} Document for given document Id from the given collection with it's local value.
 */
export const doc = (state, collection, docId) =>
  get(state, `firestore.docs.${collection}.${docId}`);

let allDocsFactoryCache = {};
/**
 * @param {String} collection Collection Id
 * @returns {Array} All documents of given collection Id.
 */
export const allDocsFactory = (collection) => {
  if (allDocsFactoryCache[collection]) {
    return allDocsFactoryCache[collection];
  }
  allDocsFactoryCache[collection] = createSelector(
    (state) => get(state, `firestore.docs.${collection}`),
    (docs) => {
      return values(docs);
    }
  );
  return allDocsFactoryCache[collection];
};

let docsByQueryFactoryCache = {};
/**
 * @param {String} queryId Query Id
 * @returns {Array} All documents of given query Id.
 */
export const docsByQueryFactory = (queryId, collection) => {
  if (docsByQueryFactoryCache[queryId]) {
    return docsByQueryFactoryCache[queryId];
  }

  docsByQueryFactoryCache[queryId] = createSelector(
    (state) => get(state, `firestore.queries.${queryId}.result`),
    (state) => get(state, `firestore.docs.${collection}`),
    (result, allDocs) => {
      let docs = [];
      forEach(result, (docId) => {
        allDocs && docs.push(allDocs[docId]);
      });
      return docs;
    }
  );
  return docsByQueryFactoryCache[queryId];
};

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
export const liveQueriesByRequester = createSelector(
  (state, requesterId) => requesterId,
  (state) => get(state, `firestore.queries`),
  (requesterId, queries) => {
    const liveQueries = filter(
      values(queries),
      (query) =>
        (query.status === "LIVE" || query.status === "PENDING") &&
        query.requesterId === requesterId
    );
    return liveQueries.map(({ id }) => id) || [];
  }
);

/**
 * @param {Object} state.
 * @param {String} requesterId.
 * @returns {Array} All queries by requesterId.
 */
export const queriesByRequester = memoize(({ state, requesterId }) => {
  return filter(get(state, `firestore.queries`), { requesterId });
});
