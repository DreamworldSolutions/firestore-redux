/**
 * Which documents an activation currently covers, and which activations currently cover a document
 * - both directions, kept in step.
 *
 * `stop` and `update` need the second direction to answer "does some *other* still-active activation
 * still need this document?" before removing its `docs`/`status` entries. Without it, that answer
 * costs a full rescan of every loaded document every time.
 *
 * Held in memory alongside redux state, not inside it - see
 * wiki/translation/state.md#internal-indexing.
 */
export default class ActivationDocIndex {
  constructor() {
    /** activation id -> Set of document keys it matches. */
    this._documentKeysByActivation = {};

    /** document key -> Set of activation ids matching it. */
    this._activationIdsByDocument = {};
  }

  /**
   * Records that an activation matches a document. Idempotent.
   * @param {String} activationId Activation id.
   * @param {String} documentKey Document key, as built by `toDocumentKey`.
   */
  addMatch(activationId, documentKey) {
    (this._documentKeysByActivation[activationId] ||= new Set()).add(documentKey);
    (this._activationIdsByDocument[documentKey] ||= new Set()).add(activationId);
  }

  /**
   * Records that an activation no longer matches a document. Idempotent.
   * @param {String} activationId Activation id.
   * @param {String} documentKey Document key.
   */
  removeMatch(activationId, documentKey) {
    const documentKeys = this._documentKeysByActivation[activationId];
    if (documentKeys) {
      documentKeys.delete(documentKey);
      if (!documentKeys.size) {
        delete this._documentKeysByActivation[activationId];
      }
    }

    const activationIds = this._activationIdsByDocument[documentKey];
    if (activationIds) {
      activationIds.delete(activationId);
      if (!activationIds.size) {
        delete this._activationIdsByDocument[documentKey];
      }
    }
  }

  /**
   * Drops an activation entirely.
   * @param {String} activationId Activation id.
   * @returns {Array} The document keys it was matching, so the caller can decide what to remove.
   */
  removeActivation(activationId) {
    const documentKeys = this.documentKeys(activationId);
    documentKeys.forEach((documentKey) => this.removeMatch(activationId, documentKey));
    return documentKeys;
  }

  /**
   * Forgets a document across every activation - for a document that left the client entirely.
   * @param {String} documentKey Document key.
   */
  removeDocument(documentKey) {
    this.activationIds(documentKey).forEach((activationId) =>
      this.removeMatch(activationId, documentKey)
    );
  }

  /**
   * @param {String} activationId Activation id.
   * @returns {Array} Document keys this activation currently matches.
   */
  documentKeys(activationId) {
    return [...(this._documentKeysByActivation[activationId] || [])];
  }

  /**
   * @param {String} documentKey Document key.
   * @returns {Array} Activation ids currently matching this document.
   */
  activationIds(documentKey) {
    return [...(this._activationIdsByDocument[documentKey] || [])];
  }

  /**
   * @param {String} documentKey Document key.
   * @returns {Boolean} `true` while at least one activation still matches this document - the check
   *  that decides whether its `docs`/`status` entries may be removed.
   */
  hasAnyActivation(documentKey) {
    return !!this._activationIdsByDocument[documentKey];
  }
}
