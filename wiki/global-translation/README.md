# Global Translation

This document explains why Global Translation works the way it does; see
[user-reference-guide.md](./user-reference-guide.md) for the
public API and [state.md](./state.md) for internal state shape
and behavior.

## Why

Two use cases need the same capability: automatically translating documents matching a declared schema,
with no manual collection/batching code.

1. **Broad, automatic.** An app translates everything a user sees across a session or view — e.g. an
   admin viewing another user's account in their language, automatically, everywhere.
2. **Narrow, manual.** An app translates a single record a user is viewing, on demand.

One mechanism covers both: a consumer declares a schema once, activates translation with a scope that's
broad or narrow depending on the case, and reads data normally — translated content substitutes
transparently wherever it's available.

## Required Integrator Inputs

Translation cannot activate ([`activateTranslation`](./user-reference-guide.md#firestorereduxactivatetranslation))
without both configured:

1. A per-collection [schema](./user-reference-guide.md#configuring-a-schema).
2. A translate implementation — either a JS function, or a server API URL — matching whatever
   request/response contract the app's own translate endpoint uses. This library has no default
   translate implementation; it calls out to the consumer's own.

## Fidelity, Chunking, and the Wire Format

Translating rich content correctly requires solving a few problems:

- **HTML/markdown fidelity.** Before a translated string is accepted, its tag multiset must match the
  source (inline tags, mention chips, links). A mismatch — or a translate-call failure — is treated as a
  failure for that item only; the original is kept.
- **Chunking and concurrency.** Batches split (newest-relevant-first), capped by item count and
  character count per request, with a concurrency cap — keeps visible content resolving first without
  overwhelming the translate endpoint.
- **Per-field failure isolation.** One field failing doesn't affect its siblings on the same document —
  independent of the document's overall [status](#status), which can report `DONE` even when one field
  failed.
- **An addressing bridge at the API boundary.** The translate call needs a flat, opaque, echoed-back id
  per item to map results back onto `{collection, docId, field}` triples.

The internal translate-call handling adapts this logic from the app-level implementation it was proven
out in, rather than reimplementing it from scratch.

## Schema

Per collection, declare:

- Which fields are translatable, and their content type: `PLAIN` (default), `MARKDOWN`, or `HTML`.
- An explicit skip list, beyond the automatic defaults below.

Whether a field is translated for meaning or transliterated (rendered in the target script, e.g. for
personal names) is the translate implementation's own concern, not something declared in this schema.

Numeric values, date/time-shaped values, and enum-shaped values (a single `ALL_CAPS_WITH_UNDERSCORES`
token) are skipped automatically, overridably. Unspecified fields translate by default.

## Activation

```
activateTranslation({ id, language, filterFunction })
updateTranslation(id, { language?, filterFunction? })
deleteTranslation(id)
```

`filterFunction` determines which documents are in scope — a broad activation is simply a filter that
matches everything; a narrow one (a single record, one view) is the same mechanism with a tighter
filter. Multiple activations can coexist under different ids.

## Behavior

1. **On activation** — documents already loaded and matching `filterFunction` are scanned once; any
   lacking a translation for `language` are translated (a single pass, not a recurring scan).
2. **On new document delivery** — while an activation is live, documents newly delivered from Firestore
   that match its `filterFunction` translate automatically. This applies to every document the client
   receives, not only what's currently rendered — an app with expensive windowed or virtualized loading
   that wants less translated should narrow its own Firestore query or `filterFunction` instead.
3. **On existing-document update** — the document's translation for the activation's current `language`
   regenerates immediately. Translations held for other languages on that document are removed (not
   marked stale and kept) — Firestore documents carry no revision field to compare against, so there's
   no cheap way to tell "one edit behind" from "current" other than not keeping the old one. Real-time
   re-translation across all configured languages simultaneously is deferred; only the active language
   updates live.
4. **On `updateTranslation`** — documents still matching the new `filterFunction`, with a valid
   translation, are kept as-is; newly-matching documents without one are translated; documents that
   matched before but no longer do have their translation removed.

## Reading Translated Content

No new selectors for the common case — `doc`, `docsByQuery`, `allDocs`, etc. transparently return
translated content once available, the original otherwise.

## Status

An optional per-document status is available for callers that want it (e.g. a translating indicator):
`IN_PROGRESS`, `DONE`, or `FAILED` — no `PENDING`, since a document not yet reached by translation simply
has no status. Status is per document, not per field: a document with a mix of succeeded and failed
fields reports `DONE`. A caller that needs to know whether one specific field failed reads that field's
own value, which is `null` on failure.

## Related

- [user-reference-guide.md](./user-reference-guide.md) — the public API.
- [state.md](./state.md) — internal state shape.
