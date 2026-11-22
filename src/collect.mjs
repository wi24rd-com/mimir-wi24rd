// Collects traffic, release downloads and basic repo figures for every repo in
// mimir.json and folds them into the data folder.
//
// Environment:
//   MIMIR_TOKEN       token with "Administration: read" on the tracked repos
//   MIMIR_PASSPHRASE  needed in "encrypted" mode
//   MIMIR_DATA_DIR    data folder (default: ./data)
//   MIMIR_MIGRATE=1   allow converting between plain and encrypted data
//
// Exit code: 0 everything collected, 2 something failed (data that did arrive
// is still saved), 1 nothing could be done.
import { writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.mjs';
import { ghGet, ghGetAll } from './lib/github.mjs';
import { emptyRepo, mergeDaily, mergeDownloads, setMeta, setSnapshot, totalDownloads, totalStars } from './lib/merge.mjs';
import { openStore } from './lib/store.mjs';
import { BADGE_COLOR, publicFigures, publicWell } from '../docs/lib/public.js';

const TRAFFIC = [
  ['views', '/traffic/views'],
  ['clones', '/traffic/clones'],
  ['referrers', '/traffic/popular/referrers'],
  ['paths', '/traffic/popular/paths'],
];

export async function collect({ config, state, token, now = new Date(), http = {} }) {
  const today = now.toISOString().slice(0, 10);
  const opts = { token, ...http };
  const errors = [];
  const raw = {};
  let skipped = 0;
  const readable = token ? await installedRepos(opts) : null;

  for (const full of config.repos) {
    const repo = (state.repos[full] ??= emptyRepo());
    const base = `/repos/${full}`;
    raw[full] = {};
    const note = (what, r) => errors.push({ repo: full, what, status: r.status, error: r.error });

    const meta = await ghGet(base, opts);
    if (meta.ok) { setMeta(repo.meta, today, meta.data); repo.last_success.meta = today; } else note('meta', meta);

    const rel = await ghGetAll(`${base}/releases`, opts);
    if (rel.ok) { mergeDownloads(repo.downloads, today, rel.data); repo.last_success.downloads = today; } else note('downloads', rel);

    if (readable && !readable.has(full.toLowerCase())) {
      note('access', { status: 0, error: 'the app is not installed on this repository' });
      skipped += TRAFFIC.length;
      continue;
    }

    for (const [name, path] of TRAFFIC) {
      const r = await ghGet(base + path, opts);
      if (!r.ok) { note(name, r); continue; }
      raw[full][name] = r.data;
      if (name === 'views') mergeDaily(repo.views, r.data.views);
      else if (name === 'clones') mergeDaily(repo.clones, r.data.clones);
      else if (name === 'referrers') setSnapshot(repo.referrers, today, r.data, 'referrer');
      else setSnapshot(repo.paths, today, r.data, 'path');
      repo.last_success[name] = today;
    }
  }

  state.health.last_run = now.toISOString().slice(0, 19) + 'Z';
  state.health.runs = (state.health.runs ?? 0) + 1;
  state.health.last_errors = errors;
  const attempted = config.repos.length * (2 + TRAFFIC.length) - skipped;
  const failed = errors.filter((e) => e.what !== 'access').length;
  return { state, raw, errors, today, counts: { attempted, succeeded: attempted - failed, skipped } };
}

// Which repositories the app token can read. Returns null when that cannot be
// determined (for example with a personal token), and every repo is then tried.
async function installedRepos(opts) {
  const names = new Set();
  let next = '/installation/repositories?per_page=100';
  for (let page = 0; next && page < 10; page++) {
    const r = await ghGet(next, opts);
    if (!r.ok || !Array.isArray(r.data?.repositories)) return null;
    for (const repo of r.data.repositories) names.add(String(repo.full_name).toLowerCase());
    next = /<([^>]+)>;\s*rel="next"/.exec(r.link ?? '')?.[1] ?? null;
  }
  return names;
}

// What the owner chose to publish, and nothing else: one Shields-compatible JSON
// file per figure, and public.json with the same figures for the front page.
// Files for figures that are no longer chosen are removed.
export function writeBadges(dir, config, state, day = new Date().toISOString().slice(0, 10)) {
  const figures = publicFigures(config, state);
  const folder = join(dir, 'badges');
  if (existsSync(folder)) {
    const keep = new Set(figures.map((f) => f.file));
    for (const name of readdirSync(folder)) if (name.endsWith('.json') && !keep.has(name)) rmSync(join(folder, name));
  }
  if (figures.length) mkdirSync(folder, { recursive: true });
  for (const f of figures) {
    writeFileSync(join(folder, f.file), JSON.stringify({ schemaVersion: 1, label: f.label, message: String(f.value), color: BADGE_COLOR }) + '\n');
  }
  const list = figures.map(({ id, repo, value }) => (repo ? { id, repo, value } : { id, value }));
  const well = publicWell(config, state, new Date(`${day}T12:00:00Z`));
  writeFileSync(join(dir, 'public.json'), JSON.stringify({ mimir: 1, day, figures: list, ...(well ? { well } : {}) }) + '\n');
}

async function main() {
  const config = loadConfig(process.env.MIMIR_CONFIG ?? 'mimir.json');
  const dir = process.env.MIMIR_DATA_DIR ?? 'data';
  const token = process.env.MIMIR_TOKEN || undefined;
  if (!token) console.log('No MIMIR_TOKEN: traffic figures need it and will be reported as failed.');
  const store = openStore(dir, { visibility: config.visibility, passphrase: process.env.MIMIR_PASSPHRASE, migrate: process.env.MIMIR_MIGRATE === '1' });
  const { state, raw, errors, today, counts } = await collect({ config, state: store.load(), token });
  store.save(state);
  store.saveRaw(today, raw);
  writeBadges(dir, config, state, today);

  const skippedNote = counts.skipped ? `, ${counts.skipped} skipped` : '';
  console.log(`Mimir ${today}: ${config.repos.length} repos, ${counts.succeeded} of ${counts.attempted} requests succeeded${skippedNote}, mode ${config.visibility}.`);
  for (const e of errors) if (e.what !== 'access') console.log(`  failed: ${e.repo} ${e.what} (HTTP ${e.status}: ${e.error})`);
  const missing = errors.filter((e) => e.what === 'access').map((e) => e.repo);
  if (missing.length) {
    console.log(`  Your Mimir app cannot read traffic for: ${missing.join(', ')}`);
    console.log('  Add them under "Repository access" at https://github.com/settings/installations');
  }
  if (counts.succeeded === 0) process.exit(1);
  if (errors.length) process.exit(2);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`Mimir stopped: ${e.message}`); process.exit(1); });
}
