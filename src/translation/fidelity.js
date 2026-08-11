import isEqual from "lodash-es/isEqual.js";
import { ContentType } from "./enums.js";

const HTML_TAG = /<\/?([a-zA-Z][a-zA-Z0-9-]*)\b([^>]*?)\/?>/g;
const HTML_ATTRIBUTE = /([a-zA-Z-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
const MARKDOWN_LINK = /(!?)\[[^\]]*\]\(\s*([^)\s]*)/g;
const MARKDOWN_INLINE_CODE = /`[^`\n]+`/g;
const MARKDOWN_FENCE = /^```/gm;

/**
 * Attributes whose value identifies what a tag points at, rather than what it says. A translator
 * may legitimately rewrite a `title` or `alt`; rewriting one of these would break the link or the
 * mention chip it addresses. `data-*` is included wholesale because that's how mention chips carry
 * the identity they resolve against.
 */
const ADDRESSING_ATTRIBUTES = ["href", "src"];

/**
 * @param {String} text Text to scan.
 * @returns {Array} One token per tag, plus one per addressing attribute on it.
 * @private
 */
const htmlTokens = (text) => {
  const tokens = [];
  let tag;

  HTML_TAG.lastIndex = 0;
  while ((tag = HTML_TAG.exec(text)) !== null) {
    const [raw, name, attributes] = tag;
    tokens.push(`tag:${raw.startsWith("</") ? "/" : ""}${name.toLowerCase()}`);

    let attribute;
    HTML_ATTRIBUTE.lastIndex = 0;
    while ((attribute = HTML_ATTRIBUTE.exec(attributes || "")) !== null) {
      const attributeName = attribute[1].toLowerCase();
      if (ADDRESSING_ATTRIBUTES.includes(attributeName) || attributeName.startsWith("data-")) {
        tokens.push(`${attributeName}:${attribute[3] !== undefined ? attribute[3] : attribute[4]}`);
      }
    }
  }

  return tokens;
};

/**
 * @param {String} text Text to scan.
 * @returns {Array} One token per link/image destination, inline code span, and fence. Emphasis
 *  markers are deliberately not counted - a translator can move them around legitimately.
 * @private
 */
const markdownTokens = (text) => {
  const tokens = [];
  let link;

  MARKDOWN_LINK.lastIndex = 0;
  while ((link = MARKDOWN_LINK.exec(text)) !== null) {
    tokens.push(`${link[1] ? "image" : "link"}:${link[2]}`);
  }

  (text.match(MARKDOWN_INLINE_CODE) || []).forEach(() => tokens.push("code"));
  (text.match(MARKDOWN_FENCE) || []).forEach(() => tokens.push("fence"));
  return tokens;
};

/**
 * Builds the tag multiset a translated string is checked against - sorted, so it compares as a
 * multiset rather than a sequence (a translator may reorder tags to suit the target language's
 * grammar; it may not add, drop, or re-point them).
 *
 * @param {String} text Text to scan.
 * @param {String} contentType `PLAIN`, `MARKDOWN`, `HTML`, or `undefined` when the schema declared
 *  none. `MARKDOWN` also scans HTML, since Markdown permits inline HTML. An undeclared content type
 *  is scanned as HTML only - a genuinely HTML source is the case worth catching, while Markdown link
 *  syntax appearing in ordinary prose would be a false alarm.
 * @returns {Array} Sorted tokens. Empty for `PLAIN`.
 */
export const tagSignature = (text, contentType) => {
  if (contentType === ContentType.PLAIN || typeof text !== "string") {
    return [];
  }

  const tokens =
    contentType === ContentType.MARKDOWN
      ? [...htmlTokens(text), ...markdownTokens(text)]
      : htmlTokens(text);

  return tokens.sort();
};

/**
 * @param {String} source Original, source-language value.
 * @param {String} translated Value the Translator returned.
 * @param {String} contentType Declared content type, or `undefined`.
 * @returns {Boolean} `true` when the translation carries exactly the source's tags. `false` fails
 *  that one item - the original is kept and the field is recorded in `failedFields`.
 */
export const fidelityPreserved = (source, translated, contentType) => {
  if (contentType === ContentType.PLAIN) {
    return true;
  }

  return isEqual(tagSignature(source, contentType), tagSignature(translated, contentType));
};
