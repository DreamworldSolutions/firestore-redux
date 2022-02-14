# firestore-redux

## Introduction

- Syncs firestore data with redux state.
- Provides a way to write or delete firestore data with localWrite into redux state.

## Usage

### 1. Import

```js
import * as firestoreRedux from "@dreamworld/firestore-redux";
import { store, sagaMiddleware } from "./store.js"; // This is store.js PATH of your application where store & sagaMiddleware are created using `crateStore` & `createSagaMiddleware` respectivelly. So replace it if required.
```

### 2. Initialization

- This library assumes that Firebase App has been initialized by application.
- So initialize this after firebase initialization.
  > Note that [redux-thunk](https://github.com/reduxjs/redux-thunk) & [redux-saga](https://redux-saga.js.org/docs/introduction/GettingStarted) middlewares must be applied on the `store` as this library uses those both middlewares.

```js
store.dispatch(firestoreRedux.actions.init(store, sagaMiddleware, firebaseApp));
```

##### Arguments

- `store (Object)` Redux Store. It is mandatory.
- `sagaMiddleware (Object)` Saga Middleware. It is mandatory.
- `firebaseApp (Object)` Firebase app instance. It is optional. If not provided, library by default uses default instance of the Firebase App.

### [Actions](./actions.js)

#### 1. query

- Reads data from the firestore for given collection/subcollection.

```js
store.actions.dispatch(
  firestoreRedux.actions.query({
    id,
    requesterId,
    collection,
    where,
    orderBy,
    startAt,
    startAfter,
    endAt,
    endBefore,
    limit,
    once,
  })
);
```

##### Arguments

- `id (String)` It is optional. But if its provided, it must be unique id.
- `requesterId (String)` Requester Id.
- `collection (String)` Collection or subcollection ID. It cannot contain a slash. It is mandatory.
- `where (Array)` List of where conditions. e.g. `[['firstName', '==', 'Nirmal'], ['lastName', '==', 'Baldaniya']]` It is optional.
- `orderBy (Array)` List of orderBy fields. e.g. `[['lastSeen', 'asc'], ['age', 'desc']]` It is optional.
- `startAt (Any)` The field values to start this query at, in order of the query's order by. It is optional.
- `startAfter (Any)` The field values to start this query after, in order of the query's order by. It is optional.
- `endAt (Any)` The field values to end this query at, in order of the query's order by. It is optional.
- `endBefore (Any)` The field values to end this query before, in order of the query's order by. It is optional.
- `limit (Number)` The maximum number of items in result. It is optional.
- `once (Boolean)` When `true`, does not subscribe for realtime changes. It is optional.

#### 2. updateQuery

- Updates `LIVE` query to fetch more records. This is useful for the pagination.

```JS
store.dispatch(firestoreRdux.actions.updateQuery({id, limit}));
```

##### Arguments

- `id (String)` Query Id.
- `limit (Number)` The maximum number of items in result.

#### 3. restartQuery

- Restarts `CLOSED` or `FAILED` query again.

```JS
store.dispatch(firestoreRdux.actions.restartQuery(id));
```

##### Arguments

- `id (String)` Query Id.

#### 4. cancelQuery

- Cancels live query/queries by it's id or requester id.

```JS
store.dispatch(firestoreRedux.actions.cancelQuery({id, requesterId}));
```

##### Arguments

- `id (String)` Query Id.
- `requesterId` (String) Requester Id.

#### 5. save

- Saves document to local & firestore as well.

```JS
store.dispatch(firestoreRedux.actions.save(docs, target));
```

##### Arguments

- `docs (Object)` Key Value map of documents. Key is the `/` seperated path where document is stored on firestore. e.g. `users/$userId` & value is the document. e.g `{'users/$userId': {name, firstNamme, lastName}}`
- `target (String)`. Possible vlaues: `BOTH`, `LOCAL` or `REMOTE`. Default is `BOTH`.
  - When `target="BOTH"`, saves documents in local state first, after that saves it on firestore.
  - When `target="LOCAL"`, saves documents only in local state.
  - When `target="REMOTE"`, saves documents only on remote database.

#### 6. deleteDocs

- Deletes document from the local & remote both.

```JS
store.dispatch(firestoreRedux.actions.deleteDocs(paths, target="BOTH"));
```

##### Arguments

- `paths (Array)` `/` seperated path where document is stored on firestore. e.g. `['users/$userId1', 'users/$userId2']`. Here document at `$userId1` & `$userId2` will be deleted.
- `target (String)`. Possible vlaues: `BOTH`, `LOCAL` or `REMOTE`. Default is `BOTH`.
  - When `target="BOTH"`, deletes documents from local state first, after that deletes from firestore.
  - When `target="LOCAL"`, deletes documents from local state only.
  - When `target="REMOTE"`, deletes documents from remote database only.

### [Selectors](./selectors.js)

#### 1. doc

- Gets document with it's local data for given document ID.

```JS
const doc = firestoreRedux.selectors.doc(state, collection, docId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `docId (String)` Document Id

##### returns

- `(Object)` e.g. `{ id, firstName, lastName, profilePic }`

#### 2. docs

- Gets all documents of the given collection ID.

```JS
const docs = firestoreRedux.selectors.docs(state, collection);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.

##### returns

- `(Array)` e.g. `[ { id, firstName, lastName, profilePic },{ id, firstName, lastName, profilePic } ]`

#### 3. query

- Gets query detail by it's ID.

```JS
const query = firestoreRedux.selectors.query(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(Object)` e.g. `{ id, requesterId, collection, request, result, status, error }`

#### 4. queryStatus

- Gets query status by it's ID.

```JS
const status = firestoreRedux.selectors.queryStatus(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(String)` Possible values: `PENDING`, `LIVE`, `CLOSED` or `FAILED`.

#### 5. queryError

- Gets query error detail by it's ID.

```JS
const error = firestoreRedux.selectors.queryError(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(Object)` e.g. `{ code, message }`

### [Utils](./utils.js)

#### 1. waitTillQueryResponse

- Waits till query for given query id is succeed / failed.
- Resolves promise when query succeed, failed or timeout.
  - When query is succeed, resolved with query result.
  - When query is failed or timeout, resolved with `undefined`
    > This method is useful mainly when next logic depends on query result.

```JS
const promise = firestoreRedux.utils.waitTillQueryResponse(queryId, timeout);
```

##### Arguments

- `queryId (String)` Query ID.
- `timeout (Number)` timeout in milliseconds. Default is 60000 (1 minute).

##### returns

- `(Promise)` Promise will be resolved when query succeed, failed or timeout.

### Developer docs

- [Redux State & state transitions](wiki/state.md)
- [Actions, Selectors & Saga flow](wiki/redux.md)
