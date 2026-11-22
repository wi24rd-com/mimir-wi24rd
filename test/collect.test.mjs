import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collect, writeBadges } from '../src/collect.mjs';
import { validateConfig } from '../src/config.mjs';
import { emptyState } from '../src/lib/merge.mjs';

const config = validateConfig({ version: 1, visibility: 'public', repos: ['o/a'], public_badges: ['total_downloads'] });
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers });

function api({ trafficStatus = 200, installed = ['O/A'] } = {}) {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, auth: init.headers.authorization });
    const p = new URL(url).pathname;
    if (p === '/installation/repositories') return installed === null ? json({ message: 'Forbidden' }, 403) : json({ total_count: installed.length, repositories: installed.map((full_name) => ({ full_name })) });
    if (p === '/repos/o/a') return json({ stargazers_count: 3, forks_count: 1, subscribers_count: 2 });
    if (p === '/repos/o/a/releases') return json([{ tag_name: 'v1', assets: [{ name: 'a.zip', download_count: 5 }] }]);
    if (trafficStatus !== 200) return json({ message: 'Resource not accessible by integration' }, trafficStatus);
    if (p.endsWith('/traffic/views')) return json({ count: 9, uniques: 4, views: [{ timestamp: '2026-11-20T00:00:00Z', count: 9, uniques: 4 }] });
    if (p.endsWith('/traffic/clones')) return json({ count: 2, uniques: 1, clones: [{ timestamp: '2026-11-20T00:00:00Z', count: 2, uniques: 1 }] });
    if (p.endsWith('/popular/referrers')) return json([{ referrer: 'news.ycombinator.com', count: 7, uniques: 6 }]);
    if (p.endsWith('/popular/paths')) return json([{ path: '/o/a', title: 'a', count: 8, uniques: 3 }]);
    return json({ message: 'Not Found' }, 404);
  };
  return { fetchImpl, seen };
}

const now = new Date('2026-11-21T03:17:00Z');

test('a full run fills every section and sends the token only as a header', async () => {
  const { fetchImpl, seen } = api();
  const { state, raw, errors } = await collect({ config, state: emptyState(), token: 'T0KEN', now, http: { fetchImpl, backoffMs: 1 } });
  const r = state.repos['o/a'];
  assert.equal(errors.length, 0);
  assert.deepEqual(r.views, { '2026-11-20': { count: 9, uniques: 4 } });
  assert.deepEqual(r.clones, { '2026-11-20': { count: 2, uniques: 1 } });
  assert.deepEqual(r.referrers['2026-11-21'], [{ referrer: 'news.ycombinator.com', count: 7, uniques: 6 }]);
  assert.deepEqual(r.downloads, { 'v1/a.zip': [['2026-11-21', 5]] });
  assert.deepEqual(r.meta['2026-11-21'], { stars: 3, forks: 1, watchers: 2 });
  assert.equal(seen.length, 7);
  assert.ok(seen.every((s) => s.auth === 'Bearer T0KEN' && !s.url.includes('T0KEN')));
  assert.ok(!JSON.stringify({ state, raw }).includes('T0KEN'));
  assert.deepEqual(Object.keys(raw['o/a']).sort(), ['clones', 'paths', 'referrers', 'views']);
});

test('when traffic is refused, downloads are still kept and each failure is reported', async () => {
  const { fetchImpl } = api({ trafficStatus: 403 });
  const { state, errors } = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl, backoffMs: 1 } });
  assert.deepEqual(errors.map((e) => e.what), ['views', 'clones', 'referrers', 'paths']);
  assert.deepEqual((await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl, backoffMs: 1 } })).counts, { attempted: 6, succeeded: 2, skipped: 0 });
  assert.ok(errors.every((e) => e.status === 403));
  assert.deepEqual(state.repos['o/a'].downloads, { 'v1/a.zip': [['2026-11-21', 5]] });
  assert.equal(state.repos['o/a'].last_success.views, undefined);
  assert.equal(state.health.last_errors.length, 4);
});

test('a failed run does not erase figures collected earlier', async () => {
  const first = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl: api().fetchImpl, backoffMs: 1 } });
  const later = new Date('2026-11-22T03:17:00Z');
  const second = await collect({ config, state: first.state, token: 'T', now: later, http: { fetchImpl: api({ trafficStatus: 403 }).fetchImpl, backoffMs: 1 } });
  assert.deepEqual(second.state.repos['o/a'].views, { '2026-11-20': { count: 9, uniques: 4 } });
  assert.equal(second.state.repos['o/a'].last_success.views, '2026-11-21');
  assert.equal(second.state.health.runs, 2);
});

