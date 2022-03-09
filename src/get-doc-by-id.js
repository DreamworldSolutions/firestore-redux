import * as actions from "./redux/actions";
import * as selectors from "./redux/selectors";
import {
  doc as fsDoc,
  getDoc as fsGetDoc,
  onSnapshot,
} from "firebase/firestore";
import { retry as reAttempt } from "@lifeomic/attempt";

class GetDocById {
  constructor(store, db, pollingConfig) {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = store;
    this.db = db;
    this.pollingConfig = pollingConfig;
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
    if (!this._waiting) {
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
    }

    if (options.once) {
      this.__getOnce({ id, collection, pathSegments, documentId });
    } else {
      this.__getRealTime({ id, collection, pathSegments, documentId });
    }
    
    return new Promise((resolve, reject) => {
      this._retryResolve = resolve;
      this._retryReject = reject;
    });
  }

  /**
   * - Disconnects firestore request.
   */
  cancel() {
    this.__unsubscribe();
  }

  /**
   * Retries if request is failed.
   */
  retry() {
    const status = selectors.queryStatus(this.store.getState(), this.id);
    if (status !== "FAILED") {
      return;
    }
    this.getDoc(this.id, this._collectionPath, this._documentId, this._options);
  }

  /**
   * Requests one time to firestore for given document.
   *  - On successfull, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with request Id & document.
   *  - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with error details.
   */
  async __getOnce({ id, collection, pathSegments, documentId }) {
    try {
      const docRef = fsDoc(this.db, ...pathSegments, documentId);
      const doc = await fsGetDoc(docRef);
      if (
        !this._options.waitTillSucceed ||
        (this._options.waitTillSucceed && doc.exists())
      ) {
        const docs = [
          {
            id: doc.id,
            data: doc.data(),
            newIndex: 0,
            oldIndex: -1,
          },
        ];

        this.__dispatchQuerySnapshot({
          id,
          collection,
          docs,
          status: "CLOSED",
        });

        const result = selectors.doc(
          this.store.getState(),
          collection,
          documentId
        );
        this._resolve(result);
        if (this._options.waitTillSucceed) {
          this._retryResolve(result);
        }
        return;
      }

      if (!this._waiting) {
        this.__retryTillSucceed();
      } else {
        this._retryReject({
          code: "NOT_FOUND",
          message: "Document not found after retry as well.",
        });
      }
    } catch (error) {
      this.__onRequestFailed(error);
    }
  }

  /**
   * Requests real time request to firestore for given documentId.
   *  - On result update, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with request Id & doc.
   *  - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with error details.
   */
  __getRealTime({ id, collection, pathSegments, documentId }) {
    let resolved;
    this._unsubscribe = onSnapshot(
      fsDoc(this.db, ...pathSegments, documentId),
      (doc) => {
        if (
          !this._options.waitTillSucceed ||
          (this._options.waitTillSucceed && doc.exists())
        ) {
          const docs = [
            {
              id: doc.id,
              data: doc.data(),
              newIndex: 0,
              oldIndex: -1,
            },
          ];

          this.__dispatchQuerySnapshot({
            id,
            collection,
            docs,
            status: "LIVE",
          });

          if (!resolved) {
            const result = selectors.doc(
              this.store.getState(),
              collection,
              documentId
            );
            this._resolve(result);
            if (this._options.waitTillSucceed) {
              this._retryResolve(result);
            }
            resolved = true;
          }
          return;
        }

        if (!this._waiting) {
          this.__retryTillSucceed();
        } else {
          this._retryReject({
            code: "NOT_FOUND",
            message: "Document not found after retry as well.",
          });
        }
      },
      (error) => {
        this.__onRequestFailed(error);
      }
    );
  }

  /**
   * @param {Object} error Error details.
   * @private
   */
  __onRequestFailed(error) {
    this.__unsubscribe();

    if (!this._options.waitTillSucceed) {
      this.__dispatchQueryFailed(error);
      this._reject(error);
      return;
    }

    if (!this._waiting) {
      this.__retryTillSucceed();
    } else {
      this._retryReject(error);
    }
  }

  /**
   * Dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` redux action.
   * @private
   */
  __dispatchQuerySnapshot({ id, collection, docs, status }) {
    this.store.dispatch(
      actions._querySnapShot({ id, collection, docs, status })
    );
  }

  /**
   * Dispatches `FIRESTORE_REDUX_QUERY_FAILED redux` action.
   * @private
   */
  __dispatchQueryFailed(error) {
    this.store.dispatch(
      actions._queryFailed({
        id: this.id,
        error: { code: error.code, message: error.message },
      })
    );
  }

  /**
   * Retries till document found.
   * @private
   */
  async __retryTillSucceed() {
    this._waiting = true;
    try {
      await reAttempt(
        () =>
          this.getDoc(
            this.id,
            this._collectionPath,
            this._documentId,
            this._options
          ),
        {
          timeout: this.pollingConfig.timeout,
          maxAttempts: this.pollingConfig.maxAttempts,
          factor: 2,
          maxDelay: 1000
        }
      );
    } catch (error) {
      this.__dispatchQueryFailed(error);
      this._reject(error);
    }
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
