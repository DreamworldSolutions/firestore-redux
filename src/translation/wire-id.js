/**
 * Separator joining a wire id's three parts.
 *
 * `/` is chosen because Firestore never allows it inside a collection ID, a document ID, or a field
 * path - so it can never appear *within* any part being joined, and the joined string always splits
 * back apart exactly the way it was built. `.` and `-` are legal inside all three, which is why they
 * can't be used here.
 */
export const WIRE_ID_SEPARATOR = "/";

/**
 * Builds the flat, opaque id an item travels to the Translator under. The Translator never parses
 * it - it just echoes the same key back on the response.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @param {String} fieldPath Field path, dot/bracket notation. e.g. `members[0].name`
 * @returns {String} e.g. `posts/post-1.2/members[0].name`
 */
export const toWireId = (collection, docId, fieldPath) =>
  `${collection}${WIRE_ID_SEPARATOR}${docId}${WIRE_ID_SEPARATOR}${fieldPath}`;

/**
 * Builds the key a document is tracked under internally - by the activation index and by the
 * pipeline's in-flight bookkeeping. Same separator, same guarantee, one part shorter.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @returns {String} e.g. `posts/post-1.2`
 */
export const toDocumentKey = (collection, docId) => `${collection}${WIRE_ID_SEPARATOR}${docId}`;

/**
 * @param {String} documentKey Key as built by `toDocumentKey`.
 * @returns {Object} `{ collection, docId }`
 * @throws {String} When the key doesn't carry both parts.
 */
export const fromDocumentKey = (documentKey) => {
  const collectionEnd = documentKey === undefined ? -1 : documentKey.indexOf(WIRE_ID_SEPARATOR);

  if (collectionEnd === -1) {
    throw `firestore-redux > translation : '${documentKey}' is not a valid document key.`;
  }

  return {
    collection: documentKey.slice(0, collectionEnd),
    docId: documentKey.slice(collectionEnd + 1),
  };
};

/**
 * Splits a wire id back into the three parts it was built from. Splits on the first two separators
 * only, so a field path is returned whole even in the impossible case that it contains one.
 * @param {String} wireId Wire id, as built by `toWireId`.
 * @returns {Object} `{ collection, docId, fieldPath }`
 * @throws {String} When the id doesn't carry all three parts.
 */
export const fromWireId = (wireId) => {
  const collectionEnd = wireId === undefined ? -1 : wireId.indexOf(WIRE_ID_SEPARATOR);
  const docIdEnd = collectionEnd === -1 ? -1 : wireId.indexOf(WIRE_ID_SEPARATOR, collectionEnd + 1);

  if (docIdEnd === -1) {
    throw `firestore-redux > translation : '${wireId}' is not a valid wire id.`;
  }

  return {
    collection: wireId.slice(0, collectionEnd),
    docId: wireId.slice(collectionEnd + 1, docIdEnd),
    fieldPath: wireId.slice(docIdEnd + 1),
  };
};
