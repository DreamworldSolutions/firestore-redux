import * as actions from "./redux/actions.js";
import * as translationSelectors from "./redux/selectors.js";
import { assertValidSchema } from "./schema.js";
import { toTranslatorFunction } from "./translator.js";
import TranslationPipeline from "./translation-pipeline.js";
import Activations from "./activations.js";

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

    /**
     * The configured Translator, as a function `({ targetLanguage, items }) => Promise`. Set by
     * `setTranslator`, which also normalizes the URL forms into this same shape.
     */
    this._translator = undefined;

    this._pipeline = new TranslationPipeline(this);
    this._activations = new Activations(this);
  }

  get _store() {
    return this._firestoreRedux.store;
  }

  /**
   * Configures the Translator - one of the two required integrator inputs, alongside
   * `setLanguage`. There is no default; nothing translates until both are set.
   *
   * Both URL forms send `credentials: 'include'` and require the server to match
   * wiki/translation/translate-api.openapi.yml exactly. Anything else - custom headers, a non-JSON
   * body, a different response envelope - needs the function form.
   *
   * @param {String|Object|Function} translator A URL String (`GET`, query params); `{ url, method }`
   *  where `method` is `'GET'` (default) or `'POST'` (JSON body); or a function
   *  `({ targetLanguage, items }) => Promise<{ targetLanguage, items }>`.
   */
  setTranslator(translator) {
    this._translator = toTranslatorFunction(translator);
  }

  /**
   * Sets the single, app-wide target language every activation translates into. Doesn't need to be
   * called before `start` - an activation can start first and simply won't translate until a
   * language is set.
   * @param {String} language Target language. Mandatory.
   */
  setLanguage(language) {
    if (!this._store) {
      throw "firestore-redux > translation.setLanguage : firestore-redux is not initialized yet.";
    }

    if (!language || typeof language !== "string") {
      throw `firestore-redux > translation.setLanguage : language must be a non-empty String. ${language}`;
    }

    if (language === translationSelectors.language(this._store.getState())) {
      return;
    }

    this._store.dispatch(actions.setLanguage(language));
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

  /**
   * Starts translation for a document scope. Already-loaded matching documents are translated once;
   * matching documents retrieved later are handled the same way. Multiple activations can coexist
   * under different ids, covering different or overlapping scopes - all translating into the one
   * current language.
   * @param {Object} param0
   *  @property {String} id Caller-chosen activation id. Mandatory.
   *  @property {Function} filterFunction `(doc, collection) => Boolean`. Mandatory.
   */
  start({ id, filterFunction } = {}) {
    this._activations.start({ id, filterFunction });
  }

  /**
   * Changes an existing activation's scope. Only valid between `start` and `stop` for that id.
   * @param {String} id Activation id.
   * @param {Object} param1
   *  @property {Function} filterFunction New `(doc, collection) => Boolean`. Mandatory.
   */
  update(id, { filterFunction } = {}) {
    this._activations.update(id, { filterFunction });
  }

  /**
   * Stops and removes an activation. A document it translated is kept if another still-active
   * activation still matches it.
   * @param {String} id Activation id.
   */
  stop(id) {
    this._activations.stop(id);
  }

  /**
   * Sends a document's translatable fields through the pipeline. Every caller funnels through here:
   * the initial scan, a document update, and a language change.
   * @param {Object} param0
   *  @property {String} collection Collection / Subcollection ID.
   *  @property {String} docId Document Id.
   *  @property {Array} fields Translatable fields, as `translatableFields` returns them.
   *  @property {Boolean} debounce `true` only for an existing-document update.
   * @private
   */
  _translateDocument({ collection, docId, fields, debounce }) {
    this._pipeline.translate({ collection, docId, fields, debounce });
  }
}
