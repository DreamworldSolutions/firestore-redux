import { LitElement, html, css, unsafeCSS } from '@dreamworld/pwa-helpers/lit.js';
import { connect } from "@dreamworld/pwa-helpers/connect-mixin";
import cloneDeep from "lodash-es/cloneDeep";
import { store } from "./store";
import firestoreRedux from "../src/firestore-redux";
import * as translationActions from "../src/translation/redux/actions.js";
import * as translationSelectors from "../src/translation/redux/selectors.js";
import { translatableFields } from "../src/translation/schema.js";
import { Status } from "../src/translation/enums.js";
import { initializeApp } from "firebase/app";
import "@dreamworld/dw-input/dw-textarea";
import "@dreamworld/dw-input/dw-input";
import "@dreamworld/dw-switch/dw-switch";
import "@dreamworld/dw-button/dw-button";
import "@dreamworld/dw-radio-button/dw-radio-group";
import "@dreamworld/dw-radio-button/dw-radio-button";
import { Shadow } from "@dreamworld/material-styles/shadow";
import * as typographyLiterals from "@dreamworld/material-styles/typography-literals";

window._firestoreRedux = firestoreRedux;

export class FirestoreReduxDemo extends connect(store)(LitElement) {
  static styles = [
    Shadow,
    css`
      /* START: Common styles */
      :host {
        display: grid;
        place-items: center;
        padding: 8px;
      }

      h1,
      h2,
      h3,
      h4,
      h5,
      h6 {
        margin: 0;
      }

      .card {
        box-shadow: var(--mdc-elevation--z3);
        padding: 16px;
        margin: 8px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        max-width: calc(100vw - 32px);
        box-sizing: border-box;
        flex: 1;
      }

      h5 {
        ${unsafeCSS(typographyLiterals.headline5)};
      }

      h6 {
        ${unsafeCSS(typographyLiterals.headline6)};
      }

      pre {
        background-color: lightblue;
        padding: 8px 8px 8px 0px;
        border-radius: 8px;
        margin-top: 0;
        overflow: auto;
      }

      .row strong:not(:nth-child(1)) {
        margin-left: 32px;
      }

      dw-textarea {
        border: 2px solid lightgray;
        border-radius: 8px;
        --dw-textarea-padding: 8px;
      }

      dw-button {
        align-self: center;
        margin-top: 16px;
      }

      .request-query_container {
        width: 100%;
      }
      /* END: Common styles.  */

      .row {
        display: flex;
        justify-content: justify;
        flex-wrap: wrap;
        width: 100%;
      }

      dw-input {
        min-width: 350px;
        margin: 12px;
        flex: 1;
      }

      .switch-container {
        margin: 8px 16px 0 12px;
      }

      dw-switch {
        margin-left: 12px;
      }

      dw-radio-group {
        display: flex;
      }

      dw-radio-button {
        margin-left: 8px;
      }

      .translation-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
      }

      .translation-actions dw-button {
        align-self: auto;
        margin: 8px 8px 0 0;
      }

      pre.output {
        background-color: #eceff1;
        padding: 8px;
        white-space: pre-wrap;
        word-break: break-word;
      }
    `,
  ];

  static properties = {
    /**
     * Intially it's `false`. After firebase app initialization, it sets to `true`.
     */
    _firebaseApp: { type: Boolean },

    /**
     * Config string entered by the user.
     */
    _firebaseConfigString: { type: String },

    /**
     * Parsed Firebase Config given by the user into text field
     */
    _firebaseConfig: { type: Object },

    /**
     * Query detail provided by the user. e.g {id, requesterId, collection, where, orderBy, startAt, startAfter, endAt, endBefore, limit, once}
     */
    _query: { type: Object },

    /**
     * Whole `/translations` branch of the redux state, mirrored so the demo re-renders on change.
     */
    _translationState: { type: Object },

    /**
     * Human readable result of the last translation scenario that was run.
     */
    _translationOutput: { type: String },
  };

