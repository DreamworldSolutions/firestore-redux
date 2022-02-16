import { getFirestore } from "firebase/firestore";
import firestoreReducer from "./reducers";
import saga from "./saga";
import * as utils from "../utils";
import { v4 as uuidv4 } from "uuid";
import isEmpty from "lodash-es/isEmpty";
import get from "lodash-es/get";
import forEach from "lodash-es/forEach";
import isObject from "lodash-es/isObject";
let DB;

export const INIT = "FIRESTORE_REDUX_INIT";
export const QUERY = "FIRESTORE_REDUX_QUERY";
export const RETRY_QUERY = "FIRESTORE_REDUX_RETRY_QUERY";
export const LOAD_NEXT_PAGE = "FIRESTORE_REDUX_LOAD_NEXT_PAGE";
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
 * Registers saga middleware
 * Adds `firestore` redux reducer.
 * Sets store into firestore utils module.
 * Dispatches `FIRESTORE_REDUX_INIT` action
 * @param {Object} store Redux store
 * @param {Object} sagaMiddleWare Saga Middleware
 * @param {Object} firebaseApp Firebase app. It's optional.
 */
export const init = (store, sagaMiddleware, firebaseApp) => {
  if (!store || !sagaMiddleware) {
    throw "Store or sagaMiddleware is not provided";
  }

  store.addReducers({ firestore: firestoreReducer });
  sagaMiddleware.run(saga);

  const db = getFirestore(firebaseApp);
  DB = db;

  return {
    type: INIT,
    store,
    db,
  };
};

/**
 * Requests new query to the firestore, if it is not running.
 * If id is not provided, creates it.
 * @param {Object} param0
 *  @property {String} id Query Id. It is optional. But if its provided, it must be unique id.
 *  @property {String} requesterId Requester Id.
 *  @property {String} collection Collection / Subcollection path. It is mandatory.
 *  @property {Array} where List of where conditions. It is optional. e.g. [['firstName', '==', 'Nirmal'], ['lastName', '==', 'Baldaniya']]
 *  @property {Array} orderBy List of orderBy fields. It is optional. e.g. [['firstName'], ['age', 'desc']]
 *  @property {Any} startAt The field values to start this query at, in order of the query's order by. It is optional.
 *  @property {Any} startAfter The field values to start this query after, in order of the query's order by. It is optional.
 *  @property {Any} endAt The field values to end this query at, in order of the query's order by. It is optional.
 *  @property {Any} endBefore The field values to end this query before, in order of the query's order by. It is optional.
 *  @property {Number} limit The maximum number of items to return. It is optional.
 *  @property {Boolean} once When `true`, does not subscribe for realtime changes. It is optional.
 */
export const query =
  ({
    id,
    requesterId,
    collection,
    where,
    orderBy,
    startAt,
    startAfter,
    endAt,
    endBefore,
    limit,
    once,
  }) =>
  (dispatch, getState) => {
    if (!DB) {
      throw "firestore-redux => query: Firestore DB instance is not ready yet.";
    }

    id = id || uuidv4();

    if (!isEmpty(get(getState(), `firestore.queries.${id}`))) {
      throw `firestore-redux => query: Provided query id "${id}" exists already. Please provide uniq ID.`;
    }

    // throw Error for mandatory fields.
    if (!collection) {
      throw new Error(
        "firestore-redux => query: Collection is not provided.",
        id,
        requesterId,
        collection
      );
    }

    dispatch({
      type: QUERY,
      id,
      requesterId,
      collection,
      where,
      orderBy,
      startAt,
      startAfter,
      endAt,
      endBefore,
      limit,
      once,
    });
  };

/**
 * Updates current live query.
 * Main purpose of this is for pagination.
 * @param {Object} param0
 *  @property {String} id Query Id.
 *  @property {Number} limit Number of result items.
 */
export const updateQuery =
  ({ id, limit }) =>
  (dispatch, getState) => {
    const query = get(getState(), `firestore.queries.${id}`);
    if (!query || query.status !== "LIVE") {
      throw `firestore-redux: updateQuery => No LIVE query exists with ${id} ID.`;
    }
    dispatch({
      type: LOAD_NEXT_PAGE,
      id,
      limit,
    });
  };

/**
 * Restarts CLOSED or FAILED query by it's query ID.
 * @param {String} id Query ID.
 */
export const restartQuery = (id) => (dispatch, getState) => {
  const query = get(getState(), `firestore.queries.${id}`);
  if (!query || (query.status !== "CLOSED" && query.status !== "FAILED")) {
    throw `firestore-redux: restartQuery => No CLOSED or FAILED query exists with ${id} ID.`;
  }
  dispatch({
    type: RETRY_QUERY,
    id,
  });
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
export const cancelQuery =
  ({ id, requesterId }) =>
  (dispatch, getState) => {
    if (!DB) {
      throw "firestore-redux => cancelQuery: Firestore DB instance is not ready yet.";
    }

    if (!id && !requesterId) {
      throw "firestore-redux: cancelQuery: Mandatory params are not found.";
    }
    const prevState = getState();
    dispatch({
      type: CANCEL_QUERY,
      id,
      requesterId,
      prevState,
    });
  };

/**
 * By defalt saves data in local & remote both
 * When `target` is 'LOCAL', saves data only in local.
 * When `target` is 'REMOTE', saves data only on remote.
 * On success or faulure, dispatches `FIRESTORE_REDUX_SAVE_DONE` or `FIRESTORE_REDUX_SAVE_FAILED` actions.
 * @param {Object} docs Key is the `/` seperated path of document. e.g `users/$userId` & Value is the document. e.g `{'users/$userId': {name, firstNamme, lastName}}`
 *                      Note: Paths must be upto the document.
 * @param {String} target Possible values: `BOTH`, `LOCAL` or `REMOTE`
 */
export const save =
  (docs, target = "BOTH") =>
  (dispatch, getState) => {
    if (!DB) {
      throw "firestore-redux => save: Firestore DB instance is not ready yet.";
    }

    // Throws error when docs is not valid object.
    if (!isObject(docs) || Array.isArray(docs)) {
      throw `firestore-redux: save => Please provide valid documents path / value map.`;
    }

    const prevState = getState();
    dispatch({
      type: SAVE,
      docs,
      target,
      prevState,
    });
  };

/**
 * @param {Object} docs Key value map of path & document. e.g. {"/users/$userId": {"firstName": "Nirmal", "lastName": "Baldaniya"}, ...}
 * @private
 */
export const _saveDone = (docs) => {
  return {
    type: SAVE_DONE,
    docs,
  };
};

/**
 * Resetes documents to it's previous value.
 * @param {Object} prevDocs Previous values of documents. e.g. {$collection: {$docId: $prevDocValue}}
 * @private
 */
export const _saveFailed = (prevDocs) => {
  return {
    type: SAVE_FAILED,
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
export const deleteDocs =
  (paths, target = "BOTH") =>
  (dispatch, getState) => {
    if (!DB) {
      throw "firestore-redux => deleteDocs: Firestore DB instance is not ready yet.";
    }

    // Throws error when paths is not Array.
    if (!Array.isArray(paths)) {
      throw `firestore-redux: deleteDocs => Please provide valid document paths array.`;
    }

    const prevState = getState();
    dispatch({
      type: DELETE_DOCS,
      paths,
      target,
      prevState,
    });
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
