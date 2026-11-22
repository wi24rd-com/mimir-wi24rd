import test from 'node:test';
import assert from 'node:assert/strict';
import { combineSeries, dayRange, mergeReferrers, repoSummary, summarize } from '../docs/lib/summary.js';
import { TEXT } from '../docs/lib/i18n.js';
import { emptyRepo, emptyState } from '../src/lib/merge.mjs';
import { demoState } from '../src/lib/demo.mjs';

const now = new Date('2026-11-21T12:00:00Z');
function repo() {
  const r = emptyRepo();
  r.views = { '2026-11-01': { count: 100, uniques: 50 }, '2026-11-19': { count: 7, uniques: 3 }, '2026-11-21': { count: 5, uniques: 2 } };
  r.clones = { '2026-11-21': { count: 1, uniques: 1 } };
  r.downloads = { 'v1/app.zip': [['2026-10-01', 10], ['2026-11-10', 14], ['2026-11-20', 20]], 'v2/new.zip': [['2026-11-18', 3], ['2026-11-21', 9]] };
  r.meta = { '2026-11-01': { stars: 4, forks: 0, watchers: 1 }, '2026-11-20': { stars: 6, forks: 1, watchers: 1 } };
  r.referrers = { '2026-11-20': [{ referrer: 'Google', count: 9, uniques: 4 }] };
  return r;
}

test('only days inside the period are summed', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  assert.equal(s.views, 12);
  assert.equal(repoSummary(repo(), { today: '2026-11-21', days: null }).views, 112);
});

test('the series has one entry per day and marks days without a figure', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  assert.equal(s.viewSeries.length, 14);
  assert.deepEqual(s.viewSeries[0], { day: '2026-11-08', count: 0, uniques: 0, known: false });
  assert.deepEqual(s.viewSeries[13], { day: '2026-11-21', count: 5, uniques: 2, known: true });
});

test('download growth is measured from the counter just before the period', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  const app = s.files.find((f) => f.name === 'app.zip');
  assert.deepEqual({ total: app.total, gained: app.gained, partial: app.partial }, { total: 20, gained: 10, partial: false });
});

test('a file first seen inside the period is counted from that first sighting, and says so', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  const fresh = s.files.find((f) => f.name === 'new.zip');
  assert.deepEqual({ total: fresh.total, gained: fresh.gained, partial: fresh.partial }, { total: 9, gained: 6, partial: true });
  assert.equal(s.downloads, 29);
  assert.equal(s.downloadsGained, 16);
});

test('stars and referrers come from the latest snapshot', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  assert.equal(s.stars, 6);
  assert.equal(s.referrersDay, '2026-11-20');
});