test('server errors are retried; a later success counts', async () => {
  let calls = 0;
  const inner = api().fetchImpl;
  const flaky = async (url, init) => (++calls <= 2 ? json({ message: 'boom' }, 502) : inner(url, init));
  const { errors } = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl: flaky, backoffMs: 1 } });
  assert.equal(errors.length, 0);
  assert.equal(calls, 9);
});

test('only the figures the owner listed are written, and dropped ones are removed', async () => {
  const d = mkdtempSync(join(tmpdir(), 'mimir-badges-'));
  const { state } = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl: api().fetchImpl, backoffMs: 1 } });
  writeBadges(d, config, state, '2026-11-21');
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'badges', 'total_downloads.json'), 'utf8')), { schemaVersion: 1, label: 'downloads', message: '5', color: '007864' });
  assert.ok(!existsSync(join(d, 'badges', 'stars.json')));
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'public.json'), 'utf8')), { mimir: 1, day: '2026-11-21', figures: [{ id: 'total_downloads', value: 5 }] });

  const more = validateConfig({ version: 1, visibility: 'encrypted', repos: ['o/a'], public_badges: ['stars', 'repo_downloads'] });
  writeBadges(d, more, state, '2026-11-22');
  assert.ok(!existsSync(join(d, 'badges', 'total_downloads.json')), 'a figure that is no longer chosen is removed');
  assert.equal(JSON.parse(readFileSync(join(d, 'badges', 'stars.json'), 'utf8')).message, '3');
  assert.equal(JSON.parse(readFileSync(join(d, 'badges', 'downloads-a.json'), 'utf8')).message, '5');
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'public.json'), 'utf8')).figures, [{ id: 'stars', value: 3 }, { id: 'repo_downloads', repo: 'o/a', value: 5 }]);

  const withWell = validateConfig({ version: 1, visibility: 'encrypted', repos: ['o/a'], public_badges: ['well'] });
  writeBadges(d, withWell, state, '2026-11-21');
  const published = JSON.parse(readFileSync(join(d, 'public.json'), 'utf8'));
  assert.deepEqual(published.figures, []);
  assert.deepEqual(published.well.repos, [{ name: 'o/a', views: 9, clones: 2, downloads: 0 }]);
  assert.equal(published.well.daily.at(-2).views, 9, 'the day before the collection');
  assert.ok(!existsSync(join(d, 'badges', 'stars.json')), 'choosing the Well writes no badge');

  const none = validateConfig({ version: 1, visibility: 'encrypted', repos: ['o/a'] });
  writeBadges(d, none, state, '2026-11-23');
  assert.ok(!existsSync(join(d, 'badges', 'stars.json')));
  assert.deepEqual(JSON.parse(readFileSync(join(d, 'public.json'), 'utf8')), { mimir: 1, day: '2026-11-23', figures: [] }, 'and the Well is gone again');
  const text = readFileSync(join(d, 'public.json'), 'utf8');
  assert.ok(!/views|clones|referrer/.test(text), 'nothing but the chosen figures');
});

test('a repo the app is not installed on is named, and its traffic is not requested', async () => {
  const { fetchImpl, seen } = api({ installed: ['o/other'] });
  const { state, errors, counts } = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl, backoffMs: 1 } });
  assert.deepEqual(errors, [{ repo: 'o/a', what: 'access', status: 0, error: 'the app is not installed on this repository' }]);
  assert.deepEqual(counts, { attempted: 2, succeeded: 2, skipped: 4 });
  assert.ok(!seen.some((s) => s.url.includes('/traffic/')));
  assert.deepEqual(state.repos['o/a'].downloads, { 'v1/a.zip': [['2026-11-21', 5]] });
});

test('when the installation list cannot be read, every repo is still tried', async () => {
  const { fetchImpl } = api({ installed: null });
  const { errors, state } = await collect({ config, state: emptyState(), token: 'T', now, http: { fetchImpl, backoffMs: 1 } });
  assert.equal(errors.length, 0);
  assert.deepEqual(state.repos['o/a'].views, { '2026-11-20': { count: 9, uniques: 4 } });
});
