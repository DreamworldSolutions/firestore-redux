import get from "lodash-es/get.js";
import values from "lodash-es/values.js";
import filter from "lodash-es/filter.js";
import forEach from "lodash-es/forEach.js";
import uniq from "lodash-es/uniq.js";
import { createSelector } from 'reselect';
import isEqual from "lodash-es/isEqual.js";

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
export const allDocs = createSelector(
  (state, collection) => get(state, `firestore.docs.${collection}`),
  (docs) => {
    return values(docs);
  },
  { maxSize: 500, resultEqualityCheck: isEqual }
);

/**
 * @param {Object} state Redux state
 * @param {String} collection Collection / Subcollection ID.
 * @returns {Object} Hash of whole collection.
 */
export const collection = (state, collection) =>
  get(state, `firestore.docs.${collection}`);


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

export const queryStatus = (state, id) => get(state, `firestore.queries.${id}.status`, "");

/**
 * @param {Object} state Redux state
 * @param {String} id Query Id
 * @returns {Object} Error dtails of the query. e.g. {code, message}
 */
export const queryError = (state, id) => get(state, `firestore.queries.${id}.error`, {});

/**
 * @param {Object} state
 * @param {String} id Query Id
 * @returns {Array} Local write result.
 */
export const localWriteResult = (state, id) => get(state, `firestore.queries.${id}.localWriteResult`, []);

/**
 * @param {Object} state
 * @param {String} id Query Id
 * @returns {Array} Pending result.
 */
export const pendingResult = (state, id) => get(state, `firestore.queries.${id}.pendingResult`, []);

/**
 * @param {Object} state Redux state.
 * @param {String} id Query ID
 * @returns {Array} Query result
 */
export const queryResult = createSelector(
  (state, id) => get(state, `firestore.queries.${id}.result`, []),
  localWriteResult,
  (result, localResult) => {
    return [...result, ...localResult];
  },
  { maxSize: 500, resultEqualityCheck: isEqual });

/**
 * @param0
 *  @property {Object} state Redux state.
 *  @property {String} queryId Query Id
 * @returns {Array} All documents of given query Id.
 */
export const docsByQuery = createSelector(
  (state, queryId) => get(state, `firestore.queries.${queryId}.collection`),
  queryResult,
  (state, queryId) => get(state, `firestore.docs`),
  (queryCollection, queryResult, allDocs) => {
    if(!queryCollection) {
      return [];
    }

    allDocs = get(allDocs, queryCollection);
    let docs = [];
    forEach(queryResult, (docId) => {
      allDocs && docs.push(allDocs[docId]);
    });
    return docs;
  },
  { maxSize: 500, resultEqualityCheck: isEqual }
);

/**
 * @param0
 *  @property {Object} state Redux state.
 *  @property {String} queryId Query Id
 *  @property {String} collection collection name.
 * @returns {Array} All documents of given query Id.
 */
export const docsByQueryResult = createSelector(
  queryResult,
  (state, queryId, collection) => get(state, `firestore.docs.${collection}`),
  (result, allDocs) => {
    let docs = [];
    forEach(result, (docId) => {
      allDocs && allDocs[docId] && docs.push(allDocs[docId]);
    });
    return docs;
  },
  { maxSize: 1000, resultEqualityCheck: isEqual }
);

/**
 * @param {String} requesterId Requester Id
 * @returns {Array} List of LIVE query ids e.g. [$queryId1, queryId2, ...]
 */
export const liveQueriesByRequester = createSelector(
  (state, requesterId) => requesterId,
  (state, requesterId) => get(state, `firestore.queries`),
  (requesterId, queries) => {
    const liveQueries = filter(
      values(queries),
      (query) =>
        (query.status === "LIVE" || query.status === "PENDING") &&
        query.requesterId === requesterId
    );
    return liveQueries.map(({ id }) => id) || [];
  },
  { maxSize: 500, resultEqualityCheck: isEqual }
);

/**
 * @param {Object} state.
 * @param {String} requesterId.
 * @returns {Array} All queries by requesterId.
 */
export const queriesByRequester = createSelector(
  (state, requesterId) => requesterId,
  (state, requesterId) => get(state, `firestore.queries`),
  (requesterId, allQueries) => {
    return filter(allQueries, { requesterId });
  },
  { maxSize: 100, resultEqualityCheck: isEqual }
);

/**
 * @returns {Array} uniq document ids of all LIVE queries.
 */
export const anotherLiveQueriesResult = ({ allQueries, collection, queryId }) => _anotherLiveQueriesResult(allQueries, collection, queryId);
const _anotherLiveQueriesResult = createSelector(
  (allQueries, collection, queryId) => allQueries,
  (allQueries, collection, queryId) => collection,
  (allQueries, collection, queryId) => queryId,
  (allQueries, collection, queryId) => {
    let docIds = [];
    forEach(allQueries, (query) => {
      const result = query.result || [];
      const localResult = query.localWriteResult || [];
      const result2 = [...result, ...localResult];
      if (
        queryId !== query.id &&
        query.collection === collection &&
        result2 && result2.length &&
        query.status === "LIVE"
      ) {
        docIds.push(...result2);
      }
    });
    return uniq(docIds);
  },
  { maxSize: 100, resultEqualityCheck: isEqual }
);

/**
 * @returns {Array} Closed queries result.
 */
export const closedQueriesResult = ({ allQueries, collection, requesterId }) => _closedQueriesResult(allQueries, collection, requesterId);
const _closedQueriesResult = createSelector(
  (allQueries, collection, requesterId) => allQueries,
  (allQueries, collection, requesterId) => collection,
  (allQueries, collection, requesterId) => requesterId,
  (allQueries, collection, requesterId) => {
    let docIds = [];
    forEach(allQueries, (query) => {
      if (
        query.collection === collection &&
        query.result &&
        query.status === "CLOSED" &&
        !query.once &&
        !query.request.documentId &&
        query.requesterId &&
        query.requesterId === requesterId
      ) {
        docIds.push(...query.result);
      }
    });
    return uniq(docIds);
  },
  { maxSize: 100, resultEqualityCheck: isEqual }
);

export const getQueryId = ({collection, criteria}) => _getQueryId(collection, criteria);
const _getQueryId = createSelector(
  (collection, criteria) => criteria,
  (collection, criteria) => collection,
  (criteria, collection) => {
    let id = `${collection}`;
    criteria && forEach(criteria.where, (value) => {
      id += `_${value[0]}-${value[2]}`;
    });

    criteria && forEach(criteria.orderBy, (value) => {
      const order = value[1] || 'asc';
      id += `_${value[0]}-${order}`;
    });

    if(criteria && criteria.documentId){
      id += `_${criteria.documentId}`;
    }

    if(criteria && criteria.startAt){
      id += `_startAt-${criteria.startAt}`;
    }

    if(criteria && criteria.startAfter){
      id += `_startAfter-${criteria.startAfter}`;
    }

    if(criteria && criteria.endAt){
      id += `_endAt-${criteria.endAt}`;
    }

    if(criteria && criteria.endBefore){
      id += `_endBefore-${criteria.endBefore}`;
    }

    if(criteria && criteria.limit){
      id += `_limit-${criteria.limit}`;
    }

    if(criteria && criteria.once){
      id += `_once`;
    }

    if(criteria && criteria.waitTillSucceed){
      id += `_waitTillSucceed`;
    }

    return id;
  },
  { maxSize: 500, resultEqualityCheck: isEqual }
);
