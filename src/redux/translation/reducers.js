import * as actions from "./actions.js";
import get from "lodash-es/get.js";
import set from "lodash-es/set.js";
import isEmpty from "lodash-es/isEmpty.js";
import forEach from "lodash-es/forEach.js";
import cloneDeep from "lodash-es/cloneDeep.js";
import { ReduxUtils } from "@dreamworld/pwa-helpers/redux-utils.js";

/**
 * `docs` and `status` are separate branches on purpose: a document's own real field - even one
 * literally named `status` or `failedFields` - lives inside `docs` and can never collide with the
 * translation metadata in `status`. `language` is one top-level value, not keyed by activation or
 * document. See wiki/translation/state.md.
 */
const INITIAL_STATE = {
  language: undefined,
  activations: {},
  schema: {},
  docs: {},
  status: {},
};

const translationReducer = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case actions.SET_LANGUAGE:
      return ReduxUtils.replace(state, "language", action.language);

    case actions.SET_SCHEMA:
      // Replaced entirely, never merged into what was declared before.
      return ReduxUtils.replace(state, "schema", action.schema);

    case actions.ADD_ACTIVATION:
      return ReduxUtils.replace(state, `activations.${action.id}`, {
        id: action.id,
        filterFunction: action.filterFunction,
      });

    case actions.REMOVE_ACTIVATION:
      return ReduxUtils.replace(state, `activations.${action.id}`, undefined);

    case actions.SET_TRANSLATED_DOC:
      return ReduxUtils.replace(
        state,
        `docs.${action.collection}.${action.docId}`,
        action.doc
      );

    case actions.SET_TRANSLATED_FIELDS: {
      const docPath = `docs.${action.collection}.${action.docId}`;
      const clone = get(state, docPath);
      if (!clone) {
        return state;
      }

      const newClone = cloneDeep(clone);
      forEach(action.fields, (value, fieldPath) => set(newClone, fieldPath, value));
      return ReduxUtils.replace(state, docPath, newClone);
    }

    case actions.SET_DOC_STATUS:
      return ReduxUtils.replace(
        state,
        `status.${action.collection}.${action.docId}`,
        { status: action.status, failedFields: action.failedFields || [] }
      );

    case actions.REMOVE_DOC_TRANSLATION:
      state = removeDocEntry(state, "docs", action.collection, action.docId);
      return removeDocEntry(state, "status", action.collection, action.docId);

    default:
      return state;
  }
};

/**
 * Removes one document's entry from a branch, and the collection map with it once that was its last
 * document - activations start and stop continuously, so collections must not accumulate as empty
 * maps for the rest of the session.
 * @param {Object} state Translation state.
 * @param {String} branch Either `docs` or `status`.
 * @param {String} collection Collection / Subcollection ID.
 * @param {String} docId Document Id.
 * @returns {Object} New translation state.
 * @private
 */
const removeDocEntry = (state, branch, collection, docId) => {
  const collectionPath = `${branch}.${collection}`;
  const newState = ReduxUtils.replace(state, `${collectionPath}.${docId}`, undefined);
  return isEmpty(get(newState, collectionPath))
    ? ReduxUtils.replace(newState, collectionPath, undefined)
    : newState;
};

export default translationReducer;
