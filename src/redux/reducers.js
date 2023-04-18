const INITIAL_STATE = { queries: {}, docs: {} };
import * as actions from "./actions.js";
import * as selectors from './selectors.js';
import isEmpty from "lodash-es/isEmpty.js";
import get from "lodash-es/get.js";
import forEach from "lodash-es/forEach.js";
import isEqual from "lodash-es/isEqual.js";
import without from "lodash-es/without.js";
import difference from "lodash-es/difference.js";
import cloneDeep from "lodash-es/cloneDeep.js";
import { ReduxUtils } from '@dreamworld/pwa-helpers/redux-utils.js';

const firestoreReducer = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case actions.QUERY:
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.id]: {
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
          }
        }
      }

    case actions.QUERY_SNAPSHOT:
      let allQueries = get(state, 'queries');
      let liveQueriesResult = selectors.anotherLiveQueriesResult({ allQueries, collection: action.collection, queryId: action.id });
      let closedQueriesResult = selectors.closedQueriesResult({ allQueries, collection: action.collection });

      // Updates query status to LIVE or CLOSED.
      state = ReduxUtils.replace(state, `queries.${action.id}.status`, action.status);

      const oldResult = get(state, `queries.${action.id}.result`, []);
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

        // When document is removed from current query snapshot but same document exists in another query, do not remove it from redux state.
        if (doc.newIndex === -1) {
          newResult = without(newResult, doc.id);
        }
      });

      if (!isEqual(oldResult, newResult)) {
        state = ReduxUtils.replace(state, `queries.${action.id}.result`, newResult);
      }

      // Updates only those documents which are actually changed.
      forEach(action.docs, (doc) => {
        if (
          !isEqual(doc.data, get(state, `docs.${action.collection}.${doc.id}`))
        ) {

          if (doc.data === undefined) {
            // When same document exists in another query, do not remove it from redux state.
            if (liveQueriesResult.includes(doc.id)) {
              return;
            }
          }

          state = ReduxUtils.replace(state, `docs.${action.collection}.${doc.id}`, doc.data);
        }
      });

      // Removes documents from the state which exist in CLOSED queries but not in LIVE queries.
      allQueries = get(state, 'queries');
      liveQueriesResult = selectors.anotherLiveQueriesResult({ allQueries, collection: action.collection });
      closedQueriesResult = selectors.closedQueriesResult({ allQueries, collection: action.collection, requesterId: action.requesterId });
      const removedDocuments = difference(closedQueriesResult, liveQueriesResult);

      forEach(removedDocuments, (docId) => {
        state = ReduxUtils.replace(state, `docs.${action.collection}.${docId}`, undefined);
      })
      return state;

    case actions.QUERY_FAILED:
      // Updates query status to `FAILED` * sets error details in state.
      state = ReduxUtils.replace(state, `queries.${action.id}.status`, 'FAILED');
      return ReduxUtils.replace(state, `queries.${action.id}.error`, action.error);

    case actions.CANCEL_QUERY:
      if (action.id && !isEmpty(get(state, `queries.${action.id}`))) {
        return ReduxUtils.replace(state, `queries.${action.id}.status`, 'CLOSED');
      }

      if (action.requesterId) {
        forEach(get(state, `queries`), (query, id) => {
          if (
            (query.status === "LIVE" || query.status === "PENDING") &&
            query.requesterId === action.requesterId
          ) {
            state = ReduxUtils.replace(state, `queries.${id}.status`, 'CLOSED');
          }
        });
      }
      return state;

    case actions.SAVE:
      if (!action.options.localWrite) {
        return state;
      }
      const docs = cloneDeep(action.docs);
      forEach(docs, (doc) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        doc._syncPending = true;
        state = ReduxUtils.replace(state, `docs.${collection}.${doc.id}`, doc);
      });
      return state;

    case actions.SAVE_DONE:
      return state;
    case actions.SAVE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = ReduxUtils.replace(state, `docs.${action.collection}.${doc.id}`, doc.newDoc ? undefined : doc);
      });
      return state;

    case actions.DELETE:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.docIds, (docId) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        state = ReduxUtils.replace(state, `docs.${collection}.${docId}`, undefined);
      });
      return state;
    case actions.DELETE_DONE:
      return state;
    case actions.DELETE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = ReduxUtils.replace(state, `docs.${action.collection}.${doc.id}`, doc);
      });
      return state;
    default:
      return state;
  }
};

export default firestoreReducer;
