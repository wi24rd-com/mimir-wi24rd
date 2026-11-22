import test from 'node:test';
import assert from 'node:assert/strict';
import { keyFromSecret, seal, unseal } from '../docs/lib/remember.js';

const secret = Uint8Array.from({ length: 32 }, (_, i) => i + 1);

test('a passphrase sealed under a passkey secret opens with the same secret only', async () => {
  const sealed = await seal(await keyFromSecret(secret), 'abcde-fghjk-mnpqr-stuvw-xyz234');
  assert.equal(await unseal(await keyFromSecret(secret), sealed), 'abcde-fghjk-mnpqr-stuvw-xyz234');
  const other = Uint8Array.from(secret); other[0] ^= 1;
  await assert.rejects(async () => unseal(await keyFromSecret(other), sealed));
});

test('what is stored does not contain the passphrase, and changes every time', async () => {
  const key = await keyFromSecret(secret);
  const a = await seal(key, 'abcde-fghjk-mnpqr-stuvw-xyz234');
  const b = await seal(key, 'abcde-fghjk-mnpqr-stuvw-xyz234');
  assert.equal(a.iv.length, 12);
  assert.notDeepEqual(a.iv, b.iv);
  assert.notDeepEqual(a.ct, b.ct);
  assert.ok(!Buffer.from(a.ct).toString('latin1').includes('abcde'));
});

test('a changed stored value is refused', async () => {
  const key = await keyFromSecret(secret);
  const sealed = await seal(key, 'abcde-fghjk-mnpqr-stuvw-xyz234');
  sealed.ct[3] ^= 1;
  await assert.rejects(() => unseal(key, sealed));
});

test('the key cannot be read back out', async () => {
  const key = await keyFromSecret(secret);
  assert.equal(key.extractable, false);
  await assert.rejects(() => crypto.subtle.exportKey('raw', key));
});
