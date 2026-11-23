const AppError = require('../errors/AppError');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let statusCode = error.statusCode || error.status || 500;
  let message = statusCode < 500 ? error.message : 'An unexpected server error occurred.';

  if (error.code === 11000) {
    statusCode = 409;
    message = 'An account with this email already exists.';
  } else if (error.name === 'ValidationError' || error.name === 'CastError') {
    statusCode = 400;
    message = 'The submitted data is invalid.';
  } else if (error.type === 'entity.parse.failed') {
    statusCode = 400;
    message = 'Request body must contain valid JSON.';
  } else if (error.type === 'entity.too.large') {
    statusCode = 413;
    message = 'Request body is too large.';
  } else if (error instanceof AppError && !error.statusCode) {
    statusCode = 500;
    message = 'An unexpected server error occurred.';
  }

  if (statusCode >= 500) {
    req.log?.error({ err: error }, 'Request failed');
  } else {
    req.log?.warn({ code: error.code, statusCode }, 'Request rejected');
  }

  return res.status(statusCode).json({
    message,
    ...(error.code ? { code: error.code } : {}),
    requestId: req.id,
  });
}

module.exports = errorHandler;