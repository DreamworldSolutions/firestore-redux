import * as actions from "./redux/actions";
import { doc as fsDoc, writeBatch } from "firebase/firestore";
import forEach from "lodash-es/forEach";
import get from "lodash-es/get";
class DeleteDocs {
  constructor(store, db) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
    this.db = db;
  }

  /**
   * Deletes documents from redux state + remote.
   *  - Dispatches `FIRESTORE_REDUX_DELETE` redux action.
   *  - Request firestore to delete documents.
   *    - On success, resolves promise.
   *    - On failure, rejects promise & dispatches `FIRESTORE_REDUX_DELETE_FAILED` action with `prevDocs`
   * @param {String} collectionPath Collection/Subcollection path.
   * @param {String|Array} docIds Single document Id or list of document Ids.
   * @param {Object} options Delete options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when deleted from firestore, rejected when delete fails.
   */
  delete(collectionPath, docIds, options) {
    if (typeof docIds === "string") {
      docIds = [docIds];
    }
    const prevState = this.store.getState();
    this.store.dispatch(actions.deleteDocs(collectionPath, docIds, options));
    if (!options.remoteWrite) {
      return new Promise((resolve) => resolve(docIds));
    }

    this.__remoteDelete(collectionPath, docIds, prevState, options);

    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Deletes documents from remote.
   * @param {String} collectionPath Collection/subcollection path.
   * @param {Array} docIds Document Ids.
   * @param {Object} prevState Previous redux state.
   * @param {Object} options Delete options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @private
   */
  async __remoteDelete(collectionPath, docIds, prevState, options) {
    let prevDocs = [];
    const batch = writeBatch(this.db);
    const pathSegments = collectionPath.split("/");
    const collection = pathSegments[pathSegments.length - 1];

    forEach(docIds, (docId) => {
      const prevDoc = get(prevState, `firestore.docs.${collection}.${docId}`);
      prevDoc && prevDocs.push(prevDoc);
      const ref = fsDoc(this.db, ...pathSegments, docId);
      batch.delete(ref);
    });

    try {
      await batch.commit();
      this.store.dispatch(actions._deleteDone(collection, docIds));
      this._resolve(docIds);
    } catch (error) {
      this.store.dispatch(actions._deleteFailed(collection, prevDocs, options));
      this._reject(error);
    }
  }
}

export default DeleteDocs;