  constructor() {
    super();
    this._queryCollection = "cards";
    this._singleDocCollection = "cards";
    this._query = {
      requesterId: "req-id",
      where: '[["columnType", "==", "DONE"]]',
      orderBy: '',
    };

    this._saveCollection = "cards";
    this._saveLocal = true;
    this._saveRemote = true;

    this._deleteCollection = "cards";
    this._deleteLocal = true;
    this._deleteRemote = true;

    this._translationOutput = "Run a scenario to see its result here (and in the console).";
    this._translationSchemaString = `{
  "posts": {
    "*": { "title": { "contentType": "PLAIN" }, "body": { "contentType": "HTML" } }
  }
}`;
  }

  firstUpdated(changedProps) {
    super.firstUpdated && super.firstUpdated(changedProps);
    this._firebaseConfigString = ` {
      "apiKey": "AIzaSyAD9RzBEZ_pzZomgIbyIHo0No4PoFDm2Zc",
      "authDomain": "friendlyeats-d6aa1.firebaseapp.com",
      "projectId": "friendlyeats-d6aa1"
    }`;
  }

  render() {
    if (!this._firebaseApp) {
      return html`${this._firebaseInitTemplate}`;
    }

    return html`
      ${this._translationTemplate} ${this._readByQueryTemplate}
      ${this._readByDocTemplate} ${this._cancelQueryTemplate}
      ${this._saveDeleteTemplate}
    `;
  }

  get _translationTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">
          Translation &mdash; <code>/translations</code> state shape &amp;
          <code>setSchema</code>
        </h6>
        <div class="translation-actions">
          <dw-button raised @click=${this.__runTranslationScenario1}
            >1. Shared language</dw-button
          >
          <dw-button raised @click=${this.__runTranslationScenario2}
            >2. Own "status" field</dw-button
          >
          <dw-button raised @click=${this.__runTranslationScenario3}
            >3. '*' + doc override</dw-button
          >
          <dw-button raised @click=${this.__runTranslationScenario4}
            >4. Default skips &amp; contentType</dw-button
          >
          <dw-button outlined @click=${this.__resetTranslationState}
            >Reset</dw-button
          >
        </div>

        <h6 class="headline6">Result</h6>
        <pre class="output">${this._translationOutput}</pre>

        <h6 class="headline6">
          Set a schema by hand (<code>translation.setSchema</code>)
        </h6>
        <dw-textarea
          .minHeight=${100}
          .maxHeight=${240}
          .value=${this._translationSchemaString}
          @value-changed=${(e) => {
            this._translationSchemaString = e.detail.value;
          }}
        ></dw-textarea>
        <dw-button raised @click=${this.__setTranslationSchema}
          >Set Schema</dw-button
        >

