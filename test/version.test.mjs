import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../docs/lib/version.js';
import { parseVersion } from '../src/update.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the version is the same everywhere it is stated, and the changelog has it', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(parseVersion(pkg.version), 'package.json holds a version number');
  assert.equal(VERSION, pkg.version);
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')} \\(\\d{4}-\\d{2}-\\d{2}\\)$`, 'm'));
  assert.match(read('README.md'), new RegExp(`version ${pkg.version.replaceAll('.', '\\.')}`));
});
