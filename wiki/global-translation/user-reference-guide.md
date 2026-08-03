# Global Translation — Reference Guide

See [README.md](./README.md) for why it works this way, and
[state.md](./state.md) for internal state shape and behavior.

Auto-translates documents matching a declared schema — no per-consumer collect/dispatch loop. A
consumer declares which collections/fields are translatable, activates translation for a language and
scope, and reads data exactly as before: `firestoreRedux.selectors.doc` / `docsByQuery` / etc. return
translated content once available, the original otherwise.

## Configuring a schema

Per collection, before activating translation:

- Which fields are translatable, and their content type: `PLAIN` (default) or `MARKDOWN`/`HTML`.
- An explicit skip list, beyond the automatic defaults below.

**Automatic default skips (overridable)**: numeric values; date/time-shaped values; enum-shaped values,
detected as a single `ALL_CAPS_WITH_UNDERSCORES` token (e.g. `IN_PROGRESS`). Unspecified fields
translate by default (`PLAIN`) unless skipped.

Whether a field is translated for meaning or transliterated (rendered in the target script, e.g. for
personal names) is the translate implementation's own concern, not declared in this schema.

## `firestoreRedux.setTranslationSchema`

Configures the per-field schema, for every translatable collection at once — the first of the two
[required integrator inputs](./README.md#required-integrator-inputs). A single call, not one per
collection; calling it again replaces the whole schema.

```js
firestoreRedux.setTranslationSchema({
  cards: {
    title: { contentType: 'PLAIN' },
    description2: { contentType: 'HTML' },
    status: { skip: true },
  },
  boards: {
    name: { contentType: 'PLAIN' },
  },
});
```

##### Arguments

- `schema (Object)` Key = collection or subcollection ID. Value = that collection's field schema: key =
  field path, value = `{ contentType, skip }`, both optional — `contentType` defaults to `PLAIN`, `skip`
  defaults to `false` (beyond the automatic default skips above).

##### returns

- Nothing.

## `firestoreRedux.setTranslateImplementation`

Configures the translate implementation — the second required integrator input. Either a server API URL
or a JS function, both following the same request/response shape: `items`, keyed by an opaque id the
library generates, each `{ text, hints? }` in (`hints`, e.g. `["user_name"]`, transliterates instead of
translating that item); the same keys back, each `{ text, success, error? }`.

The URL form only supports a `GET` request — no request body. A **POST** API (needed to send `items` in
a body — this includes Kerika's own `POST /ai/translate`) can't be configured as a plain URL; use the
**function** form instead, and make the `POST` call yourself.

```js
// URL — GET only, no body. The library calls it with credentials: 'include' (the app's existing
// cookie-based session travels automatically) and expects { targetLanguage, items } back.
firestoreRedux.setTranslateImplementation('https://api.example.com/translate');

// Function — required for a POST API. Same request/response contract, called in-process instead of
// over HTTP; you make the call (and choose the method) yourself.
firestoreRedux.setTranslateImplementation(async ({ targetLanguage, items }) => {
  const translatedItems = await callMyTranslateService(targetLanguage, items); // { [id]: { text, success, error? } }
  return { targetLanguage, items: translatedItems };
});

// Kerika reference (function form) — Kerika's /ai/translate is a POST API, so it's configured this way,
// reusing pwa's own authenticated `requestApi` helper (the same one every other feature calls through).
firestoreRedux.setTranslateImplementation(({ targetLanguage, items }) =>
  requestApi('/ai/translate', { method: 'POST', body: { targetLanguage, items } })
);
```

##### Arguments

- `implementation (String | Function)` A server API URL, or a function
  `({ targetLanguage, items }) => Promise<{ targetLanguage, items }>`. Mandatory before
  [activation](#firestorereduxactivatetranslation).

##### returns

- Nothing.

## `firestoreRedux.activateTranslation`

Activates translation for a language and a document scope.

```JS
firestoreRedux.activateTranslation({ id, language, filterFunction });
```

```js
// Kerika reference — one broad activation, started when a salesman begins impersonating, covers all
// four surfaces (AI Helper, Board, Card, Home) with a single call.
firestoreRedux.activateTranslation({
  id: 'impersonate',
  language: impersonateLang, // salesman's saved device choice, or English
  filterFunction: () => true,
});
```

##### Arguments

- `id (String)` Caller-chosen identifier for this activation. Mandatory.
- `language (String)` Target language.
- `filterFunction (Function)` Determines which documents are in scope. A "translate everything" call is
  simply a filter that matches every document; a narrower one (e.g. a single record for a manual
  on-demand translation) is the same mechanism with a tighter filter.

##### returns

- Nothing.

Multiple activations can coexist under different `id`s. Refuses to activate without both a schema
([above](#configuring-a-schema)) and a translate implementation configured — see
[Required integrator inputs](./README.md#required-integrator-inputs) — there is no default
translate function.

## `firestoreRedux.updateTranslation`

Updates an existing activation's language and/or scope.

```JS
firestoreRedux.updateTranslation(id, { language, filterFunction });
```

##### Arguments

- `id (String)` The activation's id. Mandatory.
- `language (String)` New target language. Optional.
- `filterFunction (Function)` New scope. Optional.

##### returns

- Nothing.

See [Behaviors](./state.md#behaviors) (item 4) for what happens to documents that
enter or leave scope.

## `firestoreRedux.deleteTranslation`

Stops and removes an activation.

```JS
firestoreRedux.deleteTranslation(id);
```

```js
// Kerika reference — stop translating when the salesman ends the impersonated session.
firestoreRedux.deleteTranslation('impersonate');
```

##### Arguments

- `id (String)` The activation's id. Mandatory.

##### returns

- Nothing.

## Reading translated content

No new selectors are needed for the common case — `firestoreRedux.selectors.doc`,
`docsByQuery`, `allDocs`, etc. transparently return translated content once available, the original
otherwise, for any document matching an active schema + activation.

An optional per-document status is available for callers that want it (e.g. a translating indicator).

## `firestoreRedux.selectors.translationStatus`

Gets a document's translation status.

```JS
const status = firestoreRedux.selectors.translationStatus(state, collection, docId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `docId (String)` Document Id.

##### returns

- `(String | undefined)` One of `IN_PROGRESS`, `DONE`, `FAILED`. `undefined` when the document hasn't
  been reached by translation yet — there is no `PENDING` value. Per document, not per field: a document
  with a mix of succeeded and failed fields reports `DONE`; a caller that needs to know whether a
  specific field failed reads that field's own value (`null` on failure).
