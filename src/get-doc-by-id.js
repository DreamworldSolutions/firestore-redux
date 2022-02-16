

class GetDocById {
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
   * Reads single document of given collection/subcollection from firestore.
   *  - Dispatches `FIRESTORE_REDUX_QUERY` redux action.
   *  - Requests query on firestore.
   *    - On success, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with `id`, `collection` & `docs` & resolves response promise.
   *    - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with `id` & `error` & resolves response promise.
   * @param {String} id Query Id.
   * @param {String} collection Collection/Subcollection path.
   * @param {String} documentId Document ID.
   * @param {Object} options Options. e.g. {requesterId, once }`
   */
  getDoc(id, collection, documentId, options) {
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

export default GetDocById;
