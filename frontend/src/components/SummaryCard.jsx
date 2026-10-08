import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Check, ChevronDown, Copy, Download, RotateCcw } from 'lucide-react';
import { formatSummaryText } from '../summary.js';
import { downloadSummary } from '../exportSummary.js';

export default function SummaryCard({ result, onReset }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const titleRef = useRef(null);
  const menuRef = useRef(null);
  const timer = useRef(null);
  useEffect(() => { titleRef.current?.focus(); return () => clearTimeout(timer.current); }, []);
  useEffect(() => {
    const close = event => {
      if (!menuRef.current?.open) return;
      if (event.type === 'keydown' && event.key === 'Escape') {
        menuRef.current.open = false;
        menuRef.current.querySelector('summary')?.focus();
      } else if (event.type === 'pointerdown' && !menuRef.current.contains(event.target)) menuRef.current.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', close); };
  }, []);
  async function copySummary() {
    try {
      await navigator.clipboard.writeText(formatSummaryText(result));
      setCopied(true); setCopyError('');
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch { setCopyError('Copy is unavailable here. Select the summary text to copy it manually.'); }
  }
  async function download(format) {
    if (downloading) return;
    menuRef.current.open = false;
    setDownloading(true); setDownloadError('');
    try { await downloadSummary(result, format); }
    catch { setDownloadError('Could not create the download. Please try again.'); }
    finally { setDownloading(false); }
  }
  return <section className="summary-card" aria-label="Your summary">
    <h2 ref={titleRef} tabIndex={-1}>{result.title}</h2>
    <a className="source-link" href={result.url} target="_blank" rel="noopener noreferrer"><span>{result.url}</span><ArrowUpRight size={15} /></a>
    <div className="summary-content">
      <h3>Overview</h3>
      <p className="summary-text">{result.overview}</p>
      {result.keyTakeaways.length > 0 && <><h3>Key Takeaways</h3><ul className="takeaways">{result.keyTakeaways.map((item, index) => <li key={index}>{item}</li>)}</ul></>}
    </div>
    <div className="result-actions">
      <div className="export-actions">
        <button type="button" className="secondary-button" onClick={copySummary}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Copied!' : 'Copy'}</button>
        <details className="download-options" ref={menuRef}>
          <summary className="secondary-button" aria-disabled={downloading} onClick={event => { if (downloading) event.preventDefault(); }}><Download size={14} />{downloading ? 'Preparing...' : 'Download'}<ChevronDown size={12} /></summary>
          <div className="download-menu" role="group" aria-label="Download format">
            <button type="button" disabled={downloading} onClick={() => download('pdf')}>Download as PDF</button>
            <button type="button" disabled={downloading} onClick={() => download('txt')}>Download as TXT</button>
          </div>
        </details>
      </div>
      <button type="button" className="text-button" onClick={onReset}><RotateCcw size={14} /> Summarize another</button>
    </div>
    <div aria-live="polite" className={copyError ? 'copy-status' : 'sr-only'}>{copyError || (copied ? 'Summary copied to clipboard.' : '')}</div>
    {downloadError && <p className="copy-status" role="alert">{downloadError}</p>}
  </section>;
}
