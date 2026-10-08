import dns from 'node:dns/promises';
import net from 'node:net';
import ipaddr from 'ipaddr.js';
import { AppError } from '../utils/errors.js';
import { networkDiagnostics, withDiagnostics } from '../utils/diagnostics.js';

const blocked = () => new AppError(400, 'UNSAFE_URL', 'Use a public webpage URL. Local and private network addresses are not allowed.');

export function isPublicAddress(address) {
  try {
    const ip = ipaddr.process(address);
    // Azure's platform/metadata wire-server address is globally numbered.
    if (ip.toString() === '168.63.129.16') return false;
    return ip.range() === 'unicast' && (ip.kind() !== 'ipv6' || ip.match(ipaddr.parse('2000::'), 3));
  } catch {
    return false;
  }
}

export function validateUrl(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 2048) {
    throw new AppError(400, 'INVALID_URL', 'Enter a valid webpage URL starting with https:// or http:// (up to 2,048 characters).');
  }
  let url;
  try { url = new URL(value.trim()); } catch {
    throw new AppError(400, 'INVALID_URL', 'Enter a complete webpage URL, such as https://example.com/article.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new AppError(400, 'INVALID_URL', 'Use an HTTP or HTTPS URL without credentials and with a standard web port.');
  }
  const host = url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (!host.includes('.') && !net.isIP(host)) throw blocked();
  if (['localhost', 'local', 'internal', 'lan', 'home', 'test', 'invalid'].some(suffix => host === suffix || host.endsWith(`.${suffix}`)) || host === 'metadata.google.internal') throw blocked();
  if (net.isIP(host) && !isPublicAddress(host)) throw blocked();
  url.hash = '';
  return url;
}

export async function resolvePublicHost(url, resolver = dns.lookup) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return [{ address: host, family: net.isIP(host) }];
  let timer;
  try {
    const addresses = await Promise.race([
      resolver(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new AppError(504, 'PAGE_TIMEOUT', 'The website took too long to respond. Try again later.')), 5000); }),
    ]);
    if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw blocked();
    return addresses;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw withDiagnostics(new AppError(502, 'PAGE_UNREACHABLE', 'This website could not be reached. Check the URL and try another public page.'), networkDiagnostics(error));
  } finally { clearTimeout(timer); }
}

// Axios connects to these exact validated DNS answers, avoiding a second DNS lookup.
export function pinnedLookup(addresses) {
  return (_host, options, callback) => {
    if (typeof options === 'function') { callback = options; options = {}; }
    const family = typeof options === 'number' ? options : options.family;
    const candidates = family ? addresses.filter(item => item.family === family) : addresses;
    if (!candidates.length) return callback(new Error('No validated address for this IP family'));
    if (options.all) return callback(null, candidates);
    callback(null, candidates[0].address, candidates[0].family);
  };
}
