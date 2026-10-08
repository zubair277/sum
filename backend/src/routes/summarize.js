import { Router } from 'express';
import { validateUrl } from '../services/url.js';
import { AppError } from '../utils/errors.js';
import { summaryToText, validateSummary } from '../services/summary.js';

export function summarizeRouter({ scrape, summarize, configured = true, maxConcurrent = 4, logger = console }) {
  const router = Router();
  let active = 0;
  router.post('/summarize', async (req, res) => {
    const url = validateUrl(req.body?.url);
    if (!configured) throw new AppError(503, 'AI_NOT_CONFIGURED', 'Summarization is not configured yet. The server owner needs to set GEMINI_API_KEY in backend/.env.');
    if (active >= maxConcurrent) throw new AppError(503, 'SERVER_BUSY', 'All summarization slots are busy. Please try again in a moment.');
    active++;
    let stage = 'SCRAPING_FAILED';
    try {
      const page = await scrape(url.toString());
      stage = 'AI_GENERATION_FAILED';
      const structured = validateSummary(await summarize(page));
      res.json({ success: true, title: page.title, url: page.url, ...structured, summary: summaryToText(structured), generatedAt: new Date().toISOString() });
    } catch (error) {
      logger.warn(stage, { code: error instanceof AppError ? error.code : 'UNEXPECTED_ERROR', status: error instanceof AppError ? error.status : 500, ...error.diagnostics });
      throw error;
    } finally { active--; }
  });
  return router;
}
