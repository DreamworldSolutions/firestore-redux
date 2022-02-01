import { html, css, LitElement, unsafeCSS } from "lit";
import { connect } from "@dreamworld/pwa-helpers/connect-mixin";
import isEmpty from "lodash-es/isEmpty";
import cloneDeep from "lodash-es/cloneDeep";
import { store, sagaMiddleware } from "./store";
import * as firestoreRedux from "../index.js";
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
        display: block;
        padding: 24px 16px;
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
        padding: 24px;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        margin: 0px auto;
      }

      .firebase-init-container {
        max-width: 550px;
      }

      h5 {
        ${unsafeCSS(typographyLiterals.headline5)};
      }

      h6 {
        ${unsafeCSS(typographyLiterals.headline6)};
        margin-top: 16px;
      }

      pre {
        background-color: lightblue;
        padding: 8px 8px 8px 0px;
        border-radius: 8px;
        margin-top: 0;
        overflow: auto;
      }

      dw-textarea {
        border: 2px solid lightgray;
        border-radius: 8px;
        --dw-textarea-padding: 8px;
        margin-top: 16px;
      }

      dw-button {
        align-self: center;
        margin-top: 16px;
      }

      .request-query_container dw-button,
      .cancel-query_container dw-button,
      .save-docs_container dw-button {
        margin-top: 8px;
      }
      /* END: Common styles.  */

      .request-query_container,
      .cancel-query_container,
      .save-docs_container {
        padding: 8px 8px 24px 8px;
      }

      .row {
        display: flex;
        justify-content: justify;
        flex-wrap: wrap;
      }

      .request-query_container h6,
      .cancel-query_container h6,
      .save-docs_container h6 {
        margin-left: 12px;
      }

      .cancel-query_container,
      .save-docs_container {
        flex: 1;
      }

      .cancel-query_container:nth-child(1),
      .save-docs_container:nth-child(1) {
        margin: 24px 12px 0 0;
      }

      .cancel-query_container:nth-child(2),
      .save-docs_container:nth-child(2) {
        margin: 24px 0 0 12px;
      }

      dw-input {
        min-width: 500px;
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

      @media (max-width: 900px) {
        dw-input {
          min-width: 316px;
        }

        .cancel-query_container,
        .save-docs_container {
          margin: 24px 0 0 0 !important;
        }
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
    this._query = {
      requesterId: "req-id",
      collection: "restaurants",
      orderBy: '[["price", "asc"]]',
    };
    this._saveTarget = "BOTH";
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
      ${this._requestQueryTemplate} ${this._cancelQueryTemplate}
      ${this._saveDeleteTemplate}
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

  get _requestQueryTemplate() {
    return html`
      <div class="request-query_container card">
        <h6 class="headline6">Enter Query Details</h6>
        <div class="row">
          <dw-input
            dense
            label="Requester Id"
            value="${this._query.requesterId}"
            required
            placeholder="Enter Requester Id"
            @value-changed=${(e) => {
              this._query.requesterId = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Query Id"
            placeholder="Enter unique Query Id. It is optional. But if you provide, it must be unique."
            @value-changed=${(e) => {
              this._query.id = e.detail.value;
            }}
          ></dw-input>
          <dw-input
            dense
            label="Collection"
            value="${this._query.collection}"
            required
            placeholder="Enter Collection Id"
            @value-changed=${(e) => {
              this._query.collection = e.detail.value;
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
            @change=${(e) => {
              this._query.once = e.target.checked;
            }}
          ></dw-switch>
        </div>
        <dw-button raised @click=${this.__requestQuery}
          >Request Query</dw-button
        >
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
            label="Save Documents"
            placeholder="Enter key/value map of the documents. e.g. {'users/NIRMAL_B': {'name': Nirmal, 'lastName': 'B'}}"
            @value-changed=${(e) => {
              this._saveDocsString = e.detail.value;
            }}
          ></dw-input>
          <dw-radio-group
            name="saveTarget"
            value=${this._saveTarget}
            @change=${(e) => {
              this._saveTarget = e.target.value;
            }}
          >
            <dw-radio-button
              label="Both"
              name="saveTarget"
              value="BOTH"
            ></dw-radio-button>
            <dw-radio-button
              label="LOCAL"
              name="saveTarget"
              value="LOCAL"
            ></dw-radio-button>
            <dw-radio-button
              label="REMOTE"
              name="saveTarget"
              value="REMOTE"
            ></dw-radio-button>
          </dw-radio-group>
          <dw-button raised @click=${this.__saveDocs}>Save Document</dw-button>
        </div>

        <div class="save-docs_container card">
          <h6 class="headline6">Delete Documents</h6>
          <dw-input
            dense
            label="Delete Documents"
            placeholder="Enter array of document paths. e.g. ['users/$userId', 'users/$userId2']"
            @value-changed=${(e) => {
              this._deleteDocsString = e.detail.value;
            }}
          ></dw-input>
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
      store.dispatch(
        firestoreRedux.actions.init(store, sagaMiddleware, this._firebaseApp)
      );
    } catch (err) {
      console.error(err);
      alert("Something is wrong. Please see the error detail in console.");
    }
  }

  __requestQuery() {
    if (
      isEmpty(this._query) ||
      !this._query.collection
    ) {
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

    store.dispatch(firestoreRedux.actions.query(query));
  }

  __cancelQuery() {
    if (!this._cancelQueryId) {
      alert("Please enter queryId");
      return;
    }
    store.dispatch(
      firestoreRedux.actions.cancelQuery({ id: this._cancelQueryId })
    );
  }

  __cancelQueryByRequester() {
    if (!this._cancelRequesterId) {
      alert("Please enter requesterId");
      return;
    }
    store.dispatch(
      firestoreRedux.actions.cancelQuery({
        requesterId: this._cancelRequesterId,
      })
    );
  }

  __saveDocs() {
    if (!this._saveDocsString || !this.__isJSONString(this._saveDocsString)) {
      alert("Please Enter valid Object string of documents..");
      return;
    }
    store.dispatch(
      firestoreRedux.actions.save(
        JSON.parse(this._saveDocsString),
        this._saveTarget
      )
    );
  }

  __deleteDocs() {
    if (
      !this._deleteDocsString ||
      !this.__isArrayString(this._deleteDocsString)
    ) {
      alert("Please Enter valid Array string of paths..");
      return;
    }
    store.dispatch(
      firestoreRedux.actions.deleteDocs(JSON.parse(this._deleteDocsString))
    );
  }

  async __waitTillQueryResponse() {
    const res = await firestoreRedux.utils.waitTillQueryResponse('test-q');
    console.log({ res });
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
