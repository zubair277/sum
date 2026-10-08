import { formatGeneratedAt, formatSummaryText } from './summary.js';

export function exportFilename(title, extension) {
  const slug = title.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80).replace(/-$/, '') || 'webpage';
  return `${slug.toLowerCase()}-summary.${extension}`;
}

export function createTxtContent(result) {
  return `${result.title}\nSource: ${result.url}\nGenerated: ${formatGeneratedAt(result.generatedAt)}\n\n${formatSummaryText(result)}\n`;
}

export function createPdfDefinition(result) {
  const section = text => ({ text, style: 'section', headlineLevel: 1 });
  return {
    pageSize: 'A4',
    pageMargins: [48, 48, 48, 52],
    info: { title: result.title, author: 'SummarizeAI', subject: 'Webpage overview and key takeaways' },
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35, color: '#393341' },
    styles: {
      title: { fontSize: 21, bold: true, lineHeight: 1.15, color: '#25212d', margin: [0, 0, 0, 12] },
      source: { fontSize: 9, color: '#7053a1', margin: [0, 0, 0, 8] },
      date: { fontSize: 9, color: '#766e80', margin: [0, 0, 0, 24] },
      section: { fontSize: 11, bold: true, color: '#7053a1', margin: [0, 0, 0, 8] },
    },
    content: [
      { text: result.title, style: 'title' },
      // Invisible opportunities allow even long URL tokens to wrap; the link stays exact.
      { text: result.url.replace(/(.{32})/gu, '$1\u200b'), link: result.url, style: 'source' },
      { text: `Generated: ${formatGeneratedAt(result.generatedAt)}`, style: 'date' },
      section('Overview'),
      { text: result.overview, margin: [0, 0, 0, 20] },
      ...(result.keyTakeaways.length ? [section('Key Takeaways'), { ul: result.keyTakeaways.map(text => ({ text, margin: [0, 0, 0, 6] })), margin: [0, 0, 0, 12] }] : []),
    ],
    footer: (page, total) => ({ text: `${page} / ${total}`, alignment: 'right', fontSize: 8, color: '#8b8295', margin: [48, 18, 48, 0] }),
    pageBreakBefore: (node, container) => node.headlineLevel === 1 && container.getFollowingNodesOnPage().length === 0,
  };
}

let pdfLibrary;
async function loadPdfLibrary() {
  if (!pdfLibrary) {
    pdfLibrary = Promise.all([import('pdfmake/build/pdfmake.js'), import('pdfmake/build/vfs_fonts.js')]).then(([library, fonts]) => {
      const pdfMake = library.default;
      pdfMake.addVirtualFileSystem(fonts.default);
      return pdfMake;
    }).catch(error => { pdfLibrary = undefined; throw error; });
  }
  return pdfLibrary;
}

export async function createPdfBlob(result) {
  const pdfMake = await loadPdfLibrary();
  return pdfMake.createPdf(createPdfDefinition(result)).getBlob();
}

export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  try { anchor.click(); } finally {
    anchor.remove();
    // Some browsers need the URL to survive until download dispatch completes.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function downloadSummary(result, format) {
  if (!['pdf', 'txt'].includes(format)) throw new Error('Unsupported download format.');
  const blob = format === 'pdf' ? await createPdfBlob(result) : new Blob([createTxtContent(result)], { type: 'text/plain;charset=utf-8' });
  saveBlob(blob, exportFilename(result.title, format));
}
