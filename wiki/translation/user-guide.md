# Translation — User Guide

For the minimum setup see [README.md](./README.md). This guide walks through common usage patterns,
basic scenarios, and where to reach for more advanced or customized behavior. For exact method
signatures see [user-reference-guide.md](./user-reference-guide.md),
[schema-reference.md](./schema-reference.md), and [selectors-reference.md](./selectors-reference.md).

## Common Usage

Most integrations do three things: configure a Translator once, at app startup; set (and later change)
a language as the user's preference is known or changes; and start/stop activations as the user
navigates — opening a post, entering a translated view. Reading translated content never changes
anything about how you already read data.

## Basic Scenarios

### Translate one record a user is viewing (the main use case)

```js
firestoreRedux.translation.setLanguage(currentUserLanguage);

firestoreRedux.translation.start({
  id: `post-${postId}`,
  filterFunction: (doc, collection) => collection === 'posts' && doc.id === postId,
});

// ... user closes the post ...
firestoreRedux.translation.stop(`post-${postId}`);
```

Read it with the selectors you already use — `firestoreRedux.selectors.doc('posts', postId)` returns
the translated post once ready, the original until then. Check progress if you want a translating
indicator:

```js
const status = firestoreRedux.selectors.translation.status(state, 'posts', postId);
// 'PENDING' | 'IN_PROGRESS' | 'SUCCESS' | 'PARTIAL_FAILURE' | 'FAILED'
```

### Translate everything in a session (the broad use case)

```js
firestoreRedux.translation.setLanguage(userLanguage);

firestoreRedux.translation.start({
  id: 'session',
  filterFunction: () => true, // everything currently loaded
});
```

Same calls, wider filter — nothing else changes.

## Advanced Scenarios

### Multiple activations, one shared language

Activations don't carry their own language, so running more than one at once — say, one scope per
collection — doesn't multiply anything. Set the language once; every activation you start
(and every one you start later) uses it:

```js
firestoreRedux.translation.setLanguage('hi');

firestoreRedux.translation.start({ id: 'posts-feed', filterFunction: (doc, collection) => collection === 'posts' });
firestoreRedux.translation.start({ id: 'comments-feed', filterFunction: (doc, collection) => collection === 'comments' });

// later, the user switches language — both activations follow automatically, with one call:
firestoreRedux.translation.setLanguage('gu');
```

Neither `posts-feed` nor `comments-feed` needs to be touched individually when the language changes —
see [state.md#example-state](./state.md#example-state) for this exact scenario worked through in full,
and [state.md#behaviors](./state.md#behaviors) item 6 for what a language change actually does
underneath.

### Changing an activation's scope

```js
firestoreRedux.translation.update('posts-feed', {
  filterFunction: (doc, collection) => collection === 'posts' && doc.projectId === newProjectId,
}); // user navigated to a different project
```

This only ever changes scope, not language — only valid while the activation is running; see
[user-reference-guide.md#firestorereduxtranslationupdate](./user-reference-guide.md#firestorereduxtranslationupdate)
for the exact start/stop rules. To change language instead, call
[`translation.setLanguage`](./user-reference-guide.md#firestorereduxtranslationsetlanguage) — it applies
to every activation, so there's nothing to call per-activation for that.

### Handling partial failure

```js
const status = firestoreRedux.selectors.translation.status(state, 'comments', 'comment_456');
if (status === 'PARTIAL_FAILURE') {
  const failed = firestoreRedux.selectors.translation.failedFields(state, 'comments', 'comment_456');
  // failed => ['text'], e.g. — that field still shows its original value, not a blank
  // (this is the same comment_456 example worked through in state.md#example-state)
}
```

## Customization

Most integrations never need this section — the defaults (translate every string, skip anything
numeric/boolean/date-shaped/enum-shaped) work unmodified. Reach for a schema
([schema-reference.md](./schema-reference.md)) only when:

- A specific field is being translated and shouldn't be, or vice versa (`skip`).
- A field needs `MARKDOWN`/`HTML` handling instead of plain text (`contentType`).
- One specific document, rather than its whole collection, needs a divergent schema (the `'*'` /
  specific-document-id override — see
  [schema-reference.md#per-document-overrides-rare](./schema-reference.md#per-document-overrides-rare)).

For anything about *how* a Translator should transliterate names, format dates, or otherwise behave —
that's a property of the Translator itself, not something this library or its schema configures. See
[user-reference-guide.md#firestorereduxtranslationsettranslator](./user-reference-guide.md#firestorereduxtranslationsettranslator).
