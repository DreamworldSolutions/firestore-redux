# firestore-redux

An offline-first + real-time database using Firestore + Redux.

## Basic Usage

> This guide is just for basic use-cases. For more details about all methods & selectors, [See Reference Guide](./wiki/user-reference-guide.md)

### Initialization

```js
import { initializeApp } from "firebase/app";
import firestoreRedux from "@dreamworld/firestore-redux";
import { store } from "./store.js"; // This is store.js PATH of your application where store is created using `createStore` So replace it if required.
const firebaseConfig = {}; /* Firebase Configurations. e.g. { "apiKey": "AIzaSyAD9RzBEZ_pzZomgIbyIHo0No4PoFDm2Zc", "authDomain": "friendlyeats-d6aa1.firebaseapp.com", "projectId": "friendlyeats-d6aa1" } */
const readPollingConfig = { timeout: 30000 , maxAttempts: 20 }; // timeout is in milliseconds.
const firebaseApp = initializeApp(firebaseConfig);
firestoreRedux.init({ store, firebaseApp, readPollingConfig });
```

### Read documents by query criteria.

```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Realtime query
const query = firestoreRedux.query(collection, queryCriteria);

// 1 time query.
const query = firestoreRedux.query(collection, { once: true });

// Get Query Id from query.
const queryId = query.id;

// Get result when first snapshot of result is retrived.
try {
  const result = await query.result; // [{id, ...}, {id, ...}, ...]
} catch (error) {
  const errorCode = error.code;
  const errorMessage = error.message;
  // Retry failed query.
  query.retry();
}

// Wait till query succeed.
try {
  const query = firestoreRedux.query(collection, {
    once: true,
    waitTillSucceed: true,
  }); // Retries query for 10 seconds till it succeed.
  const result = await query.result;
} catch (error) {
  // Fails if failed after given wait timeout.
}

// Result can be retrieved from the redux state directly through selector factory.
const docsByQuerySelector =
  firestoreRedux.selectors.docsByQueryFactory(queryId, collection);
const docs = docsByQuerySelector(state); // [{id, ...}, {id, ...}, ...]

// Get all documents for given collection.
const allDocsSelector = firestoreRedux.selectors.allDocsFactory(collection);
const allDocs = allDocsSelector(state); // [{id, ...}, {id, ...}, ...]
```

### Read document by it's ID.

```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Realtime query.
const request = firestoreRedux.getDocById(collection, documentId, {
  requesterId,
});

// 1 time query.
const request = firestoreRedux.getDocById(collection, documentId, {
  once: true,
});

// Get Query Id.
const id = request.id;

// Wait till response of the request.
try {
  const doc = await request.result; // Document itself. e.g.  {id, ...}
} catch (error) {
  const errorCode = error.code;
  const errorMessage = error.message;
  // Retry failed query.
  request.retry();
}

// Wait till result found.
try {
  const request = firestoreRedux.getDocById(collection, {
    once: true,
    waitTillSucceed: true,
  }); // Retries read for 10 seconds till document found.
  const result = await request.result;
} catch (error) {
  // Fails if read failed after given wait timeout.
}

// Document can be retrieved from redux state directly through selector.
const doc = firestoreRedux.selectors.doc(state, collection, docId); // {id, ...}
```

### Cancel / Stop queries

```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

// Cancel by query.
query.cancel();

// Cancel by query Id.
firestoreRedux.cancelQuery(id);

// Cancel by requester Id.
firestoreRedux.cancelQueryByRequester(requesterId);
```

### Load Next Page documents.

> This will work only when `limit` query criteria is given & query is realtime.

```javascript
import firestoreRedux from "@dreamworld/firestore-redux";

const query = firestoreRedux.query(collection, { limit: 50 }); // This will load 1-50 documents.
query.loadNextPage(); // This will load 1-100 documents.
```

### Save documents.

```JS
// Save documents on local + remote both.
firestoreRedux.save(collectionPath, docs);

// Save documents only in redux state.
firestoreRedux.save(collectionPath, docs, { localWrite: true, remoteWrite: false });

// Save documents only on remote.
firestoreRedux.save(collectionPath, docs, { localWrite: false, remoteWrite: true });

// Wait till remote changes.
await firestoreRedux.save(collectionPath, docs);
// Do further work...
```

### Delete documents.

```JS
// Delete documents from local + remote both.
firestoreRedux.delete(collectionPath, docIds);

// Delete documents from local only.
firestoreRedux.delete(collectionPath, docIds, { localWrite: true, remoteWrite: false });

// Delete documents from remote only.
firestoreRedux.delete(collectionPath, docIds, { remoteWrite: true, localWrite: false });

// Wait till remote changes.
await firestoreRedux.delete(collectionPath, docIds);
// Do further work...
```

## Developer docs

- [Redux State & state transitions](wiki/state.md)
- [Firestore Observations](wiki/firestore-observations.md)
