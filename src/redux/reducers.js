const INITIAL_STATE = { queries: {}, docs: {} };
import * as actions from "./actions.js";
import isEmpty from "lodash-es/isEmpty.js";
import get from "lodash-es/get.js";
import forEach from "lodash-es/forEach.js";
import isEqual from "lodash-es/isEqual.js";
import without from "lodash-es/without.js";
import cloneDeep from "lodash-es/cloneDeep.js";
import { ReduxUtils } from "@dw/pwa-helpers/redux-utils.js";

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
              status: "PENDING",
              once: query.once,
            },
          },
        };
      });
      return state;

    case actions.QUERY_SNAPSHOT:
      forEach(action.value, (snapshot) => {
        // Updates query status to LIVE or CLOSED.
        state = ReduxUtils.replace(
          state,
          `queries.${snapshot.id}.status`,
          snapshot.status
        );

        const oldResult = get(state, `queries.${snapshot.id}.result`, []);
        let newResult = [...oldResult];

        // Updates query result.
        forEach(snapshot.docs, (doc) => {
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
          state = ReduxUtils.replace(
            state,
            `queries.${snapshot.id}.result`,
            newResult
          );
        }

        // Updates only those documents which are actually changed.
        forEach(snapshot.docs, (doc) => {
          if (
            doc.data &&
            !isEqual(
              doc.data,
              get(state, `docs.${snapshot.collection}.${doc.id}`)
            )
          ) {
            state = ReduxUtils.replace(
              state,
              `docs.${snapshot.collection}.${doc.id}`,
              doc.data
            );
          }
        });
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
