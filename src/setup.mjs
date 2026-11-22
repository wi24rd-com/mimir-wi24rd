// One-command setup. Run it inside your clone of this repository:
//
//   node src/setup.mjs
//
// It asks which repositories to follow and how to store the figures, and
// writes mimir.json for you. Then it registers a GitHub App that belongs to you
// (read-only "Administration" access, nothing else), stores its key as a
// repository secret, switches GitHub Pages on, and starts the first collection.
// You confirm twice in the browser: once to create the app, once to choose the
// repositories it may read. It can be run again: what is done is skipped.
//
// Nothing is sent anywhere except github.com. The private key goes straight
// from GitHub into your repository's secrets; it is never written to disk or
// shown on screen.
import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadConfig } from './config.mjs';
import { guide, needsGuide, saveConfig } from './guide.mjs';
import { generatePassphrase } from './lib/crypto.mjs';
import { pagesUrl } from '../docs/lib/public.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// GitHub App names are unique across GitHub and at most 34 characters. The
// repository is part of the name, so a second copy of Mimir on the same account
// gets its own app. A long name is cut and given a short mark made from the full one.
export function appName(owner, repo) {
  const full = `mimir-${owner}-${repo}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  if (full.length <= 34) return full;
  return `${full.slice(0, 29).replace(/-+$/, '')}-${createHash('sha256').update(full).digest('hex').slice(0, 4)}`;
}

export function buildManifest({ owner, repoUrl, port }) {
  const repo = repoUrl.replace(/\/+$/, '').split('/').pop();
  return {
    name: appName(owner, repo),
    url: repoUrl,
    description: 'Reads traffic figures for my own repositories. Created by Wi24rd Mimir.',
    hook_attributes: { url: repoUrl, active: false },
    redirect_url: `http://127.0.0.1:${port}/callback`,
    public: false,
    default_permissions: { administration: 'read' },
    default_events: [],
  };
}

// Starts a listener on 127.0.0.1 only. "/start" sends the browser to GitHub
// with the manifest; GitHub sends it back to "/callback" with a one-time code,
// which is exchanged for the app's id and key.
export function startFlow({ owner, repoUrl, web = 'https://github.com', api = 'https://api.github.com', fetchImpl = fetch, timeoutMs = 15 * 60 * 1000 }) {
  const state = randomBytes(24).toString('hex');
  let finish;
  let fail;
  const done = new Promise((res, rej) => { finish = res; fail = rej; });
  let port = 0;
  let used = false;

  const page = (res, status, title, body) => {
    res.writeHead(status, {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy': `default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action ${web}`,
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    });
    res.end(`<!doctype html><meta charset="utf-8"><title>${esc(title)}</title><body style="font:16px system-ui;max-width:36rem;margin:4rem auto;padding:0 1rem"><h1>${esc(title)}</h1>${body}`);
  };

  const server = http.createServer(async (req, res) => {
    if (req.headers.host !== `127.0.0.1:${port}` || req.method !== 'GET') { res.writeHead(400).end(); return; }
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/start') {
      const manifest = JSON.stringify(buildManifest({ owner, repoUrl, port }));
      page(res, 200, 'Wi24rd Mimir setup', `<p>Sending you to GitHub to create your own Mimir app.</p><form id="f" method="post" action="${esc(web)}/settings/apps/new?state=${state}"><input type="hidden" name="manifest" value="${esc(manifest)}"><button>Continue to GitHub</button></form><script>document.getElementById("f").submit()</script>`);
      return;
    }
    if (url.pathname === '/callback') {
      const got = Buffer.from(url.searchParams.get('state') ?? '');
      const code = url.searchParams.get('code') ?? '';
      const stateOk = got.length === state.length && timingSafeEqual(got, Buffer.from(state));
      if (used || !stateOk || !/^[A-Za-z0-9_-]{1,120}$/.test(code)) { page(res, 400, 'Not accepted', '<p>This request did not come from the setup you started. Nothing was changed.</p>'); return; }
      used = true;
      try {
        const r = await fetchImpl(`${api}/app-manifests/${code}/conversions`, { method: 'POST', headers: { accept: 'application/vnd.github+json', 'user-agent': 'wi24rd-mimir' } });
        if (!r.ok) throw new Error(`GitHub answered HTTP ${r.status} when the app was being created`);
        const app = await r.json();
        if (!app.pem || !app.client_id || !app.slug) throw new Error('GitHub did not return the expected app details');
        page(res, 200, 'App created', '<p>Return to the terminal to finish.</p>');
        finish({ id: app.id, clientId: app.client_id, slug: app.slug, pem: app.pem, permissions: app.permissions ?? {} });
      } catch (e) {
        page(res, 502, 'Something went wrong', `<p>${esc(e.message)}</p>`);
        fail(e);
      }
      return;
    }
    res.writeHead(404).end();
  });

  const timer = setTimeout(() => fail(new Error('timed out waiting for GitHub (15 minutes)')), timeoutMs);
  timer.unref();
  const close = () => { clearTimeout(timer); server.close(); server.closeAllConnections?.(); };
  const ready = new Promise((res) => server.listen(0, '127.0.0.1', () => { port = server.address().port; res(`http://127.0.0.1:${port}/start`); }));
  return { ready, done, close };
}

