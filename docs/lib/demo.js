// Invented figures for three invented repositories. Used by "--demo", by
// "?demo" on GitHub Pages, by the tests and for screenshots, so no real figures
// have to be shown. It runs in Node and in the browser.
import { emptyRepo, emptyState } from './state.js';
import { addDays, isoDay } from './summary.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => { a += 0x6d2b79f5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const REPOS = [
  { name: 'example/lantern', base: 38, spikeDay: 31, files: [['v2.1.0', 'lantern-2.1.0-macos.zip', 61], ['v2.1.0', 'lantern-2.1.0-windows.exe', 118], ['v2.0.0', 'lantern-2.0.0-macos.zip', 402]], stars: 214, refs: [['news.ycombinator.com', 388], ['github.com', 141], ['Google', 96], ['reddit.com', 44]] },
  { name: 'example/quill-notes', base: 11, spikeDay: 70, files: [['v0.9.2', 'quill-0.9.2.zip', 37]], stars: 48, refs: [['Google', 52], ['github.com', 31], ['duckduckgo.com', 9]] },
  { name: 'example/tidepool', base: 4, spikeDay: null, files: [], stars: 6, refs: [['github.com', 12]] },
];

export function demoState(now = new Date(), days = 120) {
  const state = emptyState();
  const today = isoDay(now);
  REPOS.forEach((spec, index) => {
    const rand = rng(1000 + index);
    const repo = (state.repos[spec.name] = emptyRepo());
    // Views and clones per day.
    const spikes = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
      const weekend = weekday === 0 || weekday === 6 ? 0.55 : 1;
      const age = days - 1 - i;
      const spike = spec.spikeDay !== null && age >= spec.spikeDay && age < spec.spikeDay + 5 ? 9 / (1 + (age - spec.spikeDay) * 1.4) : 0;
      spikes.push(spike);
      const views = Math.round(spec.base * weekend * (0.6 + rand() * 0.8) * (1 + spike));
      repo.views[day] = { count: views, uniques: Math.max(views ? 1 : 0, Math.round(views * (0.35 + rand() * 0.2))) };
      const clones = Math.round(views * (0.08 + rand() * 0.1));
      repo.clones[day] = { count: clones, uniques: Math.min(clones, Math.round(clones * 0.7)) };
    }
    // Download counters: daily gains are drawn first, then the starting value
    // is set so each counter ends on its target today.
    for (const [tag, name, target] of spec.files) {
      const gains = spikes.map((spike) => (rand() < 0.35 + spike / 10 ? Math.round(rand() * (2 + spike)) : 0));
      let count = Math.max(0, target - gains.reduce((t, g) => t + g, 0));
      const series = (repo.downloads[`${tag}/${name}`] = []);
      gains.forEach((gain, age) => {
        const next = Math.min(target, count + gain);
        if (age === 0 || next !== count) series.push([addDays(today, -(days - 1 - age)), next]);
        count = next;
      });
      if (count !== target) series.push([today, target]);
    }
    repo.meta[addDays(today, -(days - 1))] = { stars: Math.round(spec.stars * 0.8), forks: Math.round(spec.stars / 12), watchers: Math.round(spec.stars / 20) };
    repo.meta[today] = { stars: spec.stars, forks: Math.round(spec.stars / 10), watchers: Math.round(spec.stars / 18) };
    repo.referrers[today] = spec.refs.map(([referrer, count]) => ({ referrer, count, uniques: Math.round(count * 0.6) }));
    repo.paths[today] = [{ path: `/${spec.name}`, count: spec.base * 9, uniques: spec.base * 5 }];
    repo.last_success = { meta: today, downloads: today, views: today, clones: today, referrers: today, paths: today };
  });
  state.health = { last_run: new Date(now.getTime() - 3 * 3600000).toISOString().slice(0, 19) + 'Z', runs: days * 2, last_errors: [] };
  return state;
}
