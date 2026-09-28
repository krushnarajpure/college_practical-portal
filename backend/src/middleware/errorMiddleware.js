export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    error: 'Not Found'
  });
};

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    res.destroy(error);
    return;
  }

  const isMulterError = error.name === 'MulterError';
  const isDatabaseUnavailable = ['MongoNotConnectedError', 'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNetworkError', 'MongoTopologyClosedError'].includes(error.name);
  const statusCode = error.statusCode || (isDatabaseUnavailable ? 503 : isMulterError && error.code === 'LIMIT_FILE_SIZE' ? 413 : isMulterError ? 400 : 500);
  const message = isDatabaseUnavailable ? 'MongoDB/GridFS is temporarily unavailable.' : statusCode >= 500 && !error.statusCode ? 'The requested operation could not be completed.' : error.message || 'Internal server error.';

  res.status(statusCode).json({
    success: false,
    message,
    error: error.name || 'ServerError'
  });
};
