import debounce from "lodash-es/debounce";
import * as actions from "./redux/actions.js";

let actionPayload = [];
let store;

const actionDispatcher = (data, _store) => {
  store = _store;
  actionPayload.push(data);
  actionDispatcherDebounce();
};

const dispatchSnapshot = () => {
  const _actionPayload = [ ...actionPayload ];
  actionPayload = [];
  store.dispatch(actions._querySnapShot(_actionPayload));
};

const actionDispatcherDebounce = debounce(dispatchSnapshot, 50, { maxWait: 2000 });

export default actionDispatcher;
