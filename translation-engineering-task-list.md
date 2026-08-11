# **Translation: Engineering Task List**

See [Translation](https://github.com/DreamworldSolutions/firestore-redux/blob/feature/global-translation/wiki/translation/README.md).

Each task is an independently implementable, independently testable slice of this capability's internals.

---

### Implement the `/translations` state shape and `setSchema`

#### Description

- Add `language`, `activations`, `schema`, `docs`, and `status` at Redux path `/translations`. `docs` and `status` are separate branches (both `Map<collectionId, Map<documentId, ...>>`) so a document's own real field — even one literally named `status` or `failedFields` — never collides with translation metadata. `language` is a single top-level string, not keyed by activation or document.  
- `setSchema(schema)` replaces the whole schema in one call — `Map<collectionId, Map<documentId-or-'*', Map<fieldPath, { contentType?, skip? }>>>`. `'*'` covers every document in a collection without its own entry; a specific document ID overrides it. Field paths use dot/bracket notation (`address.city`, `members[0].name`) — no separate nested-schema structure.  
- Without any schema, only string fields are attempted, and numeric, boolean, date/time-shaped, and `ALL_CAPS_WITH_UNDERSCORES`\-shaped values are skipped automatically (overridable per field via `skip: false`). An undeclared `contentType` is **not** defaulted to `PLAIN` — it must reach the Translator boundary genuinely absent.

#### Test scenarios

1. Two activations covering different collections, both translating into the same `language` value — confirm no per-activation language field exists anywhere in state.  
2. A document whose own real field is named `status` — confirm the clone's `status` holds the document's own value, unrelated to the separate translation-status branch.  
3. A `'*'` schema entry plus a specific-document override — confirm only that document uses the override.  
4. A field shaped like `IN_PROGRESS` with no schema entry — confirm it's skipped automatically; add `{ skip: false }` — confirm it's now attempted. A field with no declared `contentType` — confirm it reaches the Translator as absent, not `'PLAIN'`.

---

### Implement the Translator request pipeline: wire addressing, debouncing, chunking, and fidelity

#### Description

- **Wire addressing**: build each item's id by joining `collection` \+ `docId` \+ field path with a separator Firestore never allows inside any of those three parts, so the id always splits back apart the same way it was built. Opaque to the Translator — echoed back unchanged.  
- **Debouncing**: a document's changed translatable fields wait out a short, fixed, per-document quiet window (resetting on every further change to that document) before joining a batch — coalesces rapid successive updates (e.g. live-typing sync) into one translate call instead of one per change. Only applies to existing-document updates — `start`'s initial scan and `setLanguage` are one-shot, not a rapid-fire stream, so they skip straight to chunking.  
- **Chunking and concurrency**: batches split newest-relevant-first, capped by item count and character count per request, with a concurrency cap on simultaneous in-flight batches.  
- **Fidelity validation**: before a translated string is accepted, its tag multiset (inline tags, mention chips, links) must match the source's. A mismatch, or a translate-call failure, fails that item only — the original value is kept and recorded in `failedFields`.

#### Test scenarios

1. Round-trip a collection/docId/field-path triple containing `.`/`-` characters through the wire-id join/split — confirm it reconstructs exactly.  
2. Rapidly update the same document's translatable field several times in quick succession — confirm only one translate call fires, after the updates stop; a second document updated at the same time is debounced independently, not serialized behind the first.  
3. A document set exceeding the per-request item/character cap — confirm it splits into multiple batches; more batches than the concurrency cap allows — confirm excess batches queue.  
4. A Translator response whose tag set doesn't match the source for an `HTML`/`MARKDOWN` field — confirm it falls back to the original value and appears in `failedFields`; a matching response — confirm it's accepted.

---

### Implement `setTranslator` (URL GET/POST and function forms) and `setLanguage`

#### Description

- `setTranslator` accepts a plain URL string (`GET`, query params); an object `{ url, method? }` where `method` is `'GET'` (default) or `'POST'` (JSON body); or a function `({ targetLanguage, items }) => Promise<{ targetLanguage, items }>`. Both URL forms use `credentials: 'include'` and only work when the server's shape matches the OpenAPI contract exactly — anything else (custom headers, non-JSON body, other auth) needs the function form.  
- `setLanguage` sets the single, app-wide target language every activation reads. Doesn't need to be called before `start` — an activation can start first and simply won't translate until a language is set. Nothing translates until both a Translator and a language are configured.

#### Test scenarios

1. Configure a plain URL string — confirm a `GET` request with query params and `credentials: 'include'`.  
2. Configure `{ url, method: 'POST' }` — confirm a `POST` request with a JSON body; `{ url }` with no `method` — confirm it behaves like the plain-string `GET` form.  
3. Configure a function — confirm it's called in-process, no HTTP request made by the library itself.  
4. Call `start` before `setLanguage` — confirm matching is tracked but nothing translates until `setLanguage` is called.

---

### Implement activation lifecycle: `start`, `update`, `stop`, and bidirectional indexing

#### Description

- `start({ id, filterFunction })` scans already-loaded documents once, translating every match; new documents retrieved afterward (live-query push or a fresh query) that match are handled the same way.  
- `update(id, { filterFunction })` reconciles a scope change: newly-matching documents translate, no-longer-matching documents' entries are removed for this activation — but only if no *other* still- active activation also matches them.  
- `stop(id)` removes this activation's documents' `docs`/`status` entries, except where some other still- active activation still matches them.  
- An internal bidirectional index (activation → matching documents, document → matching activations) backs all three, so none of them need to rescan every loaded document.

#### Test scenarios

1. Start `filterFunction: () => true` against documents across several collections — confirm every match gets translated. Two overlapping activations matching the same document — confirm one shared `docs`/`status` entry, not duplicated.  
2. Narrow an activation's filter via `update` — confirm newly-excluded documents are removed, unless some other activation still matches them; widen it — confirm newly-included documents translate.  
3. Stop one of two overlapping activations — confirm shared documents are kept (the other activation still matches), while documents matched only by the stopped one are removed.

---

### Implement document-change handling: diffed updates and re-translation on language change

#### Description

- **Existing-document update**: diff the incoming update per field. A changed translatable field is debounced then re-sent (previous value/`failedFields` cleared once the translate call actually starts, not the instant the raw value changes). A changed non-translatable field copies straight into the clone, no translate call. An unchanged field is left as-is, including its existing translation.  
- **`setLanguage` re-translation**: every document currently held in `docs` — across every activation — has every translatable field re-sent into the new language, as a fresh attempt (not a diff against the old language's result); `status` is recomputed from scratch, not carried over. Non-translatable fields are untouched; a document matched by no activation is unaffected.

#### Test scenarios

1. Update a translatable field to a new value — confirm only that field re-translates, other fields' translations are untouched; update a non-translatable field — confirm no translate call and no change to any translated value.  
2. A document whose field failed translation under language A — switch to language B — confirm `status` is recomputed fresh, not assumed to fail again.  
3. Two activations with translated documents, call `setLanguage` once — confirm both re-translate in one pass, no per-activation call needed.

---

### Implement transparent read-through and the translation selectors

#### Description

- No new selector needed for the common read case: `doc`/`docsByQuery`/`allDocs` return the translated document (full clone, current language) once available, the original otherwise — a flat lookup at read time, never a per-field merge computed on every read.  
- `translation.language(state)` returns the current language, or `undefined` before `setLanguage` is ever called.  
- `translation.status(state, collection, docId)` returns `PENDING` (synthesized for a document with no stored `DocStatus` — never written as a literal value), `IN_PROGRESS`, `SUCCESS`, `PARTIAL_FAILURE`, or `FAILED`, recomputed from scratch on every language change.  
- `translation.failedFields(state, collection, docId)` returns the field paths that failed on the most recent attempt — always an array, empty for both `SUCCESS` and `PENDING`.

#### Test scenarios

1. Read a document before and after its translation completes — confirm original, then full translated clone.  
2. A document never reached by any activation — confirm `status` returns `PENDING` with no stored entry, and `failedFields` returns `[]`, not `undefined`.  
3. A document with one of three translatable fields failing — confirm `status` is `PARTIAL_FAILURE` and `failedFields` names exactly that one field; a document with zero translatable fields — confirm `SUCCESS`.

---

## **Testing Tasks (Integrated into Features)**

**Note:** Each task above should be tested immediately after implementation:

- Unit tests for the isolated logic (chunking, debouncing, wire addressing, fidelity check, diffing, indexing)  
- Integration tests against a real or stubbed Translator (both URL and function forms, GET and POST)  
- Multi-activation scenarios (overlapping scope, independent scope, sequential start/update/stop)

---

## **Implementation Order (by Priority)**

- Implement the `/translations` state shape and `setSchema`  
- Implement the Translator request pipeline: wire addressing, debouncing, chunking, and fidelity  
- Implement `setTranslator` (URL GET/POST and function forms) and `setLanguage`  
- Implement activation lifecycle: `start`, `update`, `stop`, and bidirectional indexing  
- Implement document-change handling: diffed updates and re-translation on language change  
- Implement transparent read-through and the translation selectors

---

## **Feature Dependencies**

State shape \+ setSchema → Translator request pipeline → setTranslator \+ setLanguage

  → activation lifecycle → document-change handling → read-through \+ selectors

---

## **Definition of Done (per task)**

Each task is considered "done" when:

1. ✅ Unit tests written and passing  
2. ✅ Integration test(s) against both URL (GET and POST) and function Translator forms, where relevant  
3. ✅ Multi-activation edge cases covered (overlap, independent scope, start/update/stop ordering)  
4. ✅ No console errors or warnings  
5. ✅ Code reviewed and approved  
6. ✅ Documentation (this wiki) updated if behavior differs from what's already documented
