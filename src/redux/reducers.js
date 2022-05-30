const INITIAL_STATE = {};
import * as actions from "./actions";
import * as selectors from './selectors';
import isEmpty from "lodash-es/isEmpty";
import get from "lodash-es/get";
import forEach from "lodash-es/forEach";
import isEqual from "lodash-es/isEqual";
import filter from "lodash-es/filter";
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
          const allQueries = get(state, 'queries');
          // When same document exists in another query, do not remove it from redux state.
          const documentExistsInAnotherQueryResult = selectors.isDocumentExistsInAnotherQueryResult({ allQueries, queryId: action.id, collection: action.collection, docId: doc.id });
          if (!documentExistsInAnotherQueryResult) {
            newResult = filter(newResult, (docId) => docId !== doc.id);  
          }
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
        forEach(get(oState, `queries`), (query, id) => {
          if (
            (query.status === "LIVE" || query.status === "PENDING") &&
            query.requesterId === action.requesterId
          ) {
            oState = ReduxUtils.replace(
              oState,
              `queries.${id}.status`,
              "CLOSED"
            );
          }
        });
      }
      return oState;

    case actions.SAVE:
      if (!action.options.localWrite) {
        return oState;
      }
      const docs = cloneDeep(action.docs);
      forEach(docs, (doc) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        doc._syncPending = true;
        oState = ReduxUtils.replace(
          oState,
          `docs.${collection}.${doc.id}`,
          doc
        );
      });
      return oState;

    case actions.SAVE_DONE:
      return oState;
    case actions.SAVE_FAILED:
      if (!action.options.localWrite) {
        return oState;
      }
      forEach(action.prevDocs, (doc) => {
        oState = ReduxUtils.replace(
          oState,
          `docs.${action.collection}.${doc.id}`,
          doc.newDoc ? undefined : doc
        );
      });
      return oState;

    case actions.DELETE:
      if (!action.options.localWrite) {
        return oState;
      }
      forEach(action.docIds, (docId) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        oState = ReduxUtils.replace(
          oState,
          `docs.${collection}.${docId}`,
          undefined
        );
      });
      return oState;
    case actions.DELETE_DONE:
      return oState;
    case actions.DELETE_FAILED:
      if (!action.options.localWrite) {
        return oState;
      }
      forEach(action.prevDocs, (doc) => {
        oState = ReduxUtils.replace(
          oState,
          `docs.${action.collection}.${doc.id}`,
          doc
        );
      });
      return oState;
    default:
      return oState;
  }
};

export default firestoreReducer;
