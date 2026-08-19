/**
 * Separator joining a wire id's three parts.
 *
 * `/` is chosen because Firestore never allows it inside a collection ID or a document ID, and `.`
 * and `-` are legal inside both. Collection keys hold no separator either, even for a subcollection:
 * `firestore.docs` is keyed by the last path segment, so `users/u1/user-preferences` is stored as
 * `user-preferences`.
 *
 * Only `fromDocumentKey` ever splits one of these strings back apart, and it splits on the first
 * separator only - so the collection ID is the sole part that has to be separator-free. Document IDs
 * and field paths come back whole, and a wire id is never parsed at all: the pipeline matches a
 * response by rebuilding the same key from the batch item it already holds.
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
 * @throws {Error} When the key doesn't carry both parts.
 */
export const fromDocumentKey = (documentKey) => {
  const collectionEnd = documentKey === undefined ? -1 : documentKey.indexOf(WIRE_ID_SEPARATOR);

  if (collectionEnd === -1) {
    throw new Error(`firestore-redux > translation : '${documentKey}' is not a valid document key.`);
  }

  return {
    collection: documentKey.slice(0, collectionEnd),
    docId: documentKey.slice(collectionEnd + 1),
  };
};
