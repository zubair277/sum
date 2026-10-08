import http from 'node:http';
import https from 'node:https';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { validateUrl, resolvePublicHost, pinnedLookup } from './url.js';
import { AppError } from '../utils/errors.js';
import { networkDiagnostics, withDiagnostics } from '../utils/diagnostics.js';

export const MAX_CONTENT_CHARS = 24000;
const MAX_BYTES = 2 * 1024 * 1024;
const clean = text => text.replace(/\s+/g, ' ').trim();

export function extractContent(html, url) {
  const $ = cheerio.load(html);
  const title = clean($('meta[property="og:title"]').attr('content') || $('title').first().text() || $('h1').first().text() || new URL(url).hostname).slice(0, 300);
  $('script, style, noscript, nav, footer, header, aside, form, iframe, svg, button, [hidden], [aria-hidden="true"], [role="navigation"], [role="banner"], [role="complementary"], .advertisement, .ads, .ad, .cookie-banner, .social-share').remove();
  $('[style]').each((_, element) => {
    if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test($(element).attr('style'))) $(element).remove();
  });
  const candidates = $('article, main, [role="main"]');
  let root = $('body');
  let bestLength = 0;
  candidates.each((_, element) => {
    const length = clean($(element).text()).length;
    if (length > bestLength) { root = $(element); bestLength = length; }
  });
  root.find('p, h1, h2, h3, h4, li, div, section, br, td').each((_, element) => { $(element).append('\n'); });
  const text = clean(root.text()).slice(0, MAX_CONTENT_CHARS);
  if (text.length < 200 || text.split(/\s+/).length < 40) {
    throw new AppError(422, 'INSUFFICIENT_CONTENT', 'This page has too little readable text. Try a full article or blog post. Pages that require JavaScript or a login may not work.');
  }
  return { title, url: url.toString(), text };
}

export async function scrapePage(value, { request = axios.get, resolver } = {}) {
  let url = validateUrl(value);
  const signal = AbortSignal.timeout(15000);
  try {
    for (let hop = 0; hop <= 4; hop++) {
      const addresses = await resolvePublicHost(url, resolver);
      const lookup = pinnedLookup(addresses);
      const httpAgent = new http.Agent({ lookup, keepAlive: false });
      const httpsAgent = new https.Agent({ lookup, keepAlive: false });
      let response;
      try {
        response = await request(url.toString(), {
          timeout: 10000, signal, maxRedirects: 0, proxy: false,
          maxContentLength: MAX_BYTES, maxBodyLength: MAX_BYTES,
          responseType: 'text', httpAgent, httpsAgent,
          headers: { 'User-Agent': 'SummarizeAI/1.0 (public article summarizer)', Accept: 'text/html,application/xhtml+xml' },
          validateStatus: () => true,
        });
      } finally { httpAgent.destroy(); httpsAgent.destroy(); }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (hop === 4 || !response.headers.location) throw new AppError(422, 'REDIRECT_LIMIT', 'This website redirects too many times. Try the final article URL.');
        // Revalidate every destination and its DNS answers before connecting.
        url = validateUrl(new URL(response.headers.location, url).toString());
        continue;
      }
      if (response.status < 200 || response.status >= 300) throw withDiagnostics(new AppError(502, 'PAGE_UNAVAILABLE', 'The website refused the request or the page was not found. Try another public article.'), { upstreamStatus: response.status });
      if (!/^(text\/html|application\/xhtml\+xml)(;|$)/i.test(response.headers['content-type'] || '')) throw new AppError(415, 'UNSUPPORTED_CONTENT', 'Only HTML webpages are supported. Please use an article URL instead of a PDF, image, or download.');
      return extractContent(response.data, url);
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    const diagnostics = networkDiagnostics(error);
    if (signal.aborted || ['ECONNABORTED', 'ETIMEDOUT', 'ERR_CANCELED'].includes(error.code)) throw withDiagnostics(new AppError(504, 'PAGE_TIMEOUT', 'The website took too long to respond. Try again or use another page.'), diagnostics);
    if (error.message?.includes('maxContentLength')) throw new AppError(413, 'PAGE_TOO_LARGE', 'This webpage is too large to process. Try a smaller article.');
    if (diagnostics.networkCode?.includes('CERT') || ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'DEPTH_ZERO_SELF_SIGNED_CERT'].includes(diagnostics.networkCode)) throw withDiagnostics(new AppError(502, 'PAGE_TLS_ERROR', 'The website’s HTTPS certificate could not be verified. Try another page; certificate verification remains enabled.'), diagnostics);
    throw withDiagnostics(new AppError(502, 'PAGE_UNREACHABLE', 'This website could not be read. Check the URL or try another public page.'), diagnostics);
  }
}
