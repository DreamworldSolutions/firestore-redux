import { v4 as uuidv4 } from "uuid";
import * as _selectors from './redux/selectors.js';


class FirestoreRedux {
  constructor() {
    super();
    /**
     * A redux store which holds the whole state tree of firestore.
     */
    this.store = undefined;

    /**
     * Holds queries. key is the id of the query, and value is it's instance.
     */
    this.queries = {};
  }

  /**
   * Initialize library. (Sets store property & adds `firestore` reducer)
   * @param {Object} store Redux Store.
   */
  init(store) {
    this.store = store;
  }

  /**
   * Reads documents of given collection/subcollection from firestore based on given query criteria.
   *  - Creates unique query Id.
   *  - Creates new instance of Query class.
   *  - trigger `query` method of it & returns that instance.
   * @param {String} collection Collection / Subcollection path.
   * @param {Object} queryCriteria Query criteria. e.g. `{ requesterId, where, orderBy, limit, startAt, endAt, once }`
   * @returns {Object} instance of the Query Class.
   */
  query(collection, queryCriteria) {
    return;
  }

  /**
   * Reads single document of given collection/subcollection from firestore.
   *  - Creates unique query Id.
   *  - Creates new instance of GetDocById class.
   *  - trigger `getDoc` method of it & returns that instance.
   * @param {String} collection Collection path.
   * @param {String} documentId Document ID.
   * @param {Object} options Options. e.g. {requesterId, once }`
   */
  getDocById(collection, documentId, options) {
    return;
  }

  /**
   * Saves documents in redux state + remote.
   * @param {String} collection Collection/Subcollection path.
   * @param {Array} docs Documents to be saved.
   * @param {Object} options Save options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when saved on firestore, rejected when save fails.
   */
  save(collection, docs, options = { localWrite: true, remoteWrite: true }) {
    return;
  }

  /**
   * Deletes documents from redux state + remote.
   * @param {String} collection Collection/Subcollection path.
   * @param {Array} docIds Document Ids.
   * @param {Object} options Delete options. e.g. `{ localWrite: true, remoteWrite: true }`
   * @returns {Promise} Promise resolved when deleted from firestore, rejected when delete fails.
   */
  delete(
    collection,
    docIds,
    options = { localWrite: true, remoteWrite: true }
  ) {
    return;
  }

  /**
   * Cancels LIVE queries by it's id/requesterId.
   * @param {Object} 1 of the following properties must be provided.
   *  @property {String} id Query Id.
   *  @property {String}  requesterId Requester Id.
   */
  cancelQuery({ id, requesterId }) {
    return;
  }
}

const firestoreRedux = new FirestoreRedux();

export default firestoreRedux;
export const selectors = _selectors;