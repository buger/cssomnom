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
// reqproof:proptest multiplyArrays
// Property-based test: multiplyArrays (4x4 matrix multiplication).
// Independent oracle: naive index-by-index reference using explicit summation
// over k (different loop structure from the production unrolled form), plus
// algebraic properties (identity, associativity) on seeded random matrices.
import { test } from 'node:test';
import assert from 'node:assert';
import { multiplyArrays } from '../src/DOMMatrix.ts';

// Seeded LCG so failures are reproducible (no Math.random nondeterminism).
let seed = 0x2f6e2b1;
function rnd(): number {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

function randomMatrix(small: boolean): Float64Array {
  const m = new Float64Array(16);
  for (let i = 0; i < 16; i++) {
    // Keep magnitudes small for associativity comparisons: float error in
    // ((A*B)*C) vs (A*(B*C)) must stay far below the 1e-9 tolerance.
    m[i] = small ? Math.floor(rnd() * 7) - 3 : rnd() * 20 - 10;
  }
  return m;
}

const IDENTITY = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

// Reference implementation: textbook triple-loop with an explicit k-sum.
function refMultiply(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[row * 4 + k] * b[k * 4 + col];
      out.push(sum);
    }
  }
  return out;
}

function arraysClose(a: ArrayLike<number>, b: ArrayLike<number>, eps: number): boolean {
  for (let i = 0; i < a.length; i++) {
    if (!(Math.abs(a[i] - b[i]) <= eps)) return false;
  }
  return true;
}

test('proptest multiplyArrays matches independent k-sum oracle (2000 cases)', () => {
  const ITERATIONS = 2000;
  for (let i = 0; i < ITERATIONS; i++) {
    const a = randomMatrix(false);
    const b = randomMatrix(false);
    const got = multiplyArrays(a, b);
    const expected = refMultiply(a, b);
    if (!arraysClose(got, expected, 1e-9)) {
      assert.fail(`case ${i}: mismatch for a=${[...a]} b=${[...b]} got=${[...got]}`);
    }
  }
  assert.strictEqual(ITERATIONS >= 1000, true);
});

test('proptest multiplyArrays identity element (2000 cases)', () => {
  for (let i = 0; i < 2000; i++) {
    const a = randomMatrix(true);
    assert.ok(arraysClose(multiplyArrays(a, IDENTITY), a, 0), `A*I !== A at case ${i}`);
    assert.ok(arraysClose(multiplyArrays(IDENTITY, a), a, 0), `I*A !== A at case ${i}`);
  }
});

test('proptest multiplyArrays associativity vs reassociation (1500 cases)', () => {
  for (let i = 0; i < 1500; i++) {
    const a = randomMatrix(true);
    const b = randomMatrix(true);
    const c = randomMatrix(true);
    const abC = multiplyArrays(multiplyArrays(a, b), c);
    const aBc = multiplyArrays(a, multiplyArrays(b, c));
    assert.ok(arraysClose(abC, aBc, 1e-8), `(AB)C != A(BC) at case ${i}`);
  }
});

test('proptest multiplyArrays aliased output equals fresh-output result', () => {
  for (let i = 0; i < 500; i++) {
    const a = randomMatrix(true);
    const b = randomMatrix(true);
    const fresh = multiplyArrays(a, b);
    const aliasA = new Float64Array(a);
    multiplyArrays(aliasA, b, aliasA);
    const aliasB = new Float64Array(b);
    multiplyArrays(a, aliasB, aliasB);
    assert.ok(arraysClose(aliasA, fresh, 0), 'out === a aliasing diverges');
    assert.ok(arraysClose(aliasB, fresh, 0), 'out === b aliasing diverges');
  }
});
