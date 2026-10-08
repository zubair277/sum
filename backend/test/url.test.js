import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateUrl, isPublicAddress, resolvePublicHost, pinnedLookup } from '../src/services/url.js';

test('accepts public HTTP and HTTPS and strips fragments', () => {
  assert.equal(validateUrl(' https://example.com/article#part ').href, 'https://example.com/article');
  assert.equal(validateUrl('http://8.8.8.8').hostname, '8.8.8.8');
  assert.equal(validateUrl('https://[2606:4700:4700::1111]/').protocol, 'https:');
});
test('blocks malformed URLs, credentials, unsupported protocols and ports', () => {
  for (const url of [null, '', {}, 'hello', 'example.com', 'file:///etc/passwd', 'ftp://example.com', 'https://user:secret@example.com', 'https://example.com:8080', 'https://example.com/' + 'a'.repeat(2048)]) {
    assert.throws(() => validateUrl(url), { status: 400 });
  }
});
test('blocks local, metadata, reserved, IPv6 and encoded private hosts', () => {
  for (const host of ['localhost', 'localhost.', 'sub.localhost', 'private.local', 'metadata.google.internal', '127.0.0.1', '127.1', '2130706433', '0x7f000001', '10.0.0.1', '172.16.2.2', '192.168.0.1', '169.254.169.254', '100.100.100.200', '0.0.0.0', '224.0.0.1', '[::1]', '[::]', '[fc00::1]', '[fe80::1]', '[::ffff:127.0.0.1]']) {
    assert.throws(() => validateUrl(`http://${host}/`), { status: 400 }, host);
  }
});
test('public address detection denies mapped private addresses and documentation ranges', () => {
  for (const ip of ['::ffff:192.168.1.1', '168.63.129.16', '::ffff:168.63.129.16', '192.0.2.1', '198.51.100.1', '203.0.113.1', '2001:db8::1', 'not-an-ip']) assert.equal(isPublicAddress(ip), false, ip);
  assert.equal(isPublicAddress('8.8.8.8'), true);
});
test('all DNS answers must be public, including mixed answers', async () => {
  const url = validateUrl('https://example.com');
  await assert.rejects(resolvePublicHost(url, async () => [{ address: '8.8.8.8', family: 4 }, { address: '10.0.0.1', family: 4 }]), { code: 'UNSAFE_URL' });
  await assert.rejects(resolvePublicHost(url, async () => { throw new Error('ENOTFOUND'); }), { status: 502 });
  assert.deepEqual(await resolvePublicHost(url, async () => [{ address: '8.8.8.8', family: 4 }]), [{ address: '8.8.8.8', family: 4 }]);
});
test('lookup pins validated answers and supports Node all-address option', async () => {
  const lookup = pinnedLookup([{ address: '8.8.8.8', family: 4 }]);
  const single = await new Promise((resolve, reject) => lookup('example.com', {}, (error, address, family) => error ? reject(error) : resolve({ address, family })));
  assert.deepEqual(single, { address: '8.8.8.8', family: 4 });
  const all = await new Promise((resolve, reject) => lookup('example.com', { all: true }, (error, addresses) => error ? reject(error) : resolve(addresses)));
  assert.deepEqual(all, [single]);
});
