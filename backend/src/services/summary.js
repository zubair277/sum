import { AppError } from '../utils/errors.js';

export const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    overview: { type: 'string', description: 'Professional, source-grounded overview in approximately 40–60 words.' },
    keyTakeaways: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 3, description: 'Two or three short, distinct, source-supported facts or conclusions.' },
  },
  required: ['overview', 'keyTakeaways'],
  additionalProperties: false,
};

const invalid = () => new AppError(502, 'AI_INVALID_RESPONSE', 'The AI returned an incomplete or malformed summary. Please try again.');
const clean = value => value.replace(/\s+/g, ' ').trim();

export function validateSummary(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !['overview', 'keyTakeaways'].includes(key)) ||
      typeof value.overview !== 'string' || !clean(value.overview) || value.overview.length > 2000 ||
      !Array.isArray(value.keyTakeaways) || value.keyTakeaways.length < 2 || value.keyTakeaways.length > 3 ||
      value.keyTakeaways.some(item => typeof item !== 'string' || !clean(item) || item.length > 500)) throw invalid();
  const overview = clean(value.overview);
  const keyTakeaways = value.keyTakeaways.map(clean);
  if (new Set(keyTakeaways.map(item => item.toLowerCase())).size !== keyTakeaways.length) throw invalid();
  return { overview, keyTakeaways };
}

export function parseSummary(text) {
  if (typeof text !== 'string' || text.length > 16000) throw invalid();
  // Accept a single fenced JSON block from older models; never evaluate or repair content.
  const json = text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
  try { return validateSummary(JSON.parse(json)); } catch { throw invalid(); }
}

export function summaryToText({ overview, keyTakeaways }) {
  return `Overview:\n${overview}\n\nKey Takeaways:\n${keyTakeaways.map(item => `- ${item}`).join('\n')}`;
}
