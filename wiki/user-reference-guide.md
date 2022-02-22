# User Reference guide

## Actions

### `firestoreRedux.init`

Initialize library.

```js
firestoreRedux.init(store, firebaseApp);
```

##### Arguments

- `store (Object)` Redux Store. It is mandatory.
- `firebaseApp (Object)` Firebase app. It is optional.

##### returns

- Nothing

### `firestoreRedux.query`

Reads data from the firestore for given collection/subcollection based on given query criteria.

```js
  const queryRef = firestoreRedux.query(
    collection
    {
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
    }
  );
```

##### Arguments

- `collection (String)` Collection or subcollection ID. It cannot contain a slash. It is mandatory.
- `queryCriteria (Object)`: Optional. If not provided, reads all documents of given collection/subcollection.

  - `requesterId (String)` Requester Id.
  - `where (Array)` List of where conditions. e.g. `[['firstName', '==', 'Nirmal'], ['lastName', '==', 'Baldaniya']]`.
  - `orderBy (Array)` List of orderBy fields. e.g. `[['lastSeen', 'asc'], ['age', 'desc']]`.
  - `startAt (Any)` The field values to start this query at, in order of the query's order by.
  - `startAfter (Any)` The field values to start this query after, in order of the query's order by.
  - `endAt (Any)` The field values to end this query at, in order of the query's order by.
  - `endBefore (Any)` The field values to end this query before, in order of the query's order by.
  - `limit (Number)` The maximum number of items in result.
  - `once (Boolean)` When `true`, does not subscribe for realtime changes. Default is `false`.

##### returns

- `(Object)` `queryRef` which is instance of the `Query` class.
  - Later on it can be used to cancel query, load next page, or wait till query succeeds or failed.
    ```JS
    const queryId = queryRef.queryId; // Get query Id.
    queryRef.cancel(); // Cancel query.
    queryRef.loadNextPage(); // Load next page.
    const response = await queryRef.response(); // Resolved when query succeed or failed.
    ```

### `firestoreRedux.getDocById`

Reads single document from firestore by document ID.

```javascript
const queryRef = firestoreRedux.getDocById(collection, docId, { requesterId });
```

##### Arguments

- `collection (String)` Collection or subcollection path. e.g. `users` or `boards/$boardId/cards`.
- `docId (String)` Document ID.
- `options (Object)` Options
  - `requesterId (String)` Requester Id.
  - `once (Boolean)` `true` When query is not realtime.

##### returns

- `(Object)` `queryRef` which is instance of the `GetDocById` class.
  - Later on it can be used to cancel query or wait till query succeeds or failed.
    ```JS
    const queryId = queryRef.queryId; // Get query Id.
    queryRef.cancel(); // Cancel query.
    const response = await queryRef.response(); // Resolved when query succeed or failed.
    ```

### `firestoreRedux.cancelQuery`

Cancels live query/queries by it's id or requester id.

```JS
firestoreRedux.cancelQuery({id, requesterId});
```

##### Arguments

> 1 of the following properties must be given. Either `id` or `requesterId`.

- `params (Object)`
  - `id (String)` Query Id.
  - `requesterId` (String) Requester Id.

##### returns

- Nothing

### `firestoreRedux.save`

Saves/updates documents of given collection to local as well as on remote.

```JS
firestoreRedux.save(collection, docs, options);
```

##### Arguments

- `collection (String)` Collection / Subcollection path. if it's subcollection, it's `/` sepereted path upto subcollection. e.g. `boards/$boardId/cards`
- `docs (Array)` List of documents to be saved or updated.
- `options (Object)`. Save options. e.g. `{ localWrite: true, remoteWrite: true }` By default `localWrite` & `remoteWrite` both are `true`.

##### returns

- `(Promise)` It will be resolved only when documents will be saved on remote successfully. On failed, it will be rejected.

### `firestoreRedux.delete`

Deletes documents of given collection from local as well as on remote.

```JS
firestoreRedux.delete(collection, docIds, options);
```

##### Arguments

- `collection (String)` Collection / Subcollection path.
- `docIds (Array)` List of document Ids.
- `options (Object)`. Save options. e.g. `{ localWrite: true, remoteWrite: true }` By default `localWrite` & `remoteWrite` both are `true`.

##### returns

- `(Promise)` It will be resolved only when documents will be deleted from remote successfully. On failed, it will be rejected.

## Selectors

### `firestoreRedux.selectors.doc`

Gets single document of given document ID.

```JS
const doc = firestoreRedux.selectors.doc(state, collection, docId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `docId (String)` Document Id

##### returns

- `(Object)` e.g. `{ id, firstName, lastName, profilePic }`

### `firestoreRedux.selectors.docs`

Gets all documents of the given collection ID.

```JS
const docs = firestoreRedux.selectors.docs(state, collection);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.

##### returns

- `(Array)` e.g. `[ { id, firstName, lastName, profilePic },{ id, firstName, lastName, profilePic }, ... ]`

### `firestoreRedux.selectors.docsByQueryId`

Gets documents of given collection, based the query result of given queryId.

```JS
const docs = firestoreRedux.selectors.docsByQueryId(state, collection, queryId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `queryId (String)` Query ID, from whose documents will be returned.

##### returns

- `(Array)` e.g. `[ { id, firstName, lastName, profilePic },{ id, firstName, lastName, profilePic } ]`

### `firestoreRedux.selectors.query`

Gets query detail by it's ID.

```JS
const query = firestoreRedux.selectors.query(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(Object)` e.g. `{ id, requesterId, collection, request, result, status, error }`

### `firestoreRedux.selectors.queryStatus`

Gets query status by it's ID.

```JS
const status = firestoreRedux.selectors.queryStatus(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(String)` Possible values: `PENDING`, `LIVE`, `CLOSED` or `FAILED`.

### `firestoreRedux.selectors.queryError`

Gets query error detail by it's ID.

```JS
const error = firestoreRedux.selectors.queryError(state, id);
```

##### Arguments

- `state (Object)` Redux state.
- `id (String)` Query ID

##### returns

- `(Object)` e.g. `{ code, message }`
