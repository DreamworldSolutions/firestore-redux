import debounce from "lodash-es/debounce.js";
import * as actions from "./redux/actions.js";

let actionPayload = [];
let store;

const actionDispatcher = (data, _store) => {
  store = _store;
  actionPayload.push(data);
  actionDispatcherDebounce();
};

const dispatchCancelQuery = () => {
  const _actionPayload = [...actionPayload];
  actionPayload = [];
  store.dispatch(actions.cancelQuery(_actionPayload));
};

const actionDispatcherDebounce = debounce(dispatchCancelQuery, 10);

export default actionDispatcher;
