// Opens a Mimir encrypted file with the APIs every current browser has:
// WebCrypto for the key and the decryption, DecompressionStream for gzip.
// Node 20+ has the same APIs, which is how this file is tested.

export class WrongPassphrase extends Error {}

const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export function isEnvelope(x) {
  return Boolean(x) && x.mimir === 1 && typeof x.ct === 'string';
}

export async function openEnvelope(envelope, passphrase) {
  const e = envelope;
  if (!isEnvelope(e) || e.kdf !== 'PBKDF2-SHA256' || e.cipher !== 'AES-256-GCM' || e.z !== 'gzip') {
    throw new Error('not a Mimir encrypted file, or a newer format');
  }
  if (!Number.isInteger(e.iter) || e.iter < 100000 || e.iter > 10000000) throw new Error('unexpected key-derivation setting');
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('this page must be opened over https or from 127.0.0.1 for decryption to work');
  const base = await subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  const key = await subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(e.salt), iterations: e.iter }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  let gz;
  try {
    gz = await subtle.decrypt({ name: 'AES-GCM', iv: bytes(e.iv) }, key, bytes(e.ct));
  } catch {
    throw new WrongPassphrase('wrong passphrase, or the file has been changed');
  }
  const text = await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(text);
}
