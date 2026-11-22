// Shows your figures in the terminal, in plain language.
//
//   node src/show.mjs              last 14 days
//   node src/show.mjs --days 30    another period (a number, or "all")
//   node src/show.mjs --lang da    Danish
//   node src/show.mjs --demo       invented figures, to see what it looks like
//
// In encrypted mode it asks for your passphrase. Nothing is written to disk.
import { fileURLToPath } from 'node:url';
import { decryptJson } from './lib/crypto.mjs';
import { askHidden, readDataBranch, workflowState } from './lib/data.mjs';
import { demoState } from './lib/demo.mjs';
import { TEXT, pickLang } from '../docs/lib/i18n.js';
import { summarize } from '../docs/lib/summary.js';

export function parseArgs(argv, env = {}) {
  const value = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const rawDays = value('--days') ?? '14';
  const days = rawDays === 'all' ? null : Number(rawDays);
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 3650)) throw new Error('--days takes a whole number of days, or "all"');
  return { days, lang: pickLang(value('--lang') ?? env.LANG), demo: argv.includes('--demo') };
}

// workflow: what GitHub says about the collecting workflow, when it was asked.
export function render(summary, lang, { workflow = null } = {}) {
  const t = TEXT[lang];
  const pad = (s, w) => String(s).padEnd(w);
  const num = (x, w) => t.num(x).padStart(w);
  const lines = ['', `${t.title}  ${summary.health.lastRun ? t.collected(t.hoursAgo(summary.health.ageHours)) : t.never}`, ''];
  const paused = workflow && workflow !== 'active';
  if (summary.health.stale && summary.health.lastRun) lines.push(`! ${t.staleTitle}. ${paused ? (workflow === 'disabled_inactivity' ? t.pausedInactive : t.pausedOff) : t.staleBody(Math.round(summary.health.ageHours))}`, '');
  if (summary.health.errors.length) {
    lines.push(`! ${t.errorsTitle}`);
    for (const e of summary.health.errors) lines.push(`    ${t.errorLine(e)}`);
    lines.push('');
  }
  if (!summary.repos.length) return [...lines, t.noData, ''].join('\n');
  for (const sentence of t.headline(summary)) lines.push(sentence);
  const width = Math.max(12, ...summary.repos.map((r) => r.short.length));
  const cols = [t.views, t.peakColumn, t.clones, t.peakColumn, t.downloads, t.stars];
  const w = cols.map((c) => Math.max(9, c.length));
  lines.push('', `${pad(t.repositories, width)}  ${cols.map((c, i) => c.padStart(w[i])).join('  ')}`);
  for (const r of summary.repos) {
    const cells = [r.views, r.viewUniquesPeak, r.clones, r.cloneUniquesPeak, r.downloads, r.stars];
    lines.push(`${pad(r.short, width)}  ${cells.map((c, i) => num(c, w[i])).join('  ')}`);
  }
  const files = summary.repos.flatMap((r) => r.files.map((f) => ({ ...f, repo: r.short })));
  if (files.length) {
    const fw = Math.max(t.file.length, ...files.map((f) => `${f.repo} ${f.tag} ${f.name}`.length));
    const marked = (f) => summary.days && f.partial;
    lines.push('', `${pad(t.file, fw)}  ${t.total.padStart(8)} ${t.inPeriod.padStart(12)}`);
    for (const f of files) lines.push(`${pad(`${f.repo} ${f.tag} ${f.name}`, fw)}  ${num(f.total, 8)} ${(`+${t.num(f.gained)}${marked(f) ? '*' : ''}`).padStart(12)}`);
    if (files.some(marked)) lines.push('', t.partialNote);
  }
  lines.push('', t.uniquesNote, '');
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2), process.env);
  let state;
  if (args.demo) {
    state = demoState();
  } else {
    const data = readDataBranch();
    if (data.encrypted) {
      const passphrase = process.env.MIMIR_PASSPHRASE || await askHidden(`${TEXT[args.lang].passphrase}: `);
      state = decryptJson(data.body, passphrase.trim());
    } else {
      state = data.body;
    }
  }
  const summary = summarize(state, { days: args.days });
  // Only when collection looks stopped: ask GitHub whether the workflow was switched off.
  let workflow = null;
  if (!args.demo && summary.health.stale && summary.health.lastRun) { try { workflow = workflowState().state; } catch { /* the plain warning stays */ } }
  process.stdout.write(render(summary, args.lang, { workflow }));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`Mimir: ${e.message}`); process.exit(1); });
}
