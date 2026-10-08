import { useEffect, useRef, useState } from 'react';
import { AlertCircle, AlignLeft, ArrowRight, FileText, Link2, Sparkles } from 'lucide-react';
import { summarizePage, validatePageUrl } from './api.js';
import LoadingState from './components/LoadingState.jsx';
import SummaryCard from './components/SummaryCard.jsx';

export default function App() {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);
  const requestRef = useRef(null);
  useEffect(() => () => requestRef.current?.abort(), []);
  async function submit(event) {
    event.preventDefault();
    if (requestRef.current) return;
    const validation = validatePageUrl(url);
    if (validation) { setError(validation); inputRef.current?.focus(); return; }
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError('');
    const timeout = setTimeout(() => controller.abort('timeout'), 55000);
    try {
      const data = await summarizePage(url, controller.signal);
      if (requestRef.current === controller && !controller.signal.aborted) setResult(data);
    } catch (failure) {
      if (requestRef.current === controller && (!controller.signal.aborted || controller.signal.reason === 'timeout')) {
        setError(controller.signal.reason === 'timeout' ? 'This request took too long. Please try again.' : failure.message);
      }
    } finally {
      clearTimeout(timeout);
      if (requestRef.current === controller) { setLoading(false); requestRef.current = null; }
    }
  }
  function cancel() { requestRef.current?.abort(); requestRef.current = null; setLoading(false); inputRef.current?.focus(); }
  function reset() { setResult(null); setUrl(''); setError(''); requestAnimationFrame(() => inputRef.current?.focus()); }
  return <div className="app-shell">
    <header className="site-header">
      <a href="/" className="brand" aria-label="SummarizeAI home">
        <span className="brand-icon"><Sparkles size={16} strokeWidth={1.8} /></span>
        <span>Summarize<span className="brand-ai">AI</span></span>
      </a>
    </header>
    <main>
      <div className="workspace">
        {result ? <SummaryCard result={result} onReset={reset} /> : <section className="input-card" aria-label="Summarize a webpage" aria-busy={loading}>
          <h1>Paste a link. Get the key points.</h1>
          <form onSubmit={submit} noValidate>
            <label htmlFor="page-url" className="sr-only">Webpage URL</label>
            <div className="url-control">
              <input ref={inputRef} id="page-url" type="url" placeholder="Paste a webpage URL here..." value={url}
                onChange={event => { setUrl(event.target.value); if (error) setError(''); }}
                disabled={loading} aria-invalid={Boolean(error)} aria-describedby={error ? 'url-error' : undefined}
                autoComplete="url" spellCheck="false" required />
              <button type="submit" className="primary-button" disabled={loading}>
                {loading ? <LoadingState /> : 'Summarize'}
              </button>
            </div>
            {error && <div id="url-error" className="error-message" role="alert"><AlertCircle size={16} /><span>{error}</span></div>}
          </form>
          <div className="guidance-row">
            <ol className="guidance-steps" aria-label="How it works">
              <li><Link2 size={14} aria-hidden="true" />Paste link<ArrowRight className="step-arrow" size={12} aria-hidden="true" /></li>
              <li><FileText size={14} aria-hidden="true" />Extract content<ArrowRight className="step-arrow" size={12} aria-hidden="true" /></li>
              <li><AlignLeft size={14} aria-hidden="true" />Get summary</li>
            </ol>
            {loading && <button type="button" className="text-button cancel-button" onClick={cancel}>Cancel</button>}
          </div>
        </section>}
      </div>
    </main>
  </div>;
}
