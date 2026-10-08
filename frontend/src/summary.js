const clean = text => text.replace(/\s+/g, ' ').trim();

export function normalizeSummaryResult(data) {
  const invalid = () => new Error('The server returned an incomplete summary. Please try again.');
  const structured = data.overview !== undefined || data.keyTakeaways !== undefined;
  let overview;
  let keyTakeaways;
  if (structured) {
    if (typeof data.overview !== 'string' || !clean(data.overview) || data.overview.length > 2000 ||
        !Array.isArray(data.keyTakeaways) || data.keyTakeaways.length < 2 || data.keyTakeaways.length > 3 ||
        data.keyTakeaways.some(item => typeof item !== 'string' || !clean(item) || item.length > 500)) throw invalid();
    overview = clean(data.overview);
    keyTakeaways = data.keyTakeaways.map(clean);
    if (new Set(keyTakeaways.map(item => item.toLowerCase())).size !== keyTakeaways.length) throw invalid();
  } else {
    // Older backend responses remain readable during a staggered deployment.
    if (typeof data.summary !== 'string' || !clean(data.summary) || data.summary.length > 4000) throw invalid();
    overview = clean(data.summary);
    keyTakeaways = [];
  }
  if (data.generatedAt !== undefined && (typeof data.generatedAt !== 'string' || !Number.isFinite(Date.parse(data.generatedAt)))) throw invalid();
  return { ...data, overview, keyTakeaways, generatedAt: data.generatedAt || new Date().toISOString() };
}

export function formatSummaryText({ overview, keyTakeaways }) {
  if (!keyTakeaways.length) return overview;
  return `Overview:\n${overview}\n\nKey Takeaways:\n${keyTakeaways.map(item => `- ${item}`).join('\n')}`;
}

export function formatGeneratedAt(value) {
  return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }).format(new Date(value));
}
