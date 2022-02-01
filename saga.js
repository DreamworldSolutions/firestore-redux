import { takeEvery, all, put, call, select } from "redux-saga/effects";
import {
  collectionGroup,
  getDocs,
  onSnapshot,
  writeBatch,
  doc as fsDoc,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  startAt as fsStartAt,
  startAfter as fsStartAfter,
  endAt as fsEndAt,
  endBefore as fsEndBefore,
  limit as fsLimit,
} from "firebase/firestore";
import * as actions from "./actions";
import * as selectors from "./selectors";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";

let STORE;
let DB;
let LIVE_QUERIES =
  {}; /* e.g. { $queryId1: unsubscribe1, $queryId2: unsubscribe2, $queryId3: unsubscribe3 */

/**
 * Sets Database instances.
 * @param {Object} param0
 *  @property {Object} store Redux store.
 *  @property {db} db Database instance.
 */
function* init({ store, db }) {
  STORE = store;
  DB = db;
}

/**
 * @param {Array} where List of where conditions.
 * @returns List of firestore where methods e.g. [where("firstName", "==", "Nirmal"), where("lastSeen", ">=", 1929939939399)]
 */
function* getWhereCriteria(where) {
  let arr = [];
  try {
    Array.isArray(where) &&
      forEach(where, (val) => {
        if (!Array.isArray(val) || val.length !== 3) {
          throw new Error("Invalid where condition provided", where);
        }
        arr.push(fsWhere(get(val, "0"), get(val, "1"), get(val, "2")));
      });
  } catch (err) {
    throw err;
  }
  return arr;
}

/**
 * @param {Array} orderBy List of orderBy conditions.
 * @returns List of firestore orderBy methods e.g. [orderBy("firstName", "asc"), orderBy("lastSeen", "desc")]
 */
function* getOrderByCriteria(orderBy) {
  let arr = [];
  try {
    Array.isArray(orderBy) &&
      forEach(orderBy, (val) => {
        if (!Array.isArray(val)) {
          throw new Error("Invalid orderBy provided", orderBy);
        }
        arr.push(fsOrderBy(get(val, "0"), get(val, "1")));
      });
  } catch (err) {
    throw err;
  }
  return arr;
}

/**
 * @param {Any} startAt
 * @returns {Array} firestore startAt method e.g. [startAt(1000)]
 */
function* getStartAtCriteria(startAt) {
  return startAt !== undefined ? [fsStartAt(startAt)] : [];
}

/**
 * @param {Any} startAfter
 * @returns {Array} firestore startAfter method e.g. [startAfter(1000)]
 */
function* getStartAfterCriteria(startAfter) {
  return startAfter !== undefined ? [fsStartAfter(startAfter)] : [];
}

/**
 * @param {Any} endAt
 * @returns {Array} firestore endAt method e.g. [endAt(1000)]
 */
function* getEndAtCriteria(endAt) {
  return endAt !== undefined ? [fsEndAt(endAt)] : [];
}

/**
 * @param {Any} endBefore
 * @returns {Array} firestore endBefore method e.g. [endBefore(1000)]
 */
function* getEndBeforeCriteria(endBefore) {
  return endBefore !== undefined ? [fsEndBefore(endBefore)] : [];
}

/**
 * @param {Number} limit
 * @returns {Array} firestore endBefore method e.g. [limit(1000)]
 */
function* getLimitCriteria(limit) {
  return limit !== undefined ? [fsLimit(limit)] : [];
}

/**
 * Requests query on firestore based on given criteria.
 */
function* query({
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
}) {
  const whereCriteria = yield call(getWhereCriteria, where);
  const orderByCriteria = yield call(getOrderByCriteria, orderBy);
  const startAtCriteria = yield call(getStartAtCriteria, startAt);
  const startAfterCriteria = yield call(getStartAfterCriteria, startAfter);
  const endAtCriteria = yield call(getEndAtCriteria, endAt);
  const endBeforeCriteria = yield call(getEndBeforeCriteria, endBefore);
  const limitCriteria = yield call(getLimitCriteria, limit);

  let params = arguments[0];
  params.q = fsQuery(
    collectionGroup(DB, collection),
    ...whereCriteria,
    ...orderByCriteria,
    ...startAtCriteria,
    ...startAfterCriteria,
    ...endAtCriteria,
    ...endBeforeCriteria,
    ...limitCriteria
  );

  if (once) {
    yield call(queryOnce, params);
  } else {
    yield call(queryRealTime, params);
  }
}

