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
// Verifies: INT-REQ-260821-JTY2
// Public-API unique-cause for src/DOMMatrix.ts multiplyArrays
// `out === a || out === b` via DOMMatrix.multiply / multiplySelf /
// preMultiplySelf (geometry-1 #dom-dommatrixreadonly-multiply /
// #dom-dommatrix-multiplyself / #dom-dommatrix-premultiplyself).
// 3D paths pass this._values as out. fromMatrix always copies, so
// out === a && out === b is UNREACHABLE. A distinct out (both F) is
// UNREACHABLE from these methods (they never pass a third array).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../src/DOMMatrix.ts';

function nearly(actual: number, expected: number, label: string, eps = 1e-6): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < eps, `${label}: ${actual} vs ${expected}`);
}

function identity3d(): DOMMatrix {
  return new DOMMatrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

describe('MC/DC public unique-cause: multiplyArrays out === a / out === b', () => {
  test('multiply / multiplySelf 3D unique-cause out === a T, out === b F', () => {
    // multiplySelf(this, other, this): out aliases a, fromMatrix copies b.
    const t2 = new DOMMatrix().translate(1, 2);
    const t3 = new DOMMatrix().translate(0, 0, 3);
    const product = t2.multiply(t3);
    assert.notEqual(product, t2);
    assert.equal(t2.is2D, true);
    assert.equal(product.is2D, false);
    nearly(product.m41, 1, 'multiply 2d*3d m41');
    nearly(product.m42, 2, 'multiply 2d*3d m42');
    nearly(product.m43, 3, 'multiply 2d*3d m43');

    const self = new DOMMatrix().translate(4, 5);
    const same = self.multiplySelf(new DOMMatrix().translate(0, 0, 6));
    assert.equal(same, self);
    assert.equal(self.is2D, false);
    nearly(self.m41, 4, 'multiplySelf 2d*3d m41');
    nearly(self.m43, 6, 'multiplySelf 2d*3d m43');

    const already3d = identity3d();
    already3d.translateSelf(10, 0, 1);
    already3d.multiplySelf(new DOMMatrix().translate(2, 3, 4));
    nearly(already3d.m41, 12, '3d*3d multiplySelf m41');
    nearly(already3d.m42, 3, '3d*3d multiplySelf m42');
    nearly(already3d.m43, 5, '3d*3d multiplySelf m43');
  });

  test('preMultiplySelf 3D unique-cause out === a F, out === b T', () => {
    // preMultiplySelf(other, this, this): out aliases b, fromMatrix copies a.
    const pre = new DOMMatrix().translate(1, 2);
    pre.preMultiplySelf(new DOMMatrix().translate(0, 0, 5));
    assert.equal(pre.is2D, false);
    nearly(pre.m41, 1, 'preMultiply 3d*2d m41');
    nearly(pre.m43, 5, 'preMultiply 3d*2d m43');

    const pre3 = identity3d();
    pre3.translateSelf(1, 0, 2);
    pre3.preMultiplySelf(new DOMMatrix().translate(3, 4, 5));
    nearly(pre3.m41, 4, 'preMultiply 3d*3d m41');
    nearly(pre3.m42, 4, 'preMultiply 3d*3d m42');
    nearly(pre3.m43, 7, 'preMultiply 3d*3d m43');
  });

  test('2D×2D multiply uses the fast path and does not alias through multiplyArrays', () => {
    const a = new DOMMatrix().translate(1, 2);
    const b = new DOMMatrix().translate(3, 4);
    const product = a.multiply(b);
    assert.equal(product.is2D, true);
    nearly(product.e, 4, '2d*2d e');
    nearly(product.f, 6, '2d*2d f');
    assert.equal(a.e, 1);
    assert.equal(a.is2D, true);
  });
});
