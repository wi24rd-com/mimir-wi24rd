import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../src/lib/store.mjs';
import { emptyRepo } from '../src/lib/merge.mjs';

const PASS = 'correct-horse-battery-staple-1';
const dir = () => mkdtempSync(join(tmpdir(), 'mimir-'));

test('public mode: state and raw answers are readable JSON', () => {
  const d = dir();
  const s = openStore(d, { visibility: 'public' });
  const state = s.load();
  state.repos['o/r'] = emptyRepo();
  s.save(state);
  s.saveRaw('2026-11-20', { 'o/r': { views: { count: 1 } } });
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'state.json'), 'utf8')).repos['o/r'], emptyRepo());
  assert.ok(existsSync(join(d, 'raw', '2026-11-20', 'o__r.json')));
  assert.deepEqual(openStore(d, { visibility: 'public' }).load(), state);
});

test('encrypted mode: nothing on disk names the repository', () => {
  const d = dir();
  const s = openStore(d, { visibility: 'encrypted', passphrase: PASS });
  const state = s.load();
  state.repos['wi24rd-com/hidden-project'] = emptyRepo();
  s.save(state);
  s.saveRaw('2026-11-20', { 'wi24rd-com/hidden-project': { views: { count: 1 } } });
  const names = readdirSync(d, { recursive: true }).map(String);
  assert.deepEqual(names.sort(), ['raw', join('raw', '2026-11-20.enc'), 'state.enc'].sort());
  for (const n of ['state.enc', join('raw', '2026-11-20.enc')]) assert.ok(!readFileSync(join(d, n), 'utf8').includes('hidden-project'));
  assert.deepEqual(openStore(d, { visibility: 'encrypted', passphrase: PASS }).load(), state);
});

test('encrypted mode without a passphrase is refused', () => {
  assert.throws(() => openStore(dir(), { visibility: 'encrypted' }), /MIMIR_PASSPHRASE/);
});

test('switching open data to encrypted is refused unless asked for', () => {
  const d = dir();
  const open = openStore(d, { visibility: 'public' });
  open.save(open.load());
  assert.throws(() => openStore(d, { visibility: 'encrypted', passphrase: PASS }).load(), /git history/);
  const conv = openStore(d, { visibility: 'encrypted', passphrase: PASS, migrate: true });
  conv.save(conv.load());
  assert.ok(existsSync(join(d, 'state.enc')) && !existsSync(join(d, 'state.json')));
});

test('switching encrypted data to open is refused unless asked for', () => {
  const d = dir();
  const enc = openStore(d, { visibility: 'encrypted', passphrase: PASS });
  enc.save(enc.load());
  assert.throws(() => openStore(d, { visibility: 'public' }).load(), /publishes everything/);
  assert.throws(() => openStore(d, { visibility: 'public', migrate: true }).load(), /MIMIR_PASSPHRASE/);
  const conv = openStore(d, { visibility: 'public', passphrase: PASS, migrate: true });
  conv.save(conv.load());
  assert.ok(existsSync(join(d, 'state.json')) && !existsSync(join(d, 'state.enc')));
});

test('data from a newer schema is not overwritten', () => {
  const d = dir();
  const s = openStore(d, { visibility: 'public' });
  s.save({ ...s.load(), schema: 2 });
  assert.throws(() => openStore(d, { visibility: 'public' }).load(), /schema 2/);
});
