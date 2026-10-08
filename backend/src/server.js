import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';
import { DEFAULT_GEMINI_MODEL } from './services/gemini.js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
if (new URL(frontendUrl).origin !== frontendUrl) throw new Error('FRONTEND_URL must be an exact origin without a trailing slash or path.');
const app = createApp({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL, frontendUrl, trustProxy: process.env.TRUST_PROXY === '1' ? 1 : false });
const server = app.listen(port, error => {
  if (error) {
    console.error(`Could not start API on port ${port}: ${error.code}. Change PORT in backend/.env and VITE_API_URL in frontend/.env if the port is occupied.`);
    process.exitCode = 1;
    return;
  }
  console.log(`SummarizeAI API listening on port ${port}`);
  if (!process.env.GEMINI_API_KEY) console.warn('Set GEMINI_API_KEY in backend/.env to enable AI summaries.');
});
server.requestTimeout = 45000;
server.headersTimeout = 10000;
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
});
