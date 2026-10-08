import { expect, it } from 'vitest';
import { formatSummaryText, normalizeSummaryResult } from '../summary.js';

const structured = { overview: 'A concise overview.', keyTakeaways: ['First fact.', 'Second fact.'], generatedAt: '2026-10-08T12:30:00Z' };
it('normalizes structured results and formats both sections for copying', () => {
  expect(normalizeSummaryResult(structured)).toEqual(structured);
  expect(formatSummaryText(structured)).toBe('Overview:\nA concise overview.\n\nKey Takeaways:\n- First fact.\n- Second fact.');
});
it('keeps older plain-text responses readable without inventing takeaways', () => {
  const legacy = normalizeSummaryResult({ summary: 'Existing summary.' });
  expect(legacy.overview).toBe('Existing summary.');
  expect(legacy.keyTakeaways).toEqual([]);
  expect(Number.isFinite(Date.parse(legacy.generatedAt))).toBe(true);
});
it('rejects partial structure, empty content, invalid dates and wrong types', () => {
  for (const value of [{ ...structured, overview: '' }, { ...structured, keyTakeaways: [] }, { ...structured, keyTakeaways: ['a', 2] }, { ...structured, keyTakeaways: ['a', 'A'] }, { ...structured, generatedAt: 'invalid' }, { overview: 'Only one field', summary: 'Legacy text' }]) expect(() => normalizeSummaryResult(value)).toThrow('incomplete summary');
});
