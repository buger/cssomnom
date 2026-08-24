/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// reqproof:proptest sortNumericNodes, normalizeAngleUnits
// Property-based tests for typed OM numeric-tree helpers
// (css-values-4 § 10.7 #serialize-a-calculation-tree and the typed-om
// transform angle normalization).
//
// sortNumericNodes: independent oracle = single-pass composite-key sort
// (group rank + value / unit string) — a different algorithm from the
// production filter-and-sort pipeline — plus permutation, idempotence and
// passthrough properties.
//
// normalizeAngleUnits: independent oracle = trigonometry. turn/grad/rad ->
// deg conversion must preserve sin/cos of the angle (a fundamentally
// different computation than the linear coefficient maps), plus idempotence
// and recursive structure preservation on math nodes.
import { test } from 'node:test';
import assert from 'node:assert';
import { CSSUnitValue } from '../src/typed-om/numeric/CSSUnitValue.ts';
import type { CSSNumericValue } from '../src/typed-om/numeric/CSSNumericValue.ts';
import { sortNumericNodes } from '../src/typed-om/numeric/math/math-sorting.ts';
import { normalizeAngleUnits } from '../src/typed-om/transform/CSSTransformComponent.ts';
import { CSSMathSum } from '../src/typed-om/numeric/math/CSSMathOperations.ts';

let seed = 0x5eed1234;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const UNITS = ['number', 'percent', 'px', 'em', 'deg', 's'] as const;

function randomNode(): CSSUnitValue {
  const unit = UNITS[Math.floor(rnd() * UNITS.length)];
  const value = Math.round(rnd() * 200 - 100);
  return new CSSUnitValue(value, unit);
}

function multisetEqual(a: CSSUnitValue[], b: CSSUnitValue[]): boolean {
  const keyOf = (n: CSSUnitValue) => `${n.value}|${n.unit}`;
  const counts = new Map<string, number>();
  for (const n of a) counts.set(keyOf(n), (counts.get(keyOf(n)) ?? 0) + 1);
  for (const n of b) {
    const c = counts.get(keyOf(n)) ?? 0;
    if (c === 0) return false;
    counts.set(keyOf(n), c - 1);
  }
  return [...counts.values()].every(v => v === 0);
}

function groupRank(unit: string): number {
  if (unit === 'number') return 0;
  if (unit === 'percent') return 1;
  return 2;
}

test('proptest sortNumericNodes equals composite-key reference order (2000 cases)', () => {
  for (let i = 0; i < 2000; i++) {
    const input = Array.from({ length: 1 + Math.floor(rnd() * 8) }, randomNode);
    const got = sortNumericNodes(input);
    // Reference: single-pass stable sort mirroring the SPEC ordering keys
    // (css-values-4 § 10.7): numbers ascending by value, percents ascending
    // by value, dimensions alphabetical by unit — NO value tiebreak within a
    // unit; ties keep input order (stable sort), exactly like the spec table.
    const expected = input
      .map((n, idx) => ({
        n,
        idx,
        rank: groupRank(n.unit),
        primary: n.unit === 'number' || n.unit === 'percent' ? n.value : 0,
        secondary: n.unit === 'number' || n.unit === 'percent' ? '' : n.unit,
      }))
      .sort((x, y) =>
        x.rank - y.rank ||
        x.primary - y.primary ||
        (x.secondary < y.secondary ? -1 : x.secondary > y.secondary ? 1 : 0) ||
        x.idx - y.idx)
      .map(e => e.n);
    assert.strictEqual(got.length, expected.length, `length mismatch case ${i}`);
    for (let j = 0; j < got.length; j++) {
      const g = got[j] as CSSUnitValue;
      assert.strictEqual(
        `${g.value}|${g.unit}`, `${expected[j].value}|${expected[j].unit}`,
        `order mismatch at ${j} for case ${i}`
      );
    }
  }
});

