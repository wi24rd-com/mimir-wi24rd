import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Wi24rd UI Kit 2 is copied into docs/kit/ unchanged. Its own rule is "do not
// edit the copies". This list is the SHA-256 of every file at the version in
// docs/kit/VERSION; to upgrade, copy the new package and replace the list.
const KIT = fileURLToPath(new URL('../docs/kit', import.meta.url));
const FILES = [
  ['LICENSE', 'cfc7749b96f63bd31c3c42b5c471bf756814053e847c10f3eb003417bc523d30'],
  ['LICENSE.md', 'c2e97926eb9db0536978a08eb14ff963eeb75ce85aeec0074212455140b39612'],
  ['VERSION', 'dceb827995520dae388b7283c5bc7847ef58a16e8013318c3bb436feeb5dc51e'],
  ['fonts/OFL-Inter.txt', '3b0a5fca3d17942cde889069889dedbbbd075e9b599968c82a95f4d944e9b345'],
  ['fonts/OFL-JetBrainsMono.txt', '403581b69dac5cff4079205e01c6b467e56af449ecbd7247693ddb1baafa005b'],
  ['fonts/inter-latin-ext-wght-normal.woff2', '34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956'],
  ['fonts/inter-latin-wght-normal.woff2', '3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62'],
  ['fonts/jetbrains-mono-latin-ext-wght-normal.woff2', '79bfdab9ba467e26eea4122e6f2567e188dd8a09a8c730d501fc487c4ab99c6e'],
  ['fonts/jetbrains-mono-latin-wght-normal.woff2', '18be452724bfdc236c074ca94a249a7f41a86752c7d04ab258ce9ed5651f6a7e'],
  ['kit.css', 'eac798fa9779897130f4144d40b31c6cc26cc3837b074f7c38af2906875c513f'],
  ['kit.js', '15b28a58cdefab1381b07309fc7a86ca3f346920b5b94fa5b77970942196c8be'],
  ['sprogmotor.js', '5dd9bd4353162b88034caa353f1d17aa686e903c13e7e67f7899c103d90ab5f1'],
  ['tema.js', 'bdc0c075c63c88a26cefef2638b3142cf6a64928427c27924602d1f36cb99860'],
  ['tokens.css', '8c9da687ebfedcf1166b88db19463f2415b5654d3fa8e5c4639d47cbb62307dd'],
];

test('the kit copy is version 2.8.0', () => {
  assert.equal(readFileSync(join(KIT, 'VERSION'), 'utf8').trim(), '2.8.0');
});

test('no file in the kit copy has been edited', () => {
  for (const [file, expected] of FILES) {
    assert.equal(createHash('sha256').update(readFileSync(join(KIT, file))).digest('hex'), expected, file);
  }
});

test('the kit copy holds no extra files, and its licences are with it', () => {
  const found = readdirSync(KIT, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).map((e) => join(e.parentPath ?? e.path, e.name).slice(KIT.length + 1).split('\\').join('/')).sort();
  assert.deepEqual(found, FILES.map(([f]) => f).sort());
  for (const needed of ['LICENSE', 'LICENSE.md', 'fonts/OFL-Inter.txt', 'fonts/OFL-JetBrainsMono.txt']) assert.ok(found.includes(needed), needed);
});

test('the page loads the kit before Mimir\'s own files, and nothing from another site', () => {
  const html = readFileSync(fileURLToPath(new URL('../docs/index.html', import.meta.url)), 'utf8');
  const order = ['kit/tokens.css', 'kit/kit.css', 'app.css', 'kit/tema.js', 'kit/sprogmotor.js', 'kit/kit.js', 'app.js'].map((f) => html.indexOf(`"${f}"`));
  assert.ok(order.every((i) => i > 0), 'every file is referenced');
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.ok(!/(?:src|href)="https?:/.test(html));
  assert.match(html, /data-kit-praefiks="mimir"/);
});

test('Mimir\'s own stylesheet uses the kit\'s tokens, never colour codes', () => {
  const css = readFileSync(fileURLToPath(new URL('../docs/app.css', import.meta.url)), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(css.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/g), null);
});

test("every token Mimir's own stylesheet uses exists", async () => {
  const { readFileSync } = await import('node:fs');
  const css = readFileSync(new URL('../docs/app.css', import.meta.url), 'utf8');
  const defined = new Set([...`${readFileSync(new URL('../docs/kit/tokens.css', import.meta.url), 'utf8')}\n${css}`.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  // var(--x, fallback) is left out: those are set from the script, with a default here.
  const missing = [...new Set([...css.matchAll(/var\((--[a-z0-9-]+)\)/g)].map((m) => m[1]))].filter((name) => !defined.has(name));
  assert.deepEqual(missing, []);
});
