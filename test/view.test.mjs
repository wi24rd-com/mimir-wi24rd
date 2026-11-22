import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDashboardServer } from '../src/dashboard.mjs';
import { parseArgs, render } from '../src/show.mjs';
import { readDataBranch, repoSlug, workflowState } from '../src/lib/data.mjs';
import { decryptJson, encryptJson } from '../src/lib/crypto.mjs';
import { demoState } from '../src/lib/demo.mjs';
import { WrongPassphrase, openEnvelope } from '../docs/lib/open.js';
import { summarize } from '../docs/lib/summary.js';

const now = new Date('2026-11-21T12:00:00Z');
const docs = fileURLToPath(new URL('../docs', import.meta.url));
const PASS = 'correct-horse-battery-staple-1';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    }).on('error', reject);
  });
}

async function withServer(options, fn) {
  const server = createDashboardServer({ root: docs, getState: () => ({ schema: 1 }), getConfig: () => ({ version: 1 }), source: { mode: 'local' }, ...options });
  const url = await server.ready;
  try { await fn(url); } finally { server.close(); }
}

test('the browser code opens what the collector encrypted', async () => {
  const data = demoState(now);
  assert.deepEqual(await openEnvelope(JSON.parse(JSON.stringify(encryptJson(data, PASS, { iterations: 100_000 }))), PASS), data);
});

test('the browser code reports a wrong passphrase as such', async () => {
  const env = encryptJson({ a: 1 }, PASS, { iterations: 100_000 });
  await assert.rejects(openEnvelope(env, `${PASS}x`), WrongPassphrase);
  await assert.rejects(openEnvelope({ mimir: 2 }, PASS), /newer format/);
});

test('dashboard server: serves the page with a strict policy and no caching', async () => {
  await withServer({}, async (url) => {
    const page = await get(url);
    assert.equal(page.status, 200);
    assert.match(page.body, /<script type="module" src="app\.js">/);
    assert.match(page.headers['content-security-policy'], /default-src 'none'.*connect-src 'self'/);
    assert.equal(page.headers['cache-control'], 'no-store');
    assert.equal((await get(`${url}lib/summary.js`)).status, 200);
    assert.equal((await get(`${url}kit/fonts/inter-latin-wght-normal.woff2`)).headers['content-type'], 'font/woff2');
    assert.equal((await get(`${url}kit/kit.js`)).status, 200);
    assert.equal((await get(`${url}mimir-mark.svg`)).headers['content-type'], 'image/svg+xml');
  });
});

test('dashboard server: nothing outside the dashboard folder can be read', async () => {
  await withServer({}, async (url) => {
    for (const path of ['../package.json', '..%2Fpackage.json', '%2e%2e/%2e%2e/etc/passwd', '.git/config', 'lib/../../mimir.json', 'fonts/', 'nope.js', 'index.html.bak']) {
      assert.equal((await get(url + path)).status, 404, path);
    }
    assert.equal((await get(url, { host: 'evil.example' })).status, 400);
  });
});

test('dashboard server: figures, settings and source are served; a missing data branch is explained', async () => {
  await withServer({ getState: () => ({ schema: 1, repos: {} }), getConfig: () => ({ version: 1, visibility: 'public' }), source: { mode: 'local', repository: 'o/mimir' } }, async (url) => {
    assert.deepEqual(JSON.parse((await get(`${url}data/state`)).body), { schema: 1, repos: {} });
    assert.equal(JSON.parse((await get(`${url}data/config`)).body).visibility, 'public');
    assert.equal(JSON.parse((await get(`${url}mimir-source.json`)).body).repository, 'o/mimir');
    // Not asked for unless the caller gives a way to ask.
    assert.equal((await get(`${url}data/workflow`)).status, 404);
  });
  await withServer({ getWorkflow: () => ({ state: 'disabled_inactivity' }) }, async (url) => {
    assert.deepEqual(JSON.parse((await get(`${url}data/workflow`)).body), { state: 'disabled_inactivity' });
  });
  await withServer({ getState: () => { throw new Error('there is no "data" branch yet'); } }, async (url) => {
    const res = await get(`${url}data/state`);
    assert.equal(res.status, 404);
    assert.match(JSON.parse(res.body).error, /data/);
  });
});

test('terminal view: arguments', () => {
  assert.deepEqual(parseArgs([], {}), { days: 14, lang: 'en', demo: false });
  assert.deepEqual(parseArgs(['--days', 'all', '--lang', 'da', '--demo'], {}), { days: null, lang: 'da', demo: true });
  assert.equal(parseArgs([], { LANG: 'da_DK.UTF-8' }).lang, 'da');
  assert.throws(() => parseArgs(['--days', '0'], {}), /whole number/);
  assert.throws(() => parseArgs(['--days', 'x'], {}), /whole number/);
});

