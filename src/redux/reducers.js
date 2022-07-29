const INITIAL_STATE = { queries: {}, docs: {} };
import * as actions from "./actions";
import * as selectors from './selectors';
import isEmpty from "lodash-es/isEmpty";
import get from "lodash-es/get";
import forEach from "lodash-es/forEach";
import isEqual from "lodash-es/isEqual";
import without from "lodash-es/without";
import difference from "lodash-es/difference";
import cloneDeep from "lodash-es/cloneDeep";

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
      let liveQueriesResult = selectors.liveQueriesResult({ allQueries, collection: action.collection });
      let closedQueriesResult = selectors.closedQueriesResult({ allQueries, collection: action.collection });

      // Updates query status to LIVE or CLOSED.
      state = {
        ...state,
        queries: {
          ...state.queries,
          [action.id]: {
            ...state.queries[action.id],
            status: action.status
          }
        }
      };

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
        if (doc.newIndex === -1 && !liveQueriesResult.includes(doc.id)) {
          newResult = without(newResult, doc.id);
        }
      });

      if (!isEqual(oldResult, newResult)) {
        state = {
          ...state,
          queries: {
            ...state.queries,
            [action.id]: {
              ...state.queries[action.id],
              result: newResult
            }
          }
        };
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

          state = {
            ...state,
            docs: {
              ...state.docs,
              [action.collection]: {
                ...state.docs[action.collection],
                [doc.id]: doc.data
              }
            }
          };
        }
      });

      // Removes documents from the state which exist in CLOSED queries but not in LIVE queries.
      allQueries = get(state, 'queries');
      liveQueriesResult = selectors.liveQueriesResult({ allQueries, collection: action.collection });
      closedQueriesResult = selectors.closedQueriesResult({ allQueries, collection: action.collection });
      const removedDocuments = difference(closedQueriesResult, liveQueriesResult);

      forEach(removedDocuments, (docId) => {
        state = {
          ...state,
          docs: {
            ...state.docs,
            [action.collection]: {
              ...state.docs[action.collection],
              [docId]: undefined
            }
          }
        };
      })
      return state;

    case actions.QUERY_FAILED:
      // Updates query status to `FAILED` * sets error details in state.
      return {
        ...state,
        queries: {
          ...state.queries,
          [action.id]: {
            ...state.queries[action.id],
            status: 'FAILED',
            error: action.error
          }
        }
      }

    case actions.CANCEL_QUERY:
      if (action.id && !isEmpty(get(state, `queries.${action.id}`))) {
        return {
          ...state,
          queries: {
            ...state.queries,
            [action.id]: {
              ...state.queries[action.id],
              status: 'CLOSED'
            }
          }
        }
      }

      if (action.requesterId) {
        forEach(get(state, `queries`), (query, id) => {
          if (
            (query.status === "LIVE" || query.status === "PENDING") &&
            query.requesterId === action.requesterId
          ) {
            state = {
              ...state,
              queries: {
                ...state.queries,
                [id]: {
                  ...state.queries[id],
                  status: 'CLOSED'
                }
              }
            };
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
        state = {
          ...state,
          docs: {
            ...state.docs,
            [collection]: {
              ...state.docs[collection],
              [doc.id]: doc
            }
          }
        };
      });
      return state;

    case actions.SAVE_DONE:
      return state;
    case actions.SAVE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = {
          ...state,
          docs: {
            ...state.docs,
            [action.collection]: {
              ...state.docs[action.collection],
              [doc.id]: doc.newDoc ? undefined : doc
            }
          }
        };
      });
      return state;

    case actions.DELETE:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.docIds, (docId) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        const data = cloneDeep(state.docs[collection]);
        delete data[docId];
        state = {
          ...state,
          docs: {
            ...state.docs,
            [collection]: data
          }
        };
      });
      return state;
    case actions.DELETE_DONE:
      return state;
    case actions.DELETE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = {
          ...state,
          docs: {
            ...state.docs,
            [action.collection]: {
              ...state.docs[action.collection],
              [doc.id]: doc
            }
          }
        };
      });
      return state;
    default:
      return state;
  }
};

export default firestoreReducer;
