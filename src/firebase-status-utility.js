/**
 * Utility to track and manage Firebase client status
 */

let isFirebaseTerminated = false;

/**
 * Set Firebase client status to terminated
 */
export const setFirebaseTerminated = () => {
  isFirebaseTerminated = true;
};

/**
 * Reset Firebase client terminated status
 */
export const resetFirebaseTerminated = () => {
  isFirebaseTerminated = false;
};

/**
 * Check if Firebase client is terminated
 * @returns {boolean} - true if Firebase client is terminated
 */
export const isFirebaseClientTerminated = () => {
  return isFirebaseTerminated;
};

/**
 * Wraps a Firebase operation with error handling for terminated client
 * 
 * @param {Function} operation - The Firebase operation to execute
 * @param {Function} onTerminated - Callback to execute if client is terminated
 * @returns {Promise} - Result of the operation
 */
export const withTerminationHandling = async (operation, onTerminated) => {
  try {
    if (isFirebaseTerminated) {
      return onTerminated ? onTerminated() : null;
    }
    return await operation();
  } catch (error) {
    if (error && error.code === 'failed-precondition' && 
        error.message && error.message.includes('client has already been terminated')) {
      setFirebaseTerminated();
      return onTerminated ? onTerminated() : null;
    }
    throw error;
  }
};
