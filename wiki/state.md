# firestore

## State

- Keeps firestore data.
- Path: `/firestore`

| Name    | Data Type                 | Description   |
| ------- | ------------------------- | ------------- |
| docs    | [Collection](#collection) |               |
| queries | Hash of [`Query`](#query) | key = QueryId |

### Collection

| Name          | Data Type        | Description                        |
| ------------- | ---------------- | ---------------------------------- |
| $collectionId | Hash of Document | key = documentId, value = Document |

> Where `Document` is same as FireStore document. But, when it's not yet synced/saved with the server at that time it has an extra field: `_syncPending = true`.

### Query

- All the queries by queryId with it's request, result, error & status details.
- Path: `/queries/$queryId`

| Name        | Data Type                     | Description                                                                                                                                                                                                                                             |
| ----------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| id          | uuid                          | Query Id                                                                                                                                                                                                                                                |
| requesterId | String                        | Requester Id.                                                                                                                                                                                                                                           |
| collection  | String                        | Collection ID. It is mandatory.                                                                                                                                                                                                                         |
| request     | [QueryRequest](#queryrequest) |                                                                                                                                                                                                                                                         |
| result      | docId[]                       | List of document ids, exactly in the same order as the Query result should be (according to sort criteria). It's available only when query succeeds, `status=LIVE`. It isn't cleared when Query is closed. So, it's avalable even when `status=CLOSED`. |
| error       | [QueryError](#queryerror)     | Available (and should be used) only when Query is failed, `status=FAILED`.                                                                                                                                                                              |
| status      | [QueryStatus](#enums)         |
| once        | Boolean                       | `true` when query is not realtime.                                                                                                                                                                                                                      |


Behaviors:

- Once Query is created, it's never removed (even when closed, failed). This is intentionally planned, because it's possible that the same
  Query is requested again (with sameId) in future. At that time, it's stale data can be used for the perceived speed. But, When Query is restarted then `error` field is reset to `undefined`, though `result` isn't.
- `result` field is updated whenever documents in the result are changed: new added, removed or orders are changed. But, it's not updated
  when document(s) content is changed but their order(s) in the result are are NOT changed.
- Query can be updated (while it's LIVE another request with the same id is received) at that time `status` is reset to `PENDING` and `error` is cleared. But, earlier `result` is still accessible. Note: This is mostly used to request next set/page of documents.
- Query can be restarted when it's `CLOSED` or `FAILED`. At that time, `status` is reset to `PENDING` & `error` is cleared. But earlier `result` of `CLOSED` query is still accessible.
- On query snapshot,
  - Updates query result by reference only when its changed by value. It's sort order is also same as the firestore snapshot order.
  - Updates only those documents in state which are changed by value.
- When query is cancelled, does not remove document from redux state. Removes document only when its deleted.
- Value of the deleted document is `undefined`.

#### QueryRequest

| Name       | Data Type | Description                                                                                                                                                                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| collection | String    | Collection Name                                                                                                                                                                                                                |
| where      | Array     | List of where conditions. e.g `[["firstName", "==", 'Nirmal"], ["age", ">=", "25"]]` Here the `firstName` & `age` are paths to compare, `==` is the Operator for the query and `Nirmal` & `25` are the values for comparision. |
| orderBy    | Array     | List of orderBy. e.g `[["firstName"], ["age", "desc"]]`. The `firstName` & `age` are fields to sort by & 2nd is the `order` which is optional. If not specified, order will be ascending.                                      |
| startAt    | Any       | The field values to start this query at, in order of the query's order by                                                                                                                                                      |
| startAfter | Any       | The field values to start this query after, in order of the query's order by.                                                                                                                                                  |
| endAt      | Any       | The field values to end this query at, in order of the query's order by.                                                                                                                                                       |
| endBefore  | Any       | The field values to end this query before, in order of the query's order by.                                                                                                                                                   |
| limit      | Number    | The maximum number of items to return.                                                                                                                                                                                         |
| once       | Boolean   | When `true`, request for given path wouldn't be subscribed for live listening.                                                                                                                                                 |
| waitTillSucceed | Boolean | When it's `true`, result promise will resolved when result is found from firestore. Default is `false`.

#### QueryError

| Name    | Data Type | Description   |
| ------- | --------- | ------------- |
| code    | String    | Error Code    |
| message | String    | Error Message |

### Enums

| Name   | Description                                                                   |
| ------ | ----------------------------------------------------------------------------- |
| status | Status of the query. Possible values: `PENDING`, `LIVE`, `CLOSED` or `FAILED` |

### Initial State

```js
{
}
```

### Example State

```js
{
  "docs": {
    "users": {
      "61bd5438-545b-4383-af21-f0434759bfa8": {
        "auths": [
          {
          "authId": "61bd5438-545b-4383-af21-f0434759bfa8"
          "authType": "KERIKA",
          "email": "nirmalbaldaniya@gmail.com",
          "id": "61bd5438-545b-4383-af21-f0434759bfa8",
          }
        ],
        "creationTime": 1643622657473,
        "deleted": false,
        "email": "nirmalbaldaniya@gmail.com",
        "firstName": "Nirmal",
        "lastName": "Baldaniya",
        "id": "61bd5438-545b-4383-af21-f0434759bfa8",
        "joinSecret": null
      }
    }
  },
  "queries": {
    "4383af21": {
      "id": "4383af21",
      "requesterId": "user-avatar-61bd5438-545b-4383-af21-f0434759bfa8",
      "collection": "users",
      "request": {
        "where": [["id", "==", "61bd5438-545b-4383-af21-f0434759bfa8"]]
      },
      "result": ["61bd5438-545b-4383-af21-f0434759bfa8"],
      "status": "LIVE",
      "error": undefined
    }
  }
}
```

## state transitions

- On `FIRESTORE_REDUX_QUERY `,

  - Stores query into state with `status:'PENDINIG`.

- On `FIRESTORE_REDUX_QUERY_SNAPSHOT`,

  - Updates query result by reference only when its changed by value.
  - Updates only those documents which are changed by value.

- On `FIRESTORE_REDUX_QUERY_FAILED`,

  - Sets query `status=FAILED` & sets `error` details.

- On `CANCEL_QUERY`

  - Sets query status of all cancelled queries to `CLOSED`

- On `FIRESTORE_REDUX_SAVE`,

  - When `localWrite` option is `true`, saves documents in local state.

- On `FIRESTORE_REDUX_SAVE_FAILED`, resets documents to their previous value if `prevDocs` provided.

- On `FIRESTORE_REDUX_DELETE_DOCS`,

  - When `localWrite` option is `true`, deletes documents from state.

- On `FIRESTORE_REDUX_DELETE_DOCS_FAILED`, resets documents to their previous value.
