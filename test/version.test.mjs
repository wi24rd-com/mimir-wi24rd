import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { VERSION } from '../docs/lib/version.js';
import { EXAMPLE_REPO } from '../src/config.mjs';
import { parseVersion } from '../src/update.mjs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the version is the same everywhere it is stated, and the changelog has it', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(parseVersion(pkg.version), 'package.json holds a version number');
  assert.equal(VERSION, pkg.version);
  assert.match(read('CHANGELOG.md'), new RegExp(`^## ${pkg.version.replaceAll('.', '\\.')} \\(\\d{4}-\\d{2}-\\d{2}\\)$`, 'm'));
});

test('the README of Mimir itself states the version', (t) => {
  // A copy keeps its own README through an update, so this applies to the template only.
  if (!read('mimir.json').includes(EXAMPLE_REPO)) { t.skip('this copy has its own README'); return; }
  assert.match(read('README.md'), new RegExp(`version ${VERSION.replaceAll('.', '\\.')}`));
});
