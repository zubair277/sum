import { afterEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SummaryCard from '../components/SummaryCard.jsx';
import * as exports from '../exportSummary.js';

const result = { title: 'Professional summary', url: 'https://example.com/article', overview: 'A clear overview of the source.', keyTakeaways: ['An important fact.', 'A supported conclusion.'], generatedAt: '2026-10-08T12:30:00.000Z' };
afterEach(() => vi.restoreAllMocks());
it('downloads either format from the existing result without calling the API again', async () => {
  const download = vi.spyOn(exports, 'downloadSummary').mockResolvedValue();
  const fetch = vi.spyOn(globalThis, 'fetch');
  const user = userEvent.setup(); render(<SummaryCard result={result} onReset={() => {}} />);
  for (const format of ['PDF', 'TXT']) {
    await user.click(screen.getByText('Download', { exact: true }));
    await user.click(screen.getByRole('button', { name: `Download as ${format}` }));
    await waitFor(() => expect(download).toHaveBeenCalledWith(result, format.toLowerCase()));
  }
  expect(download).toHaveBeenCalledTimes(2);
  expect(fetch).not.toHaveBeenCalled();
});
it('reports failed exports and failed clipboard access without losing the summary', async () => {
  vi.spyOn(exports, 'downloadSummary').mockRejectedValue(new Error('Export failed'));
  const user = userEvent.setup();
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('Clipboard denied'));
  render(<SummaryCard result={result} onReset={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Copy' }));
  expect(await screen.findByText(/Copy is unavailable/)).toBeVisible();
  await user.click(screen.getByText('Download', { exact: true }));
  await user.click(screen.getByRole('button', { name: 'Download as PDF' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the download');
  expect(screen.getByText(result.overview)).toBeVisible();
});
it('supports closing the download options with Escape', async () => {
  const user = userEvent.setup(); render(<SummaryCard result={result} onReset={() => {}} />);
  const toggle = screen.getByText('Download', { exact: true });
  await user.click(toggle);
  expect(toggle.closest('details')).toHaveAttribute('open');
  await user.keyboard('{Escape}');
  expect(toggle.closest('details')).not.toHaveAttribute('open');
  expect(toggle).toHaveFocus();
});
