// install.sh, run for real with stand-ins for gh, git, node and sleep on the PATH.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('../install.sh', import.meta.url));
const skip = process.platform === 'win32' ? 'needs a POSIX shell' : false;

// taken: the name already exists on GitHub. late: how many "git pull" calls it takes before the files arrive.
function stage({ taken = false, signedIn = true, late = 1, node = 'v22.0.0' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'mimir-inst-'));
  const bin = join(dir, 'bin');
  const work = join(dir, 'work');
  mkdirSync(bin); mkdirSync(work);
  const log = join(dir, 'log');
  const put = (name, body) => { writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`); chmodSync(join(bin, name), 0o755); };
  put('gh', `echo "gh $*" >> "${log}"
case "$1 $2" in
  "auth status") exit ${signedIn ? 0 : 1} ;;
  "api user") echo octo ;;
  "repo view") exit ${taken ? 0 : 1} ;;
  "repo create") mkdir "$3" ;;
esac`);
  put('git', `echo "git $*" >> "${log}"
n=$(cat "${dir}/pulls" 2>/dev/null || echo 0); n=$((n + 1)); echo "$n" > "${dir}/pulls"
if [ "$n" -ge ${late} ]; then mkdir -p src; : > src/setup.mjs; fi`);
  put('node', `case "$1" in -e) exit ${Number(node.slice(1).split('.')[0]) >= 20 ? 0 : 1} ;; -v) echo ${node} ;; *) echo "node $* in $(basename "$(pwd)")" >> "${log}" ;; esac`);
  put('sleep', ':');
  const run = (input) => spawnSync('sh', [script], { cwd: work, input, encoding: 'utf8', env: { PATH: `${bin}:/usr/bin:/bin`, MIMIR_ANSWERS_FROM_STDIN: '1' } });
  return { run, work, read: () => (existsSync(log) ? readFileSync(log, 'utf8') : '') };
}

test('install: the defaults create a public copy from the template, wait for its files and start setup in it', { skip }, () => {
  const s = stage({ late: 3 });
  const r = s.run('\n\n\n');
  assert.equal(r.status, 0, r.stderr);
  const log = s.read();
  assert.match(log, /^gh repo create mimir --template wi24rd-com\/mimir --public --clone$/m);
  assert.equal(log.match(/^git pull --quiet origin main$/gm).length, 3);
  assert.match(log, /^node src\/setup\.mjs in mimir$/m);
  assert.match(r.stdout, /creates the public repository octo\/mimir from wi24rd-com\/mimir/);
});

test('install: a name and "private" are passed on as given', { skip }, () => {
  const s = stage();
  const r = s.run('my-figures\nprivate\ny\n');
  assert.equal(r.status, 0, r.stderr);
  assert.match(s.read(), /^gh repo create my-figures --template wi24rd-com\/mimir --private --clone$/m);
  assert.match(s.read(), /^node src\/setup\.mjs in my-figures$/m);
});

test('install: nothing is created without a yes, for a taken name, an odd name or an existing folder', { skip }, () => {
  for (const [input, options, message, before] of [
    ['\n\nn\n', {}, /nothing was created/],
    ['\n', { taken: true }, /octo\/mimir already exists on GitHub/],
    ['my figures; rm -rf x\n', {}, /cannot be used as a repository name/],
    ['--help\n', {}, /cannot be used as a repository name/],
    ['\nsomething\n', {}, /neither public nor private/],
    ['here\n', {}, /already a file or folder named "here"/, (work) => mkdirSync(join(work, 'here'))],
  ]) {
    const s = stage(options);
    before?.(s.work);
    const r = s.run(input);
    assert.equal(r.status, 1, input);
    assert.match(r.stderr, message);
    assert.ok(!/repo create/.test(s.read()), input);
  }
});

test('install: says what is missing when you are not signed in or Node is too old', { skip }, () => {
  const out = stage({ signedIn: false }).run('');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /gh auth login/);
  const old = stage({ node: 'v18.19.0' }).run('');
  assert.equal(old.status, 1);
  assert.match(old.stderr, /v18\.19\.0 is too old/);
});

test('install: gives up with the next step when the files never arrive, and only starts setup inside an existing copy', { skip }, () => {
  const never = stage({ late: 999 });
  const r = never.run('\n\n\n');
  assert.equal(r.status, 1);
  assert.match(r.stderr, /git pull origin main && node src\/setup\.mjs/);
  const inside = stage();
  mkdirSync(join(inside.work, 'src'));
  writeFileSync(join(inside.work, 'src/setup.mjs'), '');
  writeFileSync(join(inside.work, 'package.json'), '{ "name": "wi24rd-mimir" }');
  assert.equal(inside.run('').status, 0);
  assert.ok(!/repo create/.test(inside.read()));
  assert.match(inside.read(), /^node src\/setup\.mjs in work$/m);
});
