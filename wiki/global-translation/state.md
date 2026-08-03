# Global Translation — State

See [README.md](./README.md) for why this exists, and
[user-reference-guide.md](./user-reference-guide.md) for the
public API.

- Keeps translation activations, per-collection schema config, and translated content.
- Path: `/translations`

| Name        | Data Type                        | Description                              |
| ----------- | --------------------------------- | ----------------------------------------- |
| activations | [Activation](#activation) | key = activation id, from `activateTranslation` |
| schema      | [CollectionSchema](#collectionschema) | Single value, set whole in one call by `setTranslationSchema` — not built up key-by-key like `activations`/`docs`. Replaced entirely on the next call. |
| docs        | [Collection](#collection)       | Translated documents, one entry per `{collection, docId, language}` currently translated |

### Activation

| Name           | Data Type | Description |
| -------------- | --------- | ----------- |
| id             | String    | Caller-chosen identifier. |
| language       | String    | Target language for this activation. |
| filterFunction | Function  | Determines which documents this activation covers. Not serializable — kept outside the plain-object state tree the same way query callbacks are; documented here for completeness. |

### CollectionSchema

| Name              | Data Type | Description |
| ----------------- | --------- | ----------- |
| $collectionId      | [FieldSchema](#fieldschema) | key = field path |

### FieldSchema

| Name        | Data Type | Description |
| ----------- | --------- | ----------- |
| contentType | Enum      | `PLAIN` (default) \| `MARKDOWN` \| `HTML`. |
| skip        | Boolean   | `true` excludes this field beyond the automatic defaults (numeric, date/time, `ALL_CAPS_WITH_UNDERSCORES`-shaped values). |

### Collection

| Name          | Data Type                          | Description |
| ------------- | ----------------------------------- | ----------- |
| $collectionId | [TranslatedDoc](#translateddoc) | key = documentId |

### TranslatedDoc

| Name    | Data Type | Description |
| ------- | --------- | ----------- |
| $field  | String \| null | Translated value for that field in the activation's current `language`. `null` = translation attempted and failed. Absent = not yet attempted. |
| status  | Enum      | `IN_PROGRESS` \| `DONE` \| `FAILED`. No `PENDING` — absent status means not yet reached. |

### Example State

```js
{
  "translations": {
    "activations": {
      "impersonate": {
        "id": "impersonate",
        "language": "hi",
        "filterFunction": /* Function — not serializable, see Activation above */ () => true
      }
    },
    "schema": {
      "cards": {
        "title": { "contentType": "PLAIN" },
        "description2": { "contentType": "HTML" },
        "status": { "skip": true }
      },
      "boards": {
        "name": { "contentType": "PLAIN" }
      }
    },
    "docs": {
      "cards": {
        "card_123": {
          "title": "होम पेज डिज़ाइन करें",
          "description2": "<p>ग्राहक पोर्टल के लिए नया लेआउट</p>",
          "status": "DONE"
        },
        "card_456": {
          "title": null,
          "description2": "<p>ग्राहक पोर्टल के लिए नया लेआउट</p>",
          "status": "DONE"
        }
      },
      "boards": {
        "board_789": {
          "name": "बिक्री पाइपलाइन",
          "status": "DONE"
        }
      }
    }
  }
}
```

- `card_123` — both fields translated successfully (`status: "DONE"`).
- `card_456` — `title` failed (`null`) but `description2` succeeded; the document still reports
  `status: "DONE"` overall — status is per document, not per field. A caller that needs to know whether
  `title` specifically failed reads `title`'s own value (`null`), not `status`.
- `board_789` — a field not declared in the schema (or skipped) simply never appears on the translated
  doc at all.

### Behaviors

1. **On activation** — documents already loaded and matching `filterFunction` are scanned once;
   any lacking a translation for `language` are translated (a single pass, not a recurring scan).
2. **On new document load** — while an activation is live, documents newly delivered from Firestore
   that match its `filterFunction` translate automatically.
3. **On existing-document update** — the document's translation for the activation's **current**
   `language` regenerates immediately. Translations held for **other** languages on that document are
   removed (not kept and marked stale) — Firestore documents carry no revision field to compare
   against, so there's no cheap way to tell "one edit behind" from "current" other than not keeping the
   old one. Real-time re-translation across all configured languages simultaneously is **deferred**;
   only the currently active language updates live.
4. **On `updateTranslation` (filter-function change)** — documents still matching, with a valid
   translation, are kept as-is; newly-matching documents without one are translated; documents that
   matched before but no longer do have their translation removed.

This mechanism covers both broad, automatic activations and narrow, single-record ones — same
`activate/update/delete` calls, a tighter `filterFunction`. "On new document load" means delivered to
the client, not rendered — an app with expensive windowed/virtualized loading that wants less translated
narrows its own Firestore query or `filterFunction` instead.

See [README.md](./README.md#fidelity-chunking-and-the-wire-format) for the
fidelity-validation/chunking/wire-id-bridge logic this relies on.
