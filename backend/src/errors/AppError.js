class AppError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace?.(this, AppError);
  }
}

module.exports = AppError;