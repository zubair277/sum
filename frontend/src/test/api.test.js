import { afterEach, expect, it, vi } from 'vitest';
import { summarizePage, validatePageUrl } from '../api.js';
afterEach(() => vi.unstubAllGlobals());
it('validates protocols, credentials, size and standard web ports', () => {
  expect(validatePageUrl('https://example.com')).toBe('');
  expect(validatePageUrl('http://example.com')).toBe('');
  for (const url of ['', 'hello', 'ftp://example.com', 'https://user:pass@example.com', 'http://example.com:5000', 'https://example.com/' + 'a'.repeat(2048)]) expect(validatePageUrl(url)).not.toBe('');
});
it('rejects malformed responses and preserves cancellation errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => { throw new Error('bad JSON'); } }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true }) }).mockRejectedValueOnce(new DOMException('Canceled', 'AbortError')));
  await expect(summarizePage('https://example.com')).rejects.toThrow('unexpected response');
  await expect(summarizePage('https://example.com')).rejects.toThrow('incomplete summary');
  await expect(summarizePage('https://example.com')).rejects.toHaveProperty('name', 'AbortError');
});
it('rejects null or partially structured API responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => null }).mockResolvedValueOnce({ ok: true, json: async () => ({ success: true, title: 'Page', url: 'https://example.com', overview: 'An overview.', keyTakeaways: ['Only one.'], summary: 'Old text.' }) }));
  await expect(summarizePage('https://example.com')).rejects.toThrow('incomplete summary');
  await expect(summarizePage('https://example.com')).rejects.toThrow('incomplete summary');
});