function gh(args, { input, quiet = false } = {}) {
  const r = spawnSync('gh', args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', quiet ? 'pipe' : 'inherit'] });
  if (r.error) throw new Error('GitHub CLI (gh) was not found. Install it from https://cli.github.com and run "gh auth login".');
  return { ok: r.status === 0, out: (r.stdout ?? '').trim() };
}

function openBrowser(url) {
  const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  spawnSync(cmd[0], cmd[1], { stdio: 'ignore' });
}

function run(cmd, args) {
  // The terminal stays connected, so git can ask for a passphrase or a sign-in when it needs one.
  const r = spawnSync(cmd, args, { encoding: 'utf8', stdio: ['inherit', 'pipe', 'inherit'] });
  return { ok: !r.error && r.status === 0, out: (r.stdout ?? '').trim() };
}

// Switches GitHub Pages on for the docs/ folder, unless it already is. Returns
// the address of the dashboard, or null when Pages is not on. "gh" and "ask" are handed in for the tests.
export async function pages({ slug, gh: ghRun, ask, say }) {
  const have = ghRun(['api', `repos/${slug}/pages`, '--jq', '.html_url'], { quiet: true });
  if (have.ok && /^https:\/\//.test(have.out)) { say(`GitHub Pages is on: ${have.out}`); return have.out; }
  const answer = String(await ask('Switch on GitHub Pages, so the dashboard gets an address of its own? [Y/n] ')).trim().toLowerCase();
  if (answer !== '' && answer !== 'y' && answer !== 'yes') { say('  Left off. You can switch it on later under Settings, Pages: branch "main", folder "/docs".'); return null; }
  const made = ghRun(['api', '--method', 'POST', `repos/${slug}/pages`, '-f', 'source[branch]=main', '-f', 'source[path]=/docs', '--jq', '.html_url'], { quiet: true });
  if (!made.ok) { say('  Could not switch it on from here. Do it under Settings, Pages: "Deploy from a branch", branch "main", folder "/docs".'); return null; }
  const url = /^https:\/\//.test(made.out) ? made.out : pagesUrl(slug);
  say(`  GitHub Pages is on. The address works in a minute or two: ${url}`);
  return url;
}

const newestRun = (ghRun) => {
  const r = ghRun(['run', 'list', '--workflow', 'collect.yml', '--limit', '1', '--json', 'databaseId,status,conclusion'], { quiet: true });
  try { return r.ok ? JSON.parse(r.out)[0] ?? null : null; } catch { return null; }
};

// Starts the first collection and stays with it until it has finished, because
// this is where a setup that looks done turns out not to be: an app that was
// created but never installed makes the collection fail a few seconds in.
// Returns 'ok', 'partial', 'failed', 'running' or 'not-started'.
export async function firstCollection({ gh: ghRun, ask, say, installUrl, open = () => {}, wait = (ms) => new Promise((r) => setTimeout(r, ms)), tries = 3, patience = 48 }) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    const before = newestRun(ghRun)?.databaseId ?? null;
    if (!ghRun(['workflow', 'run', 'collect.yml'], { quiet: true }).ok) { say('Could not start the first collection. Start it from the Actions tab ("Collect" > "Run workflow").'); return 'not-started'; }
    say('First collection started. Waiting for it to finish; it takes about a minute.');
    let run = null;
    for (let i = 0; i < patience; i++) {
      await wait(5000);
      const newest = newestRun(ghRun);
      if (newest && newest.databaseId !== before && newest.status === 'completed') { run = newest; break; }
    }
    if (!run) { say('  It is still running. Follow it with: gh run watch'); return 'running'; }
    if (run.conclusion === 'success') { say('  Collected. Your figures are in the "data" branch.'); return 'ok'; }
    const log = ghRun(['run', 'view', String(run.databaseId), '--log-failed'], { quiet: true }).out;
    if (/\/installation'?/.test(log) && /Not Found|status: 404/.test(log)) {
      say(`  The collection could not get access: your app is not installed on your account yet.\n  Install it here, choose "Only select repositories" and pick the repositories Mimir follows:\n    ${installUrl}`);
      if (attempt === tries) break;
      open(installUrl);
      await ask('  Press Enter when it says "Installed", and the collection is tried again. ');
      continue;
    }
    const missing = /Your Mimir app cannot read traffic for: ([^\n]+)/.exec(log)?.[1]?.trim();
    if (missing) {
      say(`  Collected, but the app cannot read traffic for: ${missing}\n  Add them under "Repository access" at https://github.com/settings/installations\n  The next collection picks them up; nothing is lost in the meantime.`);
      return 'partial';
    }
    say(`  The first collection did not complete. See why with: gh run view ${run.databaseId} --log-failed`);
    return 'failed';
  }
  say('  The collection still cannot get access. Install the app, then run: gh workflow run collect.yml');
  return 'failed';
}

