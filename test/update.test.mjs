import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { compare, newest, parseVersion, safePaths, update } from '../src/update.mjs';

const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.invalid', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args], { cwd, encoding: 'utf8' }).trim();
const put = (root, files) => { for (const [path, text] of Object.entries(files)) { mkdirSync(dirname(join(root, path)), { recursive: true }); writeFileSync(join(root, path), text); } };
const pkg = (version) => `${JSON.stringify({ name: 'wi24rd-mimir', version }, null, 2)}\n`;
const LIST = JSON.stringify({ replace: ['.github/workflows/collect.yml', 'src', 'docs', 'package.json'], keep: ['docs/CNAME'] });

// A stand-in for the Mimir repository, with versions 1.0.0 and 1.1.0 tagged (and 2.0.0 when asked).
function template({ major = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mimir-tpl-'));
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  put(dir, { 'package.json': pkg('1.0.0'), 'src/collect.mjs': 'one\n', 'src/update-paths.json': LIST, 'docs/app.js': 'app one\n', '.github/workflows/collect.yml': 'name: Collect\n', 'mimir.json': '{"example":true}\n', 'README.md': 'Mimir\n' });
  git(dir, 'add', '-A'); git(dir, 'commit', '--quiet', '-m', '1.0.0'); git(dir, 'tag', 'v1.0.0');
  rmSync(join(dir, 'src/collect.mjs'));
  put(dir, { 'package.json': pkg('1.1.0'), 'src/gather.mjs': 'two\n', 'docs/app.js': 'app two\n', 'README.md': 'Mimir, newer\n' });
  git(dir, 'add', '-A'); git(dir, 'commit', '--quiet', '-m', '1.1.0'); git(dir, 'tag', 'v1.1.0');
  git(dir, 'tag', 'v1.2.0-beta.1');
  if (major) { put(dir, { 'package.json': pkg('2.0.0') }); git(dir, 'add', '-A'); git(dir, 'commit', '--quiet', '-m', '2.0.0'); git(dir, 'tag', 'v2.0.0'); }
  return dir;
}

// A copy of version 1.0.0 with the owner's own settings, README and custom domain. No shared history.
function copy() {
  const dir = mkdtempSync(join(tmpdir(), 'mimir-copy-'));
  git(dir, 'init', '--quiet', '--initial-branch', 'main');
  put(dir, { 'package.json': pkg('1.0.0'), 'src/collect.mjs': 'one\n', 'docs/app.js': 'app one\n', 'docs/CNAME': 'stats.example.org\n', '.github/workflows/collect.yml': 'name: Collect\n', '.github/workflows/mine.yml': 'name: Mine\n', 'mimir.json': '{"mine":true}\n', 'README.md': 'My figures\n' });
  git(dir, 'add', '-A'); git(dir, 'commit', '--quiet', '-m', 'my copy');
  return dir;
}
const text = (dir, path) => readFileSync(join(dir, path), 'utf8');

test('versions: parsed, compared, and the newest release is found', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('0.1.0'), [0, 1, 0]);
  for (const bad of ['v1.2', '1.2.3-beta.1', 'latest', '', 'v1.2.3; rm -rf x', null]) assert.equal(parseVersion(bad), null);
  assert.ok(compare([1, 10, 0], [1, 9, 9]) > 0);
  assert.equal(newest(['v1.0.0', 'v1.10.0', 'v1.9.0', 'v2.0.0-rc.1', 'nightly']), 'v1.10.0');
  assert.equal(newest(['nightly']), null);
});

