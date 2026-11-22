// Opens the dashboard in your browser, served from this computer only.
//
//   node src/dashboard.mjs          your figures, from the "data" branch
//   node src/dashboard.mjs --demo   invented figures (add --encrypted to try the passphrase screen)
//
// The page is served on 127.0.0.1 and reads nothing from the internet. In
// encrypted mode the browser asks for your passphrase and decrypts there.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { encryptJson } from './lib/crypto.mjs';
import { readDataBranch, readPublished, repoSlug, workflowState } from './lib/data.mjs';
import { publicFigures, publicWell } from '../docs/lib/public.js';
import { demoState } from './lib/demo.mjs';

// Only for "--demo --encrypted": it protects invented figures, nothing else.
const DEMO_PASSPHRASE = 'demo-passphrase-for-mimir';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json; charset=utf-8', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; manifest-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// root: folder with the dashboard files. getState / getConfig: functions that
// return the JSON to serve, or throw with a message for the page to show.
export function createDashboardServer({ root, getState, getConfig, getPublic = () => { throw new Error('nothing is published'); }, getWorkflow = () => { throw new Error('not asked'); }, source }) {
  const base = resolve(root);
  let port = 0;
  const send = (res, status, type, body) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'content-security-policy': CSP, 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'cross-origin-resource-policy': 'same-origin' });
    res.end(body);
  };
  const json = (res, status, value) => send(res, status, TYPES['.json'], JSON.stringify(value));

  const server = http.createServer((req, res) => {
    // Only this computer, under its two own names. "localhost" is accepted because browsers
    // refuse passkeys (Face ID, fingerprint) on a numeric address.
    if (![`127.0.0.1:${port}`, `localhost:${port}`].includes(req.headers.host) || req.method !== 'GET') return send(res, 400, TYPES['.txt'], 'Bad request');
    let path;
    try { path = decodeURIComponent(new URL(req.url, `http://127.0.0.1:${port}`).pathname); } catch { return send(res, 400, TYPES['.txt'], 'Bad request'); }
    if (path === '/mimir-source.json') return json(res, 200, source);
    if (path === '/data/state' || path === '/data/config' || path === '/data/public' || path === '/data/workflow') {
      const answer = { '/data/state': getState, '/data/config': getConfig, '/data/public': getPublic, '/data/workflow': getWorkflow }[path];
      try { return json(res, 200, answer()); }
      catch (e) { return json(res, 404, { error: e.message }); }
    }
    if (path === '/') path = '/index.html';
    const file = normalize(join(base, path));
    const inside = file.startsWith(base + sep);
    const hidden = path.split('/').some((part) => part.startsWith('.'));
    const type = TYPES[extname(file)];
    if (!inside || hidden || !type || !existsSync(file) || !statSync(file).isFile()) return send(res, 404, TYPES['.txt'], 'Not found');
    send(res, 200, type, readFileSync(file));
  });

  const ready = new Promise((ok) => server.listen(0, '127.0.0.1', () => { port = server.address().port; ok(`http://127.0.0.1:${port}/`); }));
  return { ready, close: () => { server.close(); server.closeAllConnections?.(); } };
}

function main() {
  const demo = process.argv.includes('--demo');
  const here = fileURLToPath(new URL('..', import.meta.url));
  // The demo has its own settings, so it never shows the names in your mimir.json.
  const getConfig = demo
    ? () => ({ version: 1, visibility: process.argv.includes('--encrypted') ? 'encrypted' : 'public', repos: Object.keys(demoState().repos), public_badges: ['total_downloads', 'stars', 'repo_downloads', 'well'] })
    : () => JSON.parse(readFileSync(join(here, 'mimir.json'), 'utf8'));
  let getState;
  let getPublic;
  // Asked by the page only when collection looks stopped: is the workflow still switched on?
  const getWorkflow = demo ? undefined : () => workflowState({ cwd: here });
  // In the demo every figure that can be published is, so the front page has something to show.
  const demoAll = (state) => ({ repos: Object.keys(state.repos), public_badges: ['total_downloads', 'stars', 'repo_downloads', 'well'] });
  const demoPublic = (state) => () => ({ mimir: 1, day: new Date().toISOString().slice(0, 10), figures: publicFigures(demoAll(state), state).map(({ id, repo, value }) => (repo ? { id, repo, value } : { id, value })), well: publicWell(demoAll(state), state) });
  if (demo && process.argv.includes('--encrypted')) {
    const state = demoState();
    const envelope = encryptJson(state, DEMO_PASSPHRASE);
    getState = () => envelope;
    getPublic = demoPublic(state);
    console.log(`Demo passphrase: ${DEMO_PASSPHRASE}`);
  } else if (demo) {
    const state = demoState();
    getState = () => state;
    getPublic = demoPublic(state);
  } else {
    readDataBranch({ cwd: here });
    // Fetches from GitHub each time, so "Fetch again" in the page shows the newest collection.
    getState = () => readDataBranch({ cwd: here }).body;
    // Nothing published yet is an empty list, not an error.
    getPublic = () => { try { return readPublished({ cwd: here }); } catch { return { mimir: 1, figures: [] }; } };
  }
  // --front shows the page a visitor meets on GitHub Pages before the lock.
  const front = process.argv.includes('--front');
  const server = createDashboardServer({ root: join(here, 'docs'), getState, getConfig, getPublic, getWorkflow, source: { mode: 'local', demo, front, repository: demo ? null : repoSlug(here), branch: 'main' } });
  server.ready.then((url) => {
    console.log(`Mimir dashboard${demo ? ' (demo, invented figures)' : ''}: ${url}\nPress Ctrl+C to stop.`);
    if (!process.argv.includes('--no-open')) {
      const cmd = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
      spawnSync(cmd[0], cmd[1], { stdio: 'ignore' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`Mimir: ${e.message}`); process.exit(1); }
}
