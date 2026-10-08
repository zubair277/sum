import { AppError } from '../utils/errors.js';

export function errorHandler(error, _req, res, _next) {
  if (error.type === 'entity.parse.failed') error = new AppError(400, 'INVALID_JSON', 'Send a valid JSON object containing a url field.');
  if (error.type === 'entity.too.large') error = new AppError(413, 'REQUEST_TOO_LARGE', 'The request is too large. Send only a webpage URL.');
  if (!(error instanceof AppError)) {
    console.error('Unexpected API error');
    error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
  }
  res.status(error.status).json({ success: false, code: error.code, error: error.message });
}
