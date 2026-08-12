import get from "lodash-es/get.js";

/**
 * @param {Object} state Redux state.
 * @returns {String|undefined} The current target language - a single, app-wide value. `undefined`
 *  until `translation.setLanguage` is called.
 */
export const language = (state) => get(state, `translations.language`);

/**
 * @param {Object} state Redux state.
 * @returns {Object} Whole translation schema, as last set by `translation.setSchema`. `{}` when none
 *  is declared - the automatic defaults then decide what translates.
 */
export const schema = (state) => get(state, `translations.schema`, {});
