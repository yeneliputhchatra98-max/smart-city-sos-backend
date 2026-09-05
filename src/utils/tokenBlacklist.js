const blacklistedTokens = new Set();

/**
 * Add a JWT token to the in-memory blacklist.
 * @param {string} token 
 */
const addToken = (token) => {
    if (token) {
        blacklistedTokens.add(token);
    }
};

/**
 * Check if a token is in the blacklist.
 * @param {string} token 
 * @returns {boolean}
 */
const isBlacklisted = (token) => {
    if (!token) return false;
    return blacklistedTokens.has(token);
};

module.exports = {
    addToken,
    isBlacklisted
};
