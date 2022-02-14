## Observations
1. On a single document update, all another document's reference is same or different? 
    - **Reference is changed for all the documents whether it is updated or not.**
  
2. Does firestore have a revision like couchDB?
    - **No**

3. Does Firestore send another request for a similar query criteria?.
    - **No, It does not send request again for similar criteria.**
4. On subsequent query with partial/fully matched result, reference of the documents which are same by value is differnt or same?
    - same criteria:
      - **documents are not same by reference.**
    - Different criteria (but some documents are same)
      - **documents are not same by reference**

5. On update in single document, all changes are in network response or that particular document change?
    - **Firestore uses gRPC & it's responce is encoded. So We can't identify it's response.**
6. Can we chhose websocket as a transport layer?.
    - **No there is no such way**
7. On cancel 1 of the query from same 3 queries, network request is sent or not?
    - **No, network request will be sent only when last query with same criteria will be cancelled.**
