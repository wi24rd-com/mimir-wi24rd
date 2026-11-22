// Geometry and scales for "The Well": Mimir's well seen from above, drawn from
// the figures. Pure functions, so every mark on the picture can be tested
// against the number it stands for.
//
//   rim      one stone per day in the period; the more views that day, the
//            stronger the stone (five steps, with the numbers in the legend)
//   ripples  each repository is a point on the water; more views, more rings
//   drops    release-file downloads gained in the period, one drop each
//   pulse    views per day across the water: the line in the Mimir mark,
//            drawn from the real figures

export const STEPS = 5;

// Upper bounds of the five steps for a given maximum. Whole numbers, so the
// legend can say "1-3", "4-6" and so on. A maximum under five gives fewer steps.
export function scaleSteps(max) {
  const top = Math.max(0, Math.floor(max));
  if (top === 0) return [];
  const n = Math.min(STEPS, top);
  const bounds = [];
  for (let i = 1; i <= n; i++) bounds.push(Math.ceil((top * i) / n));
  return bounds.map((hi, i) => ({ level: STEPS - n + i + 1, from: i === 0 ? 1 : bounds[i - 1] + 1, to: hi }));
}

export function levelOf(count, steps) {
  if (!(count > 0)) return 0;
  return (steps.find((s) => count <= s.to) ?? steps[steps.length - 1])?.level ?? 0;
}

// How many rings a repository gets: none without views, otherwise 1 to 5 on a
// square-root scale against the busiest repository, so small ones stay visible.
export function rippleCount(views, busiest) {
  if (!(views > 0) || !(busiest > 0)) return 0;
  return Math.max(1, Math.min(5, Math.round(5 * Math.sqrt(views / busiest))));
}

// Drops shown for a number of downloads: one each, at most twelve.
export const dropCount = (gained) => Math.max(0, Math.min(12, Math.floor(gained)));

const point = (cx, cy, r, a) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
const f = (n) => Number(n.toFixed(2));

// A stone in the rim: the band between two radii, from angle a0 to a1 (radians).
export function arcPath(cx, cy, r0, r1, a0, a1) {
  const [x0, y0] = point(cx, cy, r1, a0);
  const [x1, y1] = point(cx, cy, r1, a1);
  const [x2, y2] = point(cx, cy, r0, a1);
  const [x3, y3] = point(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${f(x0)} ${f(y0)}A${r1} ${r1} 0 ${large} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${r0} ${r0} 0 ${large} 0 ${f(x3)} ${f(y3)}Z`;
}

// The rim: stones clockwise from the top, oldest first, today last.
export function rimStones(series, { cx, cy, r0, r1 }) {
  const n = series.length;
  if (!n) return [];
  const steps = scaleSteps(Math.max(0, ...series.map((p) => p.count)));
  const slice = (2 * Math.PI) / n;
  const gap = n > 120 ? 0 : Math.min(0.012, slice * 0.12);
  return series.map((p, i) => {
    const a0 = -Math.PI / 2 + i * slice + gap;
    const a1 = -Math.PI / 2 + (i + 1) * slice - gap;
    return { day: p.day, count: p.count, known: p.known, level: p.known ? levelOf(p.count, steps) : 0, d: arcPath(cx, cy, r0, r1, a0, a1), mid: (a0 + a1) / 2 };
  });
}

// Where each repository sits on the water: one in the middle, several on a circle.
export function sourcePoints(count, { cx, cy, r }) {
  if (count <= 1) return count === 1 ? [{ x: cx, y: cy }] : [];
  return Array.from({ length: count }, (_, i) => {
    const [x, y] = point(cx, cy, r, -Math.PI / 2 + Math.PI / count + (i * 2 * Math.PI) / count);
    return { x: f(x), y: f(y) };
  });
}

// The pulse: views per day from x0 to x1, rising above the line y by up to amp.
export function pulsePath(series, { x0, x1, y, amp }) {
  const known = series.filter((p) => p.known);
  if (known.length < 2) return '';
  const max = Math.max(1, ...known.map((p) => p.count));
  const step = (x1 - x0) / (series.length - 1 || 1);
  let d = '';
  let pen = false;
  series.forEach((p, i) => {
    if (!p.known) { pen = false; return; }
    // Up for an odd day, down for an even one, so the line reads as a pulse and not a hill.
    const dir = i % 2 ? -1 : 1;
    d += `${pen ? 'L' : 'M'}${f(x0 + i * step)} ${f(y - dir * (p.count / max) * amp)}`;
    pen = true;
  });
  return d;
}
