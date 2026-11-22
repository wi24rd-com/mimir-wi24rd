// A small QR code encoder: text in, a square grid of dark and light modules out.
// Byte mode, error correction level M, versions 1 to 9 (up to 180 bytes), which
// is plenty for a web address. No dependencies; the same file runs in Node for tests.

// Per version, level M: [error-correction codewords per block, [blocks, data codewords]...]
const BLOCKS = [null,
  [10, [1, 16]], [16, [1, 28]], [26, [1, 44]], [18, [2, 32]], [24, [2, 43]],
  [16, [4, 27]], [18, [4, 31]], [22, [2, 38], [2, 39]], [22, [3, 36], [2, 37]],
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46]];
export const MAX_BYTES = 180;

const dataCodewords = (v) => BLOCKS[v].slice(1).reduce((n, [count, size]) => n + count * size, 0);
// Byte mode costs 4 bits for the mode and 8 for the length.
export const capacity = (v) => dataCodewords(v) - 2;

// ---- Reed-Solomon over GF(256), polynomial 0x11d ----
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i += 1) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function generator(degree) {
  let g = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j += 1) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}

export function errorCorrection(data, degree) {
  const g = generator(degree);
  const rem = new Array(degree).fill(0);
  for (const byte of data) {
    const factor = byte ^ rem.shift();
    rem.push(0);
    for (let i = 0; i < degree; i += 1) rem[i] ^= mul(g[i + 1], factor);
  }
  return rem;
}

// ---- data: mode, length, bytes, padding, split into blocks, interleave ----
function codewords(bytes, v) {
  const total = dataCodewords(v);
  const bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, 8);
  for (const b of bytes) push(b, 8);
  push(0, Math.min(4, total * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((n, bit) => (n << 1) | bit, 0));
  for (let pad = 0xec; data.length < total; pad ^= 0xec ^ 0x11) data.push(pad);

  const [ecSize, ...groups] = BLOCKS[v];
  const blocks = [];
  let at = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i += 1) { const d = data.slice(at, at + size); at += size; blocks.push({ d, e: errorCorrection(d, ecSize) }); }
  }
  const out = [];
  const longest = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < longest; i += 1) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecSize; i += 1) for (const b of blocks) out.push(b.e[i]);
  return out;
}

