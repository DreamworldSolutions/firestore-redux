import isObject from "lodash-es/isObject";
let DB;

export const QUERY = "FIRESTORE_REDUX_QUERY";
export const QUERY_SNAPSHOT = "FIRESTORE_REDUX_QUERY_SNAPSHOT";
export const QUERY_FAILED = "FIRESTORE_REEUX_QUERY_FAILED";
export const CANCEL_QUERY = "FIRESTORE_REDUX_CANCEL_QUERY";
export const SAVE = "FIRESTORE_REDUX_SAVE";
export const SAVE_DONE = "FIRESTORE_REDUX_SAVE_DONE";
export const SAVE_FAILED = "FIRESTORE_REDUX_SAVE_FAILED";
export const DELETE_DOCS = "FIRESTORE_REDUX_DELETE_DOCS";
export const DELETE_DOCS_DONE = "FIRESTORE_REDUX_DELETE_DOCS_DONE";
export const DELETE_DOCS_FAILED = "FIRESTORE_REDUX_DELETE_DOCS_FAILED";

/**
 * Stores query with PENDING status.
 * @param {Object} param0
 *  @property {String} id Query Id. It is optional. But if its provided, it must be unique id.
 *  @property {String} collection Collection Id. Id of the collection. It is mandatory.
 *  @property {String} documentId Document Id.
 *  @property {String} requesterId Requester Id.
 *  @property {Array} where List of where conditions. It is optional. e.g. [['firstName', '==', 'Nirmal'], ['lastName', '==', 'Baldaniya']]
 *  @property {Array} orderBy List of orderBy fields. It is optional. e.g. [['firstName'], ['age', 'desc']]
 *  @property {Any} startAt The field values to start this query at, in order of the query's order by. It is optional.
 *  @property {Any} startAfter The field values to start this query after, in order of the query's order by. It is optional.
 *  @property {Any} endAt The field values to end this query at, in order of the query's order by. It is optional.
 *  @property {Any} endBefore The field values to end this query before, in order of the query's order by. It is optional.
 *  @property {Number} limit The maximum number of items to return. It is optional.
 *  @property {Boolean} once When `true`, does not subscribe for realtime changes. It is optional.
 *  @property {Boolean} waitTillSucceed When `true`, retries query until it's timeout or cross maximum attempts.
 */
export const query = ({
  id,
  collection,
  documentId,
  requesterId,
  where,
  orderBy,
  startAt,
  startAfter,
  endAt,
  endBefore,
  limit,
  once,
  waitTillSucceed,
}) => {
  return {
    type: QUERY,
    id,
    collection,
    documentId,
    requesterId,
    where,
    orderBy,
    startAt,
    startAfter,
    endAt,
    endBefore,
    limit,
    once,
    waitTillSucceed,
  };
};

/**
 * Updates query result, status & documents in given collection.
 * @param {Object} param0
 *  @property {String} id Query Id
 *  @property {String} collection Collection Id
 *  @property {Array} docs List of documents. e.g. [{ id, data, newIndex, oldIndex}, {id, data: undefined, newIndex, oldIndex}, ...]
 *  @property {String} status Query Status. When query is for once, it is 'CLOSED' otherwise its 'LIVE'.
 * @private
 */
export const _querySnapShot = ({ id, collection, docs, status }) => {
  return {
    type: QUERY_SNAPSHOT,
    id,
    collection,
    docs,
    status,
  };
};

/**
 * Sests status of the query to 'FAILED' & stores error details of given query.
 * @param {Object} param0
 *  @property {String} id Query Id
 *  @property {Object} error Error detail. e.g. {code, message}
 * @private
 */
export const _queryFailed = ({ id, error }) => {
  return {
    type: QUERY_FAILED,
    id,
    error,
  };
};

/**
 * Cancels queries by it's id/requester id.
 * One of the property must have: either `id` or `requesterId`
 * @param {String} id Query Id
 *  @property {String} id Query Id.
 *  @property {String} requesterId Requester Id.
 */
export const cancelQuery = ({ id, requesterId }) => {
  return {
    type: CANCEL_QUERY,
    id,
    requesterId,
  };
};

/**
 * @param {String} collectionPath Collection/subcollection path.
 * @param {Object|Array} docs Single or multiple documents
 * @param {Object} options Options. e.g. { localWrite: true, remoteWrite: true }
 */
export const save = (
  collectionPath,
  docs,
  options = { localWrite: true, remoteWrite: true }
) => {
  return {
    type: SAVE,
    collectionPath,
    docs,
    options,
  };
};

/**
 * @param {String} collection Collection/subcollection ID.
 * @param {Array} docs List of documents.
 * @returns 
 */
export const _saveDone = (collection, docs) => {
  return {
    type: SAVE_DONE,
    collection,
    docs,
  };
};

/**
 * Resetes documents to it's previous value.
 * @param {String} collection Collection/subcollection ID.
 * @param {Array} prevDocs List of documents with its previous value.
 * @private
 */
export const _saveFailed = (collection, prevDocs) => {
  return {
    type: SAVE_FAILED,
    collection,
    prevDocs,
  };
};

/**
 * By default deletes document from local as well as remote.
 * When `target` is 'LOCAL', deletes documents from local state only.
 * When `target` is 'REMOTE', deletes documents from remote only.
 * On success or faulure, dispatches `FIRESTORE_REDUX_DELETE_DONE` or `FIRESTORE_REDUX_DELETE_FAILED` actions.
 * @param {Array} paths List of `/` seperated path. e.g `['users/$userId1', 'users/$userId2']`. Here `users` is the collection name.
 *                      Note: Paths must be upto the document.
 * @param {String} target Possible values: `BOTH`, `LOCAL` or `REMOTE`
 */
export const deleteDocs = (paths, target = "BOTH") => {
  return {
    type: DELETE_DOCS,
    paths,
    target,
  };
};

/**
 * @param {Array} paths List of deleted document's paths.
 * @private
 */
export const _deleteDocsDone = (paths) => {
  return {
    type: DELETE_DOCS_DONE,
    paths,
  };
};

/**
 * Resetes documents to it's previous value.
 * @param {Object} prevDocs Previous values of documents. e.g. {$collection: {$docId: $prevDocValue}}
 * @private
 */
export const _deleteDocsFailed = (prevDocs) => {
  return {
    type: DELETE_DOCS_FAILED,
    prevDocs,
  };
};
