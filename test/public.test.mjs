import test from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig } from '../src/config.mjs';
import { demoState } from '../src/lib/demo.mjs';
import { totalDownloads, totalStars } from '../src/lib/merge.mjs';
import { badgeCode, badgeList, pagesUrl, publicFigures } from '../docs/lib/public.js';

const state = demoState();
const repos = Object.keys(state.repos);
const cfg = (public_badges) => validateConfig({ version: 1, visibility: 'encrypted', repos, public_badges });

test('nothing is public unless it is chosen', () => {
  assert.deepEqual(publicFigures(cfg([]), state), []);
  assert.deepEqual(badgeList(validateConfig({ version: 1, visibility: 'encrypted', repos })), []);
});

test('the totals agree with the collector, and there is one figure per repository', () => {
  const figures = publicFigures(cfg(['total_downloads', 'stars', 'repo_downloads']), state);
  assert.equal(figures.find((f) => f.id === 'total_downloads').value, totalDownloads(state));
  assert.equal(figures.find((f) => f.id === 'stars').value, totalStars(state));
  const perRepo = figures.filter((f) => f.id === 'repo_downloads');
  assert.deepEqual(perRepo.map((f) => f.repo), repos);
  assert.equal(perRepo.reduce((n, f) => n + f.value, 0), totalDownloads(state));
  assert.equal(new Set(figures.map((f) => f.file)).size, figures.length, 'every figure has its own file');
});

test('a repository is found whatever case mimir.json uses', () => {
  const upper = validateConfig({ version: 1, visibility: 'encrypted', repos: repos.map((r) => r.toUpperCase()), public_badges: ['repo_downloads'] });
  assert.equal(publicFigures(upper, state).reduce((n, f) => n + f.value, 0), totalDownloads(state));
  assert.ok(badgeList(upper).every((b) => b.file === b.file.toLowerCase()));
});

test('the badge code points at the data branch and is safe to paste', () => {
  const [badge] = badgeList(cfg(['total_downloads']));
  const code = badgeCode('Octo-Cat/Mimir', badge);
  assert.equal(code.json, 'https://raw.githubusercontent.com/Octo-Cat/Mimir/data/badges/total_downloads.json');
  assert.equal(code.markdown, '![Downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FOcto-Cat%2FMimir%2Fdata%2Fbadges%2Ftotal_downloads.json)');
  assert.ok(code.html.startsWith('<img alt="Downloads" src="https://img.shields.io/endpoint?url='));
  assert.ok(!/[<>"']/.test(code.image));
  assert.equal(pagesUrl('Octo-Cat/Mimir'), 'https://octo-cat.github.io/Mimir/');
});

test('the Well is published only when chosen, and holds nothing but what it is drawn from', async () => {
  const { publicWell, WELL_DAYS } = await import('../docs/lib/public.js');
  const { summarize } = await import('../docs/lib/summary.js');
  assert.equal(publicWell(cfg(['total_downloads', 'stars', 'repo_downloads']), state), null);
  const well = publicWell(cfg(['well']), state);
  assert.deepEqual(Object.keys(well), ['days', 'daily', 'repos']);
  assert.equal(well.days, WELL_DAYS);
  assert.equal(well.daily.length, WELL_DAYS);
  for (const p of well.daily) assert.deepEqual(Object.keys(p), ['day', 'views']);
  for (const r of well.repos) assert.deepEqual(Object.keys(r), ['name', 'views', 'clones', 'downloads']);
  const all = summarize(state, { days: WELL_DAYS });
  assert.equal(well.daily.reduce((n, p) => n + (p.views ?? 0), 0), all.totals.views, 'the days add up to the total the dashboard shows');
  assert.deepEqual(well.repos.map((r) => [r.name, r.views, r.clones, r.downloads]), all.repos.map((r) => [r.name, r.views, r.clones, r.downloadsGained]));
  assert.ok(!/uniques|referr|path|stars/.test(JSON.stringify(well)), 'no visitors, referrers, pages or stars');
});

test('the published Well covers only the repositories in mimir.json', async () => {
  const { publicWell } = await import('../docs/lib/public.js');
  const one = validateConfig({ version: 1, visibility: 'encrypted', repos: [repos[0]], public_badges: ['well'] });
  assert.deepEqual(publicWell(one, state).repos.map((r) => r.name), [repos[0]]);
  assert.deepEqual(badgeList(one), [], 'the Well has no badge');
});
