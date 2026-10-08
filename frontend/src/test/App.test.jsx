import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../App.jsx';

const result = { success: true, title: 'Urban trees', url: 'https://example.com/article', overview: 'Urban trees reduce summer heat by shading streets and buildings. They also support wildlife and improve public spaces. Protecting mature trees and planting diverse native species helps cities maintain these benefits, reduce heat exposure, and create healthier neighborhoods for residents.', keyTakeaways: ['Trees reduce urban heat exposure.', 'Native species support wildlife.'], generatedAt: '2026-10-08T12:30:00.000Z' };
const jsonResponse = (data, ok = true) => ({ ok, json: async () => data });
afterEach(() => vi.unstubAllGlobals());

describe('SummarizeAI', () => {
  it('validates empty and invalid URLs before requesting the server', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const user = userEvent.setup(); render(<App />);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Paste a webpage URL');
    await user.type(screen.getByLabelText('Webpage URL'), 'not-a-url');
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a complete URL');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('shows loading, renders the source and summary, copies, and resets', async () => {
    let resolveRequest;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveRequest = resolve; })));
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Webpage URL'), result.url);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(screen.getByRole('status')).toHaveTextContent('Summarizing...');
    expect(screen.getByRole('button', { name: 'Summarizing...' })).toBeDisabled();
    expect(screen.getByLabelText('Webpage URL')).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Summarizing...' }));
    expect(fetch).toHaveBeenCalledTimes(1);
    resolveRequest(jsonResponse(result));
    expect(await screen.findByRole('heading', { name: result.title })).toBeVisible();
    expect(screen.getByText(result.overview)).toBeVisible();
    expect(screen.getByRole('link', { name: result.url })).toHaveAttribute('href', result.url);
    const copy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(copy).toHaveBeenCalledWith(`Overview:\n${result.overview}\n\nKey Takeaways:\n- Trees reduce urban heat exposure.\n- Native species support wildlife.`);
    expect(screen.getByRole('heading', { name: 'Overview' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Key Takeaways' })).toBeVisible();
    expect(screen.getByText(result.keyTakeaways[0])).toBeVisible();
    expect(screen.getByRole('button', { name: 'Copied!' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Summarize another' }));
    expect(screen.getByLabelText('Webpage URL')).toHaveValue('');
  });
  it('shows API errors and allows a successful retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ success: false, error: 'This page has too little readable text.' }, false)).mockResolvedValueOnce(jsonResponse(result)));
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Webpage URL'), result.url);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('too little readable text');
    expect(screen.getByLabelText('Webpage URL')).toHaveValue(result.url);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(await screen.findByText(result.overview)).toBeVisible();
  });
  it('handles network failures with a helpful message', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Webpage URL'), result.url);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('couldn’t connect');
  });
  it('cancels without letting an outdated response replace the form', async () => {
    let resolveRequest;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { resolveRequest = resolve; })));
    const user = userEvent.setup(); render(<App />);
    await user.type(screen.getByLabelText('Webpage URL'), result.url);
    await user.click(screen.getByRole('button', { name: /^Summarize$/ }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    resolveRequest(jsonResponse(result));
    await waitFor(() => expect(screen.getByLabelText('Webpage URL')).toBeEnabled());
    expect(screen.queryByText(result.overview)).not.toBeInTheDocument();
  });
});
