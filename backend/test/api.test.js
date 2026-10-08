import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { AppError } from '../src/utils/errors.js';

const structured = { overview: 'Concise overview.', keyTakeaways: ['First fact.', 'Second fact.'] };
const dependencies = { logger: { warn() {} }, scrape: async url => ({ title: 'Article title', url, text: 'Extracted source text.' }), summarize: async () => structured };
test('health and summarize expose the documented response shape', async () => {
  const app = createApp(dependencies);
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200); assert.equal(health.body.aiConfigured, true);
  const result = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
  assert.equal(result.status, 200);
  assert.deepEqual({ ...result.body, generatedAt: undefined }, { success: true, title: 'Article title', url: 'https://example.com/', ...structured, summary: 'Overview:\nConcise overview.\n\nKey Takeaways:\n- First fact.\n- Second fact.', generatedAt: undefined });
  assert.ok(Number.isFinite(Date.parse(result.body.generatedAt)));
});
test('rejects invalid inputs and malformed or oversized JSON', async () => {
  const app = createApp(dependencies);
  for (const value of [undefined, 'bad', 'http://127.0.0.1', 'ftp://example.com']) {
    const response = await request(app).post('/api/summarize').send({ url: value });
    assert.equal(response.status, 400); assert.equal(response.body.success, false);
  }
  const malformed = await request(app).post('/api/summarize').set('Content-Type', 'application/json').send('{broken');
  assert.equal(malformed.status, 400); assert.equal(malformed.body.code, 'INVALID_JSON');
  const large = await request(app).post('/api/summarize').send({ url: 'a'.repeat(5000) });
  assert.equal(large.status, 413);
});
test('missing key returns an actionable error before scraping', async () => {
  let called = false;
  const app = createApp({ scrape: async () => { called = true; } });
  const response = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
  assert.equal(response.status, 503); assert.equal(response.body.code, 'AI_NOT_CONFIGURED'); assert.equal(called, false);
});
test('returns safe errors for scraping and provider failures', async () => {
  for (const [status, code] of [[502, 'PAGE_UNREACHABLE'], [422, 'INSUFFICIENT_CONTENT'], [504, 'PAGE_TIMEOUT'], [415, 'UNSUPPORTED_CONTENT']]) {
    const app = createApp({ ...dependencies, scrape: async () => { throw new AppError(status, code, 'Friendly error'); } });
    const response = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
    assert.equal(response.status, status); assert.equal(response.body.code, code);
  }
  const response = await request(createApp({ ...dependencies, summarize: async () => { throw new AppError(429, 'AI_RATE_LIMIT', 'Please wait.'); } })).post('/api/summarize').send({ url: 'https://example.com' });
  assert.equal(response.status, 429);
});
test('identifies the failing stage and never logs raw exception messages', async () => {
  for (const stage of ['SCRAPING_FAILED', 'AI_GENERATION_FAILED']) {
    const events = [];
    const failure = async () => { throw new Error('secret-value and untrusted source text'); };
    const app = createApp({ ...dependencies, logger: { warn: (...args) => events.push(args) }, [stage === 'SCRAPING_FAILED' ? 'scrape' : 'summarize']: failure });
    const response = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
    assert.equal(response.status, 500);
    assert.equal(events[0][0], stage);
    assert.ok(!JSON.stringify(events).includes('secret-value'));
    assert.ok(!JSON.stringify(response.body).includes('secret-value'));
  }
});
test('restricts production CORS to the configured frontend origin', async () => {
  const frontendUrl = 'https://summarizeai.example';
  const app = createApp({ ...dependencies, environment: 'production', frontendUrl });
  const allowed = await request(app).get('/api/health').set('Origin', frontendUrl);
  assert.equal(allowed.headers['access-control-allow-origin'], frontendUrl);
  const denied = await request(app).get('/api/health').set('Origin', 'https://untrusted.example');
  assert.equal(denied.status, 403); assert.equal(denied.body.code, 'ORIGIN_NOT_ALLOWED');
  const preflight = await request(app).options('/api/summarize').set('Origin', frontendUrl).set('Access-Control-Request-Method', 'POST');
  assert.equal(preflight.status, 204);
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    const deniedLocal = await request(app).options('/api/summarize').set('Origin', origin).set('Access-Control-Request-Method', 'POST');
    assert.equal(deniedLocal.status, 403);
    assert.equal(deniedLocal.headers['access-control-allow-origin'], undefined);
  }
});
test('allows both development origins for preflight, POST and validation errors', async () => {
  const app = createApp({ ...dependencies, environment: 'development' });
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    const preflight = await request(app).options('/api/summarize')
      .set('Origin', origin).set('Access-Control-Request-Method', 'POST').set('Access-Control-Request-Headers', 'content-type');
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], origin);
    assert.ok(preflight.headers['access-control-allow-methods'].includes('POST'));
    assert.equal(preflight.headers['access-control-allow-headers'], 'Content-Type');
    assert.ok(preflight.headers.vary.includes('Origin'));
    const response = await request(app).post('/api/summarize').set('Origin', origin).send({ url: 'https://example.com' });
    assert.equal(response.status, 200);
    assert.equal(response.headers['access-control-allow-origin'], origin);
    const invalid = await request(app).post('/api/summarize').set('Origin', origin).send({ url: 'bad-url' });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.headers['access-control-allow-origin'], origin);
  }
  const denied = await request(app).options('/api/summarize').set('Origin', 'https://untrusted.example').set('Access-Control-Request-Method', 'POST');
  assert.equal(denied.status, 403);
  assert.equal(denied.headers['access-control-allow-origin'], undefined);
});
test('limits per-client requests and returns JSON errors', async () => {
  const app = createApp({ ...dependencies, rateLimitMax: 1 });
  await request(app).post('/api/summarize').send({ url: 'https://example.com' });
  const response = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
  assert.equal(response.status, 429); assert.equal(response.body.code, 'RATE_LIMIT');
});
test('bounds concurrent work and releases slots after failures', async () => {
  let release;
  const app = createApp({ ...dependencies, maxConcurrent: 1, scrape: async url => {
    await new Promise(resolve => { release = resolve; });
    throw new AppError(502, 'PAGE_UNREACHABLE', url);
  } });
  const first = request(app).post('/api/summarize').send({ url: 'https://example.com' }).then(response => response);
  const waitForRelease = async () => {
    const deadline = Date.now() + 2000;
    while (!release) {
      if (Date.now() > deadline) throw new Error('The test server did not accept the request within two seconds.');
      await new Promise(resolve => setTimeout(resolve, 5));
    }
  };
  await waitForRelease();
  const second = await request(app).post('/api/summarize').send({ url: 'https://example.com' });
  assert.equal(second.status, 503); assert.equal(second.body.code, 'SERVER_BUSY');
  release(); assert.equal((await first).status, 502);
  const third = request(app).post('/api/summarize').send({ url: 'https://example.com' }).then(response => response);
  release = null;
  await waitForRelease();
  release(); assert.equal((await third).status, 502);
});
