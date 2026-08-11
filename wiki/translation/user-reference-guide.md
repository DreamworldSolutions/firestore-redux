# Translation — Reference Guide

This is for integrators who've read [README.md](./README.md) and want the full activation-lifecycle
method list: configuring a Translator, setting a language, and starting, updating, and stopping
translation. For schema configuration see [schema-reference.md](./schema-reference.md); for selectors
see [selectors-reference.md](./selectors-reference.md); for internal state shape and behavior see
[state.md](./state.md).

Auto-translates documents matching a declared schema — no per-consumer collect/dispatch loop. A
consumer configures a Translator, sets a target language, optionally declares a schema, starts
translation for a document scope, and reads data exactly as before:
`firestoreRedux.selectors.doc` / `docsByQuery` / etc. return translated content once available, the
original otherwise.

## `firestoreRedux.translation.setTranslator`

Configures the Translator — one of the two required integrator inputs (the other is
[the language](#firestorereduxtranslationsetlanguage)). Either a server API URL or a JS function, both
following the same request/response shape: `items`, keyed by an opaque id the library generates, each
`{ text, contentType, hints? }` in (`contentType` is the schema's declared value for that field, or
absent when the schema left it undeclared — a capable Translator can auto-detect plain/markdown/HTML/MDX
in that case, a simpler one can just treat it as plain text; `hints`, e.g. `["user_name"]`,
transliterates instead of translating that item — training the Translator to transliterate correctly
for a given hint is the Translator's own responsibility, not something this library configures); the
same keys back, each `{ text, success, error? }`.

The URL form covers both `GET` and `POST`: a plain string, or `{ url }` with no `method`, defaults to
`GET` (query params); `{ url, method: 'POST' }` is `POST` (`{ targetLanguage, items }` sent as a JSON
body). Both are called with `credentials: 'include'` — the app's existing cookie-based session travels
automatically. See
[translate-api.openapi.yml](./translate-api.openapi.yml) for the exact contract of each — **the URL form
only works if your server API's request and response match that contract exactly** (same param/field
names, same request shape for the method you pick, same response shape); there's no room to adapt or
rename anything in this form. If your API's shape differs at all — different field names, extra
required params, a different response envelope — or you need something the contract doesn't cover at
all (custom headers, a non-JSON body, auth beyond `credentials: 'include'`), use the **function** form
instead — see [translator-function-spec.md](./translator-function-spec.md) for its full contract; you
make the call (and choose the method, and adapt the shape) yourself.

```js
// URL (GET) — query params, per translate-api.openapi.yml.
firestoreRedux.translation.setTranslator('https://api.example.com/translate');

// URL (POST) — { targetLanguage, items } sent as a JSON body instead, same credentials: 'include'
// behavior, per translate-api.openapi.yml.
firestoreRedux.translation.setTranslator({ url: 'https://api.example.com/translate', method: 'POST' });

// Function — for anything the URL form doesn't cover (custom headers, non-JSON body, other auth).
// Same request/response contract, called in-process instead of over HTTP.
firestoreRedux.translation.setTranslator(async ({ targetLanguage, items }) => {
  const translatedItems = await callMyTranslateService(targetLanguage, items); // { [id]: { text, success, error? } }
  return { targetLanguage, items: translatedItems };
});
```

##### Arguments

- `translator (String | Object | Function)` A server API URL, defaulting to `GET`; or `{ url, method? }`
  where `method` is `'GET'` (default, same as the plain-string form) or `'POST'`; or a function
  `({ targetLanguage, items }) => Promise<{ targetLanguage, items }>`. Mandatory before
  [starting translation](#firestorereduxtranslationstart).

##### returns

- Nothing.

##### Errors

- Throws immediately if the argument isn't one of the three accepted forms, or if `method` is
  anything other than `'GET'`/`'POST'`.
- A non-2xx response from either URL form fails that batch's items — each keeps its original value
  and is recorded in
  [`translation.failedFields`](./selectors-reference.md#firestorereduxselectorstranslationfailedfields),
  exactly as a per-item `success: false` would. Other in-flight batches are unaffected.
- The `GET` form appends its params to whatever the configured URL already carries, so a URL with an
  existing query string keeps it.

## `firestoreRedux.translation.setLanguage`

Sets the current target language — the other required integrator input, alongside
[the Translator](#firestorereduxtranslationsettranslator). This is a single, app-wide value, not something each
activation configures for itself: every activation, however many are running, translates into whatever
language this call last set.

```JS
firestoreRedux.translation.setLanguage(language);
```

```js
// Example — set once at startup, and again whenever the viewer changes their language.
firestoreRedux.translation.setLanguage('hi');
```

##### Arguments

- `language (String)` Target language. Mandatory.

##### returns

- Nothing.

Throws if `language` is missing, empty, or not a String. Calling it again with the value it already
holds is a no-op — no re-translation pass is triggered for a language that didn't actually change.

Calling this again with a different value re-translates every document currently covered by any active
activation — see [state.md#behaviors](./state.md#behaviors) item 6. It does not need to be called
before [`translation.start`](#firestorereduxtranslationstart) — an activation can start first and simply
won't have anything to translate until a language is set — but nothing translates until both this and a
Translator are configured.

## `firestoreRedux.translation.start`

Starts translation for a document scope.

```JS
firestoreRedux.translation.start({ id, filterFunction });
```

```js
// Example — one broad activation, started for an entire session, covering every collection at once.
firestoreRedux.translation.start({
  id: 'session',
  filterFunction: () => true,
});
```

##### Arguments

- `id (String)` Caller-chosen identifier for this activation. Mandatory.
- `filterFunction (Function)` `(doc, collection) => Boolean`. Determines which documents are in scope.
  Called for each candidate document together with the collection (or subcollection) ID it belongs to
  — an activation isn't limited to one collection (translating everything a user sees typically spans
  several collections at once), and document IDs aren't guaranteed unique across collections, so
  `collection` is how a filter narrows to the right one. A "translate everything" call is simply
  `() => true`, matching every document regardless of collection; a narrower one — e.g. a single record
  for the main, on-demand use case — checks both, e.g.
  `(doc, collection) => collection === 'posts' && doc.id === postId`.

##### returns

- Nothing.

Multiple activations can coexist under different `id`s, covering different (or overlapping) scopes —
see [state.md#behaviors](./state.md#behaviors). All of them translate into the one current language;
there's no per-activation language. Refuses to translate anything without both a Translator and a
language configured — see [`translation.setTranslator`](#firestorereduxtranslationsettranslator) and
[`translation.setLanguage`](#firestorereduxtranslationsetlanguage) — there is no default for either.

## `firestoreRedux.translation.update`

Updates an existing activation's scope. Only valid between `translation.start` and `translation.stop` for
that `id` — rejected if `id` is unknown (never started, or already stopped). Once stopped, an `id` can
be started again (fresh), but not updated.

```JS
firestoreRedux.translation.update(id, { filterFunction });
```

##### Arguments

- `id (String)` The activation's id. Mandatory — must currently be started.
- `filterFunction (Function)` New scope, same `(doc, collection) => Boolean` signature as
  [`translation.start`](#firestorereduxtranslationstart). Mandatory (this call only ever changes scope —
  to change language, use [`translation.setLanguage`](#firestorereduxtranslationsetlanguage) instead,
  which applies to every activation at once).

##### returns

- Nothing.

See [Behaviors](./state.md#behaviors) (item 4) for what happens to documents that
enter or leave scope.

## `firestoreRedux.translation.stop`

Stops and removes an activation.

```JS
firestoreRedux.translation.stop(id);
```

```js
// Example — stop translating when the session ends.
firestoreRedux.translation.stop('session');
```

##### Arguments

- `id (String)` The activation's id. Mandatory.

##### returns

- Nothing.

See [Behaviors](./state.md#behaviors) (item 5) — a document this activation translated isn't removed
if some other still-active activation still matches it.

## Configuring a Schema, and Reading Translated Content

Both optional, and both documented elsewhere so this stays a pure activation-lifecycle reference:

- [schema-reference.md](./schema-reference.md) — declaring which fields translate, their content type,
  and skip rules.
- [selectors-reference.md](./selectors-reference.md) — reading translated content and its status.
