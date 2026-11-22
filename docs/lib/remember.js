// "Remember on this device": keeps the passphrase in this browser so the
// figures open without typing it. Off unless the owner turns it on.
//
// Why the passphrase and not a key: every collection encrypts with a new random
// salt, so a key derived for one file does not open the next.
//
// Two ways, chosen by the owner:
//   bio   - the passphrase is encrypted under a secret that only a passkey on
//           this device gives out, after Face ID, a fingerprint or the device
//           PIN (the WebAuthn "prf" extension). Without that check, what is
//           stored cannot be opened.
//   plain - the passphrase is encrypted under a key the browser will not hand
//           out. That stops someone reading the browser's storage files, but
//           anyone holding the unlocked device can open the figures.
//
// What is stored belongs to the web address, not to this page: another page on
// the same address (for GitHub Pages, any site of the same account) can reach it.

const DB = 'mimir';
const STORE = 'device';
const INFO = 'Wi24rd Mimir remember v1';
const text = new TextEncoder();

export class BioUnsupported extends Error {}

const random = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n));
// One entry per folder, so two Mimir installations on one address do not collide.
const slot = () => globalThis.location.pathname.replace(/[^/]*$/, '');
const isAddress = (host) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':');

// ---- the cryptography (pure, tested in Node) ----
export async function keyFromSecret(secret) {
  const subtle = globalThis.crypto.subtle;
  const base = await subtle.importKey('raw', secret, 'HKDF', false, ['deriveKey']);
  return subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: text.encode(INFO) }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key, passphrase) {
  const iv = random(12);
  const ct = new Uint8Array(await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, text.encode(passphrase)));
  return { iv, ct };
}

export async function unseal(key, { iv, ct }) {
  return new TextDecoder().decode(await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

// ---- storage ----
function store(mode) {
  return new Promise((resolve, reject) => {
    const open = globalThis.indexedDB.open(DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => resolve(open.result.transaction(STORE, mode).objectStore(STORE));
  });
}
const done = (request) => new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
const read = async () => (await done((await store('readonly')).get(slot()))) ?? null;
const write = async (record) => { await done((await store('readwrite')).put(record, slot())); };

// ---- what this device can do ----
export async function abilities() {
  const plain = Boolean(globalThis.indexedDB && globalThis.crypto?.subtle);
  let bio = false;
  try {
    const P = globalThis.PublicKeyCredential;
    if (plain && P && !isAddress(globalThis.location.hostname) && (await P.isUserVerifyingPlatformAuthenticatorAvailable())) {
      const caps = P.getClientCapabilities ? await P.getClientCapabilities() : null;
      bio = caps?.['extension:prf'] !== false;
    }
  } catch { bio = false; }
  return { plain, bio };
}

// "bio", "plain" or null.
export async function remembered() {
  try { return (await read())?.kind ?? null; } catch { return null; }
}

export async function forget() {
  try { await done((await store('readwrite')).delete(slot())); } catch { /* nothing stored */ }
}

async function secretFromPasskey(id, salt) {
  const got = await globalThis.navigator.credentials.get({ publicKey: {
    challenge: random(32), rpId: globalThis.location.hostname, userVerification: 'required', timeout: 60000,
    allowCredentials: [{ type: 'public-key', id }], extensions: { prf: { eval: { first: salt } } },
  } });
  const first = got?.getClientExtensionResults().prf?.results?.first;
  if (!first) throw new BioUnsupported('this device did not return a secret for the passkey');
  return new Uint8Array(first);
}

export async function rememberPlain(passphrase) {
  const key = await globalThis.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await write({ kind: 'plain', key, ...(await seal(key, passphrase)) });
}

// Creates a passkey on this device and stores the passphrase under its secret.
// The device asks for Face ID, a fingerprint or its PIN once or twice here.
export async function rememberBio(passphrase, label) {
  const salt = random(32);
  const made = await globalThis.navigator.credentials.create({ publicKey: {
    rp: { name: 'Wi24rd Mimir', id: globalThis.location.hostname },
    user: { id: random(16), name: label, displayName: label },
    challenge: random(32),
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
    timeout: 60000,
    extensions: { prf: { eval: { first: salt } } },
  } });
  const prf = made?.getClientExtensionResults().prf;
  if (!prf?.enabled && !prf?.results?.first) throw new BioUnsupported('the passkey on this device cannot protect a secret');
  const id = new Uint8Array(made.rawId);
  const secret = prf.results?.first ? new Uint8Array(prf.results.first) : await secretFromPasskey(id, salt);
  await write({ kind: 'bio', id, salt, ...(await seal(await keyFromSecret(secret), passphrase)) });
}

// The remembered passphrase. For "bio" the device asks for Face ID, a
// fingerprint or its PIN first. Throws when nothing is stored or the check fails.
export async function recall() {
  const record = await read();
  if (!record) throw new Error('nothing is remembered on this device');
  if (record.kind === 'plain') return unseal(record.key, record);
  return unseal(await keyFromSecret(await secretFromPasskey(record.id, record.salt)), record);
}
