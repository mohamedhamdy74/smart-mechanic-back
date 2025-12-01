const compression = require('compression');

// Compression middleware configuration
const compressionMiddleware = compression({
  level: 6, // Compression level (1-9, 6 is good balance)
  threshold: 1024, // Only compress responses larger than 1KB
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) {
      return false;
    }

    // Compress based on response content type
    const contentType = res.getHeader('Content-Type');
    if (contentType && typeof contentType === 'string') {
      // Compress JSON, HTML, CSS, JavaScript, and text responses
      return contentType.includes('json') ||
             contentType.includes('html') ||
             contentType.includes('css') ||
             contentType.includes('javascript') ||
             contentType.includes('text');
    }

    return compression.filter(req, res);
  },
});

module.exports = compressionMiddleware;