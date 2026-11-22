// Reads the collected figures from the "data" branch of your clone.
import { spawnSync } from 'node:child_process';

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error('git was not found');
  return { ok: r.status === 0, out: r.stdout ?? '', err: (r.stderr ?? '').trim() };
}

// Returns { encrypted, body } where body is the parsed state.enc or state.json.
export function readDataBranch({ cwd = process.cwd(), refresh = true } = {}) {
  if (refresh && !git(['fetch', '--quiet', 'origin', 'data'], cwd).ok) {
    if (!git(['rev-parse', '--verify', '--quiet', 'origin/data'], cwd).ok) {
      throw new Error('there is no "data" branch yet. Run setup, or start a collection from the Actions tab.');
    }
    console.error('Could not reach GitHub. Showing the figures from the last time they were fetched.');
  }
  for (const [file, encrypted] of [['state.enc', true], ['state.json', false]]) {
    const r = git(['show', `origin/data:${file}`], cwd);
    if (r.ok) {
      try { return { encrypted, body: JSON.parse(r.out) }; }
      catch { throw new Error(`${file} on the data branch is not valid JSON`); }
    }
  }
  throw new Error('the "data" branch holds no figures yet');
}

// public.json from the data branch: the figures the owner chose to publish.
export function readPublished({ cwd = process.cwd() } = {}) {
  const r = git(['show', 'origin/data:public.json'], cwd);
  if (!r.ok) throw new Error('nothing is published yet');
  return JSON.parse(r.out);
}

// What GitHub says about the collecting workflow: "active", "disabled_inactivity"
// (switched off by GitHub after 60 days without activity), "disabled_manually", ...
// Asked through the GitHub CLI, so it also works for a private repository.
export function workflowState({ cwd = process.cwd(), run = spawnSync } = {}) {
  const slug = repoSlug(cwd);
  if (!slug) throw new Error('this clone has no GitHub address');
  const r = run('gh', ['api', `repos/${slug}/actions/workflows/collect.yml`, '--jq', '.state'], { cwd, encoding: 'utf8' });
  const state = String(r.stdout ?? '').trim();
  if (r.error || r.status !== 0 || !/^[a-z_]{1,40}$/.test(state)) throw new Error('GitHub did not say whether the workflow is switched on');
  return { state };
}

// "owner/name" of the repository this clone was made from, or null.
export function repoSlug(cwd = process.cwd()) {
  const r = git(['remote', 'get-url', 'origin'], cwd);
  const m = /github\.com[:/]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\s*$/.exec(r.ok ? r.out : '');
  return m ? `${m[1]}/${m[2]}` : null;
}

// Asks for a line without showing what is typed. Falls back to reading a plain
// line when input is not a terminal.
export function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    process.stderr.write(question);
    let value = '';
    if (!input.isTTY) {
      input.setEncoding('utf8');
      input.once('data', (d) => resolve(String(d).split(/\r?\n/)[0]));
      input.once('end', () => resolve(value));
      return;
    }
    input.setRawMode(true);
    input.resume();
    input.setEncoding('utf8');
    const done = (fn, arg) => { input.setRawMode(false); input.pause(); input.removeListener('data', onData); process.stderr.write('\n'); fn(arg); };
    function onData(chunk) {
      for (const ch of chunk) {
        if (ch === '\r' || ch === '\n') return done(resolve, value);
        if (ch === '\u0003') return done(reject, new Error('cancelled'));
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    }
    input.on('data', onData);
  });
}
