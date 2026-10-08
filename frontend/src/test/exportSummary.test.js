// @vitest-environment node
import { expect, it } from 'vitest';
import { createPdfBlob, createPdfDefinition, createTxtContent, exportFilename } from '../exportSummary.js';

const result = { title: 'An article: findings & conclusions', url: 'https://example.com/article', overview: 'A professional overview with accurate facts.', keyTakeaways: ['First important finding.', 'Second supported conclusion.'], generatedAt: '2026-10-08T12:30:00.000Z' };
it('includes the title, URL, generation date, overview and takeaways in TXT', () => {
  const text = createTxtContent(result);
  for (const value of [result.title, result.url, result.overview, ...result.keyTakeaways, 'Generated:', '2026', 'Overview:', 'Key Takeaways:']) expect(text).toContain(value);
  expect(text).toContain('- First important finding.\n- Second supported conclusion.');
  expect(createTxtContent(result)).toBe(text);
  expect(exportFilename('../../dangerous: title', 'pdf')).toBe('dangerous-title-summary.pdf');
});
it('generates an actual PDF with embedded fonts, including long multiline text', async () => {
  const long = { ...result, title: ('A long title with names and numbers 2026\n').repeat(8), overview: result.overview.repeat(120), keyTakeaways: [result.keyTakeaways[0].repeat(100), 'FINAL_TAKEAWAY_SENTINEL'] };
  const definition = createPdfDefinition(long);
  expect(definition.pageSize).toBe('A4');
  expect(definition.content[0].text).toBe(long.title);
  const blob = await createPdfBlob(long);
  expect(blob.type).toBe('application/pdf');
  const bytes = new Uint8Array(await blob.arrayBuffer());
  expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(5000);
}, 15000);
