## Firestore Observations

1. Observe that on a single document update, all another documents in the snapshot are changed by reference?

   - **Reference is changed for all the documents in the snapshot even only 1 document is updated**

2. On subsequent query whose result is partial/fully matched with previous query's result, reference of the matched documents is changed or not?

   - When same query criteria:
     - **documents are not same by reference.**
   - When different query criteria (but some documents are matched by value with the previous query result):
     - **documents are not same by reference**

3. Does firestore have a revision in the document like couchDB?

   - **No, it hasn't such field in the document.**

4. Does Firestore send another request to server when user triggers another query with same query criteria?.

   - **No, It does not send request to the server again when another query with same criteria is triggered again.**

5. On update in single document, all changes are in network response or that particular document change?
   - **Firestore uses gRPC & it's responce is encoded. So We can't identify it's response.**
6. Can we chhose websocket as a transport layer?.
   - **No there is no such way**
7. 3 queries with same criteria are running. On cancel 1 of the query from those 3 queries, network request is sent or not?

   - **No, network request will be sent only when last query with same criteria will be cancelled.**

8. What is a default limit of firestore query? Let's say I have a collection `users` that has 1,000,000 records.

   - How many records will this query return?

   ```JS
   const q = query(collection(db, "users"));
   const querySnapshot = await getDocs(q);
   ```

   - **There is no default limit. By default, a query retrieves all documents that satisfy the query in ascending order by document ID. You can specify the sort order for your data using orderBy(), and you can limit the number of documents retrieved using limit().**

9. Can We get documents by its ids?

   - **At persent, firestore's javascript SDK has no such way to fetch documents by ids.**

10. Should We give support for transaction to save & delete documents?

- **No, there is no need to give this support for now. As per this [documentation](https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes)**
  > If you do not need to read any documents in your operation set, you can execute multiple write operations as a single batch that contains any combination of set(), update(), or delete() operations.

11. Get Document by Id observations:

- When user has permission on document.
  - When document exists, returns document.
  - When document doesn't exist, returns `null`.
- When user has no permission:
  - When document exists, gives `[code=permission-denied]: Missing or insufficient permissions.` error.
  - When document doesn't exist,
    - When `resource == null` is allowed in security rules, returns `null`
    - otherwise, throws `[code=permission-denied]: Missing or insufficient permissions.` error.

12. Document based query observations.

- When user queries for 10 documents & on all she has permission,
   - It gives documents.
- When she has no permission on 3 of the 10 documents,
   - It throws `[code=permission-denied]: Missing or insufficient permissions.` error.
