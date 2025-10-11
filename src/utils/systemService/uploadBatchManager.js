const activeUploadBatches = new Map();

/**
 * Creates a unique key for a user in a specific group.
 * @param {string} groupId - The group ID.
 * @param {string} senderId - The sender's ID.
 * @returns {string} The unique batch key.
 */
export const createBatchKey = (groupId, senderId) => `${groupId}:${senderId}`;

/**
 * Gets the active batch for a given key.
 * @param {string} key - The batch key.
 * @returns {object | undefined} The batch object or undefined.
 */
export const getBatch = (key) => activeUploadBatches.get(key);

/**
 * Sets or updates a batch for a given key.
 * @param {string} key - The batch key.
 * @param {object} value - The batch object to set.
 */
export const setBatch = (key, value) => activeUploadBatches.set(key, value);

/**
 * Deletes a batch for a given key.
 * @param {string} key - The batch key.
 */
export const deleteBatch = (key) => activeUploadBatches.delete(key);