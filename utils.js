import get from "lodash-es/get";
let STORE;

/**
 * Resolves promise when query succeed, failed or timeout.
 *  - When query is succeed, resolved with query result.
 *  - When query is failed or timeout, resolved with `undefined`
 * @param {String} id Query Id.
 * @param {Number} timeout Timeout. After timeout, promise will be resolved.
 * @returns {Promise}
 */
export const waitTillQueryResponse = (id, timeout = 60000) => {
  let resolve, reject;
  const interval = 200; //milliseconds.

  let promise = new Promise((res, rej) => {
    (resolve = res), (reject = rej);
  });
  const intervalId = setInterval(() => {
    const query = get(STORE.getState(), `firestore.queries.${id}`, {});
    const status = query.status;
    if (status && status !== "PENDING") {
      clearInterval(intervalId);
      resolve(query.result);
    }
  }, interval);
  setTimeout(() => {
    clearInterval(intervalId);
    resolve();
  }, timeout);
  return promise;
};

/**
 * @param {String} path Document path.
 * @returns {Boolean} `true` when given path is valid document path.
 */
export const isValidDocPath = (path) => {
  return (
    path &&
    !path.startsWith("/") &&
    !path.endsWith("/") &&
    (path.match(/\//g) || []).length % 2 === 1
  );
};

/**
 * Sets STORE variable.
 * @param {Object} store Redux store.
 */
export const setStore = (store) => {
  STORE = store;
};
