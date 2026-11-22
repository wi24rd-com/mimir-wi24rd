import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PAUSE_AFTER_DAYS, TITLE, WARN_AFTER_DAYS, decide, issueBody, quietDays, watch } from '../src/guard.mjs';

const now = new Date('2026-11-22T12:00:00Z');
const daysAgo = (n) => now.getTime() / 1000 - n * 86400;

test('quiet days are counted from the newest commit on the main branch', () => {
  assert.equal(quietDays(daysAgo(0), now), 0);
  assert.equal(quietDays(daysAgo(44.9), now), 44);
  assert.equal(quietDays(daysAgo(45), now), 45);
  // A clock that is ahead never gives a negative count; no commit time gives no count.
  assert.equal(quietDays(daysAgo(-3), now), 0);
  assert.equal(quietDays(NaN, now), null);
  assert.equal(quietDays(0, now), null);
});

test('one warning is opened after 45 quiet days, and only for a public repository', () => {
  assert.ok(WARN_AFTER_DAYS < PAUSE_AFTER_DAYS);
  assert.equal(decide({ days: 44, isPublic: true, open: false }), 'none');
  assert.equal(decide({ days: 45, isPublic: true, open: false }), 'open');
  assert.equal(decide({ days: 200, isPublic: false, open: false }), 'none');
  assert.equal(decide({ days: null, isPublic: true, open: false }), 'none');
});

test('the warning is not repeated, and it closes after a commit', () => {
  assert.equal(decide({ days: 50, isPublic: true, open: true }), 'none');
  assert.equal(decide({ days: 59, isPublic: true, open: true }), 'none');
  assert.equal(decide({ days: 0, isPublic: true, open: true }), 'close');
  assert.equal(decide({ days: 50, isPublic: false, open: true }), 'close');
});

test('the warning says how long is left and what to do, and promises nothing unproven', () => {
  const body = issueBody(47);
  assert.match(body, /for 47 days/);
  assert.match(body, /about 13 days/);
  assert.match(body, /Enable workflow/);
  assert.match(body, /not been proven/);
  assert.match(issueBody(75), /about 0 days/);
  assert.match(TITLE, /^Mimir: /);
});

test('the workflow runs the guard and keeps the schedule on in a job of its own', () => {
  const yml = readFileSync(new URL('../.github/workflows/collect.yml', import.meta.url), 'utf8');
  assert.match(yml, /run: node src\/guard\.mjs/);
  const [collect, keep] = yml.split(/^  keep-alive:$/m);
  assert.ok(keep, 'there is a keep-alive job');
  assert.match(keep, /permissions:\n      actions: write/);
  assert.match(keep, /actions\/workflows\/collect\.yml\/enable/);
  // The job that holds the app key and writes the figures does not get that permission.
  assert.ok(!/actions: write/.test(collect));
  assert.ok(!/MIMIR_APP_PRIVATE_KEY|MIMIR_PASSPHRASE/.test(keep));
});

// A stand-in for git and the GitHub CLI: answers the three questions and records what was done.
function world({ quiet, visibility = 'public', openIssue = '', fail = null }) {
  const done = [];
  const run = (cmd, args) => {
    if (cmd === 'git') return { ok: true, out: String(Math.round(daysAgo(quiet))) };
    if (args[0] === 'api') return fail === 'api' ? { ok: false, out: '' } : { ok: true, out: visibility };
    if (args[0] === 'issue' && args[1] === 'list') return { ok: true, out: openIssue };
    done.push(args);
    return { ok: true, out: '' };
  };
  return { run, done };
}

test('guard: opens one issue in the right repository after 45 quiet days', () => {
  const w = world({ quiet: 50 });
  assert.match(watch({ repo: 'o/mimir', now, run: w.run }), /quiet for 50 days \(public repository\): open the warning/);
  assert.equal(w.done.length, 1);
  assert.deepEqual(w.done[0].slice(0, 6), ['issue', 'create', '--repo', 'o/mimir', '--title', TITLE]);
  assert.match(w.done[0][7], /about 10 days/);
});

test('guard: does nothing while there is activity, when the warning is already open, or in a private repository', () => {
  for (const setup of [{ quiet: 3 }, { quiet: 50, openIssue: '12' }, { quiet: 50, visibility: 'private' }]) {
    const w = world(setup);
    assert.match(watch({ repo: 'o/mimir', now, run: w.run }), /nothing to do/);
    assert.deepEqual(w.done, []);
  }
});

test('guard: closes the warning after a commit, and stays silent when GitHub does not answer', () => {
  const w = world({ quiet: 1, openIssue: '12' });
  assert.match(watch({ repo: 'o/mimir', now, run: w.run }), /close the warning/);
  assert.deepEqual(w.done[0].slice(0, 5), ['issue', 'close', '12', '--repo', 'o/mimir']);
  const broken = world({ quiet: 50, fail: 'api' });
  assert.match(watch({ repo: 'o/mimir', now, run: broken.run }), /Could not check/);
  assert.deepEqual(broken.done, []);
});
