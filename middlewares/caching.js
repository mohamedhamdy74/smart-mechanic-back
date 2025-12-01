const NodeCache = require('node-cache');

// Initialize cache with 60 second default TTL for better performance and reduced database load
const cache = new NodeCache({ stdTTL: 60, checkperiod: 15 });

// Cache middleware for GET requests with improved performance
const cacheMiddleware = (duration = 60) => {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Skip caching for dynamic queries with frequent changes
    if (req.query && (req.query.page || req.query.search || req.query.sortBy)) {
      return next();
    }

    // Skip caching for notifications (real-time updates needed)
    if (req.originalUrl && req.originalUrl.includes('/notifications')) {
      return next();
    }

    const key = `__cache__${req.originalUrl || req.url}`;
    const cachedResponse = cache.get(key);

    if (cachedResponse) {
      console.log(`Cache hit for ${key}, returning:`, JSON.stringify(cachedResponse).substring(0, 200));
      return res.json(cachedResponse);
    }

    // Store original json method
    const originalJson = res.json;
    let responseSent = false;

    // Override json method to cache response
    res.json = function(data) {
      if (responseSent) return; // Prevent double sending
      responseSent = true;

      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          // Convert Mongoose documents to plain objects before caching
          const cacheData = JSON.parse(JSON.stringify(data));
          cache.set(key, cacheData, duration);
          console.log(`Cached response for ${key} with TTL ${duration}s`);
        } catch (cacheError) {
          console.warn('Cache write failed:', cacheError);
        }
      }
      return originalJson.call(this, data);
    };

    // Also handle send method for non-JSON responses
    const originalSend = res.send;
    res.send = function(data) {
      if (responseSent) return;
      responseSent = true;
      return originalSend.call(this, data);
    };

    next();
  };
};

// Clear cache for specific patterns
const clearCache = (pattern) => {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));

  matchingKeys.forEach(key => {
    cache.del(key);
    console.log(`Cleared cache for ${key}`);
  });

  return matchingKeys.length;
};

// Cache keys for different resources
const CACHE_KEYS = {
  USERS: 'users',
  PRODUCTS: 'products',
  BOOKINGS: 'bookings',
  MECHANICS: 'mechanics',
  WORKSHOPS: 'workshops',
};

module.exports = {
  cacheMiddleware,
  clearCache,
  CACHE_KEYS,
  cache,
};