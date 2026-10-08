import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { summarizeRouter } from './routes/summarize.js';
import { scrapePage } from './services/scraper.js';
import { createSummarizer } from './services/gemini.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './utils/errors.js';

export function createApp({ apiKey, model, frontendUrl = 'http://localhost:5173', environment = process.env.NODE_ENV || 'development', trustProxy = false, scrape = scrapePage, summarize, rateLimitMax = 10, maxConcurrent = 4, logger = console } = {}) {
  const allowedOrigins = new Set([frontendUrl]);
  if (environment === 'development') {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://127.0.0.1:5173');
  }
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet());
  app.use(cors({ origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    callback(new AppError(403, 'ORIGIN_NOT_ALLOWED', 'This origin is not allowed to use the API.'));
  }, methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
  app.get('/api/health', (_req, res) => res.json({ success: true, status: 'ok', aiConfigured: Boolean(apiKey || summarize) }));
  app.use('/api/summarize', rateLimit({
    windowMs: 15 * 60 * 1000, limit: rateLimitMax, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { success: false, code: 'RATE_LIMIT', error: 'Too many requests. Please try again in 15 minutes.' },
  }));
  app.use(express.json({ limit: '4kb' }));
  app.use('/api', summarizeRouter({ scrape, summarize: summarize || createSummarizer({ apiKey, model, logger }), configured: Boolean(apiKey || summarize), maxConcurrent, logger }));
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'API endpoint not found.')));
  app.use(errorHandler);
  return app;
}
