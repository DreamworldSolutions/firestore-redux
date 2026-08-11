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

- `schema (Object)` Key = collection or subcollection ID. Value = a document-schema map: key = a
  specific document ID, or `'*'` for "every document in this collection without its own entry" (the
  common case — almost every integration only ever declares `'*'`). Value = that document's field
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

## Automatic Default Skips (overridable)

Without any schema at all, translation is attempted only for **string** fields, and even among those,
these are skipped automatically:

- **Numeric** values.
- **Boolean** values.
- **Date/time-shaped** values.
- **Enum-shaped** values — detected as a single `ALL_CAPS_WITH_UNDERSCORES` token (e.g. `IN_PROGRESS`).

Any of these can be overridden per field via the schema above (`{ skip: false }` forces translation of
a field the defaults would otherwise skip).

### What `skip: false` Can and Can't Force

`skip: false` overrides the **shape**-based skips above — a string that merely *looks* numeric,
boolean, date/time-shaped, or enum-shaped. It can't make a non-string translatable: only `String`
values are ever sent to the Translator, whatever the schema says. Numbers, booleans, `null`,
`undefined`, `Date`s, and Firestore `Timestamp`s have no text to send, so they're left out
unconditionally — that's also what guarantees a `null`/`undefined` can never reach your Translator as
an item.

Two more values are skipped unconditionally, for the same reason:

- **Empty or whitespace-only strings** — nothing to translate.
- **A document's own `id`** — identity, not content; translating it would break every lookup keyed by
  it. (Only the root `id` field. A field named `id` nested inside an object, e.g. `author.id`, follows
  the normal rules.)

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
