# Translation — Translator Function Specification

This is the reference for the function form of `translation.setTranslator` — the contract your JS function must
implement. For the URL/`GET` form's contract see
[translate-api.openapi.yml](./translate-api.openapi.yml). See
[user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationsettranslator) to configure it.

## Signature

```ts
type Translator = (request: TranslateRequest) => Promise<TranslateResponse>;

interface TranslateRequest {
  targetLanguage: string;
  items: Record<string, TranslateItem>; // keyed by an opaque id the library generates
}

interface TranslateItem {
  text: string;
  contentType?: 'PLAIN' | 'MARKDOWN' | 'HTML'; // absent = not declared in schema, see below
  hints?: string[]; // e.g. ['user_name'] — transliterate instead of translate
}

interface TranslateResponse {
  targetLanguage: string;
  items: Record<string, TranslateResponseItem>; // same keys as the request's items
}

interface TranslateResponseItem {
  text: string;
  success: boolean;
  error?: string; // present when success is false
}
```

## Contract Notes

- **Keys are opaque and must be echoed back unchanged.** The library generates them (see
  [architecture.md#fidelity-chunking-and-wire-addressing](./architecture.md#fidelity-chunking-and-wire-addressing)
  for how) — don't parse or rely on their structure, just map each result back onto the same key it
  came in on.
- **`contentType` absent means the schema didn't declare one for that field.** A capable Translator can
  auto-detect plain text vs. Markdown vs. HTML vs. MDX in that case; a simpler one can just treat it as
  plain text. This is deliberately not defaulted to `'PLAIN'` before it reaches you — see
  [schema-reference.md](./schema-reference.md#firestorereduxtranslationsetschema).
- **`hints` requests transliteration, not translation**, for that one item — rendering in the target
  script (e.g. a personal name) rather than translating for meaning. Training your Translator to
  transliterate correctly for a given hint is entirely your own responsibility; this library doesn't
  implement or configure that behavior itself.
- **Partial failure is expected and handled per item**, not per request — return `success: false` and
  an `error` for the items that failed, alongside `success: true` results for the ones that succeeded,
  in the same response. A field reported as failed keeps its original, source-language value in state —
  never `null` — see [state.md#docstatus](./state.md#docstatus).
- **This function is called in-process**, not over HTTP — you make whatever network call you need
  (including `POST`, unlike the [URL form](./translate-api.openapi.yml), which is `GET`-only) and
  resolve the promise with the result.

## Example

```js
// Example — a POST endpoint, configured with fetch directly, using credentials: 'include' so the
// app's existing cookie-based session travels automatically.
firestoreRedux.translation.setTranslator(({ targetLanguage, items }) =>
  fetch('/translate', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLanguage, items }),
  }).then((res) => res.json())
);
```
