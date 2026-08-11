import isPlainObject from "lodash-es/isPlainObject.js";
import isArray from "lodash-es/isArray.js";
import forEach from "lodash-es/forEach.js";
import { ContentType } from "./enums.js";

/**
 * Root fields that are identity, not content. Translating a document ID would break every lookup
 * keyed by it. Skipped by default like any other automatic skip, so `{ skip: false }` still forces it.
 */
const IDENTITY_ROOT_FIELDS = ["id"];

const NUMERIC = /^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/;
const BOOLEAN = /^(true|false)$/i;
const ENUM_TOKEN = /^[A-Z0-9]+(_[A-Z0-9]+)*$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}([T ]\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?)?$/;
const SLASHED_DATE = /^\d{1,4}\/\d{1,2}\/\d{1,4}$/;
const TIME = /^\d{1,2}:\d{2}(:\d{2}(\.\d+)?)?(\s*[AaPp][Mm])?$/;

/**
 * Validates the shape of a schema before it's stored, so a malformed declaration surfaces at the
 * `translation.setSchema` call instead of silently mistranslating documents later.
 * @param {Object} schema Schema as accepted by `translation.setSchema`.
 * @throws {String} When any level of the schema isn't shaped as documented.
 */
export const assertValidSchema = (schema) => {
  if (schema === undefined || schema === null) {
    return;
  }

  if (!isPlainObject(schema)) {
    throw `firestore-redux > translation.setSchema : schema must be an Object. ${schema}`;
  }

  forEach(schema, (documentSchemas, collection) => {
    if (!isPlainObject(documentSchemas)) {
      throw `firestore-redux > translation.setSchema : schema.${collection} must be a Map of document Id (or '*') to its field schema.`;
    }

    forEach(documentSchemas, (fieldSchemas, documentId) => {
      if (!isPlainObject(fieldSchemas)) {
        throw `firestore-redux > translation.setSchema : schema.${collection}.${documentId} must be a Map of field path to { contentType, skip }.`;
      }

      forEach(fieldSchemas, (fieldSchema, fieldPath) => {
        if (!isPlainObject(fieldSchema)) {
          throw `firestore-redux > translation.setSchema : schema.${collection}.${documentId}.${fieldPath} must be an Object. e.g. { contentType: 'HTML', skip: false }`;
        }

        if (fieldSchema.contentType !== undefined && !ContentType[fieldSchema.contentType]) {
          throw `firestore-redux > translation.setSchema : schema.${collection}.${documentId}.${fieldPath}.contentType must be one of ${Object.keys(
            ContentType
          ).join(", ")}. ${fieldSchema.contentType}`;
        }

        if (fieldSchema.skip !== undefined && typeof fieldSchema.skip !== "boolean") {
          throw `firestore-redux > translation.setSchema : schema.${collection}.${documentId}.${fieldPath}.skip must be a Boolean. ${fieldSchema.skip}`;
        }
      });
    });
  });
};

/**
 * Resolves which field schema applies to a single document.
 *
 * A document's own entry replaces the collection's `'*'` entry wholesale - `'*'` covers every
 * document in the collection that has no more specific entry of its own, so the two are never
 * merged. See wiki/translation/state.md (the `schema` row).
 *
 * @param {Object} schema Whole schema, from `/translations.schema`.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @returns {Object} Map of field path to `{ contentType, skip }`. Empty when nothing is declared.
 */
export const documentFieldSchema = (schema, collection, docId) => {
  const collectionSchema = schema && schema[collection];
  if (!collectionSchema) {
    return {};
  }

  const ownSchema = docId === undefined ? undefined : collectionSchema[docId];
  return ownSchema || collectionSchema["*"] || {};
};

/**
 * Explains why the defaults skip a value, for diagnostics - which rule fired, in words. Overridable
 * per field with `{ skip: false }`.
 * See wiki/translation/schema-reference.md#automatic-default-skips-overridable.
 *
 * @param {String} value Field value. Always a String - non-strings never reach here.
 * @param {String} path Field path, dot/bracket notation.
 * @returns {String|undefined} The rule that skipped it, or `undefined` when nothing does.
 */
export const skipReason = (value, path) => {
  if (IDENTITY_ROOT_FIELDS.includes(path)) {
    return "identity field - a document ID is never content";
  }

  const text = value.trim();
  if (NUMERIC.test(text)) {
    return "numeric-shaped";
  }

  if (BOOLEAN.test(text)) {
    return "boolean-shaped";
  }

  if (ISO_DATE_TIME.test(text) || SLASHED_DATE.test(text) || TIME.test(text)) {
    return "date/time-shaped";
  }

  // Enum-shaped: a single ALL_CAPS_WITH_UNDERSCORES token, e.g. `IN_PROGRESS`.
  if (text.length > 1 && /[A-Z]/.test(text) && ENUM_TOKEN.test(text)) {
    return "enum-shaped (ALL_CAPS_WITH_UNDERSCORES)";
  }

  return undefined;
};

/**
 * @param {String} value Field value. Always a String - non-strings never reach here.
 * @param {String} path Field path, dot/bracket notation.
 * @returns {Boolean} `true` when the defaults skip this field.
 */
export const autoSkipped = (value, path) => skipReason(value, path) !== undefined;

/**
 * Walks a document and collects every field that should be sent for translation, in schema key
 * format. Everything else - non-strings, skipped fields, identity fields - is left out entirely,
 * so `undefined`/`null` values can never reach the Translator.
 *
 * @param {Object} doc Document to walk.
 * @param {String} collection Collection / Subcollection ID the document belongs to.
 * @param {Object} schema Whole schema, from `/translations.schema`.
 * @returns {Array} e.g. `[{ path: 'title', value: 'Hello', contentType: 'PLAIN' }, { path: 'body', value: '...' }]`.
 *  `contentType` is present only when the schema declared one - an undeclared content type is left
 *  genuinely absent rather than defaulted to `PLAIN`, so the Translator can auto-detect it. See
 *  wiki/translation/translator-function-spec.md.
 */
export const translatableFields = (doc, collection, schema) => {
  const fields = [];
  if (!isPlainObject(doc)) {
    return fields;
  }

  collectFields(doc, "", documentFieldSchema(schema, collection, doc.id), fields);
  return fields;
};

/**
 * Recursive half of `translatableFields`.
 * @param {Any} value Value at `path`.
 * @param {String} path Field path built so far. Empty string at the document root.
 * @param {Object} fieldSchema Resolved field schema for this document.
 * @param {Array} fields Accumulator, mutated in place.
 * @private
 */
const collectFields = (value, path, fieldSchema, fields) => {
  const declared = path ? fieldSchema[path] : undefined;

  // Declared on a branch, this prunes the whole subtree below it.
  if (declared && declared.skip === true) {
    return;
  }

  if (isPlainObject(value)) {
    forEach(value, (childValue, key) => {
      collectFields(childValue, path ? `${path}.${key}` : key, fieldSchema, fields);
    });
    return;
  }

  if (isArray(value)) {
    forEach(value, (childValue, index) => {
      collectFields(childValue, `${path}[${index}]`, fieldSchema, fields);
    });
    return;
  }

  // Only text is translatable. Numbers, booleans, `null`, `undefined`, Dates and Firestore
  // Timestamps all stop here, whatever the schema says - there is no text to send.
  if (typeof value !== "string" || !value.trim()) {
    return;
  }

  const forced = declared && declared.skip === false;
  if (!forced && autoSkipped(value, path)) {
    return;
  }

  const field = { path, value };
  if (declared && declared.contentType !== undefined) {
    field.contentType = declared.contentType;
  }
  fields.push(field);
};
