// Pure functions that fold one day's API answers into the long-term state.
// Schema 1. Nothing here touches the network or the disk.

export { SCHEMA, emptyRepo, emptyState } from '../../docs/lib/state.js';

const day = (ts) => String(ts).slice(0, 10);
const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
const num = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);

// views / clones: one entry per UTC day. GitHub's figure for the current day
// is still growing, so a later answer may be higher. Never lower a stored day.
export function mergeDaily(target, entries) {
  for (const e of entries ?? []) {
    const d = day(e?.timestamp);
    if (!isDay(d)) continue;
    const inc = { count: num(e.count), uniques: num(e.uniques) };
    const cur = target[d];
    if (!cur || inc.count > cur.count || (inc.count === cur.count && inc.uniques > cur.uniques)) target[d] = inc;
  }
  return target;
}

// referrers / paths: GitHub gives a top 10 for the last 14 days as a whole.
// It cannot be split per day, so we keep one dated snapshot per collection day.
export function setSnapshot(target, today, list, keyField) {
  if (!isDay(today) || !Array.isArray(list)) return target;
  target[today] = list.slice(0, 10).map((x) => ({
    [keyField]: String(x?.[keyField] ?? '').slice(0, 300),
    count: num(x?.count),
    uniques: num(x?.uniques),
  }));
  return target;
}

// downloads: a counter per release file. Stored as [day, count] points, and a
// new point is added only when the counter changed.
export function mergeDownloads(target, today, releases) {
  if (!isDay(today)) return target;
  for (const rel of releases ?? []) {
    if (rel?.draft) continue;
    for (const a of rel?.assets ?? []) {
      const key = `${rel.tag_name}/${a.name}`;
      const count = num(a.download_count);
      const series = (target[key] ??= []);
      const last = series[series.length - 1];
      if (last && last[0] === today) last[1] = Math.max(last[1], count);
      else if (!last || last[1] !== count) series.push([today, count]);
    }
  }
  return target;
}

export function setMeta(target, today, repo) {
  if (!isDay(today) || !repo) return target;
  const point = { stars: num(repo.stargazers_count), forks: num(repo.forks_count), watchers: num(repo.subscribers_count) };
  const days = Object.keys(target).sort();
  const prev = target[days[days.length - 1]];
  const same = prev && prev.stars === point.stars && prev.forks === point.forks && prev.watchers === point.watchers;
  if (!same || days[days.length - 1] === today) target[today] = point;
  return target;
}

export function totalDownloads(state) {
  let total = 0;
  for (const repo of Object.values(state.repos)) {
    for (const series of Object.values(repo.downloads)) total += series.length ? series[series.length - 1][1] : 0;
  }
  return total;
}

export function totalStars(state) {
  let total = 0;
  for (const repo of Object.values(state.repos)) {
    const days = Object.keys(repo.meta).sort();
    if (days.length) total += repo.meta[days[days.length - 1]].stars;
  }
  return total;
}
