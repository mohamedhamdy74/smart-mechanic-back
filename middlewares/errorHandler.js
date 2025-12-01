module.exports = (err, req, res, next) => {
  // Only log errors in development mode
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  // Handle validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: {
        message: "Validation Error",
        details: err.errors,
      },
    });
  }

  // Handle MongoDB duplicate key errors
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      error: {
        message: "البيانات موجودة بالفعل",
        details: err.keyValue,
      },
    });
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    return res.status(401).json({
      success: false,
      error: {
        message: "جلسة غير صالحة، يرجى تسجيل الدخول مرة أخرى",
      },
    });
  }

  // Handle unauthorized access
  if (err.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      error: {
        message: "غير مصرح بالوصول",
      },
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: {
      message: err.message || "حدث خطأ في الخادم",
      code: err.code,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    },
  });
};
