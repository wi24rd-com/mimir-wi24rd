// The few figures the owner chose to publish. Shared by the collector (which
// writes them), the front page (which shows them) and the settings dialog
// (which gives the badge code to copy). Nothing here reads anything the owner
// did not list in "public_badges".

import { combineSeries, summarize } from './summary.js';

// The kit's accent in the light theme: white text on it reads well.
export const BADGE_COLOR = '007864';

const slug = (repo) => repo.split('/')[1].toLowerCase().replace(/[^a-z0-9._-]/g, '-');

// One entry per file on the data branch: { id, repo?, file, label }.
export function badgeList(config) {
  const out = [];
  for (const id of config.public_badges ?? []) {
    if (id === 'total_downloads') out.push({ id, file: 'total_downloads.json', label: 'downloads' });
    else if (id === 'stars') out.push({ id, file: 'stars.json', label: 'stars' });
    else if (id === 'repo_downloads') for (const repo of config.repos) out.push({ id, repo, file: `downloads-${slug(repo)}.json`, label: 'downloads' });
  }
  return out;
}

function repoDownloads(repo) {
  let total = 0;
  for (const series of Object.values(repo?.downloads ?? {})) total += series.length ? series[series.length - 1][1] : 0;
  return total;
}

function latestStars(repo) {
  const days = Object.keys(repo?.meta ?? {}).sort();
  return days.length ? repo.meta[days[days.length - 1]].stars ?? 0 : 0;
}

// Repository names are matched without regard to case, as GitHub does.
function find(state, name) {
  const key = Object.keys(state.repos).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? state.repos[key] : null;
}

// [{ id, repo?, file, label, value }] for exactly the figures that were chosen.
export function publicFigures(config, state) {
  const repos = Object.values(state.repos);
  return badgeList(config).map((b) => {
    let value = 0;
    if (b.id === 'total_downloads') value = repos.reduce((n, r) => n + repoDownloads(r), 0);
    else if (b.id === 'stars') value = repos.reduce((n, r) => n + latestStars(r), 0);
    else value = repoDownloads(find(state, b.repo));
    return { ...b, value };
  });
}

// The Well on the front page always covers this many days.
export const WELL_DAYS = 14;

// What The Well is drawn from, when the owner chose to publish it: views per day
// added up across the repositories, and views, clones and downloads gained per
// repository. Nothing else: no visitors, no referrers, no pages.
export function publicWell(config, state, now = new Date()) {
  if (!(config.public_badges ?? []).includes('well')) return null;
  const wanted = new Set(config.repos.map((r) => r.toLowerCase()));
  const repos = summarize(state, { now, days: WELL_DAYS }).repos.filter((r) => wanted.has(r.name.toLowerCase()));
  const daily = combineSeries(repos.map((r) => r.viewSeries)).map((p) => ({ day: p.day, views: p.known ? p.count : null }));
  return { days: WELL_DAYS, daily, repos: repos.map((r) => ({ name: r.name, views: r.views, clones: r.clones, downloads: r.downloadsGained })) };
}

// What a README needs. "home" is the repository Mimir runs in, as "owner/name".
export function badgeCode(home, badge) {
  const json = `https://raw.githubusercontent.com/${home}/data/badges/${badge.file}`;
  const image = `https://img.shields.io/endpoint?url=${encodeURIComponent(json)}`;
  const alt = badge.id === 'stars' ? 'Stars' : 'Downloads';
  return { json, image, markdown: `![${alt}](${image})`, html: `<img alt="${alt}" src="${image}">` };
}

export const pagesUrl = (home) => `https://${home.split('/')[0].toLowerCase()}.github.io/${home.split('/')[1]}/`;
