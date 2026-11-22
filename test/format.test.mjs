// The promise of version 1: files written by an earlier 1.x version are read by
// every later one, with nothing for the owner to do. The files in
// fixtures/format-1/ were written by Mimir 0.1.0 and must never be regenerated.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collect, writeBadges } from '../src/collect.mjs';
import { validateConfig } from '../src/config.mjs';
import { openStore } from '../src/lib/store.mjs';
import { openEnvelope } from '../docs/lib/open.js';
import { summarize } from '../docs/lib/summary.js';

const dir = fileURLToPath(new URL('./fixtures/format-1/', import.meta.url));
const read = (name) => JSON.parse(readFileSync(join(dir, name), 'utf8'));
const PASS = 'format-1-fixture-not-a-secret';
const now = new Date('2026-11-21T12:00:00Z');

test('format 1: an earlier mimir.json is still valid', () => {
  const config = validateConfig(read('mimir.json'));
  assert.equal(config.visibility, 'encrypted');
  assert.equal(config.repos.length, 3);
  assert.deepEqual(config.public_badges, ['total_downloads', 'stars', 'repo_downloads', 'well']);
});

test('format 1: earlier open figures are read and summarized', () => {
  const folder = mkdtempSync(join(tmpdir(), 'mimir-f1-'));
  cpSync(join(dir, 'state.json'), join(folder, 'state.json'));
  const state = openStore(folder, { visibility: 'public' }).load();
  assert.deepEqual(state, read('state.json'));
  const s = summarize(state, { now, days: 14 });
  assert.equal(s.repos.length, 3);
  assert.equal(s.totals.downloads, 618);
  assert.ok(s.totals.views > 0);
});

test('format 1: earlier encrypted figures open in the collector and in the browser', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'mimir-f1-'));
  cpSync(join(dir, 'state.enc'), join(folder, 'state.enc'));
  const state = openStore(folder, { visibility: 'encrypted', passphrase: PASS }).load();
  assert.deepEqual(state, read('state.json'));
  assert.deepEqual(await openEnvelope(read('state.enc'), PASS), read('state.json'));
});

test('format 1: a collection on top of earlier figures keeps every earlier day', async () => {
  const state = read('state.json');
  const before = JSON.parse(JSON.stringify(state));
  const config = validateConfig({ ...read('mimir.json'), visibility: 'public' });
  // GitHub answers nothing new: every request fails, and what was stored must stay.
  const result = await collect({ config, state, token: undefined, now, http: { retries: 0, backoffMs: 0, fetchImpl: async () => new Response('{}', { status: 500 }) } });
  for (const [name, repo] of Object.entries(before.repos)) {
    assert.deepEqual(result.state.repos[name].views, repo.views);
    assert.deepEqual(result.state.repos[name].downloads, repo.downloads);
  }
});

test('format 1: published figures and badges keep their shape', () => {
  const folder = mkdtempSync(join(tmpdir(), 'mimir-f1-'));
  writeBadges(folder, validateConfig(read('mimir.json')), read('state.json'), '2026-11-21');
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'public.json'), 'utf8')), read('public.json'));
  assert.deepEqual(JSON.parse(readFileSync(join(folder, 'badges', 'total_downloads.json'), 'utf8')), read('badge-total_downloads.json'));
});
