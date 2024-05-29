import debounce from "lodash-es/debounce.js";
import forEach from "lodash-es/forEach.js";
import isEmpty from "lodash-es/isEmpty.js";
import get from "lodash-es/get.js";
import * as actions from "./redux/actions.js";
import snapshotActionDispatcher from "./snapshot-action-dispatcher.js";

export let actionPayload = [];
let store;

const actionDispatcher = (data, _store) => {
  store = _store;
  actionPayload.push(data);
  actionDispatcherDebounce();
};

const dispatchQuery = () => {
  const _actionPayload = [...actionPayload];
  const state = store && store.getState() || {};
  const _pendingResult = [];
  forEach(_actionPayload, (query) => {
    const pendingResult = get(state, `firestore.queries.${query.id}.pendingResult`);
    if(!isEmpty(pendingResult)) {
      _pendingResult.push(pendingResult);
    }
  });
  actionPayload = [];
  store.dispatch(actions.query(_actionPayload));

  forEach(_pendingResult, (snapshot) => {
    snapshotActionDispatcher({...snapshot, removePendingResult: true}, store);
  });
};

const actionDispatcherDebounce = debounce(dispatchQuery, 10, { maxWait: 200 });

export default actionDispatcher;