        <h6 class="headline6">Current <code>/translations</code> state</h6>
        <pre class="output">${this.__stringify(this._translationState)}</pre>
      </div>
    `;
  }

  get _firebaseInitTemplate() {
    return html`
      <div class="firebase-init-container card">
        <h5>
          Firebase app is not initialized yet. Please add firebseConfig object
          into text field & Click the INITIALIZE button.
        </h5>
        <h6>Note: String must be the valid JSON format like this:</h6>
        <pre>
  {
    "apiKey": "AIzaSyAD9RzBEZ_pzZomgIbyIHo0No4PoFDm2Zc",
    "authDomain": "friendlyeats-d6aa1.firebaseapp.com",
    "projectId": "friendlyeats-d6aa1"
  }
</pre
        >
        <dw-textarea
          .minHeight=${200}
          .maxHeight=${300}
          .value=${this._firebaseConfigString}
          @value-changed=${this.__onAppConfigChanged}
        ></dw-textarea>
        <dw-button raised @click=${this.__init}>Initialize</dw-button>
      </div>
    `;
  }

  get _readByQueryTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">Read documents by Query</h6>
        <div class="row">
          <dw-input
            dense
            label="Collection"
            value="${this._queryCollection}"
            required
            placeholder="Enter Collection/Subcollection ID"
            @value-changed=${(e) => {
              this._queryCollection = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Requester Id"
            value="${this._query.requesterId}"
            placeholder="Enter Requester Id"
            @value-changed=${(e) => {
              this._query.requesterId = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Where"
            value=${this._query.where}
            placeholder="Enter where conditions. e.g. [['name', '==', 'Nirmal'], ['age', '<=', 30]]"
            @value-changed=${(e) => {
              this._query.where = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Order By"
            value="${this._query.orderBy}"
            placeholder="Enter orderBy. e.g. [['firstName'], ['age', 'desc']]"
            @value-changed=${(e) => {
              this._query.orderBy = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Start At"
            placeholder="Enter the field value to start this query at, in order of the query's order by"
            @value-changed=${(e) => {
              this._query.startAt = isNaN(e.detail.value)
                ? e.detail.value
                : +e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Start After"
            placeholder="Enter the field value to start this query after, in order of the query's order by."
            @value-changed=${(e) => {
              this._query.startAfter = isNaN(e.detail.value)
                ? e.detail.value
                : +e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="End At"
            placeholder="Enter the field value to end this query at, in order of the query's order by."
            @value-changed=${(e) => {
              this._query.endAt = isNaN(e.detail.value)
                ? e.detail.value
                : +e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="End Before"
            placeholder="Enter the field value to end this query before, in order of the query's order by."
            @value-changed=${(e) => {
              this._query.endAfter = isNaN(e.detail.value)
                ? e.detail.value
                : +e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Limit"
            type="number"
            placeholder="Enter he maximum number of items to return."
            @value-changed=${(e) => {
              this._query.limit = +e.detail.value;
            }}
          ></dw-input>
        </div>

        <div class="switch-container row">
          <strong>Once</strong>:
          <dw-switch
            @click=${(e) => {
              this._query.once = e.target.selected;
            }}
          ></dw-switch>

          <strong>Wait Till Read Succeed</strong>:
          <dw-switch
            @click=${(e) => {
              this._query.waitTillSucceed = e.target.selected;
            }}
          ></dw-switch>
        </div>
        <dw-button raised @click=${this.__requestQuery}
          >Request Query</dw-button
        >
      </div>
    `;
  }

  get _readByDocTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">Read Single Document.</h6>
        <div class="row">
          <dw-input
            dense
            label="Collection"
            value="${this._singleDocCollection}"
            required
            placeholder="Enter Collection/Subcollection path"
            @value-changed=${(e) => {
              this._singleDocCollection = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Document Id"
            value=""
            required
            placeholder="Enter Document ID."
            @value-changed=${(e) => {
              this._singleDocId = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Requester Id"
            value=""
            placeholder="Enter Requester Id"
            @value-changed=${(e) => {
              this._singleDocRequester = e.detail.value;
            }}
          ></dw-input>
        </div>

        <div class="switch-container row">
          <strong>Once</strong>:
          <dw-switch
            @click=${(e) => {
              this._singleDocOnce = e.target.selected;
            }}
          ></dw-switch>

          <strong>Wait Till Read Succeed</strong>:
          <dw-switch
            @click=${(e) => {
              this._singleDocwaitTillSucceed = e.target.selected;
            }}
          ></dw-switch>
        </div>
        <dw-button raised @click=${this._readDoc}>Read Document</dw-button>
      </div>
    `;
  }

  get _cancelQueryTemplate() {
    return html`
      <div class="row">
        <div class="cancel-query_container card">
          <h6 class="headline6">Cancel a single Query.</h6>
          <dw-input
            dense
            label="Cancel By Query Id"
            placeholder="Enter Query Id"
            @value-changed=${(e) => {
              this._cancelQueryId = e.detail.value;
            }}
          ></dw-input>
          <dw-button raised @click=${this.__cancelQuery}
            >Cancel Query</dw-button
          >
        </div>

        <div class="cancel-query_container card">
          <h6 class="headline6">Cancel queries by Requester Id.</h6>
          <dw-input
            dense
            label="Cancel By Requester Id"
            placeholder="Enter Requester Id"
            @value-changed=${(e) => {
              this._cancelRequesterId = e.detail.value;
            }}
          ></dw-input>
          <dw-button raised @click=${this.__cancelQueryByRequester}
            >Cancel Queries by Requester</dw-button
          >
        </div>
      </div>
    `;
  }

  get _saveDeleteTemplate() {
    return html`
      <div class="row">
        <div class="save-docs_container card">
          <h6 class="headline6">Save Documents.</h6>
          <dw-input
            dense
            label="Collection Path"
            placeholder="Enter collection / subcollection path."
            .value=${this._saveCollection}
            @value-changed=${(e) => {
              this._saveCollection = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Documents"
            placeholder="Enter document. e.g. [{'name': 'kite'}, {'name': 'lamp'}]"
            @value-changed=${(e) => {
              this._saveDocuments = e.detail.value;
            }}
          ></dw-input>
          <div class="switch-container row">
            <strong>Local Write</strong>
            <dw-switch
              ?checked=${this._saveLocal}
              @click=${(e) => {
                this._saveLocal = e.target.selected;
              }}
            ></dw-switch>
            <strong>Remote Write</strong>
            <dw-switch
              ?checked=${this._saveRemote}
              @click=${(e) => {
                this._saveRemote = e.target.selected;
              }}
            ></dw-switch>
          </div>
          <dw-button raised @click=${this.__saveDocs}>Save Document</dw-button>
        </div>

        <div class="save-docs_container card">
          <h6 class="headline6">Delete Documents</h6>
          <dw-input
            dense
            label="Collection"
            placeholder="Enter Collection/subcollection path."
            .value=${this._deleteCollection}
            @value-changed=${(e) => {
              this._deleteCollection = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Document Ids"
            placeholder="Enter array of document ids.. e.g. ['R6RNtIfCVBVLoZXYpYgN', '7B771W9riFOnLyxWbItL']"
            @value-changed=${(e) => {
              this._deleteDocIds = e.detail.value;
            }}
          ></dw-input>
          <div class="switch-container row">
            <strong>Local Delete</strong>
            <dw-switch
              ?checked=${this._deleteLocal}
              @click=${(e) => {
                this._deleteLocal = e.target.selected;
              }}
            ></dw-switch>
            <strong>Remote Delete</strong>
            <dw-switch
              ?checked=${this._deleteRemote}
              @click=${(e) => {
                this._deleteRemote = e.target.selected;
              }}
            ></dw-switch>
          </div>
          <dw-button raised @click=${this.__deleteDocs}
            >Delete documents</dw-button
          >
        </div>
      </div>
    `;
  }

  __onAppConfigChanged(e) {
    this._firebaseConfigString = e.detail.value;
  }

  __init() {
    try {
      this._firebaseConfig = JSON.parse(this._firebaseConfigString);
      this._firebaseApp = initializeApp(this._firebaseConfig);
      firestoreRedux.init({
        store,
        firebaseApp: this._firebaseApp,
        readPollingConfig: { timeout: 10000, maxAttempts: 20 },
      });
    } catch (err) {
      console.error(err);
      alert("Something is wrong. Please see the error detail in console.");
    }
  }

  async __requestQuery() {
    if (!this._queryCollection) {
      alert("Please provide Mandatory fields.");
      return;
    }

    if (this._query.where && !this.__isArrayString(this._query.where)) {
      alert('Please Enter valid Array string in "WHERE" field.');
      return;
    }

    if (this._query.orderBy && !this.__isArrayString(this._query.orderBy)) {
      alert('Please Enter valid Array string in "orderBy" field.');
      return;
    }

    const query = cloneDeep(this._query);
    query.where = this._query.where && JSON.parse(this._query.where);
    query.orderBy = this._query.orderBy && JSON.parse(this._query.orderBy);
    try {
      window.q = firestoreRedux.query(this._queryCollection, query);
      const result = await window.q.result;
      console.log({ result });
      setTimeout(() => {
        //window.q.loadNextPage();
      }, 5000);
    } catch (error) {
      console.log("Catch error", error);
      window.q.retry();
    }
  }

  async _readDoc() {
    try {
      if (!this._singleDocCollection || !this._singleDocId) {
        alert("Please provide Mandatory fields.");
        return;
      }

      window.req = firestoreRedux.getDocById(
        this._singleDocCollection,
        this._singleDocId,
        {
          once: this._singleDocOnce,
          requesterId: this._singleDocRequester,
          waitTillSucceed: this._singleDocwaitTillSucceed,
        }
      );
      const result = await window.req.result;
      console.log({ result });
    } catch (error) {
      window.req.retry();
    }
  }

  __cancelQuery() {
    if (!this._cancelQueryId) {
      alert("Please enter queryId");
      return;
    }
    firestoreRedux.cancelQuery(this._cancelQueryId);
  }

  __cancelQueryByRequester() {
    if (!this._cancelRequesterId) {
      alert("Please enter requesterId");
      return;
    }
    firestoreRedux.cancelQueryByRequester(this._cancelRequesterId);
  }

  async __saveDocs() {
    if (!this._saveCollection || !this.__isJSONString(this._saveDocuments)) {
      alert("Please Enter collection & valid document.");
      return;
    }

    try {
      const docs = await firestoreRedux.save(
        this._saveCollection,
        JSON.parse(this._saveDocuments),
        { localWrite: this._saveLocal, remoteWrite: this._saveRemote }
      );
      console.log("saved docs", docs);
    } catch (error) {
      console.error("save error", error);
    }
  }

  async __deleteDocs() {
    if (!this._deleteCollection || !this._deleteDocIds) {
      alert("Please Enter valid Array string of paths..");
      return;
    }

    const docIds = this.__isArrayString(this._deleteDocIds)
      ? JSON.parse(this._deleteDocIds)
      : this._deleteDocIds;
    try {
      const ids = await firestoreRedux.delete(this._deleteCollection, docIds, {
        localWrite: this._deleteLocal,
        remoteWrite: this._deleteRemote,
      });
      console.log('Delete success', ids);
    } catch (error) {
      console.error("Delete error", error);
    }
  }

  /**
   * Scenario 1: two activations covering different collections, both translating into the same
   * language - there must be no per-activation language field anywhere in state.
   */
  __runTranslationScenario1() {
    store.dispatch(translationActions._setLanguage("hi"));
    store.dispatch(
      translationActions._addActivation({
        id: "posts-feed",
        filterFunction: (doc, collection) => collection === "posts",
      })
    );
    store.dispatch(
      translationActions._addActivation({
        id: "comments-feed",
        filterFunction: (doc, collection) => collection === "comments",
      })
    );

    const { language, activations } = store.getState().translations;
    const ids = Object.keys(activations);
    const carryingLanguage = ids.filter((id) => "language" in activations[id]);

    this.__reportTranslationScenario(
      "Scenario 1 - two activations, one shared language",
      [
        `translations.language = ${JSON.stringify(language)}`,
        ...ids.map(
          (id) => `activations.${id} keys = [${Object.keys(activations[id]).join(", ")}]`
        ),
        this.__check(language === "hi", `single top-level language is 'hi'`),
        this.__check(ids.length === 2, `both activations are stored (${ids.length})`),
        this.__check(
          carryingLanguage.length === 0,
          `no activation carries its own 'language' field`
        ),
      ],
      { language, activations }
    );
  }

  /**
   * Scenario 2: a document whose own real field is named `status`. The clone must hold the
   * document's value; the translation status lives in the separate `status` branch.
   */
  __runTranslationScenario2() {
    const original = {
      id: "post_123",
      title: "Design home page",
      status: "IN_PROGRESS",
    };

    store.dispatch(
      translationActions._setTranslatedDoc("posts", "post_123", {
        ...original,
        title: "होम पेज डिज़ाइन करें",
      })
    );
    store.dispatch(
      translationActions._setDocStatus("posts", "post_123", {
        status: Status.SUCCESS,
        failedFields: [],
      })
    );

    const { docs, status } = store.getState().translations;
    const clone = docs.posts.post_123;
    const docStatus = status.posts.post_123;

    this.__reportTranslationScenario(
      "Scenario 2 - a document field named 'status' never collides with translation metadata",
      [
        `docs.posts.post_123   = ${JSON.stringify(clone)}`,
        `status.posts.post_123 = ${JSON.stringify(docStatus)}`,
        this.__check(
          clone.status === "IN_PROGRESS",
          `the clone's 'status' holds the document's own value`
        ),
        this.__check(
          docStatus.status === Status.SUCCESS,
          `the translation status is 'SUCCESS', in its own branch`
        ),
        this.__check(
          clone.failedFields === undefined,
          `no translation metadata leaked into the clone`
        ),
      ],
      { clone, docStatus }
    );
  }

  /**
   * Scenario 3: a `'*'` schema entry plus a specific-document override - only that document uses
   * the override.
   */
  __runTranslationScenario3() {
    firestoreRedux.translation.setSchema({
      posts: {
        "*": { title: { contentType: "PLAIN" } },
        post_123: { title: { skip: true } },
      },
    });

    const schema = translationSelectors.schema(store.getState());
    const wildcard = translatableFields(
      { id: "post_999", title: "Design home page" },
      "posts",
      schema
    );
    const overridden = translatableFields(
      { id: "post_123", title: "Design home page" },
      "posts",
      schema
    );

    this.__reportTranslationScenario(
      "Scenario 3 - '*' covers the collection, a document Id overrides it",
      [
        `post_999 (uses '*')      -> ${JSON.stringify(wildcard)}`,
        `post_123 (own override)  -> ${JSON.stringify(overridden)}`,
        this.__check(
          wildcard.length === 1 && wildcard[0].contentType === "PLAIN",
          `post_999's title is translatable, as PLAIN, from the '*' entry`
        ),
        this.__check(
          overridden.length === 0,
          `post_123's title is skipped by its own entry`
        ),
      ],
      { wildcard, overridden }
    );
  }

  /**
   * Scenario 4: default skips (including an `IN_PROGRESS`-shaped value), `{ skip: false }` forcing
   * a skipped field back in, and an undeclared `contentType` staying genuinely absent.
   */
  __runTranslationScenario4() {
    const doc = {
      id: "post_1",
      title: "Design home page",
      columnType: "IN_PROGRESS",
      body: "<p>New layout for the customer portal</p>",
      views: 42,
      rank: "3.5",
      dueDate: "2026-08-11",
      archived: false,
      note: null,
      owner: { name: "Nirmal" },
    };

    firestoreRedux.translation.setSchema({});
    const withoutSchema = translatableFields(
      doc,
      "posts",
      translationSelectors.schema(store.getState())
    );

    firestoreRedux.translation.setSchema({
      posts: {
        "*": { columnType: { skip: false }, body: { contentType: "HTML" } },
      },
    });
    const withSchema = translatableFields(
      doc,
      "posts",
      translationSelectors.schema(store.getState())
    );

    const titleField = withSchema.find(({ path }) => path === "title");
    const bodyField = withSchema.find(({ path }) => path === "body");

    this.__reportTranslationScenario(
      "Scenario 4 - automatic skips, skip:false, and an absent contentType",
      [
        `no schema   -> ${withoutSchema.map(({ path }) => path).join(", ")}`,
        `with schema -> ${withSchema.map(({ path }) => path).join(", ")}`,
        `every item's keys, no schema: ${withoutSchema
          .map(({ path, ...rest }) => `${path}:[${Object.keys(rest).join(",")}]`)
          .join("  ")}`,
        this.__check(
          !withoutSchema.some(({ path }) => path === "columnType"),
          `'IN_PROGRESS' is skipped automatically with no schema entry`
        ),
        this.__check(
          withSchema.some(({ path }) => path === "columnType"),
          `{ skip: false } brings 'columnType' back in`
        ),
        this.__check(
          withoutSchema.every((field) => !("contentType" in field)),
          `no undeclared field carries a contentType key at all - not even 'PLAIN'`
        ),
        this.__check(
          titleField && !("contentType" in titleField),
          `'title' stays absent while a sibling declares one`
        ),
        this.__check(
          bodyField && bodyField.contentType === "HTML",
          `'body' carries its declared HTML contentType`
        ),
        this.__check(
          ["views", "rank", "dueDate", "archived", "note", "id"].every(
            (path) => !withoutSchema.some((field) => field.path === path)
          ),
          `number / numeric string / date / boolean / null / id are all left out`
        ),
      ],
      { withoutSchema, withSchema }
    );
  }

  __setTranslationSchema() {
    if (!this.__isJSONString(this._translationSchemaString)) {
      alert("Please enter a valid JSON schema.");
      return;
    }

    try {
      firestoreRedux.translation.setSchema(
        JSON.parse(this._translationSchemaString)
      );
      this.__reportTranslationScenario("translation.setSchema", [
        this.__check(true, "schema accepted and stored at /translations.schema"),
      ]);
    } catch (error) {
      console.error(error);
      this.__reportTranslationScenario("translation.setSchema", [
        this.__check(false, `${error}`),
      ]);
    }
  }

  __resetTranslationState() {
    firestoreRedux.translation.setSchema({});
    store.dispatch(translationActions._setLanguage(undefined));
    store.dispatch(translationActions._removeActivation("posts-feed"));
    store.dispatch(translationActions._removeActivation("comments-feed"));
    store.dispatch(
      translationActions._removeDocTranslation("posts", "post_123")
    );
    this._translationOutput = "Reset. /translations is back to its initial shape.";
  }

  /**
   * Prints a scenario's outcome to both the demo card and the console.
   * @param {String} title Scenario title.
   * @param {Array} lines Lines to show, in order.
   * @param {Object} data Raw values, logged to the console for inspection.
   */
  __reportTranslationScenario(title, lines, data) {
    this._translationOutput = [title, "", ...lines].join("\n");
    console.group(`%c${title}`, "font-weight: bold");
    lines.forEach((line) => console.log(line));
    data && console.log(data);
    console.groupEnd();
  }

  /**
   * @param {Boolean} passed Whether the expectation held.
   * @param {String} expectation What was expected.
   * @returns {String} A single result line.
   */
  __check(passed, expectation) {
    return `${passed ? "PASS" : "FAIL"}  ${expectation}`;
  }

  /**
   * @param {Object} value Value to show.
   * @returns {String} Pretty JSON, with functions shown by name since JSON drops them.
   */
  __stringify(value) {
    if (value === undefined) {
      return "";
    }

    return JSON.stringify(
      value,
      (key, val) => (typeof val === "function" ? "<filterFunction>" : val),
      2
    );
  }

  /**
   * @param {String} str String to be checked for valid Object string
   * @returns {Boolean}
   */
  __isJSONString(str) {
    try {
      JSON.parse(str);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {String} str String to be checked for valid Array string
   * @returns {Boolean}
   */
  __isArrayString(str) {
    return this.__isJSONString(str) && Array.isArray(JSON.parse(str));
  }

  stateChanged(state) {
    this._translationState = state.translations;
  }
}
customElements.define("firestore-redux-demo", FirestoreReduxDemo);
