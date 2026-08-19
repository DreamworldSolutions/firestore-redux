# Translation — Architecture

This is for developers extending or maintaining this capability, not integrators consuming it — start
with [README.md](./README.md) if that's what you need. This explains *why* the internal shape in
[state.md](./state.md) looks the way it does, and how data flows through it end to end.

## Responsibilities

Two parties, one boundary:

- **The Translator** (your JS function or server API — see
  [translator-function-spec.md](./translator-function-spec.md) /
  [translate-api.openapi.yml](./translate-api.openapi.yml)) does exactly one thing: given text and its
  content type, return translated text, or transliterate it if hinted. It has no awareness of Redux,
  Firestore, activations, or state — it's a stateless text-in/text-out (or text-in/error-out) boundary.
- **This library** owns everything on the other side of that boundary: deciding which documents and
  fields need translating, calling the Translator in batches, storing results,
  keeping them in sync as documents change and activations start/stop, and serving them back out
  through the selectors an app already uses.

Nothing about the Translator's own behavior — how well it transliterates a name, whether it detects
Markdown correctly — is this library's concern; nothing about state management, caching, or runtime
synchronization is the Translator's concern. See
[Chunking and Wire Addressing](#chunking-and-wire-addressing) below for the
specific problems that separation lets this library solve once, internally, instead of every
integrator solving them ad hoc.

## Chunking and Wire Addressing

Translating rich content correctly requires solving a few problems, all handled internally — an
integrator never touches any of this directly:

- **Translate-call failures.** A translate-call failure, or an item the Translator reports as failed, is
  treated as a failure for that item only; the original is kept, and it's recorded in
  [`translation.failedFields`](./selectors-reference.md#firestorereduxselectorstranslationfailedfields).
  Whether a translated string preserved the source's HTML/Markdown structure is **not** checked here —
  that is the Translator's own responsibility, stated in
  [translator-function-spec.md](./translator-function-spec.md#contract-notes) and
  [translate-api.openapi.yml](./translate-api.openapi.yml). A result marked `success: true` is stored
  exactly as returned.
- **Debouncing.** A document's translatable fields aren't re-sent the instant a raw value changes.
  Each document has its own short, fixed quiet window (a few hundred milliseconds); every further change
  to that document resets its window. Only once the window elapses without another change does that
  document's changed fields join the next batch — see
  [state.md#behaviors](./state.md#behaviors) item 3. This is per document, not global or per-activation:
  a burst of edits across many different documents doesn't serialize behind one shared timer, and a
  document that's actively being edited (e.g. live-typing sync) triggers one translate call once editing
  pauses, not one per keystroke-level update. `status` for a debouncing document stays whatever it was
  before the change — it doesn't flip to `IN_PROGRESS` until the window elapses and the translate call
  actually starts.
- **Chunking and concurrency.** Once a document's changes clear debounce (or, for `translation.start`'s
  initial scan and `translation.setLanguage`, immediately — neither of those is a rapid-fire update
  stream), its translatable fields join batches split newest-relevant-first, capped by item count and
  character count per request, with a concurrency cap — keeps visible content resolving first without
  overwhelming the Translator.
- **Wire addressing.** Each item sent to the Translator carries a flat, opaque, echoed-back id — see
  [translator-function-spec.md](./translator-function-spec.md) — built by joining `collection` +
  `docId` + field path (the target language itself travels once, at the request's top level, as
  `targetLanguage` — see [translator-function-spec.md](./translator-function-spec.md) — since it's a
  single value for the whole request, not something that varies per item). The join uses a separator
  that Firestore itself never allows inside any of those three parts (e.g. `/`, which can't appear in a
  Firestore document ID or field path). Because the separator can never legally appear *within* any part
  being joined, the joined string always splits back apart the same way it was built — it can never be
  misread as a different collection, document, or field name.

### Concrete Limits

The values behind the four behaviors above, all exported from
`src/translation/translation-pipeline.js`:

| Constant | Value | What it bounds |
| -------- | ----- | -------------- |
| `DEBOUNCE_WINDOW` | `300`ms | A document's quiet window before its changed fields join a batch |
| `MAX_ITEMS_PER_REQUEST` | `50` | Items in one translate call |
| `MAX_CHARS_PER_REQUEST` | `20000` | Total `text` characters in one translate call |
| `MAX_CONCURRENT_REQUESTS` | `3` | Translate calls in flight at once |

A single item longer than `MAX_CHARS_PER_REQUEST` is still sent, alone in its own batch, rather than
being dropped or jamming the queue behind it. Within a batch, items keep the order they were queued
in; it's the *choice* of which items form the batch that is newest-first, not the order inside it.

A document's fields can span several batches. Its `status` is written once — after the last of them
comes back — never once per batch.

## Data Flow

```
translation.start({ id, filterFunction })         translation.setLanguage(language)
        │                                                  │
        ▼                                                  ▼
scan loaded documents ──► filterFunction ──►   every document currently held in `docs`,
   matching documents                          across every activation (state.md#behaviors item 6)
        │                                                  │
        └─────────────────────┬────────────────────────────┘
                               ▼
              split translatable fields (schema/defaults)
              from everything else, per document
                               │
             ┌─────────────────┴─────────────────┐
             ▼                                   ▼
   translatable fields                  everything else
   → batched, sent to the Translator     → copied straight into the clone
             │
             ▼
   results
   merged into docs.$collection.$docId          (state.md#translateddoc)
   success/failure recorded into status.$collection.$docId  (state.md#docstatus)
             │
             ▼
selectors (doc / docsByQuery / allDocs / translation.status / translation.failedFields) read the
finished clone — no merge logic at read time
```

New documents retrieved while an activation is live, document updates, `translation.update`, and
`translation.stop` all re-enter this same flow from the `translation.start` side — see
[state.md#behaviors](./state.md#behaviors) for the exact rule each one follows; they're all variations
of "figure out which documents match now, diff against what matched before, translate/copy/remove
accordingly." `translation.setLanguage` is the other entry point: it doesn't touch `filterFunction`
matching at all — it just re-runs the "translate the translatable fields" half of this flow, for every
document any activation already has, in the new language.

## State Management

Three design decisions in [state.md](./state.md) exist specifically for this data flow's sake:

1. **`docs` is a full clone, not a sparse map of only-translated fields.** If a selector had to merge
   "translated where available, original otherwise" on every read, that logic would run on every
   document read in the app, for as long as any activation is live — a real, continuous cost. Doing
   that merge once, when a document's translation actually changes, and storing the ready result,
   moves the cost off the read path entirely. See [state.md#translateddoc](./state.md#translateddoc).
2. **Status and failed fields live in their own branch, not mixed into the cloned document.** A real
   document field can be named anything, including `status` or `failedFields` (see the worked example
   at [state.md#example-state](./state.md#example-state)) — metadata about the translation has to live
   somewhere that can never collide with the data being translated. That's `status`, a sibling of
   `docs`, not a property on the clone.
3. **`language` is one value, not a key on `docs`/`status`, and not a field on `Activation`.** Only one
   language is ever live at a time, shared by every activation — so there's nothing to key `docs`/
   `status` by, and nothing per-activation to reconcile when it changes. A `translation.setLanguage` call
   is a single, uniform re-translation pass over whatever `docs` already holds (state.md#behaviors item
   6), not a per-activation operation — that's *why* activations don't carry their own `language` field
   at all (state.md#activation). This is a deliberate simplification: an earlier design keyed `docs`/
   `status` by language to let different activations hold simultaneous, independent translations of the
   same document into different languages — that capability was cut in favor of this single-language
   model, which is simpler both to reason about and to store.

## Indexing

Two reconciliation problems recur across `translation.start`'s initial scan, `translation.update`'s
scope change, and `translation.stop`: "which documents does this activation currently cover" and "which
activations currently cover this document." Answering either by scanning every loaded document, every
time, doesn't scale. [state.md#internal-indexing](./state.md#internal-indexing) keeps both directions
available directly, which is what lets `translation.stop` ([Behaviors](./state.md#behaviors) item 5)
check "does any *other* activation still need this document" without a full rescan.
