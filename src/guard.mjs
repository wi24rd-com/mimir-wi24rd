// Warns in good time before GitHub pauses the schedule. Run by the Collect
// workflow after each collection.
//
// GitHub switches scheduled workflows off in a public repository after 60 days
// without activity, and a workflow that is switched off cannot say so. Mimir
// commits its figures to the "data" branch only, so a copy that nobody touches
// may look inactive. While the workflow still runs, it can count: after 45
// days without a commit on the main branch it opens one issue, and GitHub
// sends the owner a notification. The issue closes itself after the next commit.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const WARN_AFTER_DAYS = 45;
export const PAUSE_AFTER_DAYS = 60;
export const TITLE = 'Mimir: GitHub may pause collection soon';

// Whole days since the newest commit on the main branch (given in seconds since 1970).
export function quietDays(lastCommitSeconds, now = new Date()) {
  if (!Number.isFinite(lastCommitSeconds) || lastCommitSeconds <= 0) return null;
  return Math.max(0, Math.floor((now.getTime() / 1000 - lastCommitSeconds) / 86400));
}

// 'open' an issue, 'close' the open one, or 'none'. Only public repositories are paused.
export function decide({ days, isPublic, open }) {
  const due = isPublic && days !== null && days >= WARN_AFTER_DAYS;
  if (due && !open) return 'open';
  if (!due && open) return 'close';
  return 'none';
}

export function issueBody(days) {
  const left = Math.max(0, PAUSE_AFTER_DAYS - days);
  return [
    `Nothing is wrong yet. No commit has reached the main branch of this repository for ${days} days.`,
    '',
    `GitHub switches scheduled workflows off in a public repository after ${PAUSE_AFTER_DAYS} days without activity. That would be in about ${left} days. A workflow that is switched off cannot report it, so this is said now.`,
    '',
    'Mimir switches its own schedule on again at every run, which is meant to prevent the pause. That has not been proven over a full 60 days.',
    '',
    'What you can do:',
    '',
    '- Reset the count now: commit any change to the main branch, for example a line in the README.',
    '- Or wait. If collection stops, the dashboard says why, and "Enable workflow" under Actions, Collect starts it again. GitHub keeps traffic for 14 days, so no figures are lost when that is done within two weeks.',
    '',
    'This issue closes itself after the next commit on the main branch.',
  ].join('\n');
}

function shell(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return { ok: !r.error && r.status === 0, out: (r.stdout ?? '').trim() };
}

// Looks, decides and acts. Returns a line for the log. "run" is replaced in the tests.
export function watch({ repo, now = new Date(), run = shell }) {
  const days = quietDays(Number(run('git', ['log', '-1', '--format=%ct', 'HEAD']).out), now);
  const visibility = run('gh', ['api', `repos/${repo}`, '--jq', '.visibility']);
  const found = run('gh', ['issue', 'list', '--repo', repo, '--state', 'open', '--search', `in:title "${TITLE}"`, '--json', 'number', '--jq', '.[0].number // empty']);
  if (days === null || !visibility.ok || !found.ok || (found.out && !/^\d+$/.test(found.out))) return 'Could not check how long the main branch has been quiet.';
  const action = decide({ days, isPublic: visibility.out === 'public', open: Boolean(found.out) });
  if (action === 'open') run('gh', ['issue', 'create', '--repo', repo, '--title', TITLE, '--body', issueBody(days)]);
  if (action === 'close') run('gh', ['issue', 'close', found.out, '--repo', repo, '--comment', 'The main branch has a recent commit again.']);
  return `Main branch quiet for ${days} days (${visibility.out} repository): ${action === 'none' ? 'nothing to do' : `${action} the warning`}.`;
}

function main() {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) { console.log('Not running on GitHub: nothing to watch.'); return; }
  console.log(watch({ repo }));
}

// A problem here must never fail a collection.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.log(`Guard skipped: ${e.message}`); }
}
