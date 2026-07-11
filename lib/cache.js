const NodeCache = require('node-cache');

// stdTTL par défaut 1h, on override par set() au cas par cas
const cache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

module.exports = {
  get: (key) => cache.get(key),
  set: (key, value, ttlSeconds) => cache.set(key, value, ttlSeconds),
  del: (key) => cache.del(key),
  flush: () => cache.flushAll()
};
