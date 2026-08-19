import { LitElement, html, css, unsafeCSS } from '@dreamworld/pwa-helpers/lit.js';
import { connect } from "@dreamworld/pwa-helpers/connect-mixin";
import cloneDeep from "lodash-es/cloneDeep";
import forEach from "lodash-es/forEach";
import { store } from "./store";
import firestoreRedux from "../src/firestore-redux";
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

      .translation-table {
        border-collapse: collapse;
        width: 100%;
        margin-top: 16px;
        font-size: 14px;
      }

      .translation-table th,
      .translation-table td {
        border-bottom: 1px solid lightgray;
        padding: 8px;
        text-align: left;
        vertical-align: top;
      }

      .hint {
        color: gray;
        font-style: italic;
      }

      .switch-container dw-button {
        margin-right: 8px;
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
     * `true` while the translation activation is running.
     */
    _translating: { type: Boolean },

    /**
     * Rows shown in the translation table. e.g. [{ docId, original, translated, status }]
     */
    _translationRows: { type: Array },
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

    this._translationCollection = "cards";
    this._translationLanguage = "hi";
    this._translating = false;
    this._translationRows = [];
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
      ${this._readByQueryTemplate} ${this._readByDocTemplate}
      ${this._cancelQueryTemplate} ${this._saveDeleteTemplate}
      ${this._translationTemplate}
    `;
  }

  /**
   * Minimal, complete example of the translation capability: configure a Translator, set a
   * language, start an activation. Reads never change - `selectors.doc` returns the translation
   * once it's ready. See wiki/translation/README.md.
   */
  get _translationTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">Translation</h6>
        <p>
          Three calls is the whole integration. Nothing changes at the read site &mdash;
          <code>selectors.doc</code> returns the translated document once it's ready, the original
          until then.
        </p>
        <pre>
firestoreRedux.translation.setTranslator(translateFn);   // your translate API
firestoreRedux.translation.setLanguage('${this._translationLanguage}');
firestoreRedux.translation.start({
  id: 'demo',
  filterFunction: (doc, collection) => collection === '${this._translationCollection}',
});</pre
        >

        <div class="row">
          <dw-input
            dense
            label="Collection"
            .value=${this._translationCollection}
            @value-changed=${(e) => {
              this._translationCollection = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Language"
            placeholder="e.g. hi, gu, mr, fr"
            .value=${this._translationLanguage}
            @value-changed=${(e) => {
              this._translationLanguage = e.detail.value;
            }}
          ></dw-input>
        </div>

        <div class="switch-container row">
          <dw-button outlined @click=${this._addSampleDocuments}
            >Add sample documents</dw-button
          >
          <dw-button raised ?disabled=${this._translating} @click=${this._startTranslating}
            >Start translating</dw-button
          >
          <dw-button outlined ?disabled=${!this._translating} @click=${this._stopTranslating}
            >Stop</dw-button
          >
        </div>

        ${this._translationRows.length
          ? html`
              <table class="translation-table">
                <tr>
                  <th>Document</th>
                  <th>Original (selectors.originalDoc)</th>
                  <th>Translated (selectors.doc)</th>
                  <th>Status</th>
                </tr>
                ${this._translationRows.map(
                  (row) => html`
                    <tr>
                      <td>${row.docId}</td>
                      <td>${row.original}</td>
                      <td>${row.translated}</td>
                      <td>${row.status}</td>
                    </tr>
                  `
                )}
              </table>
            `
          : html`<p class="hint">
              Add the sample documents (or run a query above), then start translating.
            </p>`}
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
   * Writes two documents into redux locally, so the translation example has something to work on
   * without a Firestore project. A real app's documents arrive from a query instead.
   */
  _addSampleDocuments() {
    store.dispatch(
      firestoreRedux.actions.save(
        this._translationCollection,
        [
          {
            id: "sample-1",
            title: "Design the home page",
            description: "New layout for the customer portal",
            columnType: "IN_PROGRESS",
            dueDate: "2026-08-11",
          },
          {
            id: "sample-2",
            title: "Review the launch checklist",
            description: "Confirm every item before Friday",
            columnType: "DONE",
            dueDate: "2026-08-14",
          },
        ],
        { localWrite: true, remoteWrite: false }
      )
    );
    this._refreshTranslationRows();
  }

  /**
   * The three integrator calls. The Translator here is a free public API wired through the function
   * form - swap it for your own endpoint, or pass a URL string to use the URL form instead.
   */
  _startTranslating() {
    if (!this._translationLanguage) {
      alert("Please enter a target language.");
      return;
    }

    firestoreRedux.translation.setTranslator(async ({ targetLanguage, items }) => {
      const results = await Promise.all(
        Object.entries(items).map(async ([id, item]) => {
          const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
            item.text
          )}&langpair=en|${targetLanguage}`;
          try {
            const data = await (await fetch(url)).json();
            return data.responseStatus === 200
              ? [id, { text: data.responseData.translatedText, success: true }]
              : [id, { text: item.text, success: false, error: String(data.responseDetails) }];
          } catch (error) {
            return [id, { text: item.text, success: false, error: String(error) }];
          }
        })
      );
      return { targetLanguage, items: Object.fromEntries(results) };
    });

    firestoreRedux.translation.setLanguage(this._translationLanguage);
    firestoreRedux.translation.start({
      id: "demo",
      filterFunction: (doc, collection) => collection === this._translationCollection,
    });

    this._translating = true;
    this._refreshTranslationRows();
  }

  _stopTranslating() {
    firestoreRedux.translation.stop("demo");
    this._translating = false;
    this._refreshTranslationRows();
  }

  /**
   * Rebuilds the table from the selectors, so it shows exactly what an app would read.
   */
  _refreshTranslationRows() {
    const state = store.getState();
    const rows = [];
    forEach(
      firestoreRedux.selectors.collection(state, this._translationCollection),
      (document, docId) => {
        rows.push({
          docId,
          original: firestoreRedux.selectors.originalDoc(state, this._translationCollection, docId).title,
          translated: firestoreRedux.selectors.doc(state, this._translationCollection, docId).title,
          status: firestoreRedux.selectors.translation.status(state, this._translationCollection, docId),
        });
      }
    );
    this._translationRows = rows;
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
    if (this._translationRows.length) {
      this._refreshTranslationRows();
    }
  }
}
customElements.define("firestore-redux-demo", FirestoreReduxDemo);
