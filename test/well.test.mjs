import test from 'node:test';
import assert from 'node:assert/strict';
import { arcPath, dropCount, levelOf, pulsePath, rimStones, rippleCount, scaleSteps, sourcePoints } from '../docs/lib/well.js';

test('scale: five whole-number steps that cover 1 to the maximum without gaps', () => {
  const steps = scaleSteps(52);
  assert.deepEqual(steps.map((s) => s.level), [1, 2, 3, 4, 5]);
  assert.equal(steps[0].from, 1);
  assert.equal(steps[4].to, 52);
  for (let i = 1; i < steps.length; i++) assert.equal(steps[i].from, steps[i - 1].to + 1);
});

test('scale: a small maximum gives fewer steps, ending on the strongest', () => {
  assert.deepEqual(scaleSteps(3), [{ level: 3, from: 1, to: 1 }, { level: 4, from: 2, to: 2 }, { level: 5, from: 3, to: 3 }]);
  assert.deepEqual(scaleSteps(0), []);
});

test('scale: every count lands in the step whose range holds it', () => {
  const steps = scaleSteps(52);
  assert.equal(levelOf(0, steps), 0);
  assert.equal(levelOf(1, steps), 1);
  assert.equal(levelOf(52, steps), 5);
  for (let v = 1; v <= 52; v++) { const s = steps.find((x) => x.level === levelOf(v, steps)); assert.ok(v >= s.from && v <= s.to, String(v)); }
});

test('ripples: none without views, one to five otherwise, never fewer for more views', () => {
  assert.equal(rippleCount(0, 100), 0);
  assert.equal(rippleCount(1, 500), 1);
  assert.equal(rippleCount(500, 500), 5);
  let last = 0;
  for (let v = 1; v <= 500; v += 7) { const n = rippleCount(v, 500); assert.ok(n >= last && n >= 1 && n <= 5); last = n; }
});

test('drops: one per download, at most twelve', () => {
  assert.equal(dropCount(0), 0);
  assert.equal(dropCount(8), 8);
  assert.equal(dropCount(163), 12);
});

test('rim: one stone per day, clockwise from the top, with the level of that day', () => {
  const series = [{ day: 'a', count: 0, known: true }, { day: 'b', count: 10, known: true }, { day: 'c', count: 5, known: false }, { day: 'd', count: 20, known: true }];
  const stones = rimStones(series, { cx: 300, cy: 300, r0: 250, r1: 282 });
  assert.equal(stones.length, 4);
  assert.deepEqual(stones.map((s) => s.level), [0, 3, 0, 5]);
  assert.ok(stones[0].mid > -Math.PI / 2 && stones[0].mid < 0, 'first stone starts at the top, going right');
  assert.ok(stones.every((s, i) => i === 0 || s.mid > stones[i - 1].mid));
  assert.match(stones[0].d, /^M[\d.-]+ [\d.-]+A282 282 0 0 1 /);
  assert.deepEqual(rimStones([], { cx: 0, cy: 0, r0: 1, r1: 2 }), []);
});

test('arc: a stone wider than half the circle is drawn the long way round', () => {
  assert.match(arcPath(0, 0, 10, 20, 0, 4), /A20 20 0 1 1 /);
  assert.match(arcPath(0, 0, 10, 20, 0, 1), /A20 20 0 0 1 /);
});

test('sources: one repository sits in the middle, several are spread evenly on a circle', () => {
  assert.deepEqual(sourcePoints(1, { cx: 300, cy: 300, r: 120 }), [{ x: 300, y: 300 }]);
  const five = sourcePoints(5, { cx: 300, cy: 300, r: 120 });
  assert.equal(five.length, 5);
  for (const p of five) assert.ok(Math.abs(Math.hypot(p.x - 300, p.y - 300) - 120) < 0.02);
  assert.equal(new Set(five.map((p) => `${p.x},${p.y}`)).size, 5);
  assert.deepEqual(sourcePoints(0, { cx: 0, cy: 0, r: 1 }), []);
});

test('pulse: the busiest day reaches the full height, unknown days break the line', () => {
  const series = [{ count: 0, known: true }, { count: 10, known: true }, { count: 5, known: false }, { count: 4, known: true }, { count: 2, known: true }];
  const d = pulsePath(series, { x0: 100, x1: 500, y: 300, amp: 40 });
  assert.equal(d, 'M100 300L200 340M400 316L500 292');
  assert.equal(pulsePath([{ count: 3, known: true }], { x0: 0, x1: 1, y: 0, amp: 1 }), '');
});
