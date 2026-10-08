import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSummary, summaryToText } from '../src/services/summary.js';
import { createSummarizer } from '../src/services/gemini.js';

const valid = { overview: 'A clear overview of the source.', keyTakeaways: ['First fact.', 'Second fact.'] };
test('parses JSON, normalizes whitespace, and accepts a single fenced JSON object', () => {
  assert.deepEqual(parseSummary(JSON.stringify(valid)), valid);
  assert.deepEqual(parseSummary('```json\n' + JSON.stringify(valid) + '\n```'), valid);
  assert.equal(parseSummary(JSON.stringify({ ...valid, overview: '  A clear\n overview.  ' })).overview, 'A clear overview.');
  assert.equal(summaryToText(valid), 'Overview:\nA clear overview of the source.\n\nKey Takeaways:\n- First fact.\n- Second fact.');
});
test('rejects malformed, missing, empty, oversized and incorrectly typed output', () => {
  for (const value of [null, [], {}, { ...valid, overview: '' }, { ...valid, overview: 'x'.repeat(2001) }, { ...valid, keyTakeaways: ['Only one.'] }, { ...valid, keyTakeaways: ['a', 'b', 'c', 'd'] }, { ...valid, keyTakeaways: ['a', 42] }, { ...valid, keyTakeaways: ['a', ' '] }, { ...valid, keyTakeaways: ['a', 'A'] }, { ...valid, extra: 'unexpected' }]) {
    assert.throws(() => parseSummary(JSON.stringify(value)), { code: 'AI_INVALID_RESPONSE' });
  }
  for (const text of ['broken JSON', '{"overview":', 'x'.repeat(16001)]) assert.throws(() => parseSummary(text), { code: 'AI_INVALID_RESPONSE' });
});
test('malformed Gemini JSON returns a safe error without inventing a summary', async () => {
  const summarize = createSummarizer({ client: { models: { generateContent: async () => ({ text: 'not JSON containing sensitive data' }) } } });
  await assert.rejects(summarize({ title: 'Article', text: 'Source' }), error => error.status === 502 && error.code === 'AI_INVALID_RESPONSE' && !error.message.includes('sensitive data'));
});
