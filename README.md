# firestore-redux

An offline-first + real-time database using Firestore + Redux.

## Basic Usage
> This guide is just for basic use-cases. For more details about all methods & selectors, [See Reference Guide](./wiki/user-reference-guide.md)

### Initialization

```js
import { initializeApp } from "firebase/app";
import firestoreRedux from "@dreamworld/firestore-redux";
import { store } from "./store.js"; // This is store.js PATH of your application where store is created using `createStore` So replace it if required.
const firebaseConfig = {} // Firebase Configurations.

const firebaseApp = initializeApp(firebaseConfig);
firestoreRedux.init(store, firebaseApp);
```

### Read documents by query criteria.

```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Realtime query
const queryRef = firestoreRedux.query(collection, queryCriteria);

// 1 time query.
const queryRef = firestoreRedux.query(collection, {once: true});

// Get Query Id from queryRef.
const queryId = queryRef.id;

// Wait till query response.
const response = await queryRef.response(); // Resolved when query succeed or failed.
const result = response.result; // Query result. e.g. [$queryId1, $queryId2, $queryId3, ...]
const error = response.error; // Query error. e.g. {code, message}

// Retry failed query.
queryRef.retry();
```

### Read document by it's ID.
```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Realtime query.
const queryRef = firestoreRedux.getDocById(collection, documentId, {requesterId});

// 1 time query.
const queryRef = firestoreRedux.getDocById(collection, documentId, {once: true});

// Get Query Id.
const id = queryRef.id;

// Wait till response of the request.
const response = await queryRef.response(); // Resolved when query succeed or failed.
const result = response.result; // Query result. e.g. [$queryId1, $queryId2, $queryId3, ...]
const error = response.error; // Query error. e.g. {code, message}

// Retry failed query.
queryRef.retry();

```

### Cancel / Stop queries
```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Cancel by queryRef.
queryRef.cancel();

// Cancel by query Id.
firestoreRedux.cancelQuery({id});

// Cance by requester Id.
firestoreRedux.cancelQuery({requesterId});

```

### Load Next Page documents.
> This will work only when `limit` query criteria is given & query is realtime.
```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

const queryRef = firestoreRedux.query(collection, {limit: 50}); // This will load 50 documents.
queryRef.loadNextPage(); // This will load 100 documents.
```

### Get Documents from Redux State  using Selectors.
```javascript

// Get list of documents which are in result of the query.
const docs = firestoreRedux.selectors.docsByQueryId(state, collection, queryId); // [{id, ...}, {id, ...}, ...]

// Get all documents for given collection.
const docs = firestoreRedux.selectors.docs(state, collection); // [{id, ...}, {id, ...}, ...]

// Get single document by it's ID.
const doc = firestoreRedux.selectors.doc(state, collection, docId); // {id, ...}
```

### Save documents.

```JS
// Save documents on local + remote both.
const response = firestoreRedux.save(collection, docs);

// Save documents only in redux state.
firestoreRedux.save(collection, docs, { localWrite: true, remoteWrite: false });

// Save documents only on remote.
const response = firestoreRedux.save(collection, docs, { localWrite: false, remoteWrite: true });
```
> `response` in the above example is a `Promise` which will be resolved when the documents are saved successfully on remote. It will be resolved on failed write operation.
So wait on it only when you want to wait for the remote changes because documents are saved in redux state already.

### Delete documents.

```JS
// Delete documents from local + remote both.
const response = firestoreRedux.delete(collection, docIds);

// Delete documents from local only.
firestoreRedux.delete(collection, docIds, {localWrite: true, remoteWrite: false });

// Delete documents from remote only.
const response = firestoreRedux.delete(collection, docIds, { remoteWrite: true, localWrite: false });
```
> `response` in the above example is a `Promise` which will be resolved when the documents are deleted successfully from remote. It will be resolved on failed write operation.
So wait on it only when you want to wait for the remote changes because documents are deleted from redux state already.


## Developer docs
- [Redux State & state transitions](wiki/state.md)
- [Firestore Observations](wiki/firestore-observations.md)