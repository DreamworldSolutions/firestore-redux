import { createStore, compose, applyMiddleware, combineReducers } from "redux";
import thunk from "redux-thunk";
import createSagaMiddleware from "redux-saga";
import { lazyReducerEnhancer } from "pwa-helpers/lazy-reducer-enhancer";

export const sagaMiddleware = createSagaMiddleware();

// Sets up a Chrome extension for time travel debugging.
// See https://github.com/zalmoxisus/redux-devtools-extension for more information.
const devCompose = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__
  ? window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__({
      shouldHotReload: true,
    })
  : compose;

// Initializes the Redux store with a lazyReducerEnhancer (so that you can
// lazily add reducers after the store has been created) and redux-thunk (so
// that you can dispatch async actions). See the "Redux and state management"
// section of the wiki for more details:
// https://pwa-starter-kit.polymer-project.org/redux-and-state-management
export const store = createStore(
  (state) => state,
  devCompose(
    lazyReducerEnhancer(combineReducers),
    applyMiddleware(thunk, sagaMiddleware)
  )
);
