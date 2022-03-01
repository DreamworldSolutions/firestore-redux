import * as actions from "./redux/actions";
import * as selectors from "./redux/selectors";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";

import {
  collectionGroup,
  getDocs,
  onSnapshot,
  query as fsQuery,
  where as fsWhere,
  orderBy as fsOrderBy,
  startAt as fsStartAt,
  startAfter as fsStartAfter,
  endAt as fsEndAt,
  endBefore as fsEndBefore,
  limit as fsLimit,
} from "firebase/firestore";
class Query {
  constructor(store, db) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
    this.db = db;
    // `unsubscribe` method returned by firestore onSnapshot.
    this._unsubscribe = undefined;
  }

  /**
   * Reads documents of given collection/subcollection from firestore based on given query criteria.
   *  - Dispatches `FIRESTORE_REDUX_QUERY` redux action.
   *  - Requests query on firestore.
   *    - On success, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with `id`, `collection` & `docs` & resolves response promise.
   *    - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with `id` & `error` & resolves response promise.
   * @param {String} id Query Id.
   * @param {String} collection Collection / Subcollectin Id.
   * @param {Object} criteria Query criteria. e.g. `{ requesterId, where, orderBy, limit, startAt, endAt, once }`
   */
  query(id, collection, criteria = {}) {
    this.id = id;
    this._collection = collection;
    this._criteria = criteria;
    if (criteria.limit && !this._initialQueryLimit) {
      this._initialQueryLimit = criteria.limit;
    }

    const requesterId = criteria.requesterId;
    const where = criteria.where;
    const orderBy = criteria.orderBy;
    const startAt = criteria.startAt;
    const startAfter = criteria.startAfter;
    const endAt = criteria.endAt;
    const endBefore = criteria.endBefore;
    const limit = criteria.limit;
    const once = criteria.once;
    const waitTillSucceed = criteria.waitTillSucceed;

    this.store.dispatch(
      actions.query({
        id,
        collection,
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
      })
    );

    const whereCriteria = this.__getWhereCriteria(where);
    const orderByCriteria = this.__getOrderByCriteria(orderBy);
    const startAtCriteria = this.__getStartAtCriteria(startAt);
    const startAfterCriteria = this.__getStartAfterCriteria(startAfter);
    const endAtCriteria = this.__getEndAtCriteria(endAt);
    const endBeforeCriteria = this.__getEndBeforeCriteria(endBefore);
    const limitCriteria = this.__getLimitCriteria(limit);

    let params = { id, collection };
    params.q = fsQuery(
      collectionGroup(this.db, collection),
      ...whereCriteria,
      ...orderByCriteria,
      ...startAtCriteria,
      ...startAfterCriteria,
      ...endAtCriteria,
      ...endBeforeCriteria,
      ...limitCriteria
    );

    this.result = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    if (once) {
      this.__queryOnce(params);
    } else {
      this.__queryRealTime(params);
    }
  }

  /**
   * - Disconnects firestore query.
   */
  cancel() {
    this.__unsubscribe();
  }

  /**
   * Loads next page documents from firestore.
   * Note: This will work only when `limit` query criteria is given & query is realtime.
   */
  loadNextPage() {
    if (!this._initialQueryLimit) {
      throw "firestore-redux > loadNextPage: Limit criteria is not provided.";
    }
    this.__unsubscribe();
    this._criteria.limit = this._criteria.limit + this._initialQueryLimit;
    this.query(this.id, this._collection, this._criteria);
  }

  /**
   * Retries if query is failed.
   * - Retries query on firestore.
   */
  retry() {}

  /**
   * Requests one time query to firestore by given query criteria.
   *  - On successfull query, dispatches `QUERY_SNAPSHOT` action with query Id & docs.
   *  - On failure, dispatches `QUERY_FAILED` action with error details.
   */
  async __queryOnce({ q, id, collection }) {
    try {
      const snapshot = await getDocs(q);
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
      this.store.dispatch(
        actions._querySnapShot({ id, collection, docs, status: "CLOSED" })
      );
      const result = selectors.docsByQueryFactory(id, collection)(
        this.store.getState(),
        collection
      );
      this._resolve(result);
    } catch (error) {
      this.__onQueryFailed(error);
    }
  }

  /**
   * Requests real time query to firestore by given query criteria.
   *  - On result update, dispatches `QUERY_SNAPSHOT` action with query Id & docs.
   *  - On failure, dispatches `QUERY_FAILED` action with error details.
   */
  __queryRealTime({ q, id, collection }) {
    let queryResolved;
    this._unsubscribe = onSnapshot(
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
        this.store.dispatch(
          actions._querySnapShot({ id, collection, docs, status: "LIVE" })
        );
        if (!queryResolved) {
          const result = selectors.docsByQueryFactory(
            id,
            collection
          )(this.store.getState());
          this._resolve(result);
          queryResolved = true;
        }
      },
      (error) => {
        this.__onQueryFailed(error);
      }
    );
  }

  /**
   * @param {Array} where List of where conditions.
   * @returns List of firestore where methods e.g. [where("firstName", "==", "Nirmal"), where("lastSeen", ">=", 1929939939399)]
   * @private
   */
  __getWhereCriteria(where) {
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
   * @private
   */
  __getOrderByCriteria(orderBy) {
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
   * @private
   */
  __getStartAtCriteria(startAt) {
    return startAt !== undefined ? [fsStartAt(startAt)] : [];
  }

  /**
   * @param {Any} startAfter
   * @returns {Array} firestore startAfter method e.g. [startAfter(1000)]
   */
  __getStartAfterCriteria(startAfter) {
    return startAfter !== undefined ? [fsStartAfter(startAfter)] : [];
  }

  /**
   * @param {Any} endAt
   * @returns {Array} firestore endAt method e.g. [endAt(1000)]
   * @private
   */
  __getEndAtCriteria(endAt) {
    return endAt !== undefined ? [fsEndAt(endAt)] : [];
  }

  /**
   * @param {Any} endBefore
   * @returns {Array} firestore endBefore method e.g. [endBefore(1000)]
   * @private
   */
  __getEndBeforeCriteria(endBefore) {
    return endBefore !== undefined ? [fsEndBefore(endBefore)] : [];
  }

  /**
   * @param {Number} limit
   * @returns {Array} firestore endBefore method e.g. [limit(1000)]
   * @private
   */
  __getLimitCriteria(limit) {
    return limit !== undefined ? [fsLimit(limit)] : [];
  }

  /**
   * @param {Object} error Error details.
   * @private
   */
  __onQueryFailed(error) {
    this.__unsubscribe();

    this.store.dispatch(
      actions._queryFailed({
        id: this.id,
        error: { code: error.code, message: error.message },
      })
    );
    this._reject(error);
  }

  /**
   * Unsubscribes firestore query.
   * @private
   */
  __unsubscribe() {
    this._unsubscribe && this._unsubscribe();
    this._unsubscribe = undefined;
  }
}

export default Query;
