class DeleteDocs {
  constructor(store) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
  }

  /**
   * Deletes documents from redux state + remote.
   *  - Dispatches `FIRESTORE_REDUX_DELETE_DOCS` redux action.
   *  - Request firestore to delete documents.
   *    - On success, resolves promise.
   *    - On failure, rejects promise & dispatches `FIRESTORE_REDUX_SAVE_FAILED` action with `prevDocs`
   * @param {String} collection Collection/Subcollection path.
   * @param {String|Array} docIds Single document Id or list of document Ids.
   * @param {Object} options Delete options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when deleted from firestore, rejected when delete fails.
   */
  delete(collection, docIds, options) {
    return;
  }
}

export default DeleteDocs;