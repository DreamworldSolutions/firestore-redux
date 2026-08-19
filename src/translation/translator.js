/**
 * Normalizes every accepted `setTranslator` form into the one shape the pipeline calls:
 * `({ targetLanguage, items }) => Promise<{ targetLanguage, items }>`.
 *
 * Both URL forms send `credentials: 'include'`, so the app's existing cookie-based session travels
 * automatically, and both require the server to match wiki/translation/translate-api.openapi.yml
 * exactly - nothing is renamed or re-shaped on the way in or out. Anything else needs the function
 * form, where the integrator makes the call themselves.
 *
 * @param {String|Object|Function} translator A URL string (GET); `{ url, method }` where `method` is
 *  `'GET'` (default) or `'POST'`; or a function already implementing the contract.
 * @returns {Function} The Translator function.
 * @throws {Error} When the argument isn't one of the three accepted forms.
 */
export const toTranslatorFunction = (translator) => {
  if (typeof translator === "function") {
    return translator;
  }

  if (typeof translator === "string") {
    return urlTranslator(translator, "GET");
  }

  if (translator && typeof translator.url === "string") {
    const method = (translator.method || "GET").toUpperCase();
    if (method !== "GET" && method !== "POST") {
      throw new Error(`firestore-redux > translation.setTranslator : method must be 'GET' or 'POST'. ${translator.method}`);
    }
    return urlTranslator(translator.url, method);
  }

  throw new Error(`firestore-redux > translation.setTranslator : translator must be a URL String, { url, method }, or a Function. ${translator}`);
};

/**
 * @param {String} url Translate endpoint.
 * @param {String} method `'GET'` or `'POST'`.
 * @returns {Function} Translator function issuing that request.
 * @private
 */
const urlTranslator = (url, method) => async ({ targetLanguage, items }) => {
  const response =
    method === "POST"
      ? await fetch(url, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetLanguage, items }),
        })
      : await fetch(requestUrlWithQuery(url, targetLanguage, items), {
          method: "GET",
          credentials: "include",
        });

  if (!response.ok) {
    throw new Error(`firestore-redux > translation : translate request failed with ${response.status}.`);
  }

  return response.json();
};

/**
 * Builds the GET form's URL. `items` travels JSON-encoded in a single query param, per the contract.
 * Existing query params on the configured URL are preserved.
 * @private
 */
const requestUrlWithQuery = (url, targetLanguage, items) => {
  const separator = url.includes("?") ? "&" : "?";
  const query = new URLSearchParams({
    targetLanguage,
    items: JSON.stringify(items),
  });
  return `${url}${separator}${query}`;
};
