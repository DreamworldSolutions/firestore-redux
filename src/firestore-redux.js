import { v4 as uuidv4 } from "uuid";
import * as actions from "./redux/actions";
import * as _selectors from "./redux/selectors";
import firestoreReducer from "./redux/reducers";
import { getFirestore } from "firebase/firestore";
import Query from "./query";
import GetDocById from "./get-doc-by-id";
import SaveDocs from "./save-docs";
import DeleteDocs from "./delete-docs";
import merge from "lodash-es/merge";
import forEach from "lodash-es/forEach";
import isEmpty from "lodash-es/isEmpty";
import isObject from "lodash-es/isObject";
import isArray from "lodash-es/isArray";

class FirestoreRedux {
  constructor() {
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = undefined;

    /**
     * Holds queries. key is the id of the query, and value is it's instance.
     */
    this._queries = {};

    // Default configuration for wait till read succeed query.
    this._readPollingConfig = { timeout: 30000, maxAttempts: 20 };
  }

  /**
   * Initialize library. (Sets store property & adds `firestore` reducer)
   * @param {Object} store Redux Store.
   * @param {Object} firebaseApp Firebase app. It's optional.
   * @param {Object} readPollingConfig. Query polling config.
   */
  init({ store, firebaseApp, readPollingConfig }) {
    if (!store) {
      throw "firestore-redux : redux store is not provided.";
    }
    this.store = store;
    store.addReducers({ firestore: firestoreReducer });
    this.db = getFirestore(firebaseApp);
    this.readPollingConfig = merge(this._readPollingConfig, readPollingConfig);
  }

  /**
   * Reads documents of given collection/subcollection from firestore based on given query criteria.
   *  - Creates unique query Id.
   *  - Creates new instance of Query class.
   *  - trigger `query` method of it & returns that instance.
   * @param {String} collection Collection / Subcollection path.
   * @param {Object} criteria Query criteria. e.g. `{ requesterId, where, orderBy, limit, startAt, endAt, once, waitTillSucceed }`
   * @returns {Object} instance of the Query Class.
   */
  query(collection, criteria) {
    if (!this.store || !this.db) {
      throw "firebase-redux > query : firestore-redux is not initialized yet.";
    }

    if (!collection) {
      throw "firestore-redux > query : collection is not provided";
    }

    const id = uuidv4();
    const instance = new Query(this.store, this.db, this.readPollingConfig);
    this._queries[id] = instance;
    instance.query(id, collection, criteria);
    this._queries[id] = instance;
    return instance;
  }

  /**
   * Reads single document of given collection/subcollection from firestore.
   *  - Creates unique query Id.
   *  - Creates new instance of GetDocById class.
   *  - trigger `getDoc` method of it & returns that instance.
   * @param {String} collectionPath Collection path.
   * @param {String} documentId Document ID.
   * @param {Object} options Options. e.g. {requesterId, once, waitTillSucceed }`
   */
  getDocById(collectionPath, documentId, options) {
    if (!this.store || !this.db) {
      throw "firebase-redux > getDocById : firestore-redux is not initialized yet.";
    }

    if (!collectionPath || !documentId) {
      throw `firestore-redux > getDocById : Collection Path or document Id is not provided. > ${collectionPath} > ${documentId}`;
    }

    if (!this.__isValidCollectionPath(collectionPath)) {
      throw `firestore-redux > getDocById > Collection/Subcollection path is not valid. ${collectionPath}`;
    }

    const id = uuidv4();
    const instance = new GetDocById(
      this.store,
      this.db,
      this.readPollingConfig
    );
    this._queries[id] = instance;
    instance.getDoc(id, collectionPath, documentId, options);
    this._queries[id] = instance;
    return instance;
  }

  /**
   * Saves documents in redux state + remote.
   * @param {String} collectionPath Collection/Subcollection path.
   * @param {Object|Array} docs Single Document or list of documents to be saved.
   * @param {Object} options Save options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when saved on firestore, rejected when save fails.
   */
  save(
    collectionPath,
    docs,
    options = { localWrite: true, remoteWrite: true }
  ) {
    if (!this.store || !this.db) {
      throw "firebase-redux > save : firestore-redux is not initialized yet.";
    }

    if (!collectionPath || isEmpty(docs)) {
      throw `firestore-redux > save : collection path or documents are not provided. ${collectionPath}, ${docs}`;
    }

    if (!this.__isValidCollectionPath(collectionPath)) {
      throw `firestore-redux > save > Collection/Subcollection path is not valid. ${collectionPath}`;
    }

    if (!isObject(docs)) {
      throw `firestore-redux > save : provided docs is not valid object or array. ${docs}`;
    }

    const instance = new SaveDocs(this.store, this.db);
    return instance.save(collectionPath, docs, options);
  }

  /**
   * Deletes documents from redux state + remote.
   * @param {String} collectionPath Collection/Subcollection path.
   * @param {String|Array} docIds Single document Id or list of document Ids.
   * @param {Object} options Delete options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when deleted from firestore, rejected when delete fails.
   */
  delete(
    collectionPath,
    docIds,
    options = { localWrite: true, remoteWrite: true }
  ) {
    if (!this.store || !this.db) {
      throw "firebase-redux > delete : firestore-redux is not initialized yet.";
    }

    if (!collectionPath || isEmpty(docIds)) {
      throw `firestore-redux > delete : collection path or document ids are not provided. ${collectionPath}, ${docIds}`;
    }

    if (typeof docIds !== "string" && !isArray(docIds)) {
      throw `firestore-redux > delete : document ids must be string or array of string. ${docIds}`;
    }

    const instance = new DeleteDocs(this.store, this.db);
    return instance.delete(collectionPath, docIds, options);
  }

  /**
   * Cancels LIVE query by it's id.
   * @param {String} id Query Id.
   */
  cancelQuery(id) {
    const status = _selectors.queryStatus(this.store.getState(), id);
    if (!id || !status || (status !== "LIVE" && status !== "PENDING")) {
      return;
    }
    this.store.dispatch(actions.cancelQuery({ id }));
    this.__cancel(id);
  }

  /**
   * Cancels all live queries by requester id.
   * @param {String} requesterId Requester Id.
   */
  cancelQueryByRequester(requesterId) {
    const liveQueries = _selectors.liveQueriesByRequester(
      this.store.getState(),
      requesterId
    );
    forEach(liveQueries, (id) => {
      this.__cancel(id);
    });
    this.store.dispatch(actions.cancelQuery({ requesterId }));
  }

  /**
   * Unsubscribes firestore query.
   * @param {String} id Query Id.
   * @private
   */
  __cancel(id) {
    if (this._queries[id]) {
      this._queries[id].cancel();
      delete this._queries[id];
    }
  }

  /**
   * @param {String} path Collection/Subcollection path.
   * @returns {Boolean} `true` when given path is valid collection/subcollection path.
   * @private
   */
  __isValidCollectionPath = (path) => {
    return (
      path &&
      !path.startsWith("/") &&
      !path.endsWith("/") &&
      (path.match(/\//g) || []).length % 2 === 0
    );
  };
}

const firestoreRedux = new FirestoreRedux();

export default firestoreRedux;
export const selectors = _selectors;
