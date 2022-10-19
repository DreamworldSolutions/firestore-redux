import { LitElement, html, css, unsafeCSS } from '@dreamworld/pwa-helpers/lit.js';
import { connect } from "@dreamworld/pwa-helpers/connect-mixin";
import cloneDeep from "lodash-es/cloneDeep";
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
  };

  constructor() {
    super();
    this._queryCollection = "alphabets";
    this._singleDocCollection = "alphabets";
    this._query = {
      requesterId: "req-id",
      orderBy: '[["name", "asc"]]',
    };

    this._saveCollection = "alphabets";
    this._saveLocal = true;
    this._saveRemote = true;

    this._deleteCollection = "alphabets";
    this._deleteLocal = true;
    this._deleteRemote = true;
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
        window.q.loadNextPage();
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

  stateChanged(state) {}
}
customElements.define("firestore-redux-demo", FirestoreReduxDemo);