/**
 * Requests one time query to firestore by given query criteria.
 *  - On successfull query, dispatches `QUERY_SNAPSHOT` action with query Id & docs.
 *  - On failure, dispatches `QUERY_FAILED` action with error details.
 */
function* queryOnce({ q, id, collection }) {
  try {
    const snapshot = yield call(getDocs, q);
    let docs = [];
    let i = 0;
    snapshot.forEach((doc) => {
      docs.push({
        id: doc.id,
        data: doc.data(),
        newIndex: i,
        oldIndex: -1,
      });
      i += 1;
    });
    STORE.dispatch(
      actions._querySnapShot({ id, collection, docs, status: "CLOSED" })
    );
    return;
  } catch (error) {
    STORE.dispatch(
      actions._queryFailed({
        id,
        error: { code: error.code, message: error.message },
      })
    );
    console.error(
      `Error whilde reading one time data from ${collection} => `,
      error,
      arguments[0]
    );
  }
}

/**
 * Requests one time query to firestore by given query criteria.
 *  - On result update, dispatches `QUERY_SNAPSHOT` action with query Id & docs.
 *  - On failure, dispatches `QUERY_FAILED` action with error details.
 */
function* queryRealTime({ q, id, collection }) {
  LIVE_QUERIES[id] = onSnapshot(
    q,
    (snapshot) => {
      const docs = [];
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          docs.push({
            id: change.doc.id,
            data: change.doc.data(),
            newIndex: change.newIndex,
            oldIndex: change.oldIndex,
          });
        }
        if (change.type === "modified") {
          docs.push({
            id: change.doc.id,
            data: change.doc.data(),
            newIndex: change.newIndex,
            oldIndex: change.oldIndex,
          });
        }
        if (change.type === "removed") {
          docs.push({
            id: change.doc.id,
            data: undefined,
            newIndex: change.newIndex,
            oldIndex: change.oldIndex,
          });
        }
      });
      STORE.dispatch(
        actions._querySnapShot({ id, collection, docs, status: "LIVE" })
      );
    },
    (error) => {
      const unsubscribe = get(LIVE_QUERIES, `${id}`);
      unsubscribe && unsubscribe() && delete LIVE_QUERIES[id];
      STORE.dispatch(
        actions._queryFailed({
          id,
          error: { code: error.code, message: error.message },
        })
      );
      console.error(
        `Error whilde reading realtime data from ${collection} => `,
        error,
        arguments[0]
      );
    }
  );
}

/**
 * Updates LIVE query to fetch more records.
 * @param {Object} param0
 *  @property {String} id Query Id.
 *  @property {Number} limit The maximum number of items in result.
 */
function* updateQuery({ id, limit }) {
  const unsubscribe = get(LIVE_QUERIES, `${id}`);
  if (unsubscribe) {
    unsubscribe();
    delete LIVE_QUERIES[id];
  }
  const state = yield select();
  const query = selectors.query(state, id);
  const params = {
    id,
    requesterId: query.requesterId,
    collection: query.collection,
    where: get(query, "request.where"),
    orderBy: get(query, "request.orderBy"),
    startAt: get(query, "request.startAt"),
    startAfter: get(query, "request.startAfter"),
    endAt: get(query, "request.endAt"),
    endBefore: get(query, "request.endBefore"),
    limit,
  };
  yield call(query, params);
}

/**
 * Restarts CLOSED or FAILED query again.
 * @param {String} id Query Id.
 */
function* restartQuery(id) {
  const state = yield select();
  const query = selectors.query(state, id);
  const params = {
    id,
    requesterId: query.requesterId,
    collection: query.collection,
    where: get(query, "request.where"),
    orderBy: get(query, "request.orderBy"),
    startAt: get(query, "request.startAt"),
    startAfter: get(query, "request.startAfter"),
    endAt: get(query, "request.endAt"),
    endBefore: get(query, "request.endBefore"),
    limit: get(query, "request.limit"),
    once: query.once,
  };
  yield call(query, params);
}

/**
 * Unsubscrive query/queries by it's id/requesterId.
 * @param {Object} param0
 *  @property {String} id Query Id.
 *  @property {String} requesterId Requester Id.
 *  @property {Object} prevState Previous redux state. i.e. The state before reducer updated the query status.
 */
