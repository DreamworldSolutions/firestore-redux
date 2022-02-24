

class SaveDocs {
  constructor(store) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
  }

  /**
   * Saves documents in redux state + remote.
   *  - Dispatches `FIRESTORE_REDUX_SAVE` redux action.
   *  - Request firestore to save documents.
   *    - On success, resolves promise.
   *    - On failure, rejects promise & dispatches `FIRESTORE_REDUX_DELETE_DOCS_FAILED` action with `prevDocs`
   * @param {String} collection Collection/Subcollection path.
   * @param {Object|Array} docs Single document or list of documents to be saved.
   * @param {Object} options Save options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when saved on firestore, rejected when save fails.
   */
  save(collection, docs, options) {
    return;
  }
}

export default SaveDocs;
