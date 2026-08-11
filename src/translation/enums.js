/**
 * Content type of an item's `text`, as declared in the schema and forwarded to the Translator.
 * See wiki/translation/state.md#enums.
 */
export const ContentType = {
  PLAIN: "PLAIN",
  MARKDOWN: "MARKDOWN",
  HTML: "HTML",
};

/**
 * A document's overall translation status, as stored at `/translations.status.$collection.$docId`.
 *
 * `PENDING` is deliberately absent: it is never stored. A document translation hasn't reached yet
 * simply has no entry, and the `translation.status` selector turns "no entry" into `PENDING` for
 * its callers. See wiki/translation/state.md#docstatus.
 */
export const Status = {
  IN_PROGRESS: "IN_PROGRESS",
  SUCCESS: "SUCCESS",
  PARTIAL_FAILURE: "PARTIAL_FAILURE",
  FAILED: "FAILED",
};
