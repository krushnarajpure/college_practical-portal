import { logger } from '../utils/logger.js';

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found.',
    error: 'Not Found'
  });
};

export const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    if (error instanceof Error) res.destroy(error);
    else res.destroy();
    return;
  }

  const errorName = typeof error?.name === 'string' ? error.name : 'ServerError';
  const errorMessage = typeof error?.message === 'string' ? error.message : 'Internal server error.';
  const isMulterError = errorName === 'MulterError';
  const isDatabaseUnavailable = [
    'MongoNotConnectedError',
    'MongoServerSelectionError',
    'MongooseServerSelectionError',
    'MongoNetworkError',
    'MongoTopologyClosedError'
  ].includes(errorName);
  const requestedStatusCode = Number(error?.statusCode || error?.status);
  const hasValidStatusCode = Number.isInteger(requestedStatusCode) && requestedStatusCode >= 400 && requestedStatusCode <= 599;
  const statusCode = hasValidStatusCode
    ? requestedStatusCode
    : isDatabaseUnavailable
      ? 503
      : isMulterError && error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : isMulterError
          ? 400
          : 500;
  const message = isDatabaseUnavailable
    ? 'MongoDB/GridFS is temporarily unavailable.'
    : statusCode >= 500
      ? 'The requested operation could not be completed.'
      : errorMessage;

  if (statusCode >= 500) {
    logger.error('Request failed', {
      name: errorName,
      statusCode,
      method: req.method,
      path: req.path,
      message: errorMessage
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    error: errorName
  });
};
