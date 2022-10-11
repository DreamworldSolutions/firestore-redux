## Standard practices

- When user reads document on which security rules is applied based on current document's field & that document doesn't exists, firebase gives `[code=permission-denied]: Missing or insufficient permissions.` error. So to allow read such non-exist document add `resource == null` checker in firestore security rules. [See Reference](https://stackoverflow.com/questions/67059320/what-is-the-proper-way-to-handle-permission-denied-when-a-firestore-document-d) <br/>

  e.g

  ```js
  allow read: if resource == null || (request.auth && request.auth.uid == resource.data.userId)
  ```

- When security rule is based on current document's field, use `resource.data` instead of `get($documentPath)` method of firestore to avoid extra read. [See Reference](https://stackoverflow.com/questions/67059320/what-is-the-proper-way-to-handle-permission-denied-when-a-firestore-document-d#comment118534491_67059632) <br/>

  e.g

  ```js
  allow read: if resource == null || (request.auth && request.auth.uid == resource.data.userId)
  ```