test('update: takes the newest version and leaves the owner\'s files alone', () => {
  const tpl = template();
  const dir = copy();
  const result = update({ cwd: dir, template: tpl });
  assert.equal(result.from, '1.0.0');
  assert.equal(result.to, 'v1.1.0');
  assert.equal(text(dir, 'docs/app.js'), 'app two\n');
  assert.equal(text(dir, 'src/gather.mjs'), 'two\n');
  assert.equal(JSON.parse(text(dir, 'package.json')).version, '1.1.0');
  // A file the new version no longer has is gone.
  assert.ok(!existsSync(join(dir, 'src/collect.mjs')));
  // Settings, README, custom domain and the owner's own workflow are untouched.
  assert.equal(text(dir, 'mimir.json'), '{"mine":true}\n');
  assert.equal(text(dir, 'README.md'), 'My figures\n');
  assert.equal(text(dir, 'docs/CNAME'), 'stats.example.org\n');
  assert.equal(text(dir, '.github/workflows/mine.yml'), 'name: Mine\n');
  // Nothing is committed: the change is staged for the owner to look at.
  assert.equal(git(dir, 'log', '--oneline').split('\n').length, 1);
  assert.deepEqual(result.changed.sort(), ['docs/app.js', 'package.json', 'src/collect.mjs', 'src/gather.mjs', 'src/update-paths.json'].sort());
  assert.equal(git(dir, 'status', '--porcelain').split('\n').every((line) => /^[AMD] {2}/.test(line)), true);
  // "git reset --hard" takes it all back.
  git(dir, 'reset', '--quiet', '--hard');
  assert.equal(text(dir, 'docs/app.js'), 'app one\n');
  assert.equal(text(dir, 'src/collect.mjs'), 'one\n');
});

test('update: says so when there is nothing newer, or nothing released', () => {
  const tpl = template();
  const dir = copy();
  update({ cwd: dir, template: tpl });
  git(dir, 'commit', '--quiet', '-m', 'Mimir v1.1.0');
  assert.deepEqual(update({ cwd: dir, template: tpl }), { from: '1.1.0', to: null, released: true });
  const empty = mkdtempSync(join(tmpdir(), 'mimir-empty-'));
  git(empty, 'init', '--quiet');
  assert.deepEqual(update({ cwd: dir, template: empty }), { from: '1.1.0', to: null, released: false });
});

test('update: --check changes nothing, and a named version can be taken', () => {
  const tpl = template();
  const dir = copy();
  assert.deepEqual(update({ cwd: dir, template: tpl, check: true }), { from: '1.0.0', to: 'v1.1.0', changed: null });
  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(update({ cwd: dir, template: tpl, wanted: '1.1.0' }).to, 'v1.1.0');
  assert.throws(() => update({ cwd: copy(), template: tpl, wanted: 'v9.9.9' }), /no version/);
  assert.throws(() => update({ cwd: copy(), template: tpl, wanted: 'main' }), /not a version/);
});

test('update: refuses a clone with uncommitted changes, a new major version, and a folder that is not Mimir', () => {
  const tpl = template({ major: true });
  const dirty = copy();
  writeFileSync(join(dirty, 'mimir.json'), '{"mine":"edited"}\n');
  assert.throws(() => update({ cwd: dirty, template: tpl, wanted: 'v1.1.0' }), /not committed/);
  assert.equal(text(dirty, 'docs/app.js'), 'app one\n');
  const dir = copy();
  assert.throws(() => update({ cwd: dir, template: tpl }), /new major version/);
  assert.equal(git(dir, 'status', '--porcelain'), '');
  assert.equal(update({ cwd: dir, template: tpl, allowMajor: true }).to, 'v2.0.0');
  assert.throws(() => update({ cwd: mkdtempSync(join(tmpdir(), 'mimir-other-')), template: tpl }), /top folder of your Mimir clone/);
});

test('update: a file list from a version cannot point outside Mimir\'s own files', () => {
  assert.deepEqual(safePaths({ replace: ['src', 'docs'], keep: ['docs/CNAME'] }), { replace: ['src', 'docs'], keep: ['docs/CNAME'] });
  for (const bad of [['../outside'], ['/etc/passwd'], ['mimir.json'], ['README.md'], ['.git/config'], ['.'], ['--force'], ['src; rm -rf x'], ['']]) {
    assert.throws(() => safePaths({ replace: bad, keep: [] }), /will not replace/, JSON.stringify(bad));
  }
  assert.throws(() => safePaths({ replace: 'src' }), /no usable list/);
  // The list that ships with this version passes its own check.
  safePaths(JSON.parse(readFileSync(new URL('../src/update-paths.json', import.meta.url), 'utf8')));
});
