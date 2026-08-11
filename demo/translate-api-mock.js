/**
 * A `/translate` endpoint implementing wiki/translation/translate-api.openapi.yml, served alongside
 * the demo by web-dev-server so the URL forms of `translation.setTranslator` can be exercised over
 * real HTTP.
 *
 * This is demo/test infrastructure - it is not part of the published library.
 *
 * Beyond translating, it records what it actually received (method, query params, body, and whether
 * a cookie arrived), so the demo can assert the request shape server-side rather than trusting the
 * client's own view of it. `GET /translate/__received` returns those records.
 */
const received = [];

/**
 * Marks the text as translated without touching any markup, so a `contentType`-declared field still
 * passes the fidelity check.
 */
const translate = (text, targetLanguage) => {
  const prefix = `[${targetLanguage}] `;
  const firstTag = text.indexOf("<");
  // Put the marker inside the leading tag when there is one, so the tag multiset is unchanged.
  if (firstTag === 0) {
    const tagEnd = text.indexOf(">");
    return tagEnd === -1 ? prefix + text : `${text.slice(0, tagEnd + 1)}${prefix}${text.slice(tagEnd + 1)}`;
  }
  return prefix + text;
};

const respond = (targetLanguage, items) => {
  const translated = {};
  Object.entries(items || {}).forEach(([id, item]) => {
    translated[id] = { text: translate(item.text, targetLanguage), success: true };
  });
  return { targetLanguage, items: translated };
};

const readBody = (request) =>
  new Promise((resolve) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => resolve(body));
  });

/**
 * @returns {Function} Koa middleware for web-dev-server.
 */
export const translateApiMock = () => async (ctx, next) => {
  const path = ctx.path;

  if (path === "/translate/__received") {
    ctx.type = "application/json";
    ctx.body = JSON.stringify(received);
    return;
  }

  if (path === "/translate/__reset") {
    received.length = 0;
    ctx.type = "application/json";
    ctx.body = "{}";
    return;
  }

  if (path !== "/translate") {
    return next();
  }

  const record = {
    method: ctx.method,
    query: { ...ctx.query },
    contentType: ctx.get("content-type") || null,
    cookie: ctx.get("cookie") || null,
    origin: ctx.get("origin") || null,
  };

  let targetLanguage;
  let items;

  if (ctx.method === "GET") {
    targetLanguage = ctx.query.targetLanguage;
    try {
      items = JSON.parse(ctx.query.items || "{}");
    } catch (error) {
      items = undefined;
    }
    record.itemsParsedFromQuery = items;
  } else if (ctx.method === "POST") {
    const raw = await readBody(ctx.req);
    record.rawBody = raw;
    try {
      const parsed = JSON.parse(raw || "{}");
      targetLanguage = parsed.targetLanguage;
      items = parsed.items;
    } catch (error) {
      items = undefined;
    }
  } else {
    ctx.status = 405;
    return;
  }

  if (!targetLanguage || !items) {
    record.rejected = "missing targetLanguage or items";
    received.push(record);
    ctx.status = 400;
    ctx.type = "application/json";
    ctx.body = JSON.stringify({ error: record.rejected });
    return;
  }

  record.targetLanguage = targetLanguage;
  record.itemIds = Object.keys(items);
  record.itemCount = record.itemIds.length;
  // Recorded so the demo can prove an undeclared contentType arrived genuinely absent.
  record.itemKeys = Object.fromEntries(Object.entries(items).map(([id, item]) => [id, Object.keys(item)]));
  received.push(record);

  ctx.type = "application/json";
  ctx.body = JSON.stringify(respond(targetLanguage, items));
};
