# Translation — Selectors Reference

This is a reference for reading translated content and its status. See [README.md](./README.md) to
get started, and [state.md](./state.md) for the state shape these read from.

## Reading Translated Content

No new selectors are needed for the common case — `firestoreRedux.selectors.doc`, `docsByQuery`,
`allDocs`, etc. transparently return the translated document once available (a full clone, in the
current language — see [state.md#translateddoc](./state.md#translateddoc)), the original otherwise,
for any document matching a live activation. This is the **document translation selector**: you don't
call anything new, your existing read calls just start returning translated content once it's ready.

## `firestoreRedux.selectors.translation.language`

Gets the current target language — the same value last passed to
[`translation.setLanguage`](./user-reference-guide.md#firestorereduxtranslationsetlanguage). A single,
app-wide value; there's no per-activation or per-document language to look up.

```JS
const language = firestoreRedux.selectors.translation.language(state);
```

##### Arguments

- `state (Object)` Redux state.

##### returns

- `(String | undefined)` The current language, or `undefined` if `translation.setLanguage` hasn't been
  called yet.

## `firestoreRedux.selectors.translation.status`

Gets a document's overall translation status, in the current language.

```JS
const status = firestoreRedux.selectors.translation.status(state, collection, docId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `docId (String)` Document Id.

##### returns

- `(String)` One of `PENDING`, `IN_PROGRESS`, `SUCCESS`, `PARTIAL_FAILURE`, `FAILED` — always a string,
  never `undefined`. `PENDING` means the document hasn't been reached by translation yet — there's no
  stored state for it (see [state.md#docstatus](./state.md#docstatus)), but this selector still returns
  a real value for it rather than `undefined`, so callers don't need a separate existence check before
  switching on the result. `PARTIAL_FAILURE` means some but not all translatable fields failed; use
  [`translation.failedFields`](#firestorereduxselectorstranslationfailedfields) to find out which ones. Recomputed from scratch
  whenever the language changes (via `translation.setLanguage`) — see
  [state.md#behaviors](./state.md#behaviors) item 6.

## `firestoreRedux.selectors.translation.failedFields`

Gets the list of fields whose translation failed, for a document, in the current language.

```JS
const failed = firestoreRedux.selectors.translation.failedFields(state, collection, docId);
```

##### Arguments

- `state (Object)` Redux state.
- `collection (String)` Collection ID.
- `docId (String)` Document Id.

##### returns

- `(String[])` Field paths (schema key format, e.g. `'address.city'`, `'members[0].name'`) that failed
  translation on the most recent attempt. Always an array, never `undefined` — empty both when
  `translation.status` is `SUCCESS` and when it's `PENDING` (nothing attempted yet, so nothing has
  failed).

A failed field's value on the translated document itself is **not** `null` — it's the original,
source-language value, so a caller that only reads the document (via `doc`/`docsByQuery`/etc.) never
sees a hole; a caller that specifically needs to know what failed reads this selector.
