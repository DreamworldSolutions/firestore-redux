import debounce from "lodash-es/debounce";
import * as actions from "./redux/actions.js";

let actionPayload = [];
let store;

const actionDispatcher = (data, _store) => {
  store = _store;
  actionPayload.push(data);
  actionDispatcherDebounce();
};

const dispatchQuery = () => {
  const _actionPayload = [...actionPayload];
  actionPayload = [];
  store.dispatch(actions.query(_actionPayload));
};

const actionDispatcherDebounce = debounce(dispatchQuery, 10);

export default actionDispatcher;