// ---- the grid ----
const MASKS = [
  (r, c) => (r + c) % 2 === 0, (r) => r % 2 === 0, (r, c) => c % 3 === 0, (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0, (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0, (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function bch(value, bits, poly, polyBits) {
  let rem = value << (polyBits - 1);
  for (let i = bits + polyBits - 2; i >= polyBits - 1; i -= 1) if ((rem >> i) & 1) rem ^= poly << (i - (polyBits - 1));
  return (value << (polyBits - 1)) | rem;
}
// Level M is 00, then the mask number; 15 bits after BCH and the fixed XOR.
export const formatBits = (mask) => bch(mask, 5, 0x537, 11) ^ 0x5412;
export const versionBits = (v) => bch(v, 6, 0x1f25, 13);

function frame(v) {
  const n = 17 + 4 * v;
  const dark = Array.from({ length: n }, () => new Array(n).fill(false));
  const fixed = Array.from({ length: n }, () => new Array(n).fill(false));
  const set = (r, c, on) => { if (r >= 0 && c >= 0 && r < n && c < n) { dark[r][c] = on; fixed[r][c] = true; } };
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r += 1) for (let c = -1; c <= 7; c += 1) {
      const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
      set(r0 + r, c0 + c, ring <= 1 || ring === 3);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i += 1) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const centres = ALIGN[v];
  for (const r of centres) for (const c of centres) {
    const last = centres[centres.length - 1];
    if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue; // the finder corners
    for (let dr = -2; dr <= 2; dr += 1) for (let dc = -2; dc <= 2; dc += 1) set(r + dr, c + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
  }
  set(n - 8, 8, true); // the always-dark module
  // reserve the format areas (written per mask) and the version areas
  for (let i = 0; i < 9; i += 1) { if (!fixed[8][i]) set(8, i, false); if (!fixed[i][8]) set(i, 8, false); }
  for (let i = 0; i < 8; i += 1) { set(8, n - 1 - i, false); if (i < 7) set(n - 1 - i, 8, false); }
  if (v >= 7) {
    const bits = versionBits(v);
    for (let i = 0; i < 18; i += 1) {
      const on = ((bits >> i) & 1) === 1;
      set(Math.floor(i / 3), n - 11 + (i % 3), on);
      set(n - 11 + (i % 3), Math.floor(i / 3), on);
    }
  }
  return { n, dark, fixed };
}

function place(base, words, mask) {
  const { n, fixed } = base;
  const dark = base.dark.map((row) => row.slice());
  let bit = 0;
  const total = words.length * 8;
  for (let right = n - 1, up = true; right > 0; right -= 2, up = !up) {
    if (right === 6) right -= 1; // the vertical timing column is skipped
    for (let i = 0; i < n; i += 1) {
      const r = up ? n - 1 - i : i;
      for (const c of [right, right - 1]) {
        if (fixed[r][c]) continue;
        const value = bit < total ? (words[bit >> 3] >> (7 - (bit & 7))) & 1 : 0;
        bit += 1;
        dark[r][c] = (value === 1) !== MASKS[mask](r, c);
      }
    }
  }
  const f = formatBits(mask);
  const on = (i) => ((f >> i) & 1) === 1;
  // first copy, around the top-left finder
  for (let i = 0; i <= 5; i += 1) dark[8][i] = on(14 - i);
  dark[8][7] = on(8); dark[8][8] = on(7); dark[7][8] = on(6);
  for (let i = 0; i <= 5; i += 1) dark[5 - i][8] = on(5 - i);
  // second copy, split between bottom-left and top-right
  for (let i = 0; i <= 6; i += 1) dark[n - 1 - i][8] = on(14 - i);
  for (let i = 0; i <= 7; i += 1) dark[8][n - 8 + i] = on(7 - i);
  return dark;
}

// The standard's four penalty rules; the mask with the lowest sum is used.
export function penalty(dark) {
  const n = dark.length;
  let score = 0;
  const lines = [];
  for (let i = 0; i < n; i += 1) { lines.push(dark[i]); lines.push(dark.map((row) => row[i])); }
  for (const line of lines) {
    for (let i = 0, run = 1; i < n; i += 1, run += 1) {
      if (i + 1 === n || line[i + 1] !== line[i]) { if (run >= 5) score += run - 2; run = 0; }
    }
    const s = line.map((d) => (d ? '1' : '0')).join('');
    for (const pattern of ['10111010000', '00001011101']) for (let at = s.indexOf(pattern); at !== -1; at = s.indexOf(pattern, at + 1)) score += 40;
  }
  let count = 0;
  for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) {
    if (dark[r][c]) count += 1;
    if (r + 1 < n && c + 1 < n && dark[r][c] === dark[r][c + 1] && dark[r][c] === dark[r + 1][c] && dark[r][c] === dark[r + 1][c + 1]) score += 3;
  }
  score += Math.floor(Math.abs((count * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

export function versionFor(byteLength) {
  for (let v = 1; v <= 9; v += 1) if (byteLength <= capacity(v)) return v;
  throw new Error(`too long for this QR encoder: ${byteLength} bytes, the limit is ${MAX_BYTES}`);
}

// Returns { size, version, mask, dark } where dark[row][column] is true for a dark module.
export function qr(text, { mask } = {}) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const version = versionFor(bytes.length);
  const base = frame(version);
  const words = codewords(bytes, version);
  let best = null;
  for (const m of mask === undefined ? [0, 1, 2, 3, 4, 5, 6, 7] : [mask]) {
    const dark = place(base, words, m);
    const score = penalty(dark);
    if (!best || score < best.score) best = { size: base.n, version, mask: m, dark, score };
  }
  return { size: best.size, version: best.version, mask: best.mask, dark: best.dark };
}

// One SVG path for all dark modules, with the four-module quiet zone the standard asks for.
export function qrPath(code, quiet = 4) {
  let d = '';
  for (let r = 0; r < code.size; r += 1) for (let c = 0; c < code.size; c += 1) if (code.dark[r][c]) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  return { d, box: code.size + quiet * 2 };
}