test('proptest sortNumericNodes is a permutation-preserving idempotence', () => {
  for (let i = 0; i < 1000; i++) {
    const input = Array.from({ length: 1 + Math.floor(rnd() * 9) }, randomNode);
    const once = sortNumericNodes(input) as CSSUnitValue[];
    assert.ok(multisetEqual(input, once), `output is not a permutation of input (case ${i})`);
    const twice = sortNumericNodes(once);
    const keyOf = (n: CSSNumericValue) => { const u = n as CSSUnitValue; return `${u.value}|${u.unit}`; };
    assert.strictEqual(
      twice.map(keyOf).join(','), once.map(keyOf).join(','),
      `sort not idempotent (case ${i})`
    );
  }
});

test('proptest sortNumericNodes passes through non-CSSUnitValue trees untouched', () => {
  // Mixed arrays containing non-simple nodes must be returned unmodified
  // per css-values-4 § 10.7 (only all-simple sums are reordered).
  const notSimple = [{ marker: true }] as unknown as CSSNumericValue[];
  const mixed = [randomNode(), ...notSimple];
  assert.strictEqual(sortNumericNodes(mixed), mixed);
  assert.deepStrictEqual(sortNumericNodes([]), []);
});

// --- normalizeAngleUnits ----------------------------------------------------

const ANGLE_UNITS: Array<[`${'turn' | 'grad' | 'rad'}`, number]> = [['turn', 360], ['grad', 0.9], ['rad', 180 / Math.PI]];

test('proptest normalizeAngleUnits preserves angle via trig oracle (2500 cases)', () => {
  for (let i = 0; i < 2500; i++) {
    const [unit] = ANGLE_UNITS[Math.floor(rnd() * ANGLE_UNITS.length)];
    const degrees = Math.round(rnd() * 1440 - 720); // includes negatives & >360
    const node = new CSSUnitValue(degrees, unit);
    const normalized = normalizeAngleUnits(node) as CSSUnitValue;
    assert.strictEqual(normalized.unit, 'deg', `${degrees}${unit} did not normalize to deg`);
    // Trigonometric equivalence: same point on the unit circle.
    const srcRad = (degrees * Number(ANGLE_UNITS.find(u => u[0] === unit)![1]) * Math.PI) / 180;
    assert.ok(
      Math.abs(Math.sin(normalized.value * Math.PI / 180) - Math.sin(srcRad)) < 1e-9 &&
      Math.abs(Math.cos(normalized.value * Math.PI / 180) - Math.cos(srcRad)) < 1e-9,
      `${degrees}${unit} -> ${normalized.value}deg does not preserve the angle`
    );
  }
});

test('proptest normalizeAngleUnits is idempotent (1500 cases)', () => {
  for (let i = 0; i < 1500; i++) {
    const pickA = rnd();
    let node: CSSNumericValue;
    if (pickA < 0.6) {
      const [unit] = ANGLE_UNITS[Math.floor(rnd() * ANGLE_UNITS.length)];
      node = new CSSUnitValue(Math.round(rnd() * 400 - 200), unit);
    } else if (pickA < 0.8) {
      node = new CSSUnitValue(Math.round(rnd() * 100), 'px'); // non-angle passthrough
    } else {
      const [unit] = ANGLE_UNITS[Math.floor(rnd() * ANGLE_UNITS.length)];
      node = new CSSMathSum(
        new CSSUnitValue(Math.round(rnd() * 90), unit),
        new CSSUnitValue(Math.round(rnd() * 90), unit)
      );
    }
    const once = normalizeAngleUnits(node);
    const twice = normalizeAngleUnits(once);
    assert.strictEqual(
      JSON.stringify((once as unknown as { values?: unknown[] }).values ?? once),
      JSON.stringify((twice as unknown as { values?: unknown[] }).values ?? twice),
      'normalization not idempotent'
    );
    assert.strictEqual(once instanceof CSSUnitValue, twice instanceof CSSUnitValue);
  }
});
