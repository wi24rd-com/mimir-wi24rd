import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyRepo, emptyState, mergeDaily, mergeDownloads, setMeta, setSnapshot, totalDownloads, totalStars } from '../src/lib/merge.mjs';

test('daily figures: a later, higher count replaces a partial day; a lower one never does', () => {
  const t = {};
  mergeDaily(t, [{ timestamp: '2026-11-20T00:00:00Z', count: 3, uniques: 2 }]);
  mergeDaily(t, [{ timestamp: '2026-11-20T00:00:00Z', count: 9, uniques: 5 }]);
  mergeDaily(t, [{ timestamp: '2026-11-20T00:00:00Z', count: 4, uniques: 4 }]);
  assert.deepEqual(t, { '2026-11-20': { count: 9, uniques: 5 } });
});

test('daily figures: running the same answer twice changes nothing', () => {
  const entries = [{ timestamp: '2026-11-19T00:00:00Z', count: 2, uniques: 1 }, { timestamp: '2026-11-20T00:00:00Z', count: 7, uniques: 3 }];
  const once = mergeDaily({}, entries);
  const twice = mergeDaily(mergeDaily({}, entries), entries);
  assert.deepEqual(once, twice);
});

test('daily figures: days that fell out of the 14-day window are kept', () => {
  const t = { '2026-10-01': { count: 5, uniques: 5 } };
  mergeDaily(t, [{ timestamp: '2026-11-20T00:00:00Z', count: 1, uniques: 1 }]);
  assert.equal(Object.keys(t).length, 2);
  assert.deepEqual(t['2026-10-01'], { count: 5, uniques: 5 });
});

test('daily figures: malformed entries are ignored', () => {
  const t = mergeDaily({}, [{ timestamp: 'garbage', count: 1 }, null, { timestamp: '2026-11-20T00:00:00Z', count: -4, uniques: 'x' }]);
  assert.deepEqual(t, { '2026-11-20': { count: 0, uniques: 0 } });
});

test('downloads: a point is added only when the counter changed', () => {
  const rel = (n) => [{ tag_name: 'v1.0.0', assets: [{ name: 'app.zip', download_count: n }] }];
  const t = {};
  mergeDownloads(t, '2026-11-18', rel(4));
  mergeDownloads(t, '2026-11-19', rel(4));
  mergeDownloads(t, '2026-11-20', rel(6));
  mergeDownloads(t, '2026-11-20', rel(7));
  assert.deepEqual(t, { 'v1.0.0/app.zip': [['2026-11-18', 4], ['2026-11-20', 7]] });
});

test('downloads: draft releases are left out', () => {
  const t = mergeDownloads({}, '2026-11-20', [{ tag_name: 'v2', draft: true, assets: [{ name: 'a', download_count: 1 }] }]);
  assert.deepEqual(t, {});
});

test('snapshots: top lists are stored per collection day and capped at ten', () => {
  const list = Array.from({ length: 12 }, (_, i) => ({ referrer: `r${i}`, count: i, uniques: i }));
  const t = setSnapshot({}, '2026-11-20', list, 'referrer');
  assert.equal(t['2026-11-20'].length, 10);
  assert.deepEqual(t['2026-11-20'][1], { referrer: 'r1', count: 1, uniques: 1 });
});

test('meta: unchanged figures do not add a new day', () => {
  const t = {};
  setMeta(t, '2026-11-19', { stargazers_count: 1, forks_count: 0, subscribers_count: 0 });
  setMeta(t, '2026-11-20', { stargazers_count: 1, forks_count: 0, subscribers_count: 0 });
  setMeta(t, '2026-11-21', { stargazers_count: 2, forks_count: 0, subscribers_count: 0 });
  assert.deepEqual(Object.keys(t), ['2026-11-19', '2026-11-21']);
});

test('totals: latest download counters and latest stars are summed across repos', () => {
  const s = emptyState();
  s.repos['o/a'] = emptyRepo();
  s.repos['o/b'] = emptyRepo();
  s.repos['o/a'].downloads = { 'v1/x': [['2026-11-18', 4], ['2026-11-20', 6]], 'v1/y': [['2026-11-18', 1]] };
  s.repos['o/b'].downloads = { 'v1/z': [['2026-11-18', 3]] };
  s.repos['o/a'].meta = { '2026-11-18': { stars: 2, forks: 0, watchers: 0 } };
  s.repos['o/b'].meta = { '2026-11-18': { stars: 1, forks: 0, watchers: 0 }, '2026-11-20': { stars: 5, forks: 0, watchers: 0 } };
  assert.equal(totalDownloads(s), 10);
  assert.equal(totalStars(s), 7);
});
