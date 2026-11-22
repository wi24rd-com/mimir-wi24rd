import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.mjs';

const ok = { version: 1, visibility: 'encrypted', repos: ['wi24rd-com/grimnir', 'wi24rd-com/Wi24rd-FTP'] };

test('a valid config yields the owner and defaults', () => {
  const c = validateConfig(ok);
  assert.equal(c.owner, 'wi24rd-com');
  assert.deepEqual(c.public_badges, []);
});

for (const [name, bad, msg] of [
  ['unknown visibility', { ...ok, visibility: 'secret' }, /visibility/],
  ['no repos', { ...ok, repos: [] }, /at least one/],
  ['repo without owner', { ...ok, repos: ['grimnir'] }, /not a valid/],
  ['shell characters in a repo name', { ...ok, repos: ['wi24rd-com/x;rm -rf'] }, /not a valid/],
  ['path traversal in a repo name', { ...ok, repos: ['../etc/passwd'] }, /not a valid/],
  ['duplicate repo', { ...ok, repos: ['wi24rd-com/grimnir', 'Wi24rd-com/Grimnir'] }, /twice/],
  ['two owners', { ...ok, repos: ['a/x', 'b/y'] }, /same owner/],
  ['unknown badge', { ...ok, public_badges: ['views'] }, /unknown badge/],
  ['wrong version', { ...ok, version: 2 }, /version/],
]) {
  test(`rejected: ${name}`, () => assert.throws(() => validateConfig(bad), msg));
}

test('the mimir.json that ships with Mimir is the example, and setup asks instead of using it', async (t) => {
  const { readFileSync } = await import('node:fs');
  const { EXAMPLE_REPO } = await import('../src/config.mjs');
  const shipped = validateConfig(JSON.parse(readFileSync(new URL('../mimir.json', import.meta.url), 'utf8')));
  // In your own copy mimir.json holds your repositories, and this check does not apply.
  if (!shipped.repos.includes(EXAMPLE_REPO)) { t.skip('this copy has its own mimir.json'); return; }
  assert.deepEqual(shipped.repos, [EXAMPLE_REPO]);
  assert.equal(shipped.visibility, 'encrypted');
  assert.deepEqual(shipped.public_badges, []);
  const { needsGuide } = await import('../src/guide.mjs');
  assert.equal(needsGuide(JSON.parse(readFileSync(new URL('../mimir.json', import.meta.url), 'utf8'))), true);
  assert.match(readFileSync(new URL('../src/setup.mjs', import.meta.url), 'utf8'), /needsGuide\(shipped\)/);
});