test('dayRange includes both ends', () => {
  assert.deepEqual(dayRange('2026-02-27', '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
});

test('health: fresh within 36 hours, stopped after', () => {
  const state = emptyState();
  state.health.last_run = '2026-11-21T03:17:00Z';
  assert.equal(summarize(state, { now }).health.stale, false);
  state.health.last_run = '2026-11-19T03:17:00Z';
  const h = summarize(state, { now }).health;
  assert.equal(h.stale, true);
  assert.equal(Math.round(h.ageHours), 57);
  assert.equal(summarize(emptyState(), { now }).health.stale, true);
});

test('the summary sentences name the busiest repo, the top source and the top file in both languages', () => {
  const s = summarize(demoState(now), { now, days: 14 });
  for (const lang of ['en', 'da']) {
    const text = TEXT[lang].headline(s).join(' ');
    assert.ok(text.includes('lantern'), lang);
    assert.ok(text.includes('news.ycombinator.com'), lang);
    assert.ok(text.includes(s.topFile.name), lang);
  }
  const empty = summarize(emptyState(), { now, days: 14 });
  assert.equal(TEXT.en.headline(empty).length, 2);
});

test('demo figures are the same on every run and counters never go down', () => {
  assert.deepEqual(demoState(now), demoState(now));
  for (const r of Object.values(demoState(now).repos)) {
    for (const series of Object.values(r.downloads)) {
      for (let i = 1; i < series.length; i++) assert.ok(series[i][1] >= series[i - 1][1] && series[i][0] > series[i - 1][0]);
    }
  }
});

test('English and Danish have exactly the same entries', () => {
  assert.deepEqual(Object.keys(TEXT.en).sort(), Object.keys(TEXT.da).sort());
  for (const k of Object.keys(TEXT.en)) assert.equal(typeof TEXT.en[k], typeof TEXT.da[k], k);
});

test('the busiest single day is reported for unique visitors', () => {
  const s = repoSummary(repo(), { today: '2026-11-21', days: 14 });
  assert.equal(s.viewUniquesPeak, 3);
  assert.equal(repoSummary(repo(), { today: '2026-11-21', days: null }).viewUniquesPeak, 50);
});

test('when every file was first seen inside the period, the text says since when downloads are counted', () => {
  const state = emptyState();
  const r = (state.repos['o/a'] = emptyRepo());
  r.downloads = { 'v1/a.zip': [['2026-11-21', 6]], 'v1/b.zip': [['2026-11-21', 4]] };
  const s = summarize(state, { now, days: 14 });
  assert.equal(s.countingSince, '2026-11-21');
  assert.match(TEXT.en.headline(s).join(' '), /10 times in total\. Mimir has counted them since 2026-11-21/);
  assert.match(TEXT.da.headline(s).join(' '), /10 gange i alt\. Mimir har talt dem siden 2026-11-21/);
  assert.equal(summarize(demoState(now), { now, days: 14 }).countingSince, null);
  assert.equal(summarize(state, { now, days: null }).countingSince, null);
});

test('the kit\'s language engine gets the same plain texts in both languages', async () => {
  const { plainTexts } = await import('../docs/lib/i18n.js');
  assert.deepEqual(Object.keys(plainTexts('en')).sort(), Object.keys(plainTexts('da')).sort());
  assert.ok(Object.values(plainTexts('en')).every((v) => typeof v === 'string' && v.length > 0));
  for (const key of ['docTitle', 'overview', 'refresh', 'range14', 'passphrase', 'unlock', 'settings', 'repository', 'tableScroll']) assert.ok(key in plainTexts('en'), key);
});

test('several repositories: counts are added per day, unique visitors are left out', () => {
  const a = [{ day: '2026-11-20', count: 3, uniques: 2, known: true }, { day: '2026-11-21', count: 5, uniques: 4, known: true }];
  const b = [{ day: '2026-11-19', count: 1, uniques: 1, known: true }, { day: '2026-11-20', count: 0, uniques: 0, known: false }, { day: '2026-11-21', count: 2, uniques: 2, known: true }];
  assert.deepEqual(combineSeries([a, b]), [
    { day: '2026-11-19', count: 1, uniques: null, known: true },
    { day: '2026-11-20', count: 3, uniques: null, known: true },
    { day: '2026-11-21', count: 7, uniques: null, known: true },
  ]);
  assert.deepEqual(combineSeries([]), []);
});

test('referrers across repositories are added and sorted, most visits first', () => {
  const s = summarize(demoState(now), { now, days: 14 });
  const merged = mergeReferrers(s.repos);
  assert.deepEqual(merged[0], { referrer: 'news.ycombinator.com', count: 388 });
  assert.equal(merged.find((x) => x.referrer === 'github.com').count, 141 + 31 + 12);
  for (let i = 1; i < merged.length; i++) assert.ok(merged[i - 1].count >= merged[i].count);
});

test('the version shown in the footer is the one in package.json', async () => {
  const { VERSION } = await import('../docs/lib/version.js');
  const { readFileSync } = await import('node:fs');
  assert.equal(VERSION, JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version);
});
