# Redux

## [Actions](../actions.js)

- init(store, sagaMiddleware, firebaseApp)
- query({ id, requesterId, collection, where, orderBy,startAt, startAfter, endAt, endBefore, limit, once })
- updateQuery({id, limit})
- restartQuery(id)
- cancelQuery({ id, requesterId })
- save(docs, target="BOTH")
- deleteDocs(paths, target="BOTH")

## [Selectors](../selectors.js)

- doc(state, collection, docId)
- docs(state, collection)
- query(state, queryId)
- queryStatus(state, queryId)
- queryError(state, queryId)
- queryResult(state, queryId)
- liveQueriesByRequester(queries, requesterId)

## [Utils](../utils.js)

- waitTillQueryResponse(queryId, timeout)

## Saga Flow

- On `FIRESTORE_REDUX_INIT`, registers saga handler, add reducer to `firestore` path & gets database instance.

- On `FIRESTORE_REDUX_QUERY `,

  - Requests query on firestore.
    - On success, dispatches `FIRESTORE_REDUX_QUERY_SNAPSHOT` action with `queryId`, `collection` & `docs`.
    - On failure, dispatches `FIRESTORE_REDUX_QUERY_FAILED` action with `queryId` & `error`.

- On `FIRESTORE_REDUX_UPDATE_QUERY`,

  - Saga handler requests another query with updated `limit` criteria.

- On `FIRESTORE_REDUX_RESTART_QUERY`, re-requests `CLOSED` query with previous criteria.

- On `CANCEL_QUERY`, unsubscribes the query/queries by its id/requesterId.

- On `FIRESTORE_REDUX_SAVE`,

  - When `target` is `REMOTE` or `BOTH`, saves documents on remote.
    - On successfull firestore save, dispatches `FIRESTORE_REDUX_SAVE_DONE` action.
    - On failure firestore request, dispatches `FIRESTORE_REDUX_SAVE_FAILED` action with `prevDocs`.

- On `FIRESTORE_REDUX_DELETE_DOCS`, deletes documents from remote.
  - On successfull firestore delete, dispatches `FIRESTORE_REDUX_DELETE_DOCS_DONE` action.
  - On firestore delete failure, dispatches `FIRESTORE_REDUX_DELETE_DOCS_FAILED` action with `prevDocs`.
