import isArray from "lodash-es/isArray";
import * as actions from "./redux/actions";
import { doc as fsDoc, writeBatch } from "firebase/firestore";
import get from "lodash-es/get";
import forEach from "lodash-es/forEach";
import { v4 as uuidv4 } from "uuid";

class SaveDocs {
  constructor(store, db) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
    this.db = db;
  }

  /**
   * Saves documents in redux state + remote.
   *  - Dispatches `FIRESTORE_REDUX_SAVE` redux action.
   *  - Request firestore to save documents.
   *    - On success, resolves promise.
   *    - On failure, rejects promise & dispatches `FIRESTORE_REDUX_DELETE_DOCS_FAILED` action with `prevDocs`
   * @param {String} collectionPath Collection/Subcollection path.
   * @param {Object|Array} docs Single document or list of documents to be saved.
   * @param {Object} options Save options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when saved on firestore, rejected when save fails.
   */
  save(collectionPath, docs, options) {
    if (!isArray(docs)) {
      docs = [docs];
    }
    forEach(docs, (doc) => {
      if (!doc.id) {
        doc.id = uuidv4();
      }
    });

    const prevState = this.store.getState();
    this.store.dispatch(actions.save(collectionPath, docs, options));

    if (!options.remoteWrite) {
      return;
    }

    this.__remoteWrite(collectionPath, docs, prevState);
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });
  }

  /**
   * Save documents on remote.
   * @param {String} collectionPath Collection/subcollection path.
   * @param {Array} docs Documents to be saved on remote.
   * @param {Object} prevState Previous state.
   * @private
   */
  async __remoteWrite(collectionPath, docs, prevState) {
    let prevDocs = [];
    const batch = writeBatch(this.db);
    forEach(docs, (doc) => {
      const pathSegments = collectionPath.split("/");
      const collection = pathSegments[pathSegments.length - 1];
      prevDocs.push(
        get(prevState, `firestore.docs.${collection}.${doc.id}`, {
          id: doc.id,
          newDoc: true,
        })
      );

      const ref = fsDoc(this.db, ...pathSegments, doc.id);
      batch.set(ref, doc);
    });
    try {
      await batch.commit();
      this.store.dispatch(actions._saveDone(collectionPath, docs));
      this._resolve(docs);
    } catch (error) {
      this.store.dispatch(actions._saveFailed(collectionPath, prevDocs));
      this._reject(error);
    }
  }
}

export default SaveDocs;
