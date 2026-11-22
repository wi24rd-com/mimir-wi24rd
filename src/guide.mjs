// The questions setup asks when mimir.json still holds the example: which
// repositories to follow, how to store the figures, and what to publish. The
// answers become mimir.json. Nothing is written until the owner has seen the
// file and said yes.
//
// "ask" asks one question and returns the answer; "gh" and "git" run those
// programs. All three are handed in, so the tests can stand in for them.
import { BADGES, EXAMPLE_REPO, validateConfig } from './config.mjs';

export const needsGuide = (parsed) => !Array.isArray(parsed?.repos) || parsed.repos.length === 0 || parsed.repos.includes(EXAMPLE_REPO);

// "1 3 5", "1,3", "2-4" or "all" as a sorted list of positions (0-based).
// With fewer than ten choices, digits written together ("124") are read one by one.
// Null when the answer cannot be read that way. An empty answer is an empty list.
export function parsePick(text, count) {
  const answer = String(text ?? '').trim().toLowerCase();
  if (answer === '') return [];
  if (answer === 'all') return Array.from({ length: count }, (_, i) => i);
  const picked = new Set();
  const together = (part) => count < 10 && /^\d{2,9}$/.test(part);
  for (const part of answer.split(/[\s,]+/).filter(Boolean).flatMap((p) => (together(p) ? [...p] : [p]))) {
    const m = /^(\d{1,4})(?:-(\d{1,4}))?$/.exec(part);
    if (!m) return null;
    const from = Number(m[1]);
    const to = Number(m[2] ?? m[1]);
    if (from < 1 || to > count || from > to) return null;
    for (let i = from; i <= to; i++) picked.add(i - 1);
  }
  return [...picked].sort((a, b) => a - b);
}

const yes = (answer, fallback) => { const a = String(answer ?? '').trim().toLowerCase(); return a === '' ? fallback : a === 'y' || a === 'yes'; };

// Repositories of one account that are their own (not forks) and not archived.
export function listRepos(owner, gh) {
  const r = gh(['repo', 'list', owner, '--source', '--no-archived', '--limit', '200', '--json', 'nameWithOwner,visibility'], { quiet: true });
  if (!r.ok) throw new Error(`could not list the repositories of ${owner}`);
  let list;
  try { list = JSON.parse(r.out); } catch { throw new Error('GitHub CLI did not answer with a list of repositories'); }
  return list
    .filter((x) => typeof x?.nameWithOwner === 'string' && x.nameWithOwner.toLowerCase().startsWith(`${owner.toLowerCase()}/`))
    .map((x) => ({ name: x.nameWithOwner, private: String(x.visibility).toUpperCase() !== 'PUBLIC' }))
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
}

const MODES = {
  encrypted: 'encrypted  The figures are stored encrypted. Only your passphrase opens them. (recommended)',
  public: 'public     The figures are stored in the open. Anyone can read all of them.',
  private: 'private    The figures are stored in the open, in this private repository. Only you can read them.',
};
const PUBLISH = {
  total_downloads: 'Downloads in total, as a badge',
  stars: 'Stars in total, as a badge',
  repo_downloads: 'Downloads per repository, as one badge each',
  well: 'The Well on the front page. This publishes views and clones, which GitHub otherwise shows to you only',
};

// Asks until the answer can be used, at most five times.
async function until(ask, question, read, say) {
  for (let tries = 0; tries < 5; tries++) {
    const value = read(await ask(question));
    if (value !== null) return value;
    say('  That answer could not be read. Write the numbers with spaces between them, for example: 1 3');
  }
  throw new Error('no usable answer after five tries');
}

