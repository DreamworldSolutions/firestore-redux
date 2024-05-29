const INITIAL_STATE = { queries: {}, docs: {} };
import * as actions from "./actions.js";
import * as selectors from './selectors.js';
import isEmpty from "lodash-es/isEmpty.js";
import get from "lodash-es/get.js";
import map from 'lodash-es/map.js';
import forEach from "lodash-es/forEach.js";
import isEqual from "lodash-es/isEqual.js";
import without from "lodash-es/without.js";
import unionWith from "lodash-es/unionWith.js";
import uniqWith from "lodash-es/uniqWith.js";
import cloneDeep from "lodash-es/cloneDeep.js";
import difference from 'lodash-es/difference.js';
import { ReduxUtils } from "@dreamworld/pwa-helpers/redux-utils.js";

const firestoreReducer = (state = INITIAL_STATE, action) => {
  switch (action.type) {
    case actions.QUERY:
      forEach(action.value, (query) => {
        state = {
          ...state,
          queries: {
            ...state.queries,
            [query.id]: {
              id: query.id,
              collection: query.collection,
              requesterId: query.requesterId,
              request: {
                documentId: query.documentId,
                where: query.where,
                orderBy: query.orderBy,
                startAt: query.startAt,
                startAfter: query.startAfter,
                endAt: query.endAt,
                endBefore: query.endBefore,
                limit: query.limit,
                waitTillSucceed: query.waitTillSucceed,
              },
              result: get(state, `queries.${query.id}.result`),
              localWriteResult: get(state, `queries.${query.id}.localWriteResult`),
              status: get(state, `queries.${query.id}.status`) === "LIVE" ? "LIVE": "PENDING",
              once: query.once,
            },
          },
        };
      });
      return state;

    case actions.QUERY_SNAPSHOT:
      forEach(action.value, (snapshot) => {
        const oldStatus = get(state, `queries.${snapshot.id}.status`);
        const oldLocalWriteResult = get(state, `queries.${snapshot.id}.localWriteResult`, []);
        const oldResult = get(state, `queries.${snapshot.id}.result`, []);

        // Updates query status to LIVE or CLOSED.
        state = ReduxUtils.replace(
          state,
          `queries.${snapshot.id}.status`,
          snapshot.status
        );

        if(snapshot.removePendingResult) {
          state = ReduxUtils.replace(state, `queries.${snapshot.id}.pendingResult`, undefined);
        }

        let pendingResult = [];
        if(!oldStatus || oldStatus === 'CLOSED') {
          const oldPendingDocIds = get(state, `queries.${snapshot.id}.pendingResult.docIds`, []);
          const oldPendingDocs = get(state, `queries.${snapshot.id}.pendingResult.docs`, []);

          const docs = snapshot.docs || [];
          const docIds = map(docs, 'id');

          state = ReduxUtils.replace(state, `queries.${snapshot.id}.pendingResult`, {
            id: snapshot.id,
            collection: snapshot.collection,
            requesterId: snapshot.requesterId,
            docs: uniqWith(unionWith(docs, oldPendingDocs, isEqual), (doc1, doc2) => isEqual(doc1, doc2) || doc1.id == doc2.id),
            docIds: [...oldPendingDocIds, ...docIds],
            status: snapshot.status
          });
        } else {
          pendingResult = get(state, `queries.${snapshot.id}.pendingResult.docIds`, []);
          state = ReduxUtils.replace(state, `queries.${snapshot.id}.pendingResult`, undefined);
        }

        let newLocalWriteResult = [...oldLocalWriteResult];
        let newResult = oldStatus === 'PENDING' ? pendingResult: [...oldResult];

        // Updates query result (localWriteResult + result).
        forEach(snapshot.docs, (doc) => {
          if (doc.data) {
            // Remove result from localWrite
            if(newLocalWriteResult.length && doc.newIndex !== -1) {
              newLocalWriteResult = without(newLocalWriteResult, doc.id);
            }

            // When new doc is added or result order is changed.
            if (doc.newIndex !== -1 && newResult[doc.newIndex] !== doc.id) {
              // Remove docId from older index.
              if (newResult.includes(doc.id)) {
                newResult = without(newResult, doc.id);
              }
              // Add docId to newer index.
              newResult.splice(doc.newIndex, 0, doc.id);
            }
          }

          // When document is removed.
          if (doc.newIndex === -1) {
            newResult = without(newResult, doc.id);
          }
        });

        if (!isEqual(oldLocalWriteResult, newLocalWriteResult)) {
          state = ReduxUtils.replace(
            state,
            `queries.${snapshot.id}.localWriteResult`,
            newLocalWriteResult
          );
        }

        if (!isEqual(oldResult, newResult)) {
          state = ReduxUtils.replace(
            state,
            `queries.${snapshot.id}.result`,
            newResult
          );
        }

        const removeDocs = [];
        // Updates only those documents which are actually changed.
        forEach(snapshot.docs, (doc) => {
          if (!isEqual(doc.data,get(state, `docs.${snapshot.collection}.${doc.id}`))) {

            // When same document exists in another query, do not remove it from redux state.
            if (doc.data === undefined) {
              let allQueries = get(state, "queries");
              let liveQueriesResult = selectors.anotherLiveQueriesResult({
                allQueries,
                collection: snapshot.collection,
                queryId: snapshot.id,
              });

              if (liveQueriesResult.includes(doc.id)) {
                return;
              }

              removeDocs.push(doc.id);
            }

            state = ReduxUtils.replace(
              state,
              `docs.${snapshot.collection}.${doc.id}`,
              doc.data
            );
          }
        });

        //Remove docs when is remove form new results.
        if (!isEqual(oldResult, newResult) && !isEmpty(oldResult)) {
          let _diff = difference(oldResult, newResult);
          if(!isEmpty(_diff)) {
            _diff = difference(_diff, removeDocs);
            if(!isEmpty(_diff)) {
              forEach(_diff, (docId) => {
                let allQueries = get(state, "queries");
                let liveQueriesResult = selectors.anotherLiveQueriesResult({
                  allQueries,
                  collection: snapshot.collection,
                  queryId: snapshot.id,
                });

                if (liveQueriesResult.includes(docId)) {
                  return;
                }
  
                state = ReduxUtils.replace(
                  state,
                  `docs.${snapshot.collection}.${docId}`,
                  undefined
                );
              });
            }
          }
        }
      });

      return state;

    case actions.QUERY_FAILED:
      // Updates query status to `FAILED` * sets error details in state.
      state = ReduxUtils.replace(
        state,
        `queries.${action.id}.status`,
        "FAILED"
      );
      return ReduxUtils.replace(
        state,
        `queries.${action.id}.error`,
        action.error
      );

    case actions.CANCEL_QUERY:
      forEach(action.value, (query) => {
        if (query.id && !isEmpty(get(state, `queries.${query.id}`))) {
          state = ReduxUtils.replace(
            state,
            `queries.${query.id}.status`,
            "CLOSED"
          );
        }

        if (query.requesterId) {
          forEach(get(state, `queries`), (q, id) => {
            if (
              (q.status === "LIVE" || q.status === "PENDING") &&
              q.requesterId === query.requesterId
            ) {
              state = ReduxUtils.replace(
                state,
                `queries.${id}.status`,
                "CLOSED"
              );
            }
          });
        }
      });

      return state;

    case actions.SAVE:
      if (!action.options.localWrite) {
        return state;
      }
      const docs = cloneDeep(action.docs);

      forEach(docs, (doc) => {
        // Localwrite doc
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        doc._syncPending = true;
        state = ReduxUtils.replace(state, `docs.${collection}.${doc.id}`, doc);

        // Localwrite query result when queryId is provided in options.
        if(action.options.queryId) {
          const queryLocalWriteResultPath = `queries.${action.options.queryId}.localWriteResult`;
          const queryResultPath = `queries.${action.options.queryId}.result`;
          const localWriteQueryResult = get(state, queryLocalWriteResultPath, []);
          const queryResult = get(state, queryResultPath, []);
          if(!localWriteQueryResult.includes(doc.id) && !queryResult.includes(doc.id)) {
            state = ReduxUtils.replace(state, queryLocalWriteResultPath, [...localWriteQueryResult, doc.id]);
          }
        }
      });

      return state;

    case actions.SAVE_DONE:
      return state;
    case actions.SAVE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = ReduxUtils.replace(
          state,
          `docs.${action.collection}.${doc.id}`,
          doc.newDoc ? undefined : doc
        );
      });
      return state;

    case actions.DELETE:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.docIds, (docId) => {
        const pathSegments = action.collectionPath.split("/");
        const collection = pathSegments[pathSegments.length - 1];
        state = ReduxUtils.replace(
          state,
          `docs.${collection}.${docId}`,
          undefined
        );

        // Remove docId from query result when queryId is provided.
        if(action.options.queryId) {
          const path = `queries.${action.options.queryId}.result`;
          const result = get(state, path, []);
          state = ReduxUtils.replace(
            state,
            path,
            without(result, docId)
          );

          // Remove docId from localWriteResult.
          const _localResult = get(state, `queries.${action.options.queryId}.localWriteResult`, []);
          if(_localResult.length) {
            state = ReduxUtils.replace(
              state,
              `queries.${action.options.queryId}.localWriteResult`,
              without(_localResult, docId)
            );
          }

        }
      });
      return state;
    case actions.DELETE_DONE:
      return state;
    case actions.DELETE_FAILED:
      if (!action.options.localWrite) {
        return state;
      }
      forEach(action.prevDocs, (doc) => {
        state = ReduxUtils.replace(
          state,
          `docs.${action.collection}.${doc.id}`,
          doc
        );
      });
      return state;
    default:
      return state;
  }
};

export default firestoreReducer;
