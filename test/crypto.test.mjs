import test from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { decryptJson, encryptJson, generatePassphrase } from '../src/lib/crypto.mjs';

const PASS = 'correct-horse-battery-staple-1';
const FAST = { iterations: 100_000 };

test('round trip returns the same data', () => {
  const data = { repos: { 'o/r': { views: { '2026-11-20': { count: 9, uniques: 5 } } } }, text: 'æøå' };
  assert.deepEqual(decryptJson(encryptJson(data, PASS, FAST), PASS), data);
});

test('the envelope does not contain the data in readable form', () => {
  const text = JSON.stringify(encryptJson({ secretRepoName: 'wi24rd-com/hidden-project' }, PASS, FAST));
  assert.ok(!text.includes('hidden-project'));
  assert.ok(!text.includes('secretRepoName'));
});

test('a wrong passphrase is rejected', () => {
  const env = encryptJson({ a: 1 }, PASS, FAST);
  assert.throws(() => decryptJson(env, PASS + 'x'), /wrong passphrase/);
});

test('a changed file is rejected', () => {
  const env = encryptJson({ a: 1 }, PASS, FAST);
  const bytes = Buffer.from(env.ct, 'base64');
  bytes[0] ^= 1;
  assert.throws(() => decryptJson({ ...env, ct: bytes.toString('base64') }, PASS), /wrong passphrase|changed/);
});

test('a short passphrase is refused', () => {
  assert.throws(() => encryptJson({ a: 1 }, 'short'), /at least 20/);
});

test('two encryptions of the same data differ (fresh salt and nonce)', () => {
  const a = encryptJson({ a: 1 }, PASS, FAST);
  const b = encryptJson({ a: 1 }, PASS, FAST);
  assert.notEqual(a.ct, b.ct);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
});

test('the default setting is 600,000 PBKDF2 rounds', () => {
  assert.equal(encryptJson({ a: 1 }, PASS).iter, 600_000);
});

test('a browser can open it: decrypt with WebCrypto only', async () => {
  const data = { hello: 'dashboard', n: [1, 2, 3] };
  const env = encryptJson(data, PASS, FAST);
  const b64 = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey('raw', new TextEncoder().encode(PASS), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: b64(env.salt), iterations: env.iter }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const plain = await subtle.decrypt({ name: 'AES-GCM', iv: b64(env.iv) }, key, b64(env.ct));
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(plain)).toString('utf8')), data);
});

test('generated passphrases are long, grouped and not repeated', () => {
  const a = generatePassphrase();
  const b = generatePassphrase();
  assert.match(a, /^[a-hjkmnp-z2-9]{5}(-[a-hjkmnp-z2-9]{5}){3}-[a-hjkmnp-z2-9]{6}$/);
  assert.notEqual(a, b);
  assert.doesNotThrow(() => encryptJson({ a: 1 }, a, FAST));
});
