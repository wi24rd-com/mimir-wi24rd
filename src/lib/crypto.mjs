// Encryption for the "encrypted" mode.
// PBKDF2-SHA256 -> AES-256-GCM, written so a browser can open it with WebCrypto:
// the ciphertext is followed by the 16-byte tag, exactly as SubtleCrypto expects.
// The data is gzip-compressed before it is encrypted.
import { pbkdf2Sync, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSPHRASE = 20;

function key(passphrase, salt, iterations) {
  return pbkdf2Sync(Buffer.from(passphrase, 'utf8'), salt, iterations, 32, 'sha256');
}

export function encryptJson(value, passphrase, { iterations = KDF_ITERATIONS } = {}) {
  if (typeof passphrase !== 'string' || passphrase.length < MIN_PASSPHRASE) {
    throw new Error(`passphrase must be at least ${MIN_PASSPHRASE} characters`);
  }
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(passphrase, salt, iterations), iv);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(value), 'utf8'))), cipher.final(), cipher.getAuthTag()]);
  return {
    mimir: 1,
    kdf: 'PBKDF2-SHA256',
    iter: iterations,
    cipher: 'AES-256-GCM',
    z: 'gzip',
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    ct: body.toString('base64'),
  };
}

export function decryptJson(envelope, passphrase) {
  const e = envelope;
  if (!e || e.mimir !== 1 || e.kdf !== 'PBKDF2-SHA256' || e.cipher !== 'AES-256-GCM' || e.z !== 'gzip') {
    throw new Error('not a Mimir encrypted file, or a newer format');
  }
  if (!Number.isInteger(e.iter) || e.iter < 100_000 || e.iter > 10_000_000) throw new Error('unexpected key-derivation setting');
  const body = Buffer.from(e.ct, 'base64');
  if (body.length < 17) throw new Error('encrypted file is too short');
  const decipher = createDecipheriv('aes-256-gcm', key(passphrase, Buffer.from(e.salt, 'base64'), e.iter), Buffer.from(e.iv, 'base64'));
  decipher.setAuthTag(body.subarray(body.length - 16));
  let plain;
  try {
    plain = Buffer.concat([decipher.update(body.subarray(0, body.length - 16)), decipher.final()]);
  } catch {
    throw new Error('wrong passphrase, or the file has been changed');
  }
  return JSON.parse(gunzipSync(plain).toString('utf8'));
}

// 26 characters from an alphabet without look-alikes: about 128 bits.
export function generatePassphrase() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  const out = [];
  while (out.length < 26) {
    for (const b of randomBytes(64)) {
      if (b < 248 && out.length < 26) out.push(alphabet[b % 31]);
    }
  }
  const s = out.join('');
  return `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10, 15)}-${s.slice(15, 20)}-${s.slice(20)}`;
}
