import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { qr, qrPath, errorCorrection, formatBits, versionBits, versionFor, capacity, penalty, MAX_BYTES } from '../docs/lib/qr.js';

test('error correction matches the published "HELLO WORLD" 1-M example', () => {
  const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
  assert.deepEqual(errorCorrection(data, 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
});

test('format and version information match the standard tables', () => {
  assert.equal(formatBits(0), 0b101010000010010);
  assert.equal(formatBits(5), 0b100000011001110);
  assert.equal(versionBits(7), 0x07c94);
  assert.equal(versionBits(9), 0x09a99);
});

test('the smallest version that fits is chosen', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 9].map(capacity), [14, 26, 42, 62, 84, 106, 122, 152, 180]);
  assert.equal(versionFor(14), 1);
  assert.equal(versionFor(15), 2);
  assert.equal(versionFor(MAX_BYTES), 9);
  assert.throws(() => qr('x'.repeat(MAX_BYTES + 1)), /too long/);
  assert.equal(qr('æ'.repeat(7)).version, 1, 'length is counted in bytes');
  assert.equal(qr('æ'.repeat(8)).version, 2);
});

test('the grid has the fixed patterns in place', () => {
  const code = qr('https://example.github.io/lantern/');
  assert.equal(code.size, 17 + 4 * code.version);
  assert.equal(code.dark.length, code.size);
  const finder = (r0, c0) => [0, 1, 2, 3, 4, 5, 6].map((i) => (code.dark[r0 + 3][c0 + i] ? 1 : 0)).join('');
  for (const [r, c] of [[0, 0], [0, code.size - 7], [code.size - 7, 0]]) assert.equal(finder(r, c), '1011101');
  for (let i = 8; i < code.size - 8; i += 1) assert.equal(code.dark[6][i], i % 2 === 0, 'timing row');
  assert.equal(code.dark[code.size - 8][8], true, 'the dark module');
});

test('the mask with the lowest penalty is used, and the result is stable', () => {
  const text = 'https://example.github.io/lantern/';
  const best = qr(text);
  const scores = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => penalty(qr(text, { mask }).dark));
  assert.equal(penalty(best.dark), Math.min(...scores));
  assert.deepEqual(qr(text).dark, best.dark);
  // This exact grid was read back by an independent decoder when it was built.
  const hash = createHash('sha256').update(best.dark.map((row) => row.map((d) => (d ? 1 : 0)).join('')).join('\n')).digest('hex');
  assert.equal(hash, '51721369686f396bbe5e4b895936d7b9a5e25d1fc043c1bbdb181b47ce4a8d09');
});

test('the SVG path has one square per dark module and a quiet zone', () => {
  const code = qr('A');
  const { d, box } = qrPath(code);
  assert.equal(box, code.size + 8);
  assert.equal(d.split('M').length - 1, code.dark.flat().filter(Boolean).length);
  assert.ok(d.startsWith('M4 4'), 'the top-left finder starts after the quiet zone');
});
