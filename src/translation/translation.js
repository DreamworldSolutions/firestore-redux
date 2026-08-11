import * as actions from "./redux/actions.js";
import { assertValidSchema } from "./schema.js";

/**
 * Public API for the translation capability, exposed as `firestoreRedux.translation`.
 * See wiki/translation/README.md.
 */
export default class Translation {
  /**
   * @param {Object} firestoreRedux The FirestoreRedux instance this belongs to. Held as a reference
   *  rather than the store itself, because the store only exists after `firestoreRedux.init`.
   */
  constructor(firestoreRedux) {
    this._firestoreRedux = firestoreRedux;
  }

  get _store() {
    return this._firestoreRedux.store;
  }

  /**
   * Configures the schema for every translatable collection at once. Calling it again replaces the
   * whole schema. A schema is optional - see wiki/translation/schema-reference.md.
   * @param {Object} schema `Map<collectionId, Map<documentId-or-'*', Map<fieldPath, { contentType, skip }>>>`
   */
  setSchema(schema) {
    if (!this._store) {
      throw "firestore-redux > translation.setSchema : firestore-redux is not initialized yet.";
    }

    assertValidSchema(schema);
    this._store.dispatch(actions.setSchema(schema));
  }
}