function* cancelQuery({ id, requesterId, prevState }) {
  if (id) {
    const unsubscribe = get(LIVE_QUERIES, `${id}`);
    if (unsubscribe) {
      unsubscribe();
      delete LIVE_QUERIES[id];
    }
    return;
  }

  const res = yield put(actions.waitTillQueryResponse, `test-q`);
  console.log({ res });

  if (requesterId) {
    const liveQueries = selectors.liveQueriesByRequester(
      get(prevState, `firestore.queries`),
      requesterId
    );
    forEach(liveQueries, (id) => {
      const unsubscribe = get(LIVE_QUERIES, `${id}`);
      if (unsubscribe) {
        unsubscribe();
        delete LIVE_QUERIES[id];
      }
    });
  }
}

/**
 * When target is `REMOTE` or `BOTH`, saves docs on the firestore.
 * On success, dispatches `FIRESTORE_REDUX_SAVE_DONE` action
 * On failure, dispatches `FIRESTORE_REDUX_SAVE_FAILED` action with previous documents values.
 * @param {Object} param0
 *  @property {Object} docs Key/value map of document path & document.
 *  @property {String} target Possible values: 'BOTH', 'LOCAL' & 'REMOTE'
 *  @property {Object} prevState Previous redux state. i.e. The state before reducer added docs in state.
 */
function* save({ docs, target = "BOTH", prevState }) {
  if (target === "LOCAL") {
    return;
  }

  let prevDocs = {};
  const batch = writeBatch(DB);

  forEach(docs, (doc, path) => {
    const pathSegments = path.split("/");
    // Prepares previous state of documents. It resets those documents when firestore write is failed.
    if (target === "BOTH") {
      const collection = pathSegments[pathSegments.length - 2];
      const docId = pathSegments[pathSegments.length - 1];
      prevDocs[collection] = prevDocs[collection] || {};
      prevDocs[collection][docId] = get(
        prevState,
        `firestore.docs.${collection}.${docId}`
      );
    }
    const ref = fsDoc(DB, ...pathSegments);
    batch.set(ref, doc);
  });
  try {
    yield call(batch.commit.bind(batch));
    yield put(actions._saveDone(docs));
  } catch (error) {
    yield put(actions._saveFailed(prevDocs));
    console.error("Failed to save documents", error, pathSegments);
  }
}

/**
 * When target is `REMOTE` or `BOTH`, deletes docs from the firestore.
 * On success, dispatches `FIRESTORE_REDUX_DELETE_DONE` action
 * On failure, dispatches `FIRESTORE_REDUX_DELETE_FAILED` action with previous documents values.
 * @param {Object} param0
 *  @property {Array} paths List of `/` seperated documents paths.
 *  @property {String} target Possible values: 'BOTH', 'LOCAL' & 'REMOTE'
 *  @property {Object} prevState Previous redux state. i.e. The state before reducer deleted docs from state.
 */
function* deleteDocs({ paths, target, prevState }) {
  if (target === "LOCAL") {
    return;
  }

  let prevDocs = {};
  const batch = writeBatch(DB);

  forEach(paths, (path) => {
    const pathSegments = path.split("/");
    // Prepares previous state of documents. It resets those documents when firestore delete is failed.
    if (target === "BOTH") {
      const collection = pathSegments[pathSegments.length - 2];
      const docId = pathSegments[pathSegments.length - 1];
      prevDocs[collection] = prevDocs[collection] || {};
      prevDocs[collection][docId] = get(
        prevState,
        `firestore.docs.${collection}.${docId}`
      );
    }
    const ref = fsDoc(DB, ...pathSegments);
    batch.delete(ref);
  });
  try {
    yield call(batch.commit.bind(batch));
    yield put(actions._deleteDocsDone(paths));
  } catch (error) {
    yield put(actions._deleteDocsFailed(prevDocs));
    console.error("Failed to delete documents", error, paths);
  }
}

/**
 * Init Saga.
 */
function* saga() {
  yield all([
    takeEvery(actions.INIT, init),
    takeEvery(actions.QUERY, query),
    takeEvery(actions.UPDATE_QUERY, updateQuery),
    takeEvery(actions.RESTART_QUERY, restartQuery),
    takeEvery(actions.CANCEL_QUERY, cancelQuery),
    takeEvery(actions.SAVE, save),
    takeEvery(actions.DELETE_DOCS, deleteDocs),
  ]);
}

export default saga;
