# Translation — State

This is an internal reference — how this library represents translation state and reacts to change.
See [README.md](./README.md) to get started, [user-guide.md](./user-guide.md) for usage scenarios, and
[architecture.md](./architecture.md) for the design rationale behind this shape.

- Keeps the current translation language, activations, per-collection schema config, translated
  documents, and their status.
- Path: `/translations`

| Name        | Data Type                                                                    | Description |
| ----------- | ------------------------------------------------------------------------------ | ----------- |
| language    | String                                                                          | The current target language — a single, app-wide value, set by `translation.setLanguage`. Not per-activation; see [Activation](#activation). |
| activations | Map<id, [Activation](#activation)>                                            | key = activation id, from `translation.start` |
| schema      | Map<collectionId, Map<documentId, Map<fieldPath, [FieldSchema](#fieldschema)>>> | Single value, set whole in one call by `translation.setSchema` — not built up key-by-key like `activations`/`docs`. Replaced entirely on the next call. `documentId` is a specific document ID, or `'*'` — the wildcard applying to every document in the collection that has no more specific entry of its own (almost every integration only ever declares `'*'`). `fieldPath` is dot/bracket-notation (e.g. `'address.city'`, `'members[0].name'` — see [schema-reference.md](./schema-reference.md#field-paths)). |
| docs        | Map<collectionId, Map<documentId, [TranslatedDoc](#translateddoc)>>            | Translated documents, one entry per `{collection, docId}` currently translated, in the current `language` |
| status      | Map<collectionId, Map<documentId, [DocStatus](#docstatus)>>                    | Translation status and failed fields, one entry per `{collection, docId}` — kept in its own branch, separate from `docs`, so a document's own real fields (even one literally named `status` or `failedFields`) never collide with this metadata |

### Activation

**Activations carry no language of their own.** `id` and `filterFunction` are all an activation is —
scope only. Every activation translates into whatever `language` (above) currently holds; there's no
per-activation override and no multi-language mode. Changing `language` — via `translation.setLanguage`
— re-translates every document every active activation currently covers, all at once; see
[Behaviors](#behaviors) item 6. Running two activations for two different scopes at the same time (say,
one covering `posts`, another covering `comments`) doesn't mean two languages — both still translate
into the one current `language`.

| Name           | Data Type | Description |
| -------------- | --------- | ----------- |
| id             | String    | Caller-chosen identifier. |
| filterFunction | Function  | `(doc, collection) => Boolean` — determines which documents this activation covers; called with the collection (or subcollection) ID alongside each document since one activation can span several collections at once — see [user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationstart) for the full signature. Not serializable like `id` — kept as a live in-memory reference, documented here for completeness. |

### FieldSchema

| Name        | Data Type | Description |
| ----------- | --------- | ----------- |
| contentType | [ContentType](#enums) | Omitted when the integrator hasn't declared one for this field — **not** silently defaulted to `PLAIN` here; see [user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationsettranslator) for what an unspecified content type means on the wire. |
| skip        | Boolean   | `true` excludes this field beyond the automatic defaults (numeric, boolean, date/time, `ALL_CAPS_WITH_UNDERSCORES`-shaped values). |

### TranslatedDoc

A translated document is a **full clone** of the original document at `{collection, docId}`, in the
current `language` — every field from the original is present. A field the schema (or the automatic
defaults) marks translatable holds its translated value once translation succeeds; every other field —
skipped, non-string, or simply not in scope — is copied unchanged from the original. This is a
deliberate design choice: reading translated content is then a flat lookup (`docs.$collectionId
.$documentId`, take it whole), never a per-field merge of "translated where available, original
otherwise" computed at selector-call time. See [architecture.md](./architecture.md#state-management)
for why that matters for performance.

| Name    | Data Type | Description |
| ------- | --------- | ----------- |
| $field  | Any | Every field the original document has. For a translatable field: the translated value once that field's translation succeeds. On failure, this holds the **original, source-language value** (never `null`) — the failure itself is tracked separately in [`status`](#docstatus), not by corrupting the field's value. For any other field: an unchanged copy of the original document's value. |

Translation-in-progress status and which fields (if any) failed live in the parallel `status` branch —
see [DocStatus](#docstatus) below, not on `TranslatedDoc` itself.

### DocStatus

| Name          | Data Type      | Description |
| ------------- | ---------------- | ----------- |
| status        | [Status](#enums) | The document's **overall** translation status (as opposed to any single field's — see `failedFields` below). Stored once a document is actually reached by translation — there's no stored `PENDING` value; a document not yet reached simply has no `DocStatus` entry at all. The [`translation.status`](./selectors-reference.md#firestorereduxselectorstranslationstatus) selector is what turns "no entry" into the public value `PENDING`, so callers never see `undefined`. |
| failedFields  | String[] | Field paths (schema key format, e.g. `'address.city'`, `'members[0].name'`) whose translation failed on the most recent attempt. Empty when `status` is `SUCCESS`. |

### Enums

| Name          | Values |
| ------------- | ------ |
| ContentType   | `PLAIN`, `MARKDOWN`, `HTML` |
| Status        | `IN_PROGRESS`, `SUCCESS`, `PARTIAL_FAILURE`, `FAILED` |

`Status` — the document's **overall** translation status: `SUCCESS` = every translatable field
translated — including the trivial case of a document with no translatable fields at all (nothing to
attempt, nothing to fail, `failedFields` stays `[]`). `PARTIAL_FAILURE` = at least one translatable
field succeeded and at least one failed. `FAILED` =
every translatable field that was attempted failed (including the case where the whole translate call
itself failed and nothing came back). Publicly, the
[`translation.status`](./selectors-reference.md#firestorereduxselectorstranslationstatus) selector also
returns `PENDING`, for a document with no `DocStatus` entry yet — see [DocStatus](#docstatus).

### Example State

One language, two activations covering two different collections:

```js
{
  "translations": {
    "language": "hi",
    "activations": {
      "posts-feed": { "id": "posts-feed", "filterFunction": (doc, collection) => collection === 'posts' },
      "comments-feed": { "id": "comments-feed", "filterFunction": (doc, collection) => collection === 'comments' }
    },
    "schema": {
      "posts": {
        "*": {
          "title": { "contentType": "PLAIN" },
          "body": { "contentType": "HTML" },
          "status": { "skip": true }
        }
      },
      "comments": {
        "*": { "text": { "contentType": "PLAIN" } }
      }
    },
    "docs": {
      "posts": {
        "post_123": {
          "title": "होम पेज डिज़ाइन करें",
          "body": "<p>ग्राहक पोर्टल के लिए नया लेआउट</p>",
          "status": "IN_PROGRESS"
        }
      },
      "comments": {
        "comment_456": {
          "text": "बहुत बढ़िया!"
        }
      }
    },
    "status": {
      "posts": { "post_123": { "status": "SUCCESS", "failedFields": [] } },
      "comments": { "comment_456": { "status": "PARTIAL_FAILURE", "failedFields": ["text"] } }
    }
  }
}
```

- `posts-feed` and `comments-feed` are two independent activations, scoped to different collections,
  but both translating into the one current `language`, `"hi"`.
- `post_123` — `title`/`body` both succeeded (`status.posts.post_123.status` is `SUCCESS`).
  `post_123`'s own `status` field (`"IN_PROGRESS"`, a business value from the original document,
  unrelated to translation) is copied through unchanged — it's `skip: true` in the schema, and it
  doesn't collide with the *translation* status above because that lives in the separate `status`
  branch of `/translations`, not inside the cloned document.
- `comment_456` — `text`'s translation failed, so `docs.comments.comment_456.text` still holds the
  original value (not `null` — the source value), and `status.comments.comment_456` reports
  `PARTIAL_FAILURE` with `failedFields: ["text"]`.

**Now the language changes** — `firestoreRedux.translation.setLanguage('gu')`:

```js
{
  "translations": {
    "language": "gu",
    "activations": { /* unchanged — same two activations, same scopes */ },
    "schema": { /* unchanged */ },
    "docs": {
      "posts": {
        "post_123": {
          "title": "હોમ પેજ ડિઝાઇન કરો",
          "body": "<p>ગ્રાહક પોર્ટલ માટે નવો લેઆઉટ</p>",
          "status": "IN_PROGRESS"
        }
      },
      "comments": {
        "comment_456": { "text": "ખૂબ સરસ!" }
      }
    },
    "status": {
      "posts": { "post_123": { "status": "SUCCESS", "failedFields": [] } },
      "comments": { "comment_456": { "status": "SUCCESS", "failedFields": [] } }
    }
  }
}
```

Both activations' documents re-translated into Gujarati automatically — neither `posts-feed` nor
`comments-feed` was touched directly; changing `language` once was enough. (`comment_456`'s earlier
`text` failure happened not to recur this time — `PARTIAL_FAILURE` isn't sticky across a language
change, it's recomputed from scratch. See [Behaviors](#behaviors) item 6.)

### Behaviors

An activation behaves like a **live Firestore query** over whatever currently matches its
`filterFunction`: a document enters an activation's translated set the moment it starts matching (on
initial scan, or on a later update that makes it start matching) and leaves the moment it stops
matching (on a later update, or when the activation itself stops) — added and removed continuously, not
only at the moment the activation starts.

1. **On activation** — documents already loaded and matching `filterFunction` are scanned once; for
   each, translatable fields are identified from the schema/defaults and sent for translation in the
   current `language` (if one is set — see item 6), and its `docs`/`status` entries are created
   (untranslated fields copied through immediately; translatable fields fill in as results arrive — see
   [DocStatus](#docstatus) for the `IN_PROGRESS` window). If no `language` has been set yet, matching is
   still tracked (see [Internal Indexing](#internal-indexing)), but nothing translates until one is.
2. **On new document retrieval** — while an activation is live, documents newly retrieved from
   Firestore that match its `filterFunction` are handled exactly as in item 1. "Retrieved" covers both
   a live-query update pushing a change to an already-open query, and a new query loading documents for
   the first time — both trigger the same behavior. This applies to every document the client receives,
   not only what's currently rendered.
3. **On existing-document update — retranslate only what changed.** Each activation currently matching
   this document diffs the incoming update against the previous version:
   - A translatable field whose raw value changed is **debounced per document** — a short, fixed quiet
     window that resets on every further change to that document — before being re-sent for translation;
     see [architecture.md#fidelity-chunking-and-wire-addressing](./architecture.md#fidelity-chunking-and-wire-addressing).
     Its previous translated value and any `failedFields` entry for it are cleared once the window
     elapses and the translate call actually starts, not the instant the raw value changes.
   - A field that changed but isn't translatable is copied straight into the clone immediately — no
     translate call, so no debounce either.
   - A field that didn't change is left exactly as it was in the clone, including its existing
     translation.
4. **On `translation.update` (filter-function change)** — documents still matching the new
   `filterFunction`, with a valid translation, are kept as-is; newly-matching documents without one are
   translated (as in item 1); documents that matched before but no longer do have their `docs`/`status`
   entries removed — scoped to this activation; see item 5 for what "removed" really means when more
   than one activation is involved.
5. **On `translation.stop`** — the documents this activation had translated are **not** blindly removed.
   For each one, check whether it still matches some *other* still-active activation (via the
   [document → activations index](#internal-indexing)): if yes, keep it — another activation still
   needs it; if no, remove its `docs`/`status` entries. This is the same rule, viewed the other way, as
   `translation.update`'s newly-matching/no-longer-matching diff in item 4.
6. **On `translation.setLanguage` (the language changes)** — every document currently held in `docs` —
   i.e., matched by at least one active activation, regardless of which one — has every translatable
   field re-sent for translation, into the new language. This is a fresh attempt, not a diff against the
   old language's result: a field that failed under the old language isn't assumed to fail again, and
   vice versa, so `status` is recomputed from scratch per document rather than carried over. Fields that
   aren't translatable are untouched — they don't depend on `language` at all. A document not currently
   matched by any activation isn't affected (it has no `docs`/`status` entry to update). Activations
   started *after* this call simply pick up whatever `language` is current at that time — there's
   nothing activation-specific to reconcile, because activations don't carry a language of their own
   (see [Activation](#activation)).

This mechanism covers both the narrow, single-record use case and the broad, automatic one — same
`start/update/stop` calls, a tighter or wider `filterFunction` — independently of how many activations
are running or how often `language` changes.

### Internal Indexing

Reconciling activations against documents (items 4, 5, and 6 above) needs lookups in both directions,
kept alongside — not replacing — the tables above:

- **Translation → documents.** Which documents currently match a given activation's `filterFunction`,
  so `translation.update`/`translation.stop` don't need to re-scan every loaded document to find out
  what to remove.
- **Document → translations.** Which activations currently match a given document, so — when one
  activation stops matching it (its filter changed, or the activation itself stopped) — the library
  can tell whether *some other* still-active activation matches the same document before deleting its
  `docs`/`status` entries.

One activation matches many documents, and one document can match many activations — two activations
covering different collections, as in the [example above](#example-state), or two whose filters
happen to overlap on the same collection.

### A Note on Conventions

Every `Map<K, V>` above is a plain object keyed by a stable ID (activation id, collection ID, document
ID, or `'*'`), never an array — consistent with the rest of this library's Redux state (see
[wiki/state.md](../state.md)) and with how Firestore documents themselves already look as JSON.

See [architecture.md#fidelity-chunking-and-wire-addressing](./architecture.md#fidelity-chunking-and-wire-addressing)
for the fidelity-validation/chunking/wire-id-bridge logic this relies on.