// repo: { nameWithOwner, isPrivate } of the repository Mimir runs in.
// Returns the validated settings and the text of mimir.json.
export async function guide({ repo, ask, gh, say }) {
  const [owner] = repo.nameWithOwner.split('/');
  const all = listRepos(owner, gh).filter((r) => r.name.toLowerCase() !== repo.nameWithOwner.toLowerCase());
  if (!all.length) throw new Error(`${owner} has no repositories to follow yet (forks and archived repositories are left out).`);

  say('Question 1 of 3: which repositories should Mimir follow?\n');
  const width = String(all.length).length;
  all.forEach((r, i) => say(`  ${String(i + 1).padStart(width)}  ${r.name}${r.private ? '  (private)' : ''}`));
  say(`\n  ${repo.nameWithOwner} itself is left out. You can change the list later in mimir.json.`);
  const picked = await until(ask, '\nNumbers with spaces between them (1 3 5), a span (2-4), or "all": ', (a) => { const p = parsePick(a, all.length); return p && p.length ? p : null; }, say);
  if (picked.length > 100) throw new Error('Mimir follows at most 100 repositories.');
  let repos = picked.map((i) => all[i].name);
  const hidden = picked.filter((i) => all[i].private).map((i) => all[i].name);
  if (hidden.length && !repo.isPrivate) {
    say(`\n  ${repo.nameWithOwner} is public, and mimir.json in it lists the repositories by name.\n  The names of these private repositories would be visible to everyone:\n`);
    for (const name of hidden) say(`      ${name}`);
    say('\n  1  Leave the private ones out (recommended)\n  2  Follow them anyway, with their names in the open\n  3  Stop');
    const choice = await until(ask, '\nNumber [1]: ', (a) => { const t = String(a ?? '').trim(); return t === '' ? 1 : [1, 2, 3].includes(Number(t)) ? Number(t) : null; }, say);
    if (choice === 3) throw new Error('Stopped. Nothing was changed.');
    if (choice === 1) {
      repos = repos.filter((name) => !hidden.includes(name));
      if (!repos.length) throw new Error('Stopped: every repository you picked is private. Nothing was changed. Pick public ones, or make this repository private.');
      say(`\n  Following ${repos.length}: ${repos.join(', ')}`);
    }
  }

  const modes = repo.isPrivate ? ['private', 'encrypted'] : ['encrypted', 'public'];
  say('\nQuestion 2 of 3: how should the figures be stored?\n');
  modes.forEach((m, i) => say(`  ${i + 1}  ${MODES[m]}`));
  const visibility = await until(ask, '\nNumber [1]: ', (a) => { const t = String(a ?? '').trim(); return t === '' ? modes[0] : modes[Number(t) - 1] ?? null; }, say);

  let badges = [];
  if (repo.isPrivate) {
    say('\nQuestion 3 of 3 is skipped: figures can only be published from a public repository.');
  } else {
    say('\nQuestion 3 of 3: should any figures be shown in the open? Nothing is, unless you choose it.\n');
    BADGES.forEach((b, i) => say(`  ${i + 1}  ${PUBLISH[b]}`));
    const chosen = await until(ask, '\nNumbers with spaces between them (1 2 4), or just Enter for none: ', (a) => parsePick(a, BADGES.length), say);
    badges = chosen.map((i) => BADGES[i]);
  }

  const settings = { version: 1, visibility, repos, public_badges: badges };
  const config = validateConfig(settings);
  return { config, text: `${JSON.stringify(settings, null, 2)}\n` };
}

// Shows the file, and saves, commits and pushes it when the owner says yes.
export async function saveConfig({ text, ask, git, sh, say, write, hasFixedTime = false }) {
  say(`\nThis becomes mimir.json:\n\n${text.split('\n').map((line) => (line ? `    ${line}` : '')).join('\n')}`);
  if (!yes(await ask('Save it, commit and push? [Y/n] '), true)) throw new Error('Stopped. Nothing was changed.');
  if (hasFixedTime && yes(await ask('Give commits in this clone a fixed time of day, so they do not show when you work (tools/fast-tid.sh)? [y/N] '), false)) {
    if (!sh(['tools/fast-tid.sh', 'install']).ok) say('  Could not switch that on. The commit will carry the real time.');
  }
  write(text);
  if (!git(['add', 'mimir.json']).ok || !git(['commit', '--quiet', '-m', 'Follow my repositories']).ok) throw new Error('mimir.json was saved, but could not be committed. Commit and push it yourself, then run setup again.');
  if (!git(['push', '--quiet']).ok) throw new Error('mimir.json was committed, but the push was refused. Run "git push", then run setup again.');
  say('  Saved and pushed.\n');
}
