# Translation

**Translation** is a capability of `firestore-redux` (this library — an offline-first + real-time
Firestore + Redux binding) that automatically translates Firestore content into a target language at
read time. This is the entry point for integrators wiring it into their own app. For usage scenarios
beyond the minimum below see [user-guide.md](./user-guide.md); for the full reference set — methods,
schema, selectors, state, architecture — see [Reference Guides](#reference-guides) at the bottom.

## Why

Firestore documents often carry fields a user typed in their own language — a post's title, a
comment's body, a project's description. When a *different* user views that same content in a
different language, it needs to be translated. This capability does exactly that and nothing more: it
translates existing user-generated content at render time, once, and substitutes the translated
version transparently wherever the app already reads that document. It is **not** an i18n replacement
— i18n tooling like `i18next` translates an app's own fixed UI strings (button labels, menu text,
captions written by the app's developers); this capability never touches any of that, only
user-authored content — and it is **not** pre-translation: it doesn't produce or store translated
copies ahead of time for later reuse (a separate pattern some apps use); translation happens once, at
the moment it's needed.

The main use case is narrow and manual: a single user translates a single record they're viewing, on
demand. A concrete example, used throughout this guide: two people share a post. One wrote its body in
English; the other doesn't read English but does read Hindi, and opens the same post with Hindi
selected as their language — they see a Hindi translation of that body in place of the English
original. The same mechanism also supports a broader, automatic use — an app translating everything a
user sees across a session or view — but that's secondary, not what this capability was designed
around.

## Required Integrator Input

Getting this running takes three calls. The first two are required; the third is where you actually
say what to translate.

**1. Configure a [Translator](./user-reference-guide.md#firestorereduxtranslationsettranslator).** Either a server
API URL (`GET` or `POST`) or a JS function — whatever your app's own translate endpoint looks like. This
library has no default; it always calls out to yours.

```js
firestoreRedux.translation.setTranslator({ url: '/translate', method: 'POST' });
```

**2. [Set a language](./user-reference-guide.md#firestorereduxtranslationsetlanguage).** One value,
app-wide — every activation translates into it, however many activations you run. No default; nothing
translates until this is called.

```js
firestoreRedux.translation.setLanguage('hi');
```

**3. [Start translation](#activations)**, scoped to what you need — the post from the example above:

```js
firestoreRedux.translation.start({
  id: 'post-view',
  filterFunction: (doc, collection) => collection === 'posts' && doc.id === postId, // narrow: this one record
});
```

That's the whole minimum. Nothing changes at the read site —
[`doc`, `docsByQuery`, `allDocs`, etc.](#reading-translated-content) transparently return the Hindi
translation once it's ready, the English original until then. Stop when the post's closed:

```js
firestoreRedux.translation.stop('post-view');
```

Change the language later with another `translation.setLanguage` call — every running activation
re-translates into it automatically, no per-activation update needed.

A [schema](./schema-reference.md) is **optional** on top of all this — the default behavior (translate
every string field, skip anything that looks numeric, boolean, date/time-shaped, or enum-shaped) needs
no configuration at all; most integrations never declare one. Declare a schema only to fine-tune it:

- A field is being translated that shouldn't be (wastes translate calls, or worse — a value that's
  meant to be an `ALL_CAPS_WITH_UNDERSCORES` enum but isn't quite shaped like one gets translated and
  stops matching its `enum`).
- A field needs a specific content type (`MARKDOWN`/`HTML`) so it translates correctly instead of as
  plain text.

## How Translation Actually Happens

Your Translator is the only thing that actually translates text — `fetch('/translate', ...)` above, in
the example. Once it's configured, a language is set, and an activation is started, this library owns
everything else: deciding what needs translating, calling your Translator in batches, storing the
result in Redux, and serving it back out through the selectors you already use. You never touch that
machinery — that separation is what makes the three calls above the whole integration.

One thing worth knowing as an integrator: **failure is isolated per field.** One field failing doesn't
affect its siblings on the same document. A failed field keeps its original, source-language value —
never blanked to `null` — while the failure itself is tracked in
[`translation.failedFields`](./selectors-reference.md#firestorereduxselectorstranslationfailedfields), separate from the
document's overall [`translation.status`](./selectors-reference.md#firestorereduxselectorstranslationstatus),
which reports `PARTIAL_FAILURE` rather than masking the failure as success.

For how batching and the wire addressing between this library and your Translator work internally, see
[architecture.md#chunking-and-wire-addressing](./architecture.md#chunking-and-wire-addressing).
Preserving a source's HTML/Markdown structure through translation is the Translator's responsibility —
see [translator-function-spec.md](./translator-function-spec.md#contract-notes).

## Activations

```
translation.start({ id, filterFunction })
translation.update(id, { filterFunction })
translation.stop(id)
```

`filterFunction(doc, collection)` determines which documents are in scope — a single record, as in the
post example above, for the main, narrow use case; the same call with a wider filter (e.g.
`() => true`) covers the broader, automatic use case instead — translating everything currently
loaded, across every collection, for the whole session.

**Activations don't carry a language** — that's set once, app-wide, via
[`translation.setLanguage`](./user-reference-guide.md#firestorereduxtranslationsetlanguage), and every
activation translates into it. Multiple activations can coexist under different ids, covering different
(or overlapping) scopes at the same time — e.g. one for `posts`, another for `comments` — but they all
share the one current language; there's no per-activation override. Changing the language once updates
every one of them — see [state.md#behaviors](./state.md#behaviors) for exactly what happens to a
document's translated data as activations start, update, and stop, and as the language changes.

Full signatures: [user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationstart).

## Reading Translated Content

No new selectors for the common case — `doc`, `docsByQuery`, `allDocs`, etc. transparently return
translated content once available, the original otherwise. Optional status and failed-field selectors
are available for callers that want them (e.g. a translating indicator) — see
[selectors-reference.md](./selectors-reference.md).

## Reference Guides

- [user-guide.md](./user-guide.md) — common usage, basic and advanced scenarios, customization.
- [user-reference-guide.md](./user-reference-guide.md) — activation lifecycle methods
  (`translation.setTranslator`/`translation.setLanguage`/`translation.start`/`translation.update`/`translation.stop`).
- [schema-reference.md](./schema-reference.md) — declaring a schema, field paths, defaults.
- [selectors-reference.md](./selectors-reference.md) — reading translated content and its status.
- [state.md](./state.md) — internal Redux state shape and behavior.
- [architecture.md](./architecture.md) — internal architecture, responsibilities, and data flow.
- [translate-api.openapi.yml](./translate-api.openapi.yml) — the request/response contract a
  URL-configured Translator must implement.
- [translator-function-spec.md](./translator-function-spec.md) — the same contract for the
  function-configured form.
