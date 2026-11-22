// Brings your copy of Mimir up to a newer version. Run it inside your clone:
//
//   node src/update.mjs            the newest version
//   node src/update.mjs v1.2.0     a version you name
//   node src/update.mjs --check    only say whether there is a newer one
//
// It fetches the version from the Mimir repository and replaces Mimir's own
// files with it. Your mimir.json, your README and your figures (the "data"
// branch) are not touched. Nothing is committed: you look at the change, run
// the tests, and commit and push it yourself.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEMPLATE = 'https://github.com/wi24rd-com/mimir.git';

// The files a version consists of. A newer version brings its own list
// (src/update-paths.json); this one is used when it does not.
const BUILT_IN = JSON.parse(readFileSync(new URL('./update-paths.json', import.meta.url), 'utf8'));

// "v1.2.3" or "1.2.3" as three numbers, or null. Pre-releases are not versions to update to.
export function parseVersion(text) {
  const m = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})$/.exec(String(text ?? '').trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}
export const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

// The highest version among tag names such as "v1.0.0". Null when there is none.
export function newest(tags) {
  return tags.filter(parseVersion).sort((a, b) => compare(parseVersion(b), parseVersion(a)))[0] ?? null;
}

// A path list from a version is outside data: only plain relative paths are accepted.
export function safePaths(list) {
  const ok = (p) => typeof p === 'string' && p.length > 0 && p.length < 200 && !p.startsWith('/') && !p.startsWith('-') && !p.split('/').includes('..') && !p.split('/').includes('.git') && /^[A-Za-z0-9._/-]+$/.test(p);
  const own = (p) => p === 'mimir.json' || p === 'README.md' || p === '.git' || p === '.';
  if (!list || !Array.isArray(list.replace) || !Array.isArray(list.keep)) throw new Error('the version has no usable list of files');
  if (![...list.replace, ...list.keep].every(ok) || list.replace.some(own) || list.replace.length > 100) throw new Error('the version lists a file Mimir will not replace');
  return { replace: list.replace, keep: list.keep };
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.error) throw new Error('git was not found');
  return { ok: r.status === 0, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

// Returns { from, to, changed } and leaves the change staged, or { from, to: null } when there is nothing newer.
export function update({ cwd = process.cwd(), template = TEMPLATE, wanted = null, check = false, allowMajor = false } = {}) {
  const pkgPath = join(cwd, 'package.json');
  const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
  if (pkg?.name !== 'wi24rd-mimir') throw new Error('run this in the top folder of your Mimir clone');
  const from = parseVersion(pkg.version);
  if (!from) throw new Error(`package.json holds the version "${pkg.version}", which is not a version number`);

  const listed = git(['ls-remote', '--tags', '--refs', template], cwd);
  if (!listed.ok) throw new Error(`could not reach ${template}`);
  const tags = listed.out.split('\n').map((line) => line.split('refs/tags/')[1]).filter(Boolean);
  if (wanted && !parseVersion(wanted)) throw new Error(`"${wanted}" is not a version such as v1.2.0`);
  const tag = wanted ? tags.find((t) => parseVersion(t) && compare(parseVersion(t), parseVersion(wanted)) === 0) : newest(tags);
  if (wanted && !tag) throw new Error(`there is no version ${wanted}`);
  if (!tag) return { from: pkg.version, to: null, released: false };
  const to = parseVersion(tag);
  if (!wanted && compare(to, from) <= 0) return { from: pkg.version, to: null, released: true };
  if (check) return { from: pkg.version, to: tag, changed: null };
  if (to[0] > from[0] && !allowMajor) throw new Error(`${tag} is a new major version and may need more than new files. Read its release notes, then run: node src/update.mjs ${tag} --major`);

  if (git(['status', '--porcelain'], cwd).out) throw new Error('this clone has changes that are not committed. Commit or put them aside first, so the update is the only change.');
  if (!git(['fetch', '--quiet', '--no-tags', template, `refs/tags/${tag}`], cwd).ok) throw new Error(`could not fetch ${tag}`);
  const target = git(['rev-parse', '--verify', '--quiet', 'FETCH_HEAD^{commit}'], cwd).out;
  if (!target) throw new Error(`could not read ${tag}`);

  const shipped = git(['show', `${target}:src/update-paths.json`], cwd);
  const paths = safePaths(shipped.ok ? JSON.parse(shipped.out) : BUILT_IN);
  const kept = paths.keep.filter((p) => git(['cat-file', '-e', `HEAD:${p}`], cwd).ok);
  for (const p of paths.replace) {
    // Removed first, so a file the new version no longer has does not stay behind.
    git(['rm', '-r', '--quiet', '--ignore-unmatch', '--', p], cwd);
    if (git(['cat-file', '-e', `${target}:${p}`], cwd).ok && !git(['checkout', target, '--', p], cwd).ok) throw new Error(`could not take ${p} from ${tag}. Run "git reset --hard" to go back to where you were.`);
  }
  for (const p of kept) git(['checkout', 'HEAD', '--', p], cwd);
  const changed = git(['diff', '--cached', '--name-only'], cwd).out.split('\n').filter(Boolean);
  return { from: pkg.version, to: tag, changed };
}

function main() {
  const args = process.argv.slice(2);
  const wanted = args.find((a) => !a.startsWith('--')) ?? null;
  const result = update({ template: process.env.MIMIR_TEMPLATE || TEMPLATE, wanted, check: args.includes('--check'), allowMajor: args.includes('--major') });
  if (!result.to) { console.log(result.released ? `Mimir ${result.from} is the newest version.` : `Mimir ${result.from}: no version has been released yet.`); return; }
  if (result.changed === null) { console.log(`Mimir ${result.to} is available (you have ${result.from}). Run: node src/update.mjs`); return; }
  if (!result.changed.length) { console.log(`Your copy already holds the files of ${result.to}.`); return; }
  console.log(`Mimir ${result.from} -> ${result.to}: ${result.changed.length} files changed. Nothing is committed yet.\n`);
  console.log('  git diff --cached --stat     look at the change');
  console.log('  npm test                     run the tests');
  console.log(`  git commit -m "Mimir ${result.to}" && git push`);
  console.log('\nTo go back instead: git reset --hard');
  if (result.changed.some((f) => f.startsWith('.github/workflows/'))) console.log('\nA workflow file changed. If the push is refused, give the GitHub CLI the "workflow" permission: gh auth refresh -s workflow');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { main(); } catch (e) { console.error(`Mimir update stopped: ${e.message}`); process.exit(1); }
}