test('terminal view: shows the sentences, one row per repo and one per file', () => {
  const text = render(summarize(demoState(now), { now, days: 14 }), 'en');
  assert.match(text, /views and \d+ clones in the last 14 days\./);
  for (const name of ['lantern', 'quill-notes', 'tidepool', 'lantern-2.1.0-windows.exe']) assert.ok(text.includes(name), name);
  assert.match(render(summarize(demoState(now), { now, days: 14 }), 'da'), /visninger og \d+ kloninger/);
});

test('terminal view: warns when collection has stopped or was incomplete', () => {
  const state = demoState(now);
  state.health.last_run = '2026-11-18T03:00:00Z';
  state.health.last_errors = [{ repo: 'o/a', what: 'access', status: 0, error: 'x' }];
  const text = render(summarize(state, { now, days: 14 }), 'en');
  assert.match(text, /Collection has stopped/);
  assert.match(text, /o\/a: your Mimir app is not installed/);
  assert.match(text, /Check the Actions tab/);
});

test('terminal view: says why when GitHub has switched the workflow off', () => {
  const state = demoState(now);
  state.health.last_run = '2026-11-18T03:00:00Z';
  const summary = summarize(state, { now, days: 14 });
  assert.match(render(summary, 'en', { workflow: 'disabled_inactivity' }), /Collection has stopped\. GitHub has paused it because this repository had no activity for 60 days/);
  assert.match(render(summary, 'da', { workflow: 'disabled_manually' }), /slået fra i dette repository/);
  assert.match(render(summary, 'en', { workflow: 'active' }), /Check the Actions tab/);
  // A workflow that is switched off is only mentioned when collection has actually stopped.
  assert.ok(!render(summarize(demoState(now), { now, days: 14 }), 'en', { workflow: 'disabled_inactivity' }).includes('paused'));
});

test('workflow state: read through the GitHub CLI, and anything unexpected is refused', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mimir-wf-'));
  execFileSync('git', ['init', '--quiet', dir]);
  execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', 'https://github.com/o/mimir.git']);
  const calls = [];
  const answer = (stdout, status = 0) => (cmd, args) => { calls.push([cmd, ...args]); return { status, stdout }; };
  assert.deepEqual(workflowState({ cwd: dir, run: answer('disabled_inactivity\n') }), { state: 'disabled_inactivity' });
  assert.deepEqual(calls[0].slice(0, 3), ['gh', 'api', 'repos/o/mimir/actions/workflows/collect.yml']);
  assert.throws(() => workflowState({ cwd: dir, run: answer('<html>', 0) }), /did not say/);
  assert.throws(() => workflowState({ cwd: dir, run: answer('', 1) }), /did not say/);
});

test('figures are read from the data branch of a real git clone, encrypted and open', () => {
  const git = (cwd, ...args) => execFileSync('git', args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });
  const root = mkdtempSync(join(tmpdir(), 'mimir-git-'));
  const origin = join(root, 'origin');
  const clone = join(root, 'clone');
  mkdirSync(origin);
  git(origin, 'init', '-q', '-b', 'main');
  writeFileSync(join(origin, 'README.md'), 'x\n');
  git(origin, 'add', '-A'); git(origin, 'commit', '-q', '-m', 'main');
  git(root, 'clone', '-q', origin, clone);
  assert.throws(() => readDataBranch({ cwd: clone }), /no "data" branch yet/);

  const state = demoState(now);
  git(origin, 'checkout', '-q', '--orphan', 'data'); git(origin, 'rm', '-q', '-rf', '.');
  writeFileSync(join(origin, 'state.enc'), JSON.stringify(encryptJson(state, PASS, { iterations: 100_000 })));
  git(origin, 'add', '-A'); git(origin, 'commit', '-q', '-m', 'data');
  const enc = readDataBranch({ cwd: clone });
  assert.equal(enc.encrypted, true);
  assert.deepEqual(decryptJson(enc.body, PASS), state);

  git(origin, 'rm', '-q', 'state.enc');
  writeFileSync(join(origin, 'state.json'), JSON.stringify(state));
  git(origin, 'add', '-A'); git(origin, 'commit', '-q', '-m', 'open');
  const open = readDataBranch({ cwd: clone });
  assert.equal(open.encrypted, false);
  assert.deepEqual(open.body, state);

  git(clone, 'remote', 'set-url', 'origin', 'git@github.com:wi24rd-com/mimir.git');
  assert.equal(repoSlug(clone), 'wi24rd-com/mimir');
  git(clone, 'remote', 'set-url', 'origin', 'https://github.com/wi24rd-com/Wi24rd-FTP');
  assert.equal(repoSlug(clone), 'wi24rd-com/Wi24rd-FTP');
});

test('terminal view: files first seen inside the period are marked and explained', () => {
  const state = demoState(now);
  state.repos['example/tidepool'].downloads = { 'v1/new.zip': [['2026-11-20', 2], ['2026-11-21', 5]] };
  const text = render(summarize(state, { now, days: 14 }), 'en');
  assert.match(text, /tidepool v1 new\.zip\s+5\s+\+3\*/);
  assert.match(text, /\* counted since the file was first collected/);
  assert.ok(!render(summarize(demoState(now), { now, days: 14 }), 'en').includes('*'));
});
