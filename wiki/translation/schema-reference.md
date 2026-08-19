# Translation — Schema Reference

This is a reference for declaring a translation schema. See [README.md](./README.md) to get started —
a schema is optional, most integrations never need one — [user-guide.md](./user-guide.md) for usage
scenarios, and [state.md](./state.md) (the `schema` row) for the internal shape this configures.

## Why a Schema, and When

The default behavior needs no configuration: every string field translates, and anything that looks
numeric, boolean, date/time-shaped, or enum-shaped is skipped automatically (see
[Automatic Default Skips](#automatic-default-skips-overridable) below). Declare a schema only to
fine-tune two things:

1. **Skip a field that shouldn't translate.** A value the defaults didn't catch — e.g. an
   `ALL_CAPS_WITH_UNDERSCORES` enum that isn't quite shaped like one — gets translated and stops
   matching its `enum`. Mark it `{ skip: true }`.
2. **Override the detected content type.** A field needs `MARKDOWN` or `HTML` handling instead of
   plain text, so tags and formatting survive translation intact.

## `firestoreRedux.translation.setSchema`

Configures the schema for every translatable collection at once. A single call, not one per
collection; calling it again replaces the whole schema.

```js
firestoreRedux.translation.setSchema({
  posts: {
    '*': {
      title: { contentType: 'PLAIN' },
      body: { contentType: 'HTML' },
      'address.city': { contentType: 'PLAIN' },
      status: { skip: true },
    },
  },
  projects: {
    '*': {
      name: { contentType: 'PLAIN' },
    },
  },
});
```

##### Arguments

- `schema (Object)` Key = collection or subcollection ID, or `'*'` for rules every collection inherits
  (see [Applying Rules to Every Collection](#applying-rules-to-every-collection)). Value = a
  document-schema map: key = a specific document ID, or `'*'` for "every document in this collection
  without its own entry" (the common case — almost every integration only ever declares `'*'`). Value = that document's field
  schema (see [state.md#fieldschema](./state.md#fieldschema)): key = field path (see
  [Field Paths](#field-paths) below), value = `{ contentType, skip }`, both optional. `skip` defaults
  to `false` (beyond the automatic default skips below). `contentType` left undeclared is forwarded to
  the Translator as-is — see
  [user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationsettranslator) for what that means
  on the wire; it is **not** silently substituted with `'PLAIN'` here.

##### returns

- Nothing.

### Per-Document Overrides (rare)

`'*'` covers "every document in this collection." A specific document ID in the same place overrides
`'*'` for that one document only:

```js
firestoreRedux.translation.setSchema({
  posts: {
    '*': { title: { contentType: 'PLAIN' } },
    post_123: { title: { skip: true } }, // this one post's title is never translated
  },
});
```

This is an edge case — most collections are uniform enough that `'*'` alone is all you need.

## Applying Rules to Every Collection

The same field name often means the same thing in every collection — `accountId`, `boardId`,
`createdBy` are identity, never content, wherever they appear. Declaring them per collection means
repeating the same lines for each one.

A top-level `'*'` is a base that every collection inherits:

```js
firestoreRedux.translation.setSchema({
  '*': {
    '*': {
      accountId: { skip: true },
      boardId: { skip: true },
      description: { contentType: 'HTML' },
    },
  },
  boards: {
    '*': { templateCategory: { skip: true } },
  },
});
```

`boards` here skips `accountId`, `boardId` **and** `templateCategory`, and treats `description` as
HTML — it inherits the base and adds to it. A collection that declares nothing at all still gets the
base.

Note the nesting: the top-level `'*'` holds a *document*-schema map, exactly like a real collection, so
its fields sit under an inner `'*'`. The structure is uniform at both levels — top level is a collection
ID or `'*'`, second level is a document ID or `'*'` — rather than a shorthand that would be
indistinguishable from a document-schema map.

### Precedence

Underneath both sits one built-in layer of the library's own: `id: { skip: true }` (see
[Automatic Default Skips](#automatic-default-skips-overridable)). It's an ordinary schema layer, not a
hardcoded rule, so anything you declare at either level overrides it in the usual way.

A collection's own rules are merged over the base, **field by field**, so one collection-specific rule
doesn't discard the shared ones. A field declared in both wins in the collection:

```js
firestoreRedux.translation.setSchema({
  '*':   { '*': { boardId: { skip: true } } },
  cards: { '*': { boardId: { skip: false } } },   // cards translates boardId; every other collection skips it
});
```

This is deliberately **not** how the document level behaves — there, a document's own entry replaces its
collection's `'*'` entry wholesale (see [`setSchema`](#firestorereduxtranslationsetschema) above). The two
differ because they're for different things: the cross-collection base means "these fields, everywhere",
which merging preserves and replacing would defeat, whereas a per-document entry exists precisely to
describe *that* document instead of the collection default. A document's own entry still inherits the
cross-collection base.

## Automatic Default Skips (overridable)

Without any schema at all, translation is attempted only for **string** fields, and even among those,
these are skipped automatically:

- **Numeric** values.
- **Boolean** values.
- **Date/time-shaped** values.
- **Enum-shaped** values — detected as a single `ALL_CAPS_WITH_UNDERSCORES` token (e.g. `IN_PROGRESS`).
- **A document's own `id`** — identity, not content; translating it would break every lookup keyed by
  it. Only the root `id` field: a field named `id` nested inside an object, e.g. `author.id`, follows
  the normal rules above. Declaring `id: { skip: true }` yourself is therefore redundant, though
  harmless. Unlike the shape rules above, this one is a built-in schema layer sitting underneath
  everything you declare (see [Precedence](#precedence)), so `id: { skip: false }` overrides it at any
  level — the cross-collection base included.

Any of these can be overridden per field via the schema above (`{ skip: false }` forces translation of
a field the defaults would otherwise skip).

### What `skip: false` Can and Can't Force

`skip: false` overrides the **shape**-based skips above — a string that merely *looks* numeric,
boolean, date/time-shaped, or enum-shaped. It can't make a non-string translatable: only `String`
values are ever sent to the Translator, whatever the schema says. Numbers, booleans, `null`,
`undefined`, `Date`s, and Firestore `Timestamp`s have no text to send, so they're left out
unconditionally — that's also what guarantees a `null`/`undefined` can never reach your Translator as
an item.

One more value is skipped unconditionally, for the same reason:

- **Empty or whitespace-only strings** — nothing to translate.

A document's own `id` is *not* in this group: it's an ordinary automatic skip like the shape-based ones,
so `{ skip: false }` does force it. There's rarely a reason to.

### Declaring a Rule on a Branch

A field path doesn't have to name a leaf. `{ skip: true }` on an object or array path prunes
everything beneath it in one declaration:

```js
firestoreRedux.translation.setSchema({
  posts: {
    '*': { attachments: { skip: true } }, // attachments[0].name, attachments[1].name, ... all skipped
  },
});
```

The reverse isn't true: `skip: false` on a branch doesn't force its children in — each field still
decides for itself. And `contentType` only applies to the exact path it's declared on.

### `'*'` and a Document Entry Don't Merge

A document's own entry **replaces** the collection's `'*'` entry rather than merging into it —
`'*'` covers every document in the collection *that has no more specific entry of its own*. So a
document entry declaring one field's rule leaves that document with exactly that one rule; every other
field of that document falls back to the automatic defaults, not to `'*'`.

## Field Paths

Field paths address where in a document a rule applies:

```text
title
description
address.city
members[0].name
attachments[3].name
```

- A top-level field is just its name: `title`.
- A nested object field uses dot notation: `address.city`.
- An array element uses bracket notation with its index: `members[0].name`, `attachments[3].name`.

There's no separate "nested schema" concept — a nested or array-indexed field is just a longer path
string, declared at the root of the schema's field-path map like any other field.

## Transliteration

Whether a field is translated for meaning or transliterated (rendered in the target script, e.g. for
personal names) is the Translator's own concern, not declared in this schema — see
[user-reference-guide.md](./user-reference-guide.md#firestorereduxtranslationsettranslator).
