import { normalizeSummaryResult } from './summary.js';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export function validatePageUrl(value) {
  if (!value.trim()) return 'Paste a webpage URL to get started.';
  if (value.length > 2048) return 'Please use a URL shorter than 2,048 characters.';
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) return 'Use an HTTP or HTTPS URL without credentials and with a standard web port.';
    return '';
  } catch { return 'Enter a complete URL, such as https://example.com/article.'; }
}

export async function summarizePage(url, signal) {
  let response;
  try {
    response = await fetch(`${API_URL}/api/summarize`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }), signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('We couldn’t connect to the server. Check your connection and try again.');
  }
  let data;
  try { data = await response.json(); } catch { throw new Error('The server returned an unexpected response. Please try again.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('The server returned an incomplete summary. Please try again.');
  if (!response.ok || !data.success) throw new Error(data.error || 'We couldn’t summarize this page. Try again.');
  if (typeof data.title !== 'string' || !data.title.trim() || data.title.length > 300 || typeof data.url !== 'string' || validatePageUrl(data.url)) throw new Error('The server returned an incomplete summary. Please try again.');
  return normalizeSummaryResult(data);
}
