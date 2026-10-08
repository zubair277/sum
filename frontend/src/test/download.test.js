import { afterEach, expect, it, vi } from 'vitest';
import { downloadSummary } from '../exportSummary.js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('creates a UTF-8 TXT download and cleans up its temporary browser URL', async () => {
  let blob;
  const createObjectURL = vi.fn(value => { blob = value; return 'blob:test-download'; });
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
  let filename;
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () { filename = this.download; });
  const result = { title: 'Éarth research', url: 'https://example.com', overview: 'An accurate overview.', keyTakeaways: ['A fact.', 'A conclusion.'], generatedAt: '2026-10-08T12:30:00Z' };
  await downloadSummary(result, 'txt');
  expect(filename).toBe('earth-research-summary.txt');
  expect(blob.type).toBe('text/plain;charset=utf-8');
  const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blob); });
  expect(text).toContain(result.title);
  expect(text).toContain(result.url);
  expect(text).toContain('Key Takeaways:\n- A fact.\n- A conclusion.');
  expect(document.querySelector('a[download]')).toBeNull();
  await new Promise(resolve => setTimeout(resolve, 1050));
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:test-download');
});
