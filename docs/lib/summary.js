// Turns the stored state into the figures the terminal view and the dashboard
// show. Pure functions, shared by Node and the browser.

const DAY = 86400000;
export const isoDay = (date) => new Date(date).toISOString().slice(0, 10);
export const addDays = (day, n) => isoDay(Date.parse(`${day}T00:00:00Z`) + n * DAY);

// Every day from `from` to `to`, both included.
export function dayRange(from, to) {
  const out = [];
  for (let d = from; d <= to && out.length < 4000; d = addDays(d, 1)) out.push(d);
  return out;
}

export function firstDay(state) {
  let first = null;
  for (const repo of Object.values(state.repos ?? {})) {
    for (const section of [repo.views, repo.clones, repo.meta]) {
      for (const d of Object.keys(section ?? {})) if (!first || d < first) first = d;
    }
    for (const series of Object.values(repo.downloads ?? {})) {
      if (series.length && (!first || series[0][0] < first)) first = series[0][0];
    }
  }
  return first;
}

// Counter value on a given day: the last recorded point on or before it.
function counterAt(series, day) {
  let value = null;
  for (const [d, n] of series) { if (d <= day) value = n; else break; }
  return value;
}

function latest(byDay, onOrBefore) {
  const days = Object.keys(byDay ?? {}).filter((d) => d <= onOrBefore).sort();
  return days.length ? { day: days[days.length - 1], value: byDay[days[days.length - 1]] } : null;
}

// days: number of days ending today, or null for everything collected.
export function repoSummary(repo, { today, days }) {
  const start = days ? addDays(today, -(days - 1)) : null;
  const inRange = (d) => d <= today && (!start || d >= start);
  const sum = (byDay) => Object.entries(byDay ?? {}).reduce((t, [d, v]) => (inRange(d) ? t + v.count : t), 0);

  const files = Object.entries(repo.downloads ?? {}).map(([key, series]) => {
    const total = counterAt(series, today) ?? 0;
    const firstSeen = series.length ? series[0][0] : null;
    // What the counter showed just before the period began. If Mimir first saw
    // the file inside the period, growth is counted from that first sighting.
    const before = start ? counterAt(series, addDays(start, -1)) : null;
    const base = before ?? (series.length ? series[0][1] : 0);
    const slash = key.indexOf('/');
    return { key, tag: key.slice(0, slash), name: key.slice(slash + 1), total, gained: Math.max(0, total - base), firstSeen, partial: before === null };
  }).sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));

  // Unique visitors cannot be summed over days, so the busiest single day is reported instead.
  const peak = (byDay) => Object.entries(byDay ?? {}).reduce((m, [d, v]) => (inRange(d) ? Math.max(m, v.uniques) : m), 0);
  const meta = latest(repo.meta, today);
  const referrers = latest(repo.referrers, today);
  const paths = latest(repo.paths, today);
  const series = (byDay) => {
    const keys = Object.keys(byDay ?? {}).filter(inRange).sort();
    if (!keys.length) return [];
    const from = start ?? keys[0];
    return dayRange(from, today).map((d) => ({ day: d, count: byDay[d]?.count ?? 0, uniques: byDay[d]?.uniques ?? 0, known: d in byDay }));
  };

  return {
    views: sum(repo.views),
    clones: sum(repo.clones),
    viewUniquesPeak: peak(repo.views),
    cloneUniquesPeak: peak(repo.clones),
    viewSeries: series(repo.views),
    cloneSeries: series(repo.clones),
    downloads: files.reduce((t, f) => t + f.total, 0),
    downloadsGained: files.reduce((t, f) => t + f.gained, 0),
    files,
    stars: meta?.value.stars ?? 0,
    forks: meta?.value.forks ?? 0,
    watchers: meta?.value.watchers ?? 0,
    referrers: referrers?.value ?? [],
    referrersDay: referrers?.day ?? null,
    paths: paths?.value ?? [],
    hasTraffic: Object.keys(repo.views ?? {}).length + Object.keys(repo.clones ?? {}).length > 0,
  };
}

export function summarize(state, { now = new Date(), days = 14 } = {}) {
  const today = isoDay(now);
  const repos = Object.keys(state.repos ?? {}).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map((name) => ({ name, short: name.split('/')[1] ?? name, ...repoSummary(state.repos[name], { today, days }) }));
  const total = (k) => repos.reduce((t, r) => t + r[k], 0);
  const busiest = repos.filter((r) => r.views > 0).sort((a, b) => b.views - a.views)[0] ?? null;
  const topFile = repos.flatMap((r) => r.files.map((f) => ({ ...f, repo: r.short }))).filter((f) => f.gained > 0).sort((a, b) => b.gained - a.gained)[0] ?? null;
  const refTotals = new Map();
  for (const r of repos) for (const x of r.referrers) refTotals.set(x.referrer, (refTotals.get(x.referrer) ?? 0) + x.count);
  const topReferrer = [...refTotals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;

  // When Mimir first saw every release file inside the period, it cannot say how
  // many downloads fell within it. The day counting began is reported instead.
  const allFiles = repos.flatMap((r) => r.files);
  const countingSince = days && allFiles.length && allFiles.every((f) => f.partial) ? allFiles.map((f) => f.firstSeen).sort()[0] : null;

  const lastRun = state.health?.last_run ?? null;
  const ageHours = lastRun ? Math.max(0, (now.getTime() - Date.parse(lastRun)) / 3600000) : null;
  return {
    today,
    days,
    since: firstDay(state),
    repos,
    totals: { views: total('views'), clones: total('clones'), downloads: total('downloads'), downloadsGained: total('downloadsGained'), stars: total('stars') },
    busiest,
    topFile,
    countingSince,
    topReferrer: topReferrer ? { referrer: topReferrer[0], count: topReferrer[1] } : null,
    health: {
      lastRun,
      ageHours,
      // Collections run twice a day. More than 36 hours without one means something stopped.
      stale: ageHours === null || ageHours > 36,
      errors: state.health?.last_errors ?? [],
    },
  };
}

// One series for several repositories: counts are added per day. Unique
// visitors cannot be added across repositories either, so they are left out.
export function combineSeries(list) {
  const byDay = new Map();
  for (const series of list) {
    for (const p of series) {
      const c = byDay.get(p.day) ?? { day: p.day, count: 0, uniques: null, known: false };
      if (p.known) { c.count += p.count; c.known = true; }
      byDay.set(p.day, c);
    }
  }
  return [...byDay.values()].sort((a, b) => (a.day < b.day ? -1 : 1));
}

// Referrers across repositories, most visits first. Visits are added; unique visitors are not.
export function mergeReferrers(repos) {
  const totals = new Map();
  for (const r of repos) for (const x of r.referrers) totals.set(x.referrer, (totals.get(x.referrer) ?? 0) + x.count);
  return [...totals.entries()].map(([referrer, count]) => ({ referrer, count })).sort((a, b) => b.count - a.count || a.referrer.localeCompare(b.referrer));
}
