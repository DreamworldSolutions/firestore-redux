const INITIAL_STATE = {};
import * as actions from "./actions";
import isEmpty from "lodash-es/isEmpty";
import get from "lodash-es/get";
import forEach from "lodash-es/forEach";
import isEqual from "lodash-es/isEqual";
import filter from "lodash-es/filter";
import merge from "lodash-es/merge";
import cloneDeep from "lodash-es/cloneDeep";
import { ReduxUtils } from "@dw/pwa-helpers/redux-utils";

const firestoreReducer = (state = INITIAL_STATE, action) => {
  let oState = { ...state };
  switch (action.type) {
    case actions.QUERY:
      return ReduxUtils.replace(oState, `queries.${action.id}`, {
        id: action.id,
        collection: action.collection,
        requesterId: action.requesterId,
        request: {
          documentId: action.documentId,
          where: action.where,
          orderBy: action.orderBy,
          startAt: action.startAt,
          startAfter: action.startAfter,
          endAt: action.endAt,
          endBefore: action.endBefore,
          limit: action.limit,
          waitTillSucceed: action.waitTillSucceed,
        },
        status: "PENDING",
        once: action.once,
      });

    case actions.QUERY_SNAPSHOT:
      // Updates query status to LIVE or CLOSED.
      oState = ReduxUtils.replace(
        oState,
        `queries.${action.id}.status`,
        action.status
      );
      const oldResult = get(oState, `queries.${action.id}.result`, []);
      let newResult = [...oldResult];
      // Updates query result.
      forEach(action.docs, (doc) => {
        if (doc.data) {
          if (doc.newIndex !== -1 && newResult[doc.newIndex] !== doc.id) {
            if (doc.oldIndex !== -1) {
              newResult.splice(doc.oldIndex, 1);
            }
            newResult.splice(doc.newIndex, 0, doc.id);
          }
        }
        if (doc.newIndex === -1) {
          newResult = filter(newResult, (docId) => docId !== doc.id);
        }
      });

      oState = isEqual(oldResult, newResult)
        ? oState
        : ReduxUtils.replace(oState, `queries.${action.id}.result`, newResult);

      // Updates only those documents which are actually changed.
      forEach(action.docs, (doc) => {
        if (
          !isEqual(doc.data, get(oState, `docs.${action.collection}.${doc.id}`))
        ) {
          oState = ReduxUtils.replace(
            oState,
            `docs.${action.collection}.${doc.id}`,
            doc.data
          );
        }
      });
      return oState;

    case actions.QUERY_FAILED:
      // Updates query status to `FAILED`
      oState = ReduxUtils.replace(
        oState,
        `queries.${action.id}.status`,
        "FAILED"
      );
      // Sets error detail for given query.
      oState = ReduxUtils.replace(
        oState,
        `queries.${action.id}.error`,
        action.error
      );
      return oState;

    case actions.CANCEL_QUERY:
      if (action.id && !isEmpty(get(oState, `queries.${action.id}`))) {
        oState = ReduxUtils.replace(
          oState,
          `queries.${action.id}.status`,
          "CLOSED"
        );
        return oState;
      }

      if (action.requesterId) {
        forEach(
          get(oState, `queries`),
          (query, id) => {
            if((query.status === "LIVE" || query.status === "PENDING") &&
            query.requesterId === action.requesterId) {
              oState = ReduxUtils.replace(oState, `queries.${id}.status`, "CLOSED");
            }
          }
        );
      }
      return oState;

    case actions.SAVE:
      if (action.target !== "REMOTE") {
        const docs = cloneDeep(action.docs);
        forEach(docs, (doc, path) => {
          const pathSegments = path.split("/");
          const collection = pathSegments[pathSegments.length - 2];
          const docId = pathSegments[pathSegments.length - 1];
          const currDoc = cloneDeep(
            get(state, `docs.${collection}.${docId}`, {})
          );
          doc._syncPending = true;
          doc = merge(currDoc, doc);
          oState = ReduxUtils.replace(
            oState,
            `docs.${collection}.${docId}`,
            doc
          );
        });
      }
      return oState;

    case actions.SAVE_DONE:
      return oState;
    case actions.SAVE_FAILED:
      forEach(action.prevDocs, (docs, collection) => {
        forEach(docs, (doc, docId) => {
          oState = ReduxUtils.replace(
            oState,
            `docs.${collection}.${docId}`,
            doc
          );
        });
      });
      return oState;

    case actions.DELETE_DOCS:
      if (action.target !== "REMOTE") {
        forEach(action.paths, (path) => {
          const pathSegments = path.split("/");
          const collection = pathSegments[pathSegments.length - 2];
          const docId = pathSegments[pathSegments.length - 1];
          oState = ReduxUtils.replace(
            oState,
            `docs.${collection}.${docId}`,
            undefined
          );
        });
      }
      return oState;
    case actions.DELETE_DOCS_DONE:
      return oState;
    case actions.DELETE_DOCS_FAILED:
      forEach(action.prevDocs, (docs, collection) => {
        forEach(docs, (doc, docId) => {
          oState = ReduxUtils.replace(
            oState,
            `docs.${collection}.${docId}`,
            doc
          );
        });
      });
      return oState;
    default:
      return oState;
  }
};

export default firestoreReducer;
