# SummarizeAI

Turn public webpages into a professional overview and key takeaways. SummarizeAI extracts readable HTML and asks Google Gemini for a source-grounded JSON response: a 40–60 word overview plus 2–3 short bullets, ideally 60–90 words total. It preserves facts, names and numbers without inventing conclusions. The app uses real scraping and real Gemini calls; there are no demo summaries or fallback-generated results in application code.

**Repository:** [github.com/zubair277/sum](https://github.com/zubair277/sum)  
**Live frontend:** not yet deployed; add your actual Vercel URL here.  
**Live API:** not yet deployed; add your actual Render URL here.

## Features

- Compact, centered utility card with a responsive purple-and-white interface, URL validation, a button spinner, cancellation, and retry.
- Source title, final source URL, overview, key takeaways, clipboard copying, and a “Summarize another” action inside the existing minimal result card.
- PDF and UTF-8 TXT downloads containing the title, source URL, both summary sections, and generation date. Downloads use the current result and never request another summary.
- Gemini JSON-schema output and server validation reject malformed, empty, incorrectly typed, duplicate, and oversized fields with `502 AI_INVALID_RESPONSE`.
- HTML extraction with navigation, scripts, styles, ads, and hidden content removed.
- Public-address checks for IPv4/IPv6, every DNS answer, and every redirect. DNS answers are pinned to the connection to reduce DNS-rebinding risk; proxy environment variables cannot route scraping requests.
- HTML-only requests with a 2 MiB response limit, 10-second request timeout, 15-second overall fetching deadline, and at most four redirects. DNS resolution is bounded to five seconds per lookup.
- Extracted content capped at 24,000 characters; at least 200 characters and 40 words required.
- Gemini key held only on the server, configurable model, quota handling, and a separate system instruction that treats source content as untrusted data.
- Restricted CORS, security headers, 4 KiB request limit, 10 requests per client per 15 minutes, and at most four simultaneous jobs per server process.
- Health check, deployment configs, automated tests, and GitHub Actions validation.

## Technologies

React 19, Vite, Tailwind CSS 4, Lucide icons, Node.js, Express 5, Axios, Cheerio, the official `@google/genai` SDK, `ipaddr.js`, and [pdfmake](https://pdfmake.github.io/docs/0.3/) for client-side PDF generation. Tests use Node's built-in test runner, Supertest, Vitest, and React Testing Library. There is no database or authentication.

## Structure

```text
ai-web-summarizer/                 # this workspace is the project root
├── frontend/
│   ├── src/
│   │   ├── components/            # loading and result cards
│   │   ├── test/                  # UI and API-client tests
│   │   ├── App.jsx
│   │   ├── api.js
│   │   ├── summary.js             # normalization and copy formatting
│   │   ├── exportSummary.js       # PDF/TXT generation and download
│   │   ├── main.jsx
│   │   └── index.css
│   ├── public/favicon.svg
│   ├── .env.example
│   ├── vite.config.js
│   ├── vercel.json
│   └── package.json
├── backend/
│   ├── src/
│   │   ├── routes/summarize.js
│   │   ├── services/             # URL safety, scraping, Gemini
│   │   ├── middleware/errorHandler.js
│   │   ├── utils/errors.js
│   │   ├── app.js
│   │   └── server.js
│   ├── test/
│   ├── .env.example
│   └── package.json
├── docs/                         # UI screenshots
├── .github/workflows/ci.yml
├── .gitignore
├── .nvmrc
├── render.yaml
├── package.json                  # npm workspaces and combined scripts
├── package-lock.json
└── README.md
```

## Prerequisites

Use **Node.js 24 LTS** (matching `.nvmrc` and CI) and npm. You also need internet access and a Gemini API key with access to the selected model. On a machine with nvm, run `nvm install` followed by `nvm use` in this directory.

## Local setup

From the repository root:

```bash
npm ci
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Create **`backend/.env`** inside the backend folder, alongside its `package.json`, and edit it to contain:

```dotenv
GEMINI_API_KEY=your_actual_gemini_key
GEMINI_MODEL=gemini-3.5-flash-lite
PORT=5000
FRONTEND_URL=http://localhost:5173
TRUST_PROXY=0
```

Create **`frontend/.env`** inside the frontend folder, alongside its `package.json`:

```dotenv
VITE_API_URL=http://localhost:5000
```

The examples are templates, not real credentials. Actual `.env` files are ignored by Git. Never put `GEMINI_API_KEY` in a `VITE_` variable: Vite exposes those values publicly. The backend explicitly loads `backend/.env`, including when launched from the repository root. Hosting environment variables take precedence.

**This local checkout:** ignored `.env` files are already prepared with `PORT=5001` and `VITE_API_URL=http://localhost:5001` because macOS AirPlay uses port 5000 on this machine. Keep those files, add your key to `backend/.env`, and run `npm run dev`. The frontend still runs on `http://localhost:5173`; your local health endpoint is `http://localhost:5001/api/health`. The examples above retain the brief's standard port 5000 for a fresh clone.

### Obtain a free Gemini API key

1. Open [Google AI Studio's API key page](https://aistudio.google.com/apikey) and sign in.
2. Create a key for an eligible Google Cloud project. Keep the project on the free tier if you want to avoid paid usage.
3. Paste the key into `GEMINI_API_KEY` in `backend/.env` and restart the backend.
4. Confirm your model and project quota in AI Studio. The default `gemini-3.5-flash-lite` has free-tier input/output pricing in [Google's pricing documentation](https://ai.google.dev/gemini-api/docs/pricing#gemini-3.5-flash-lite). Eligibility and quotas depend on your account, region, and project and can change; the app does not enable billing.

The implementation follows the [official Google GenAI JavaScript SDK](https://github.com/googleapis/js-genai). The default Gemini 3.5 Flash-Lite uses its supported `thinkingLevel: minimal` setting. Gemini 3.8 Flash uses `low`, and Gemini 2.5 Flash/Flash-Lite use `thinkingBudget: 0`; unknown models use their defaults. Model discovery alone does not prove generation access. Live debugging showed Gemini 2.5 Flash rejecting new users with 404 and Gemini 3.8 Flash experiencing high demand with 503; the configured Flash-Lite replacement passed a direct generation test. See the [thinking documentation](https://ai.google.dev/gemini-api/docs/thinking) for model-specific settings. Temporary provider 500/502/503 errors receive at most three attempts with exponential backoff under a 35-second AI deadline; quota and configuration errors are not retried. Persistent overload returns `503 AI_BUSY`. Logs identify `SCRAPING_FAILED`, `AI_GENERATION_FAILED`, and `AI_GENERATION_RETRY` using safe status/reason fields, never raw SDK errors, credentials, or source text.

### Run both services

```bash
npm run dev
```

Open **http://localhost:5173** or **http://127.0.0.1:5173**. With `NODE_ENV=development` (the default when unset), both local origins are allowed by the API. With `NODE_ENV=production`, only the configured `FRONTEND_URL` is allowed. The backend runs at **http://localhost:5000** in a fresh clone and **http://localhost:5001** in this checkout. If a port is occupied, stop that process or change `PORT`, `FRONTEND_URL`, and `VITE_API_URL` consistently. Vite can select another port automatically, which requires updating `FRONTEND_URL` to that exact origin.

Or use two terminals, each in the repository root:

```bash
# Terminal 1
npm run dev --workspace backend
```

```bash
# Terminal 2
npm run dev --workspace frontend
```

The backend starts without a key, but summarization then returns an actionable `503 AI_NOT_CONFIGURED` error. No AI result is fabricated. A key is needed to verify a real end-to-end summary.

### Tests and build

```bash
npm test
npm run build
npm run start --workspace backend
# In another terminal, optionally preview the production frontend:
npm run preview --workspace frontend -- --port 5173
```

The tests do not need credentials or external websites: providers and network responses are injected only in test code. They cover safe/unsafe URLs, private redirects, changed DNS responses, bounded scraping, unavailable/empty sites, Gemini failures, JSON validation, API compatibility, CORS, rate and concurrency limits, and frontend validation/loading/success/error/copy/reset/cancel states. Export tests generate actual PDF bytes, verify TXT content and temporary browser URL cleanup, and test both download controls and export-error handling. Supertest needs permission to bind a local ephemeral port. The CI workflow runs the full test suite and production build on Node 24.

### Copy and download

After summarizing, **Copy** copies the overview and bullet points. Open **Download** and choose **Download as PDF** or **Download as TXT**. Both exports include the existing result's title, final validated source URL, overview, takeaways, and generation date. The timestamp is created on the backend when generation completes and shown in your browser's local timezone. Downloads never call Gemini again or send the document to an external conversion service.

PDFs use embedded Roboto fonts, A4 pages, automatic wrapping and pagination, page numbers, and section-heading orphan prevention. PDF code/fonts are bundled locally and loaded only on the first PDF request; this adds about 830 KB compressed on first use and produces a Vite large-chunk advisory for the two lazy export bundles. The initial utility page does not load them. TXT uses UTF-8. Roboto covers common Latin, Greek and Cyrillic text; PDF glyph coverage for other writing systems remains a limitation until appropriate fonts are bundled. TXT preserves those characters.

Summary word counts are prompt targets rather than hard truncation rules, to avoid cutting off facts or imposing English word boundaries on every source language. Schema and type/size validation cannot prove factual accuracy; check the source for high-stakes use.

## API

### `GET /api/health`

```json
{ "success": true, "status": "ok", "aiConfigured": false }
```

`aiConfigured` reflects whether a key is present, not whether Gemini has accepted it. This endpoint does not consume Gemini quota.

### `POST /api/summarize`

Content-Type: `application/json`

```bash
curl -X POST http://localhost:5000/api/summarize \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://science.nasa.gov/earth/facts/"}'
```

Request:

```json
{ "url": "https://example.com/article" }
```

Successful response (`200`; example schema, not a built-in summary):

```json
{
  "success": true,
  "title": "Example Article",
  "url": "https://example.com/article",
  "overview": "The source-grounded overview appears here.",
  "keyTakeaways": ["First supported fact.", "Second supported conclusion."],
  "summary": "Overview:\nThe source-grounded overview appears here.\n\nKey Takeaways:\n- First supported fact.\n- Second supported conclusion.",
  "generatedAt": "2026-10-08T12:30:00.000Z"
}
```

Error response:

```json
{
  "success": false,
  "code": "INSUFFICIENT_CONTENT",
  "error": "This page has too little readable text. Try a full article or blog post. Pages that require JavaScript or a login may not work."
}
```

| HTTP status | Meaning |
| --- | --- |
| 400 | Invalid URL/JSON or blocked internal address |
| 403 | Browser origin not permitted |
| 404 | API route not found |
| 413 | Request or fetched HTML exceeds the size limit |
| 415 | URL does not return HTML |
| 422 | Too little readable text or too many redirects |
| 429 | Local request limit or Gemini quota/rate limit |
| 502 | Page inaccessible, malformed AI output, or AI/provider failure |
| 503 | Missing/invalid Gemini configuration, persistent provider overload, or occupied job slots |
| 504 | Fetching or AI generation timed out |
| 500 | Unexpected server failure, with a generic public message |

`overview` and `keyTakeaways` are the structured fields; `summary` remains a plain-text string for compatibility with older clients. `generatedAt` is an ISO 8601 UTC timestamp. During staggered deployment, the new frontend can read an older summary-only response without inventing takeaways; its export date then uses the time the response was received. Invalid structured fields are rejected even if a legacy `summary` is present.

The returned URL is the final validated destination after redirects. The API only permits HTTP/HTTPS and standard ports 80/443, without URL credentials. The server does not store the URL, source text, or summary.

## Deploy to Render and Vercel

Commit the source and root lockfile to your GitHub repository. Do not commit `.env` files, `node_modules`, or `dist`. Deployment configuration is prepared; publishing requires your own hosting accounts and environment variables.

### Backend: Render

Use **New → Blueprint** with the included root `render.yaml`, or create a Node web service manually:

| Setting | Value |
| --- | --- |
| Root directory | Leave empty (repository root) |
| Build command | `npm ci --omit=dev --workspace backend` |
| Start command | `npm run start --workspace backend` |
| Health check | `/api/health` |
| Node version | `24` |

Set `GEMINI_API_KEY` as a secret, `GEMINI_MODEL=gemini-3.5-flash-lite`, `NODE_ENV=production`, and `TRUST_PROXY=1` for Render's proxy. Set `FRONTEND_URL` to the exact production frontend origin, for example `https://your-project.vercel.app` **without a trailing slash**. Render supplies `PORT`; the server listens on it. Initially use your intended frontend origin, then correct it once Vercel provides the URL. Open `https://your-service.onrender.com/api/health` after deployment.

The free instance may sleep and cause a slow first request. Gemini's free quota and the in-memory rate limiter suit a small, single-instance assignment/demo deployment. Limits reset on restart and are not coordinated across replicas. For larger public traffic, add infrastructure-level abuse controls and a shared rate-limit store. CORS is a browser policy and does not authenticate API callers.

### Frontend: Vercel

1. Import the same GitHub repository.
2. Set the **Root Directory to `frontend`**, framework to **Vite**, build command to `npm run build`, and output directory to `dist`. Keep Vercel's install command default so it can use the workspace lockfile. Allow access to files outside the root directory for the shared root lockfile if prompted.
3. Set `VITE_API_URL=https://your-service.onrender.com` in production environment variables. Include no `/api` suffix; the frontend adds `/api/summarize`.
4. Deploy. Update Render's `FRONTEND_URL` to this Vercel origin and redeploy/restart Render if needed.
5. Paste a public article and verify the complete workflow. Use HTTPS for both hosts. Clipboard copying needs a secure context (HTTPS or localhost).

Vite variables are embedded at build time; redeploy after changing `VITE_API_URL`. Preview deployment origins are denied unless configured as the server's allowed origin; use a separate staging backend if you want isolated preview testing.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `AI_NOT_CONFIGURED` | Set the actual key in `backend/.env` locally or Render secrets, then restart. |
| `AI_MODEL_UNAVAILABLE` | Set an accessible model in `GEMINI_MODEL` and restart; model discovery alone does not prove generation access. |
| `AI_KEY_INVALID` / `AI_ACCESS_DENIED` | Check the key, restrictions, permissions, and region in AI Studio. |
| `AI_REQUEST_INVALID` | Check the configured model supports the generation/thinking settings. |
| `AI_INVALID_RESPONSE` | Gemini returned malformed or incomplete JSON. Retry; no fabricated fallback is used. |
| `AI_BUSY` | The provider is overloaded after bounded retries. Wait and try again. |
| Gemini quota error / `429` | Check AI Studio's project quota and retry later; no paid fallback is used. |
| Network/CORS error | Check that backend is running, `VITE_API_URL` is correct, and `FRONTEND_URL` matches the browser origin exactly. |
| Slow first deployed request | Render's free service may be waking up. Wait, then retry. |
| Website returns `403` or no useful text | Try a different article. Login pages, paywalls, anti-bot systems, and JS-only content are not bypassed. |
| PDF or image URL rejected | Supply an HTML article instead. |
| Local/private URL rejected | Expected SSRF protection. Use a publicly accessible website. |
| Frontend edits to `.env` have no effect | Restart Vite locally, or rebuild/redeploy on Vercel. |
| Copy fails | Use HTTPS/localhost, allow clipboard access, or manually select and copy the summary. |
| Download fails | Retry and check the browser's download permissions. PDF generation stays in your browser. |
| Tests fail with `listen EPERM` | Run the tests with local socket permission outside a restrictive execution sandbox. |

The scraper cannot execute JavaScript. Main-text selection is heuristic and may include irrelevant content on unusually structured sites. Source text is truncated before Gemini processing, so the summary of a very long page covers only the extracted initial portion. Prompt separation and explicit instructions mitigate prompt injection, but model outputs still need verification against their sources. Scraped text is sent to Google; consult [Gemini's terms](https://ai.google.dev/gemini-api/terms) for free-tier data handling. Local cancellation stops the browser request; a job already running on the server may finish and consume quota.

## Screenshots

Screenshots of the actual interface belong in `docs/`. See desktop and mobile captures here when available:

- `docs/desktop.png`
- `docs/mobile.png`

Browser automation was unavailable during implementation, so these captures are not included yet. Automated UI-state tests and the production build were verified; visual browser QA remains a manual check.

To refresh them, run the frontend and capture the home page at desktop and mobile sizes. Only capture a successful summary after configuring your own key and requesting a real page.

## GitHub submission

Add your actual repository/demo URLs at the top, add screenshots, and push the project to your repository. Keep the root `package-lock.json` so reviewers and hosting services install the same versions. `npm test` and `npm run build` are the submission checks. No hosting deployment or GitHub push is performed automatically by the local setup.

This checkout currently inherits a Git repository from its parent Desktop directory. Initialize a repository **inside the project folder** before adding files so unrelated Desktop files are excluded:

```bash
# Run inside this project, not its parent directory:
git init -b main
git rev-parse --show-toplevel   # must identify this project folder
git check-ignore backend/.env frontend/.env
git add .
git diff --cached --stat       # review only project source/configuration
git commit -m "Prepare SummarizeAI assignment"
# Create an empty GitHub repository, then substitute its actual clone URL:
git remote add origin YOUR_ACTUAL_REPOSITORY_URL
git push -u origin main
```

Deployment files are prepared for Vercel and Render, and CI runs tests/build. Real hosting publication, project billing/free-tier status, desktop/mobile browser layout, download behavior on physical devices, and screenshots require verification in your accounts or browser before submission. Configuration readiness does not mean the app has already been published or deployed.
