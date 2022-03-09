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
- `readPollingConfig` Configurations for waiting query. This is ignored when `waitTillSucceed` query criteria is not `true`. Default is `{ timeout: 30000, maxAttempts: 20 }`. 

##### returns

- Nothing

### `firestoreRedux.query`

Reads data from the firestore for given collection/subcollection based on given query criteria.

```js
  const query = firestoreRedux.query(
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
      waitTillSucceed
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
  - `waitTillSucceed (Boolean)` When it's `true`, retries query based on `readPollingConfig`. Default is `false`.

##### returns

- `(Object)` `query` which is instance of the `Query` class.
  - Later on it can be used to cancel query, load next page, or retry failed.
    ```JS
    const queryId = query.id; // Get query Id.
    query.cancel(); // Cancel query.
    query.loadNextPage(); // Load next page.
    try {
      const docs = await query.result; // Resolved when first snapshot is retrived.
    } catch(error){
      query.retry();
    }
    ```

### `firestoreRedux.getDocById`

Reads single document from firestore by document ID.

```javascript
const query = firestoreRedux.getDocById(collection, docId, { requesterId });
```

##### Arguments

- `collectionPath (String)` Collection or subcollection path. e.g. `users` or `boards/$boardId/cards`.
- `docId (String)` Document ID.
- `options (Object)` Options
  - `requesterId (String)` Requester Id.
  - `once (Boolean)` `true` When query is not realtime.
  - `waitTillSucceed (Boolean)` When it's `true`, retries query based on `readPollingConfig`.

##### returns

- `(Object)` `request` which is instance of the `GetDocById` class.
  - Later on it can be used to cancel query or wait till query succeeds or failed.
    ```JS
    const queryId = request.id; // Get query Id.
    request.cancel(); // Cancel query.
    try {
      const doc= await request.result; // Resolved when first snapshot is retrived.
    } catch(error){
      query.retry();
    }
    ```

### `firestoreRedux.cancelQuery`

Cancels live query by it's id.

```JS
firestoreRedux.cancelQuery(id);
```

##### Arguments

- `id (String)` Query Id. It is mandatory.

##### returns

- Nothing

### `firestoreRedux.cancelQueryByRequester`

Cancels live queries by requester Id.

```JS
firestoreRedux.cancelQueryByRequester(requesterId);
```

##### Arguments

- `requesterId` (String) Requester Id. It is mandatory.

##### returns

- Nothing

### `firestoreRedux.save`

Saves/updates documents of given collection to local as well as on remote.

```JS
firestoreRedux.save(collectionPath, docs, options);
```

##### Arguments

- `collectionPath (String)` Collection / Subcollection path. if it's subcollection, it's `/` sepereted path upto subcollection. e.g. `boards/$boardId/cards`
- `docs (Object|Array)` Single document or List of documents to be saved or updated.
- `options (Object)`. Save options. e.g. `{ localWrite: true, remoteWrite: true }` By default `localWrite` & `remoteWrite` both are `true`.

##### returns

- `(Promise)` It will be resolved only when documents will be saved on remote successfully. On failed, it will be rejected.

### `firestoreRedux.delete`

Deletes documents of given collection from local as well as on remote.

```JS
firestoreRedux.delete(collectionPath, docIds, options);
```

##### Arguments

- `collectionPath (String)` Collection / Subcollection path.
- `docIds (String|Array)` Single doc Id or List of document Ids.
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

### `firestoreRedux.selectors.allDocsFactory`

Gets all documents of the given collection ID.

```JS
const docs = firestoreRedux.selectors.allDocsFactory(collection)(state);
```

##### Arguments

- `collection (String)` Collection ID.

##### returns

- `(Array)` e.g. `[ { id, firstName, lastName, profilePic },{ id, firstName, lastName, profilePic }, ... ]`

### `firestoreRedux.selectors.docsByQueryFactory`

Gets documents of given collection, based the query result of given queryId.

```JS
const docs = firestoreRedux.selectors.docsByQueryFactory(queryId, collection)(state);
```

##### Arguments

- `queryId (String)` Query ID, from whose documents will be returned.
- `collection (String)` Collection ID.

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
