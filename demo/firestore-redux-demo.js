import { LitElement, html, css, unsafeCSS } from '@dreamworld/pwa-helpers/lit.js';
import { connect } from "@dreamworld/pwa-helpers/connect-mixin";
import cloneDeep from "lodash-es/cloneDeep";
import { store } from "./store";
import firestoreRedux from "../src/firestore-redux";
import * as translationActions from "../src/translation/redux/actions.js";
import * as translationSelectors from "../src/translation/redux/selectors.js";
import { translatableFields, documentFieldSchema, skipReason } from "../src/translation/schema.js";
import { Status } from "../src/translation/enums.js";
import { toWireId, fromWireId } from "../src/translation/wire-id.js";
import { fidelityPreserved, tagSignature } from "../src/translation/fidelity.js";
import {
  DEBOUNCE_WINDOW,
  MAX_ITEMS_PER_REQUEST,
  MAX_CHARS_PER_REQUEST,
  MAX_CONCURRENT_REQUESTS,
} from "../src/translation/translation-pipeline.js";
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

    /**
     * Human readable result of the last Translator-pipeline scenario that was run.
     */
    _pipelineOutput: { type: String },

    /**
     * Human readable result of the last setTranslator / setLanguage scenario that was run.
     */
    _translatorOutput: { type: String },
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
    this._pipelineOutput = "Run a scenario to see its result here (and in the console).";
    this._translatorOutput = "Run a scenario to see its result here (and in the console).";
    this._realEndpointUrl = "";
    this._realEndpointMethod = "GET";
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
      ${this._translationTemplate} ${this._pipelineTemplate}
      ${this._translatorTemplate} ${this._readByQueryTemplate}
      ${this._readByDocTemplate} ${this._cancelQueryTemplate}
      ${this._saveDeleteTemplate}
    `;
  }

  get _translatorTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">
          Translation &mdash; <code>setTranslator</code> and
          <code>setLanguage</code>
        </h6>
        <div>
          Every URL-form scenario below makes a <strong>real HTTP request</strong> to
          <code>/translate</code>, served by <code>demo/translate-api-mock.js</code> per
          <code>translate-api.openapi.yml</code>. Watch the DevTools <strong>Network</strong> tab
          while they run. Each result is checked against what the <em>server</em> actually
          received, not just what the client thinks it sent.
        </div>
        <div class="translation-actions">
          <dw-button raised @click=${this.__runTranslatorScenario1}
            >T1. Plain URL &rarr; GET</dw-button
          >
          <dw-button raised @click=${this.__runTranslatorScenario2}
            >T2. POST &amp; default GET</dw-button
          >
          <dw-button raised @click=${this.__runTranslatorScenario3}
            >T3. Function form</dw-button
          >
          <dw-button raised @click=${this.__runTranslatorScenario4}
            >T4. No language yet</dw-button
          >
          <dw-button raised @click=${this.__runRealApiScenario}
            >R. REAL public API (~8s)</dw-button
          >
        </div>

        <h6 class="headline6">Result</h6>
        <pre class="output">${this._translatorOutput}</pre>

        <h6 class="headline6">Fire one call at a real endpoint</h6>
        <div class="row">
          <dw-input
            dense
            label="Translate endpoint URL"
            placeholder="e.g. https://your-server/translate"
            .value=${this._realEndpointUrl}
            @value-changed=${(e) => {
              this._realEndpointUrl = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Method (GET or POST)"
            .value=${this._realEndpointMethod}
            @value-changed=${(e) => {
              this._realEndpointMethod = e.detail.value;
            }}
          ></dw-input>
        </div>
        <dw-button raised @click=${this.__callRealEndpoint}
          >Call real endpoint</dw-button
        >
      </div>
    `;
  }

  get _pipelineTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">Translation &mdash; Translator request pipeline</h6>
        <div>
          Caps in force: <code>DEBOUNCE_WINDOW=${DEBOUNCE_WINDOW}ms</code>,
          <code>MAX_ITEMS_PER_REQUEST=${MAX_ITEMS_PER_REQUEST}</code>,
          <code>MAX_CHARS_PER_REQUEST=${MAX_CHARS_PER_REQUEST}</code>,
          <code>MAX_CONCURRENT_REQUESTS=${MAX_CONCURRENT_REQUESTS}</code>
        </div>
        <div class="translation-actions">
          <dw-button raised @click=${this.__runPipelineScenario1}
            >P1. Wire addressing</dw-button
          >
          <dw-button raised @click=${this.__runPipelineScenario2}
            >P2. Debouncing (~3s)</dw-button
          >
          <dw-button raised @click=${this.__runPipelineScenario3}
            >P3. Chunking &amp; concurrency (~3s)</dw-button
          >
          <dw-button raised @click=${this.__runPipelineScenario4}
            >P4. Fidelity</dw-button
          >
        </div>

        <h6 class="headline6">Result</h6>
        <pre class="output">${this._pipelineOutput}</pre>
      </div>
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
    store.dispatch(translationActions.setLanguage("hi"));
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

  /**
   * P1: a collection/docId/field-path triple containing `.` and `-` round-trips through the wire id.
   */
  __runPipelineScenario1() {
    const triples = [
      ["posts", "post_123", "title"],
      ["my-posts.v2", "doc-1.2-3", "members[0].name"],
      ["a-b.c", "d.e-f", "address.city"],
    ];

    const lines = [];
    triples.forEach(([collection, docId, fieldPath]) => {
      const wireId = toWireId(collection, docId, fieldPath);
      const parts = fromWireId(wireId);
      lines.push(`in   : collection="${collection}"  docId="${docId}"  fieldPath="${fieldPath}"`);
      lines.push(`wire : ${wireId}`);
      lines.push(`out  : ${JSON.stringify(parts)}`);
      lines.push(
        this.__check(
          parts.collection === collection && parts.docId === docId && parts.fieldPath === fieldPath,
          `reconstructs exactly, despite '.' and '-' inside the parts`
        )
      );
      lines.push("");
    });

    let threw = false;
    try {
      fromWireId("no-separators-here");
    } catch (error) {
      threw = true;
    }
    lines.push(this.__check(threw, `a malformed wire id is rejected rather than silently mis-split`));

    this.__reportPipelineScenario("P1 - wire addressing round-trip", lines, { triples });
  }

  /**
   * P2: rapid updates to one document collapse into a single call, and a second document debounces
   * independently instead of queueing behind the first.
   */
  async __runPipelineScenario2() {
    this._pipelineOutput = "Running... (about 3 seconds)";
    const calls = this.__installStubTranslator({ latency: 900 });
    this.__seedDoc("posts", { id: "doc-a", title: "v0" });
    this.__seedDoc("posts", { id: "doc-b", title: "w0" });
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-a"));
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-b"));
    store.dispatch(translationActions.setLanguage("hi"));

    for (let i = 1; i <= 5; i++) {
      this.__translate("posts", "doc-a", [{ path: "title", value: `v${i}` }], true);
      await this.__wait(40);
    }
    await this.__wait(120);
    for (let i = 1; i <= 5; i++) {
      this.__translate("posts", "doc-b", [{ path: "title", value: `w${i}` }], true);
      await this.__wait(40);
    }
    await this.__wait(DEBOUNCE_WINDOW + 1400);

    const callA = calls.find((c) => c.ids[0].startsWith("posts/doc-a/"));
    const callB = calls.find((c) => c.ids[0].startsWith("posts/doc-b/"));
    const { docs } = store.getState().translations;

    this.__reportPipelineScenario(
      "P2 - per-document debouncing",
      [
        `10 updates were made (5 to doc-a, 5 to doc-b, 40ms apart)`,
        `translate calls fired: ${calls.length}  -> ${JSON.stringify(calls.map((c) => c.ids))}`,
        `doc-a call started at +0ms, finished at +${callA ? callA.finishedAt - callA.startedAt : "-"}ms`,
        `doc-b call started ${callB && callA ? callB.startedAt - callA.startedAt : "-"}ms after doc-a's started`,
        this.__check(calls.length === 2, `5 rapid updates per document collapsed into ONE call each`),
        this.__check(
          !!callA && !!callB && callB.startedAt - callA.startedAt < 900,
          `doc-b was NOT serialized behind doc-a's 900ms in-flight request`
        ),
        this.__check(
          docs.posts["doc-a"].title === "[hi] v5" && docs.posts["doc-b"].title === "[hi] w5",
          `only the final value of each document was translated (v5 / w5, not v1..v4)`
        ),
      ],
      { calls, docs: docs.posts }
    );
  }

  /**
   * P3: a document exceeding the per-request item cap splits into batches, newest-relevant-first,
   * with excess batches queueing behind the concurrency cap. Then the same for the character cap.
   */
  async __runPipelineScenario3() {
    this._pipelineOutput = "Running... (about 3 seconds)";

    const doc = { id: "doc-big" };
    for (let i = 0; i < 200; i++) {
      doc[`field_${i}`] = `text number ${i}`;
    }
    let calls = this.__installStubTranslator({ latency: 500 });
    this.__seedDoc("posts", doc);
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-big"));
    store.dispatch(translationActions.setLanguage("hi"));

    const fields = [];
    for (let i = 0; i < 200; i++) {
      fields.push({ path: `field_${i}`, value: `text number ${i}` });
    }
    this.__translate("posts", "doc-big", fields, false);

    const immediate = calls.length;
    const peakConcurrency = Math.max(...calls.map((c) => c.concurrentAtStart));
    await this.__wait(1800);

    const itemCapLines = [
      `200 fields queued at once`,
      `batches sent immediately: ${immediate}   (concurrency cap is ${MAX_CONCURRENT_REQUESTS})`,
      `batches after the queue drained: ${calls.length}`,
      `batch sizes: ${JSON.stringify(calls.map((c) => c.count))}`,
      `batch 1 spans: ${calls[0].ids[0]} .. ${calls[0].ids[calls[0].ids.length - 1]}`,
      `batch 4 spans: ${calls[3] ? calls[3].ids[0] : "-"} .. ${calls[3] ? calls[3].ids[calls[3].ids.length - 1] : "-"}`,
      this.__check(calls.length === 4, `split into 4 batches of ${MAX_ITEMS_PER_REQUEST}`),
      this.__check(immediate === MAX_CONCURRENT_REQUESTS, `only ${MAX_CONCURRENT_REQUESTS} went out at once - the 4th queued`),
      this.__check(peakConcurrency <= MAX_CONCURRENT_REQUESTS, `concurrency never exceeded the cap (peak ${peakConcurrency})`),
      this.__check(
        calls.every((c) => c.count <= MAX_ITEMS_PER_REQUEST),
        `every batch respects the item cap`
      ),
      this.__check(
        calls[0].ids[0] === "posts/doc-big/field_150" && calls[0].ids[49] === "posts/doc-big/field_199",
        `newest-relevant-first: batch 1 carries fields 150-199, in queue order within the batch`
      ),
      this.__check(
        store.getState().translations.status.posts["doc-big"].status === Status.SUCCESS,
        `status written only once ALL 4 batches settled`
      ),
    ];

    // Character cap - 5 fields of 6000 chars each.
    const big = "x".repeat(6000);
    const charDoc = { id: "doc-chars" };
    [0, 1, 2, 3, 4].forEach((i) => (charDoc[`f${i}`] = big));
    calls = this.__installStubTranslator({ latency: 0 });
    this.__seedDoc("posts", charDoc);
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-chars"));
    this.__translate(
      "posts",
      "doc-chars",
      [0, 1, 2, 3, 4].map((i) => ({ path: `f${i}`, value: big })),
      false
    );
    await this.__wait(300);

    this.__reportPipelineScenario(
      "P3 - chunking and concurrency",
      [
        ...itemCapLines,
        "",
        `5 fields x 6000 chars = 30000 chars, cap is ${MAX_CHARS_PER_REQUEST}`,
        `batch sizes: ${JSON.stringify(calls.map((c) => c.count))}   chars: ${JSON.stringify(calls.map((c) => c.chars))}`,
        this.__check(calls.length === 2, `split by the character cap into 2 batches`),
        this.__check(
          calls.every((c) => c.chars <= MAX_CHARS_PER_REQUEST),
          `no batch exceeded ${MAX_CHARS_PER_REQUEST} characters`
        ),
      ],
      { calls }
    );
  }

  /**
   * P4: a translation whose tag set doesn't match the source fails that field only - the original
   * is kept and the field is named in `failedFields`. A matching one is accepted.
   */
  async __runPipelineScenario4() {
    const source = '<p>New layout for the <a href="/portal">customer portal</a></p>';
    const doc = { id: "doc-html", title: "Design home page", body: source, note: "Keep it simple" };

    // Pass 1 - the Translator drops the <a> from the HTML field.
    this.__installStubTranslator({
      mangle: (id, item, language) =>
        id.endsWith("/body")
          ? { text: "<p>ग्राहक पोर्टल के लिए नया लेआउट</p>", success: true }
          : { text: `[${language}] ${item.text}`, success: true },
    });
    this.__seedDoc("posts", doc);
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-html"));
    store.dispatch(translationActions.setLanguage("hi"));

    const fields = [
      { path: "title", value: doc.title, contentType: "PLAIN" },
      { path: "body", value: source, contentType: "HTML" },
      { path: "note", value: doc.note },
    ];
    this.__translate("posts", "doc-html", fields, false);
    await this.__wait(200);

    const broken = store.getState().translations;
    const brokenLines = [
      `source   : ${source}`,
      `returned : <p>ग्राहक पोर्टल के लिए नया लेआउट</p>      <-- the <a href="/portal"> is gone`,
      `stored   : ${broken.docs.posts["doc-html"].body}`,
      `status   : ${JSON.stringify(broken.status.posts["doc-html"])}`,
      this.__check(broken.docs.posts["doc-html"].body === source, `the tag-broken field kept its ORIGINAL value (not null)`),
      this.__check(
        broken.docs.posts["doc-html"].title === "[hi] Design home page" &&
          broken.docs.posts["doc-html"].note === "[hi] Keep it simple",
        `its siblings on the same document translated fine - failure is per field`
      ),
      this.__check(broken.status.posts["doc-html"].status === Status.PARTIAL_FAILURE, `status is PARTIAL_FAILURE`),
      this.__check(
        JSON.stringify(broken.status.posts["doc-html"].failedFields) === '["body"]',
        `failedFields names exactly that one field`
      ),
    ];

    // Pass 2 - a faithful translation of the same field.
    const faithful = '<p>ग्राहक <a href="/portal">पोर्टल</a> के लिए नया लेआउट</p>';
    this.__installStubTranslator({
      mangle: (id, item, language) =>
        id.endsWith("/body") ? { text: faithful, success: true } : { text: `[${language}] ${item.text}`, success: true },
    });
    store.dispatch(translationActions._removeDocTranslation("posts", "doc-html"));
    this.__translate("posts", "doc-html", fields, false);
    await this.__wait(200);

    const ok = store.getState().translations;

    this.__reportPipelineScenario(
      "P4 - fidelity validation",
      [
        "PASS 1 - tag set does NOT match",
        ...brokenLines,
        "",
        "PASS 2 - tag set matches (tags reordered, but same multiset)",
        `returned : ${faithful}`,
        `stored   : ${ok.docs.posts["doc-html"].body}`,
        `status   : ${JSON.stringify(ok.status.posts["doc-html"])}`,
        this.__check(ok.docs.posts["doc-html"].body === faithful, `accepted - the translated value is stored`),
        this.__check(ok.status.posts["doc-html"].status === Status.SUCCESS, `status is SUCCESS`),
        this.__check(
          fidelityPreserved(source, faithful, "HTML") && !fidelityPreserved(source, "<p>x</p>", "HTML"),
          `fidelityPreserved() agrees directly`
        ),
      ],
      { broken: broken.status.posts["doc-html"], ok: ok.status.posts["doc-html"] }
    );
  }

  /**
   * T1: a plain URL string produces a GET with query params and `credentials: 'include'`.
   */
  async __runTranslatorScenario1() {
    this._translatorOutput = "Running...";
    const spy = this.__spyFetch();
    await this.__resetServerLog();

    firestoreRedux.translation.setTranslator("/translate");
    const doc = { id: "url-get", title: "Design home page", body: "<p>New layout</p>" };
    this.__prepareDoc(doc);
    firestoreRedux.translation.setLanguage("hi");
    this.__translate("posts", "url-get", [
      { path: "title", value: doc.title },
      { path: "body", value: doc.body, contentType: "HTML" },
    ]);
    await this.__wait(500);

    spy.restore();
    const [request] = await this.__serverLog();
    const call = spy.calls[0] || {};
    const clone = store.getState().translations.docs.posts["url-get"];

    this.__reportTranslatorScenario(
      "T1 - plain URL string -> GET with query params",
      [
        `server saw   : ${request ? request.method : "(no request)"} /translate`,
        `query params : ${JSON.stringify(request && request.query)}`,
        `fetch init   : ${JSON.stringify(call.init)}`,
        `cookie seen  : ${request && request.cookie}`,
        `stored       : ${JSON.stringify(clone)}`,
        this.__check(!!request && request.method === "GET", `a real GET request reached the server`),
        this.__check(!!request && request.targetLanguage === "hi", `targetLanguage travelled as a query param`),
        this.__check(
          !!request && typeof request.query.items === "string" && request.itemCount === 2,
          `items travelled JSON-encoded in a single query param, both items present`
        ),
        this.__check(call.init && call.init.credentials === "include", `called with credentials: 'include'`),
        this.__check(!!request && !!request.cookie, `the browser's cookie actually reached the server`),
        this.__check(
          !!request && JSON.stringify(request.itemKeys["posts/url-get/title"]) === '["text"]',
          `undeclared contentType arrived genuinely absent on the wire`
        ),
        this.__check(
          !!request && JSON.stringify(request.itemKeys["posts/url-get/body"]) === '["text","contentType"]',
          `declared contentType arrived alongside the text`
        ),
        this.__check(clone.title === "[hi] Design home page", `the server's response landed in redux`),
      ],
      { request, fetchInit: call.init }
    );
  }

  /**
   * T2: `{ url, method: 'POST' }` sends a JSON body; `{ url }` with no method behaves like the
   * plain-string GET form.
   */
  async __runTranslatorScenario2() {
    this._translatorOutput = "Running...";
    const spy = this.__spyFetch();
    await this.__resetServerLog();

    firestoreRedux.translation.setTranslator({ url: "/translate", method: "POST" });
    this.__prepareDoc({ id: "url-post", note: "Keep it simple" });
    firestoreRedux.translation.setLanguage("hi");
    this.__translate("posts", "url-post", [{ path: "note", value: "Keep it simple" }]);
    await this.__wait(400);

    firestoreRedux.translation.setTranslator({ url: "/translate" });
    this.__prepareDoc({ id: "url-default", note: "No method given" });
    this.__translate("posts", "url-default", [{ path: "note", value: "No method given" }]);
    await this.__wait(400);

    spy.restore();
    const [postRequest, defaultRequest] = await this.__serverLog();
    const { docs } = store.getState().translations;

    this.__reportTranslatorScenario(
      "T2 - { url, method: 'POST' } and { url } with no method",
      [
        `POST    : ${postRequest && postRequest.method}  content-type=${postRequest && postRequest.contentType}`,
        `body    : ${postRequest && postRequest.rawBody}`,
        `query   : ${JSON.stringify(postRequest && postRequest.query)}`,
        this.__check(!!postRequest && postRequest.method === "POST", `a real POST reached the server`),
        this.__check(
          !!postRequest && (postRequest.contentType || "").includes("application/json"),
          `sent as application/json`
        ),
        this.__check(
          !!postRequest && JSON.parse(postRequest.rawBody || "{}").targetLanguage === "hi",
          `{ targetLanguage, items } travelled in the JSON body`
        ),
        this.__check(
          !!postRequest && Object.keys(postRequest.query).length === 0,
          `nothing was smuggled into the query string`
        ),
        "",
        `no method : ${defaultRequest && defaultRequest.method}`,
        `query     : ${JSON.stringify(defaultRequest && defaultRequest.query)}`,
        this.__check(!!defaultRequest && defaultRequest.method === "GET", `{ url } with no method defaults to GET`),
        this.__check(
          !!defaultRequest && typeof defaultRequest.query.items === "string",
          `and carries its params exactly like the plain-string form`
        ),
        this.__check(
          docs.posts["url-post"].note === "[hi] Keep it simple" &&
            docs.posts["url-default"].note === "[hi] No method given",
          `both forms produced translated values in redux`
        ),
      ],
      { postRequest, defaultRequest }
    );
  }

  /**
   * T3: the function form is called in-process - the library itself makes no HTTP request.
   */
  async __runTranslatorScenario3() {
    this._translatorOutput = "Running...";
    const spy = this.__spyFetch();
    await this.__resetServerLog();

    let receivedRequest;
    firestoreRedux.translation.setTranslator(async ({ targetLanguage, items }) => {
      receivedRequest = { targetLanguage, itemIds: Object.keys(items), items };
      const translated = {};
      Object.entries(items).forEach(([id, item]) => {
        translated[id] = { text: `«${targetLanguage}» ${item.text}`, success: true };
      });
      return { targetLanguage, items: translated };
    });

    this.__prepareDoc({ id: "fn-form", title: "Design home page" });
    firestoreRedux.translation.setLanguage("hi");
    this.__translate("posts", "fn-form", [{ path: "title", value: "Design home page" }]);
    await this.__wait(300);

    spy.restore();
    const serverLog = await this.__serverLog();
    const clone = store.getState().translations.docs.posts["fn-form"];

    this.__reportTranslatorScenario(
      "T3 - function form, called in-process",
      [
        `function received : ${JSON.stringify(receivedRequest)}`,
        `requests the library made : ${spy.calls.length}`,
        `requests the server saw   : ${serverLog.length}`,
        `stored : ${JSON.stringify(clone)}`,
        this.__check(!!receivedRequest, `the function was called`),
        this.__check(
          !!receivedRequest && receivedRequest.targetLanguage === "hi" && receivedRequest.itemIds.length === 1,
          `called with { targetLanguage, items } keyed by wire id`
        ),
        this.__check(spy.calls.length === 0, `the library made NO fetch call of its own`),
        this.__check(serverLog.length === 0, `and the server saw no request at all`),
        this.__check(clone.title === "«hi» Design home page", `its return value landed in redux`),
      ],
      { receivedRequest, serverLog }
    );
  }

  /**
   * T4: nothing translates until a language is set, however configured the Translator is.
   */
  async __runTranslatorScenario4() {
    this._translatorOutput = "Running...";
    const spy = this.__spyFetch();
    await this.__resetServerLog();

    firestoreRedux.translation.setTranslator("/translate");
    store.dispatch(translationActions.setLanguage(undefined));
    this.__prepareDoc({ id: "no-lang", title: "Design home page" });

    const fields = [{ path: "title", value: "Design home page" }];
    this.__translate("posts", "no-lang", fields);
    await this.__wait(300);

    const beforeLog = await this.__serverLog();
    const beforeState = store.getState().translations;

    firestoreRedux.translation.setLanguage("hi");
    this.__translate("posts", "no-lang", fields);
    await this.__wait(400);

    spy.restore();
    const afterLog = await this.__serverLog();
    const afterState = store.getState().translations;

    let rejected;
    try {
      firestoreRedux.translation.setLanguage("");
      rejected = "NO ERROR THROWN";
    } catch (error) {
      rejected = String(error);
    }

    this.__reportTranslatorScenario(
      "T4 - a Translator alone isn't enough; a language is required too",
      [
        `BEFORE setLanguage`,
        `  language        : ${JSON.stringify(beforeState.language)}`,
        `  requests sent   : ${beforeLog.length}`,
        `  status entry    : ${JSON.stringify(beforeState.status.posts && beforeState.status.posts["no-lang"])}`,
        this.__check(beforeLog.length === 0, `no translate request was made with no language set`),
        this.__check(
          !beforeState.status.posts || !beforeState.status.posts["no-lang"],
          `and nothing was written to /translations`
        ),
        "",
        `AFTER setLanguage('hi')`,
        `  requests sent   : ${afterLog.length}`,
        `  stored          : ${JSON.stringify(afterState.docs.posts["no-lang"])}`,
        `  status entry    : ${JSON.stringify(afterState.status.posts["no-lang"])}`,
        this.__check(afterLog.length === 1, `the same call now goes out`),
        this.__check(
          afterState.docs.posts["no-lang"].title === "[hi] Design home page",
          `and the translation lands`
        ),
        "",
        `setLanguage('') -> ${rejected}`,
        this.__check(rejected !== "NO ERROR THROWN", `an empty language is rejected`),
        "",
        `NOTE: the other half of this scenario - "start before setLanguage keeps tracking matches" -`,
        `needs activations, which arrive in the next unit.`,
      ],
      { beforeLog, afterLog }
    );
  }

  /**
   * R: the whole chain against a REAL machine-translation service - schema -> translatableFields ->
   * wire ids -> live HTTP -> fidelity check -> redux. api.mymemory.translated.net doesn't implement
   * translate-api.openapi.yml, so it's wired through the function form, exactly as the docs
   * prescribe for a non-conforming API.
   */
  async __runRealApiScenario() {
    this._translatorOutput = "Calling api.mymemory.translated.net over the real network...";
    const lines = [];
    const say = (line) => lines.push(line);

    const batches = [];
    const httpRequests = [];

    firestoreRedux.translation.setTranslator(async ({ targetLanguage, items }) => {
      batches.push({
        batchNumber: batches.length + 1,
        targetLanguage,
        itemIds: Object.keys(items),
        items: cloneDeep(items),
      });

      const results = await Promise.all(
        Object.entries(items).map(async ([id, item]) => {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            item.text
          )}&langpair=en|${targetLanguage}`;
          const request = { wireId: id, method: "GET", url, contentTypeSent: item.contentType };
          httpRequests.push(request);
          try {
            const response = await fetch(url);
            request.httpStatus = response.status;
            const data = await response.json();
            request.rawResponse = data;
            if (data.responseStatus !== 200 || !data.responseData) {
              return [id, { text: item.text, success: false, error: data.responseDetails || "failed" }];
            }
            return [id, { text: data.responseData.translatedText, success: true }];
          } catch (error) {
            request.error = String(error);
            return [id, { text: item.text, success: false, error: String(error) }];
          }
        })
      );
      return { targetLanguage, items: Object.fromEntries(results) };
    });

    firestoreRedux.translation.setSchema({
      posts: { "*": { title: { contentType: "PLAIN" }, body: { contentType: "HTML" } } },
    });

    const doc = {
      id: "real-doc",
      title: "Design the home page",
      body: '<p>New layout for the <a href="/portal">customer portal</a></p>',
      columnType: "IN_PROGRESS",
      views: 42,
      dueDate: "2026-08-11",
      archived: false,
      note: null,
    };
    this.__prepareDoc(doc);
    firestoreRedux.translation.setLanguage("hi");

    const original = firestoreRedux.selectors.doc(store.getState(), "posts", "real-doc");
    const schema = translationSelectors.schema(store.getState());
    const fields = translatableFields(original, "posts", schema);

    // ---------------- STEP 1 ----------------
    say("STEP 1 - BEFORE REQUEST: which fields were selected, and why");
    say("");
    say("  FIELD         DECISION    VALUE                                       WHY");
    say("  " + "-".repeat(112));
    const fieldSchema = documentFieldSchema(schema, "posts", original.id);
    Object.entries(original).forEach(([key, value]) => {
      const declared = fieldSchema[key];
      let decision = "TRANSLATE";
      let why;
      if (declared && declared.skip === true) {
        decision = "SKIPPED";
        why = "schema declares skip: true";
      } else if (typeof value !== "string") {
        decision = "SKIPPED";
        why = `not a string (${value === null ? "null" : typeof value})`;
      } else if (!value.trim()) {
        decision = "SKIPPED";
        why = "empty / whitespace only";
      } else {
        const reason = skipReason(value, key);
        if (reason && !(declared && declared.skip === false)) {
          decision = "SKIPPED";
          why = `auto: ${reason}`;
        } else {
          why = declared && declared.contentType
            ? `schema contentType: ${declared.contentType}`
            : "no contentType declared -> sent ABSENT on the wire";
        }
      }
      say(
        `  ${key.padEnd(13)} ${decision.padEnd(11)} ${String(JSON.stringify(value)).slice(0, 43).padEnd(43)} ${why}`
      );
    });
    say("");
    say(`  => translatableFields() returned: ${JSON.stringify(fields.map((f) => f.path))}`);
    say(`  => exact items it built: ${JSON.stringify(fields)}`);
    say("");

    this._translatorOutput = lines.join("\n");
    this.__translate("posts", "real-doc", fields);
    await this.__wait(8000);

    // ---------------- STEP 2 ----------------
    say("STEP 2 - NETWORK: the actual requests that left the browser");
    say("");
    httpRequests.forEach((request, index) => {
      say(`  [${index + 1}] ${request.method} ${decodeURIComponent(request.url)}`);
      say(`      host        : ${new URL(request.url).host}`);
      say(`      HTTP status : ${request.httpStatus}`);
      say(`      match score : ${request.rawResponse && request.rawResponse.responseData.match}`);
    });
    const hosts = [...new Set(httpRequests.map((r) => new URL(r.url).host))];
    say("");
    say(`  distinct hosts contacted : ${JSON.stringify(hosts)}`);
    say(
      this.__check(
        hosts.length === 1 && hosts[0] === "api.mymemory.translated.net",
        `every request went to the REAL public API, not localhost and not the mock`
      )
    );
    say(this.__check(!hosts.includes("localhost:8000"), `demo/translate-api-mock.js was NOT involved`));
    say("");

    // ---------------- STEP 3 ----------------
    say("STEP 3 - PIPELINE: batching");
    say("");
    say(`  translatable fields         : ${fields.length}`);
    say(`  MAX_ITEMS_PER_REQUEST       : ${MAX_ITEMS_PER_REQUEST}`);
    say(`  MAX_CHARS_PER_REQUEST       : ${MAX_CHARS_PER_REQUEST}`);
    say(`  => batches the pipeline made: ${batches.length}`);
    batches.forEach((batch) => {
      say(`     batch ${batch.batchNumber}: targetLanguage="${batch.targetLanguage}", ${batch.itemIds.length} item(s)`);
      batch.itemIds.forEach((wireId) => {
        say(`        ${wireId}  ->  keys ${JSON.stringify(Object.keys(batch.items[wireId]))}`);
      });
    });
    say("");
    say(`  NOTE: 1 batch -> 1 Translator invocation -> ${httpRequests.length} upstream HTTP calls,`);
    say(`  because MyMemory translates one string per request. The fan-out is the Translator's`);
    say(`  business, not the library's - the library made exactly ${batches.length} call to it.`);
    say(
      this.__check(
        batches.length === 1,
        `${fields.length} fields fit under the ${MAX_ITEMS_PER_REQUEST}-item cap, so ONE batch was sent`
      )
    );
    say(
      this.__check(
        "contentType" in batches[0].items["posts/real-doc/title"],
        `title carried its declared contentType (PLAIN) onto the wire`
      )
    );
    say("");

    // ---------------- STEP 4 ----------------
    const state = store.getState().translations;
    const clone = state.docs.posts["real-doc"];
    const docStatus = state.status.posts["real-doc"];

    say("STEP 4 - RESPONSE: original vs translated, side by side");
    say("");
    Object.keys(original).forEach((key) => {
      const wasTranslated = fields.some((f) => f.path === key);
      say(`  ${key}   ${wasTranslated ? "[translated]" : "[copied through]"}`);
      say(`     EN : ${JSON.stringify(original[key])}`);
      say(`     HI : ${JSON.stringify(clone[key])}`);
    });
    say("");
    say(
      this.__check(
        clone.columnType === "IN_PROGRESS" && clone.views === 42 && clone.dueDate === "2026-08-11" &&
          clone.archived === false && clone.note === null,
        `every non-translatable field is byte-identical to the original`
      )
    );
    say(this.__check(/[ऀ-ॿ]/.test(clone.title), `title came back in Devanagari script`));
    say("");

    // ---------------- STEP 5 ----------------
    const sourceBody = original.body;
    const translatedBody = clone.body;
    const sourceSignature = tagSignature(sourceBody, "HTML");
    const translatedSignature = tagSignature(translatedBody, "HTML");

    say("STEP 5 - FIDELITY CHECK on the HTML field");
    say("");
    say(`  BEFORE : ${sourceBody}`);
    say(`  AFTER  : ${translatedBody}`);
    say("");
    say(`  tag multiset of BEFORE : ${JSON.stringify(sourceSignature)}`);
    say(`  tag multiset of AFTER  : ${JSON.stringify(translatedSignature)}`);
    say("");
    say(`  Tag ORDER in the text differs - the translator moved <a> to the front of the Hindi`);
    say(`  sentence. The check compares a SORTED multiset, so order is irrelevant; what matters`);
    say(`  is that the same tags, and the same href, are all still present exactly once.`);
    say("");
    say(this.__check(fidelityPreserved(sourceBody, translatedBody, "HTML"), `fidelityPreserved() === true -> the translation was ACCEPTED`));
    say(
      this.__check(
        !fidelityPreserved(sourceBody, "<p>ग्राहक पोर्टल के लिए नया लेआउट</p>", "HTML"),
        `control: the same text WITHOUT the <a> would have been REJECTED`
      )
    );
    say("");

    // ---------------- STEP 6 ----------------
    say("STEP 6 - REDUX STATE");
    say("");
    say(`  /translations.language                  : ${JSON.stringify(state.language)}`);
    say(`  /translations.docs.posts.real-doc       :`);
    say(this.__indent(JSON.stringify(clone, null, 2), 6));
    say(`  /translations.status.posts.real-doc     :`);
    say(this.__indent(JSON.stringify(docStatus, null, 2), 6));
    say("");
    say(this.__check(docStatus.status === Status.SUCCESS, `status === SUCCESS`));
    say(this.__check(docStatus.failedFields.length === 0, `failedFields === [] (nothing failed)`));
    say(this.__check(clone.status === undefined, `no translation metadata leaked into the document clone`));

    this.__reportTranslatorScenario(
      "R - STEP BY STEP against the REAL translation service (api.mymemory.translated.net)",
      lines,
      { fields, batches, httpRequests, clone, docStatus }
    );
  }

  __indent(text, spaces) {
    return text
      .split("\n")
      .map((line) => " ".repeat(spaces) + line)
      .join("\n");
  }

  /**
   * Fires one translate call at a URL you supply, using the real `setTranslator` URL form.
   */
  async __callRealEndpoint() {
    if (!this._realEndpointUrl) {
      alert("Please enter a translate endpoint URL.");
      return;
    }

    const method = (this._realEndpointMethod || "GET").toUpperCase();
    this._translatorOutput = `Calling ${method} ${this._realEndpointUrl} ...`;

    let outcome;
    try {
      firestoreRedux.translation.setTranslator({ url: this._realEndpointUrl, method });
      outcome = await firestoreRedux.translation._translator({
        targetLanguage: "hi",
        items: { "posts/real/title": { text: "Design the home page", contentType: "PLAIN" } },
      });
    } catch (error) {
      outcome = `ERROR: ${error}`;
    }

    this.__reportTranslatorScenario(
      `Real endpoint - ${method} ${this._realEndpointUrl}`,
      [
        `response: ${JSON.stringify(outcome, null, 2)}`,
        `If this is a CORS or 404 error, the endpoint either isn't reachable from this origin or`,
        `doesn't implement translate-api.openapi.yml - use the function form for it instead.`,
      ],
      { outcome }
    );
  }

  /**
   * Seeds a document locally and clears any translation it already had.
   */
  __prepareDoc(doc) {
    this.__seedDoc("posts", doc);
    store.dispatch(translationActions._removeDocTranslation("posts", doc.id));
  }

  /**
   * Records every `fetch` the library makes, so "the function form makes no HTTP request" and
   * "the URL form passes credentials: 'include'" are both directly observable.
   * @returns {Object} `{ calls, restore }`
   */
  __spyFetch() {
    const calls = [];
    const original = window.fetch;
    window.fetch = (url, init) => {
      if (String(url).includes("/translate") && !String(url).includes("__")) {
        calls.push({ url: String(url), init });
      }
      return original(url, init);
    };
    return { calls, restore: () => (window.fetch = original) };
  }

  /** @returns {Array} Everything the mock endpoint has received since the last reset. */
  async __serverLog() {
    const response = await fetch("/translate/__received");
    return response.json();
  }

  async __resetServerLog() {
    document.cookie = "demo_session=unit3; path=/";
    await fetch("/translate/__reset");
  }

  __reportTranslatorScenario(title, lines, data) {
    this._translatorOutput = [title, "", ...lines].join("\n");
    console.group(`%c${title}`, "font-weight: bold");
    lines.forEach((line) => console.log(line));
    data && console.log(data);
    console.groupEnd();
  }

  /**
   * Installs a stub Translator and returns the array its calls are recorded into. Stands in for
   * `translation.setTranslator`, which arrives in the next unit.
   * @param {Object} param0
   *  @property {Number} latency Milliseconds each call takes to resolve.
   *  @property {Function} mangle `(wireId, item, targetLanguage) => { text, success }`. Defaults to
   *   prefixing the language, which leaves any tags intact.
   * @returns {Array} Recorded calls.
   */
  __installStubTranslator({ latency = 0, mangle } = {}) {
    const calls = [];
    let inFlight = 0;

    firestoreRedux.translation._translator = async ({ targetLanguage, items }) => {
      inFlight++;
      const ids = Object.keys(items);
      const call = {
        ids,
        count: ids.length,
        chars: Object.values(items).reduce((total, item) => total + item.text.length, 0),
        concurrentAtStart: inFlight,
        startedAt: Date.now(),
      };
      calls.push(call);

      if (latency) {
        await this.__wait(latency);
      }

      inFlight--;
      call.finishedAt = Date.now();

      const translated = {};
      Object.entries(items).forEach(([id, item]) => {
        translated[id] = mangle
          ? mangle(id, item, targetLanguage)
          : { text: `[${targetLanguage}] ${item.text}`, success: true };
      });
      return { targetLanguage, items: translated };
    };

    return calls;
  }

  /**
   * Writes a document into `firestore.docs` locally, so the pipeline has an original to clone.
   */
  __seedDoc(collection, doc) {
    store.dispatch(
      firestoreRedux.actions.save(collection, [doc], { localWrite: true, remoteWrite: false })
    );
  }

  __translate(collection, docId, fields, debounce) {
    firestoreRedux.translation._translateDocument({ collection, docId, fields, debounce });
  }

  __wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  __reportPipelineScenario(title, lines, data) {
    this._pipelineOutput = [title, "", ...lines].join("\n");
    console.group(`%c${title}`, "font-weight: bold");
    lines.forEach((line) => console.log(line));
    data && console.log(data);
    console.groupEnd();
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
    store.dispatch(translationActions.setLanguage(undefined));
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
