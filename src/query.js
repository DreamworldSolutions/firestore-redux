class Query {
  constructor(store) {
    super();
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;

    // `unsubscribe` method returned by firestore query.
    this.unsubscribe = undefined;
  }

  /**
   * Reads documents of given collection/subcollection from firestore based on given query criteria.
   *  - Dispatches `FIRESTORE_REDUX_QUERY` redux action.
   *  - Requests query on firestore.
   *    - On success, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with `id`, `collection` & `docs` & resolves response promise.
   *    - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with `id` & `error` & resolves response promise.
   * @param {String} id Query Id.
   * @param {String} collection Collection / Subcollectin path.
   * @param {Object} queryCriteria Query criteria. e.g. `{ requesterId, where, orderBy, limit, startAt, endAt, once }`
   */
  query(id, collection, queryCriteria) {
    return;
  }

  /**
   * Cancels query.
   * - Dispatches `CANCEL_QUERY` redux action.
   * - Disconnects firestore query.
   */
  cancel() {
    return;
  }

  /**
   * Loads next page documents from firestore.
   * Note: This will work only when `limit` query criteria is given & query is realtime.
   *  - Dispatches `FIRESTORE_REDUX_LOAD_NEXT_PAGE` redux action
   */
  loadNextPage() {}

  /**
   * Retries if query is failed.
   * - Dispatches `FIRESTORE_REDUX_RETRY_QUERY` redux action if query is failed.
   * - Retries query on firestore.
   */
  retry() {}

  /**
   * @returns {Promise} Promise resolved when query is succeeded or failed.
   */
  response() {}
}

export default Query;
