import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { appName, buildManifest, firstCollection, pages, startFlow } from '../src/setup.mjs';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    http.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers: res.headers }));
    }).on('error', reject);
  });
}

const fakeGitHub = (answer, status = 200) => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, method: init.method }); return new Response(JSON.stringify(answer), { status }); };
  return { fetchImpl, calls };
};
const APP = { id: 42, client_id: 'Iv23abc', slug: 'mimir-o', pem: '-----BEGIN RSA PRIVATE KEY-----\nxyz\n-----END RSA PRIVATE KEY-----\n', permissions: { administration: 'read' } };

test('the manifest asks for read-only Administration and nothing else', () => {
  const m = buildManifest({ owner: 'wi24rd-com', repoUrl: 'https://github.com/wi24rd-com/mimir', port: 5000 });
  assert.deepEqual(m.default_permissions, { administration: 'read' });
  assert.deepEqual(m.default_events, []);
  assert.equal(m.public, false);
  assert.equal(m.hook_attributes.active, false);
  assert.equal(m.redirect_url, 'http://127.0.0.1:5000/callback');
});

test('the start page posts the manifest to GitHub with a state value', async () => {
  const flow = startFlow({ owner: 'o', repoUrl: 'https://github.com/o/mimir', fetchImpl: fakeGitHub(APP).fetchImpl });
  flow.done.catch(() => {});
  const start = await flow.ready;
  const page = await get(start);
  flow.close();
  assert.equal(page.status, 200);
  assert.match(page.body, /action="https:\/\/github\.com\/settings\/apps\/new\?state=[0-9a-f]{48}"/);
  assert.match(page.body, /name="manifest" value="\{&#34;name&#34;:&#34;mimir-o-mimir&#34;/);
  assert.match(page.headers['content-security-policy'], /form-action https:\/\/github\.com/);
});

test('a callback with the right state exchanges the code and returns the app', async () => {
  const gh = fakeGitHub(APP);
  const flow = startFlow({ owner: 'o', repoUrl: 'https://github.com/o/mimir', fetchImpl: gh.fetchImpl });
  const start = await flow.ready;
  const state = /state=([0-9a-f]{48})/.exec((await get(start)).body)[1];
  const cb = await get(start.replace('/start', `/callback?code=abc123&state=${state}`));
  const app = await flow.done;
  flow.close();
  assert.equal(cb.status, 200);
  assert.ok(!cb.body.includes('PRIVATE KEY'), 'the key must not be shown in the browser');
  assert.deepEqual(gh.calls, [{ url: 'https://api.github.com/app-manifests/abc123/conversions', method: 'POST' }]);
  assert.equal(app.clientId, 'Iv23abc');
  assert.equal(app.slug, 'mimir-o');
  assert.match(app.pem, /BEGIN RSA PRIVATE KEY/);
});

test('a callback with a wrong state, a bad code or a second use is refused', async () => {
  const gh = fakeGitHub(APP);
  const flow = startFlow({ owner: 'o', repoUrl: 'https://github.com/o/mimir', fetchImpl: gh.fetchImpl });
  const start = await flow.ready;
  const state = /state=([0-9a-f]{48})/.exec((await get(start)).body)[1];
  const cb = (q) => get(start.replace('/start', `/callback?${q}`));
  assert.equal((await cb(`code=abc&state=${'0'.repeat(48)}`)).status, 400);
  assert.equal((await cb('code=abc')).status, 400);
  assert.equal((await cb(`code=../../user&state=${state}`)).status, 400);
  assert.equal(gh.calls.length, 0, 'GitHub must not be contacted for refused callbacks');
  assert.equal((await cb(`code=abc&state=${state}`)).status, 200);
  await flow.done;
  assert.equal((await cb(`code=abc&state=${state}`)).status, 400);
  flow.close();
  assert.equal(gh.calls.length, 1);
});

test('requests with a foreign Host header are refused', async () => {
  const flow = startFlow({ owner: 'o', repoUrl: 'https://github.com/o/mimir', fetchImpl: fakeGitHub(APP).fetchImpl });
  flow.done.catch(() => {});
  const start = await flow.ready;
  const res = await get(start, { host: 'evil.example' });
  flow.close();
  assert.equal(res.status, 400);
});

test('a refusal from GitHub is reported and no app is returned', async () => {
  const flow = startFlow({ owner: 'o', repoUrl: 'https://github.com/o/mimir', fetchImpl: fakeGitHub({ message: 'Not Found' }, 404).fetchImpl });
  const start = await flow.ready;
  const state = /state=([0-9a-f]{48})/.exec((await get(start)).body)[1];
  const rejected = assert.rejects(flow.done, /HTTP 404/);
  const cb = await get(start.replace('/start', `/callback?code=abc&state=${state}`));
  await rejected;
  flow.close();
  assert.equal(cb.status, 502);
});

test('each copy gets an app name of its own, within GitHub\'s 34 characters', () => {
  assert.equal(buildManifest({ owner: 'wi24rd-com', repoUrl: 'https://github.com/wi24rd-com/mimir-wi24rd', port: 1 }).name, 'mimir-wi24rd-com-mimir-wi24rd');
  assert.notEqual(appName('o', 'mimir'), appName('o', 'mimir-two'));
  const long = appName('a-very-long-organisation-name', 'my-mimir-copy-two');
  assert.ok(long.length <= 34);
  assert.match(long, /^[a-z0-9-]+$/);
  assert.notEqual(long, appName('a-very-long-organisation-name', 'my-mimir-copy-three'));
  assert.equal(appName('O', 'My.Repo_1'), 'mimir-o-my-repo-1');
});

// A stand-in for the GitHub CLI that answers the Pages questions and records what was asked.
function pagesWorld({ already = false, create = true } = {}) {
  const calls = [];
  const said = [];
  const gh = (args) => {
    calls.push(args);
    if (args.includes('POST')) return create ? { ok: true, out: 'https://o.github.io/mimir/' } : { ok: false, out: '' };
    return already ? { ok: true, out: 'https://o.github.io/mimir/' } : { ok: false, out: '' };
  };
  return { gh, calls, said, say: (line) => said.push(line) };
}

test('pages: switched on for main and /docs when the owner says yes, and not asked for when it is on', async () => {
  const w = pagesWorld();
  assert.equal(await pages({ slug: 'o/mimir', gh: w.gh, ask: async () => '', say: w.say }), 'https://o.github.io/mimir/');
  assert.deepEqual(w.calls[1].slice(0, 8), ['api', '--method', 'POST', 'repos/o/mimir/pages', '-f', 'source[branch]=main', '-f', 'source[path]=/docs']);
  const on = pagesWorld({ already: true });
  let asked = 0;
  assert.equal(await pages({ slug: 'o/mimir', gh: on.gh, ask: async () => { asked++; return ''; }, say: on.say }), 'https://o.github.io/mimir/');
  assert.equal(asked, 0);
  assert.equal(on.calls.length, 1);
});

test('pages: left off when the owner says no, and the manual way is given when GitHub refuses', async () => {
  const no = pagesWorld();
  assert.equal(await pages({ slug: 'o/mimir', gh: no.gh, ask: async () => 'n', say: no.say }), null);
  assert.equal(no.calls.length, 1);
  assert.match(no.said.join(' '), /Settings, Pages/);
  const refused = pagesWorld({ create: false });
  assert.equal(await pages({ slug: 'o/mimir', gh: refused.gh, ask: async () => 'y', say: refused.say }), null);
  assert.match(refused.said.join(' '), /Deploy from a branch/);
});

// A stand-in for the GitHub CLI during the first collection. "runs" is what each
// started collection ends as; "logs" is what its failed log says.
function collecting({ runs, logs = [], start = true }) {
  const calls = [];
  const said = [];
  let started = 0;
  const gh = (args) => {
    calls.push(args.join(' '));
    if (args[0] === 'workflow') { if (!start) return { ok: false, out: '' }; started++; return { ok: true, out: '' }; }
    if (args[1] === 'list') return { ok: true, out: JSON.stringify(started ? [{ databaseId: 100 + started, status: runs[started - 1] === 'running' ? 'in_progress' : 'completed', conclusion: runs[started - 1] }] : []) };
    if (args[1] === 'view') return { ok: true, out: logs[started - 1] ?? '' };
    return { ok: false, out: '' };
  };
  let asked = 0;
  let opened = 0;
  const run = (options = {}) => firstCollection({ gh, say: (line) => said.push(line), ask: async () => { asked++; return ''; }, open: () => { opened++; }, wait: async () => {}, installUrl: 'https://github.com/apps/mimir-o-mimir/installations/new', patience: 3, ...options });
  return { run, calls, said, asked: () => asked, opened: () => opened, started: () => started };
}
// The lines GitHub writes when the app has no installation on the account (from a real run).
const NOT_INSTALLED = "collect\tGet a short-lived token\t    url: 'https://api.github.com/users/o/installation',\ncollect\tGet a short-lived token\t    status: 404,\ncollect\tGet a short-lived token\t##[error]Not Found - https://docs.github.com/rest/apps/apps#get-a-user-installation-for-the-authenticated-app";

test('first collection: setup waits for it and says when the figures are there', async () => {
  const w = collecting({ runs: ['success'] });
  assert.equal(await w.run(), 'ok');
  assert.match(w.said.join('\n'), /Collected\. Your figures are in the "data" branch/);
  assert.equal(w.asked(), 0);
});

test('first collection: an app that is not installed is said plainly, with the link, and tried again after Enter', async () => {
  const w = collecting({ runs: ['failure', 'success'], logs: [NOT_INSTALLED] });
  assert.equal(await w.run(), 'ok');
  const text = w.said.join('\n');
  assert.match(text, /your app is not installed on your account yet/);
  assert.match(text, /https:\/\/github\.com\/apps\/mimir-o-mimir\/installations\/new/);
  assert.equal(w.asked(), 1);
  assert.equal(w.opened(), 1);
  assert.equal(w.started(), 2);
});

test('first collection: it gives up after three tries and leaves the command to run', async () => {
  const w = collecting({ runs: ['failure', 'failure', 'failure'], logs: [NOT_INSTALLED, NOT_INSTALLED, NOT_INSTALLED] });
  assert.equal(await w.run(), 'failed');
  assert.equal(w.started(), 3);
  assert.equal(w.asked(), 2);
  assert.match(w.said.join('\n'), /gh workflow run collect\.yml/);
});

test('first collection: repositories the app cannot read are named, and other failures point to the log', async () => {
  const partial = collecting({ runs: ['failure'], logs: ['collect\tCollect\t  Your Mimir app cannot read traffic for: o/a, o/b\ncollect\tCollect\t  Add them under'] });
  assert.equal(await partial.run(), 'partial');
  assert.match(partial.said.join('\n'), /cannot read traffic for: o\/a, o\/b/);
  const other = collecting({ runs: ['failure'], logs: ['collect\tRead mimir.json\tmimir.json: not valid JSON'] });
  assert.equal(await other.run(), 'failed');
  assert.match(other.said.join('\n'), /gh run view 101 --log-failed/);
});

test('first collection: a run that takes long, or cannot be started, is not reported as done', async () => {
  const slow = collecting({ runs: ['running'] });
  assert.equal(await slow.run(), 'running');
  assert.match(slow.said.join('\n'), /still running/);
  const none = collecting({ runs: [], start: false });
  assert.equal(await none.run(), 'not-started');
  assert.match(none.said.join('\n'), /Actions tab/);
});
