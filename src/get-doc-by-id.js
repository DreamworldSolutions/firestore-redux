import * as actions from "./redux/actions";
import * as selectors from "./redux/selectors";
import {
  doc as fsDoc,
  getDoc as fsGetDoc,
  onSnapshot,
} from "firebase/firestore";

class GetDocById {
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
   * Reads single document of given collection/subcollection from firestore.
   *  - Dispatches `FIRESTORE_REDUX_QUERY` redux action.
   *  - Requests on firestore.
   *    - On success, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with `id`, `collection` & `docs` & resolves response promise.
   *    - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with `id` & `error` & resolves response promise.
   * @param {String} id Request Id.
   * @param {String} collectionPath Collection/Subcollection path.
   * @param {String} documentId Document ID.
   * @param {Object} options Options. e.g. {requesterId, once, waitTillSucceed }`
   */
  getDoc(id, collectionPath, documentId, options) {
    this.id = id;
    this._collectionPath = collectionPath;
    this._documentId = documentId;
    this._options = options;
    const pathSegments = collectionPath.split("/");
    const collection = pathSegments[pathSegments.length - 1];

    this.store.dispatch(
      actions.query({
        id,
        collection,
        documentId,
        requesterId: options.requesterId,
        once: options.once,
        waitTillSucceed: options.waitTillSucceed,
      })
    );

    this.result = new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    });

    if (options.once) {
      this.__getOnce({ id, collection, pathSegments, documentId });
    } else {
      this.__getRealTime({ id, collection, pathSegments, documentId });
    }
  }

  /**
   * - Disconnects firestore request.
   */
  cancel() {
    this.__unsubscribe();
  }

  /**
   * Retries if request is failed.
   * - Retries request on firestore.
   */
  retry() {}

  /**
   * Requests one time to firestore for given document.
   *  - On successfull, dispatches `QUERY_SNAPSHOT` action with request Id & document.
   *  - On failure, dispatches `QUERY_FAILED` action with error details.
   */
  async __getOnce({ id, collection, pathSegments, documentId }) {
    try {
      const docRef = fsDoc(this.db, ...pathSegments, documentId);
      const doc = await fsGetDoc(docRef);
      if (doc.exists()) {
        const docs = [
          {
            id: doc.id,
            data: doc.data(),
            newIndex: 0,
            oldIndex: -1,
          },
        ];
        this.store.dispatch(
          actions._querySnapShot({ id, collection, docs, status: "CLOSED" })
        );
        const result = selectors.doc(
          this.store.getState(),
          collection,
          documentId
        );
        this._resolve(result);
      }
    } catch (error) {
      this.__onRequestFailed(error);
    }
  }

  /**
   * Requests real time request to firestore for given documentId.
   *  - On result update, dispatches `QUERY_SNAPSHOT` action with request Id & doc.
   *  - On failure, dispatches `QUERY_FAILED` action with error details.
   */
  __getRealTime({ id, collection, pathSegments, documentId }) {
    try {
      let resolved;
      this._unsubscribe = onSnapshot(
        fsDoc(this.db, ...pathSegments, documentId),
        (doc) => {
          const docs = [
            {
              id: doc.id,
              data: doc.data(),
              newIndex: 0,
              oldIndex: -1,
            },
          ];
          this.store.dispatch(
            actions._querySnapShot({ id, collection, docs, status: "LIVE" })
          );
          if (!resolved) {
            const result = selectors.doc(
              this.store.getState(),
              collection,
              documentId
            );
            this._resolve(result);
            resolved = true;
          }
        }
      );
    } catch (error) {
      this.__onRequestFailed(error);
    }
  }

  /**
   * @param {Object} error Error details.
   * @private
   */
  __onRequestFailed(error) {
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

export default GetDocById;