async function main() {
  const force = process.argv.includes('--force');
  const say = console.log;

  if (!gh(['auth', 'status'], { quiet: true }).ok) throw new Error('Not signed in. Run "gh auth login" first.');
  const view = gh(['repo', 'view', '--json', 'nameWithOwner,url,visibility'], { quiet: true });
  if (!view.ok) throw new Error('Run this inside your clone of the Mimir repository, after it has been pushed to GitHub.');
  const repo = JSON.parse(view.out);
  const isPrivate = repo.visibility !== 'PUBLIC';

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (question) => rl.question(question);
  try {
    say(`\nWi24rd Mimir setup\n  Data repository : ${repo.nameWithOwner} (${isPrivate ? 'private' : 'public'})\n`);
    // A fresh copy still holds the example: ask, and write mimir.json.
    let shipped = null;
    try { shipped = JSON.parse(readFileSync('mimir.json', 'utf8')); } catch { /* missing or broken: loadConfig says which, below */ }
    if (shipped && needsGuide(shipped)) {
      const made = await guide({ repo: { nameWithOwner: repo.nameWithOwner, isPrivate }, ask, gh, say });
      await saveConfig({ text: made.text, ask, say, git: (args) => run('git', args), sh: (args) => run('sh', args), write: (text) => writeFileSync('mimir.json', text), hasFixedTime: existsSync('tools/fast-tid.sh') });
    }
    const config = loadConfig();
    say(`  Mode            : ${config.visibility}\n  Following       : ${config.repos.join(', ')}\n`);
    if (config.visibility === 'private' && !isPrivate) throw new Error('mimir.json says "private", but this repository is public. Make the repository private, or choose "encrypted" or "public".');
    if (config.visibility === 'public') say('  Note: in "public" mode anyone can read the collected figures.\n');

    const existing = gh(['variable', 'get', 'MIMIR_APP_CLIENT_ID'], { quiet: true });
    let slug = gh(['variable', 'get', 'MIMIR_APP_SLUG'], { quiet: true }).out;
    if (existing.ok && existing.out && !force) {
      say('An app is already connected to this repository. Skipping app creation (use --force to create a new one).');
    } else {
      const flow = startFlow({ owner: config.owner, repoUrl: repo.url });
      const startUrl = await flow.ready;
      say(`Step 1 of 2: create your app. Opening the browser.\n  If nothing opens, go to: ${startUrl}\n`);
      openBrowser(startUrl);
      let app;
      try { app = await flow.done; } finally { flow.close(); }
      if (app.permissions.administration !== 'read') say('  Warning: GitHub did not confirm "Administration: read". Check the app\'s permissions.');
      if (!gh(['secret', 'set', 'MIMIR_APP_PRIVATE_KEY'], { input: app.pem }).ok) throw new Error('Could not store the app key as a repository secret.');
      app.pem = '';
      if (!gh(['variable', 'set', 'MIMIR_APP_CLIENT_ID', '--body', app.clientId]).ok) throw new Error('Could not store the app client id.');
      gh(['variable', 'set', 'MIMIR_APP_SLUG', '--body', app.slug]);
      slug = app.slug;
      say(`  App "${slug}" created. Its key is stored as a secret in ${repo.nameWithOwner}.\n`);
    }

    if (config.visibility === 'encrypted') {
      const secrets = gh(['secret', 'list', '--json', 'name'], { quiet: true });
      const has = secrets.ok && JSON.parse(secrets.out).some((s) => s.name === 'MIMIR_PASSPHRASE');
      if (!has) {
        const passphrase = generatePassphrase();
        if (!gh(['secret', 'set', 'MIMIR_PASSPHRASE'], { input: passphrase }).ok) throw new Error('Could not store the passphrase.');
        say(`Your passphrase. It opens the dashboard and is shown only this once.\nSave it in your password manager:\n\n    ${passphrase}\n`);
        await rl.question('Press Enter when you have saved it. ');
      }
    }

    if (slug) {
      const install = `https://github.com/apps/${slug}/installations/new`;
      say(`\nStep 2 of 2: install the app and choose the repositories it may read.\n  Choose "Only select repositories", pick these, and press Install:\n${config.repos.map((r) => `      ${r}`).join('\n')}\n  If nothing opens, go to: ${install}\n`);
      openBrowser(install);
      await rl.question('Press Enter when GitHub says the app is installed. ');
    }

    // The dashboard on GitHub Pages needs a public repository.
    say('');
    const address = isPrivate ? null : await pages({ slug: repo.nameWithOwner, gh, ask, say });

    say('');
    const collected = await firstCollection({ gh, ask, say, installUrl: slug ? `https://github.com/apps/${slug}/installations/new` : 'https://github.com/settings/installations', open: openBrowser });

    const done = collected === 'ok' || collected === 'partial';
    say(done ? '\nDone. From here:' : '\nSetup is in place, but there are no figures yet. When the collection has run:');
    say('  node src/show.mjs          your figures in the terminal');
    say('  node src/dashboard.mjs     the dashboard on this computer');
    if (address) say(`  ${address}   the dashboard on GitHub Pages${config.visibility === 'encrypted' ? ', opened with your passphrase' : ''}`);
    say('  Collection runs twice a day from now on.\n');
  } finally {
    rl.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Setup can be run again, and it says where: after install.sh the terminal is still in the folder above.
  main().catch((e) => { console.error(`\nSetup stopped: ${e.message}\n\nTo start it again:\n  cd "${process.cwd()}" && node src/setup.mjs`); process.exit(1); });
}
