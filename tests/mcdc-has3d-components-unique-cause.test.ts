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
// Verifies: INT-REQ-260821-JTY2, SW-REQ-260821-7AKJ
// Unique-cause leftovers for src/DOMMatrix.ts has3DComponents (0/4 D, 1/6 C,
// incomplete 4) after tests/dom-matrix.test.ts, tests/mcdc-branch-dommatrix.test.ts,
// tests/mcdc-transform-leftover-unique-cause.test.ts, and
// tests/typed-om-transform-is2d.test.ts.
// Last recapture: 0/4 D, 1/6 C, incomplete 4
// (next seam: init instanceof Float32Array, Array.isArray(...)).
// Drive CSSTransformValue.parse / CSSStyleValue.parse('transform') / DOMMatrix
// / CSSMatrixComponent / is2D setter. geometry-1 § 4 #dom-dommatrixreadonly-dommatrixreadonly
// treats a 6-item sequence as 2D and a 16-item sequence as always 3D, so the
// constructor never calls has3DComponents for arrays — Array / Float32Array /
// length-6 / length≠16 unique-cause uses the exported helper (pairs public
// CSSOM cannot emit). No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSTransformValue,
  CSSMatrixComponent,
  CSSStyleValue,
  DOMMatrix,
  DOMMatrixReadOnly,
} from '../src/typed-om.ts';
import { has3DComponents } from '../src/DOMMatrix.ts';

const IDENTITY_16 = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
  0, 0, 0, 1,
] as const;

const AFFINE_16 = [
  2, 0, 0, 0,
  0, 3, 0, 0,
  0, 0, 1, 0,
  10, 20, 0, 1,
] as const;

// geometry-1 2D-ness: m13/m14/m23/m24/m31/m32/m34/m43 default 0; m33/m44 default 1.
const NON_2D_KEYS: readonly { key: 'm13' | 'm14' | 'm23' | 'm24' | 'm31' | 'm32' | 'm33' | 'm34' | 'm43' | 'm44'; expected: number }[] = [
  { key: 'm13', expected: 0 },
  { key: 'm14', expected: 0 },
  { key: 'm23', expected: 0 },
  { key: 'm24', expected: 0 },
  { key: 'm31', expected: 0 },
  { key: 'm32', expected: 0 },
  { key: 'm33', expected: 1 },
  { key: 'm34', expected: 0 },
  { key: 'm43', expected: 0 },
  { key: 'm44', expected: 1 },
];

const NON_2D_INDICES: readonly { idx: number; expected: number; key: (typeof NON_2D_KEYS)[number]['key'] }[] = [
  { idx: 2, expected: 0, key: 'm13' },
  { idx: 3, expected: 0, key: 'm14' },
  { idx: 6, expected: 0, key: 'm23' },
  { idx: 7, expected: 0, key: 'm24' },
  { idx: 8, expected: 0, key: 'm31' },
  { idx: 9, expected: 0, key: 'm32' },
  { idx: 10, expected: 1, key: 'm33' },
  { idx: 11, expected: 0, key: 'm34' },
  { idx: 14, expected: 0, key: 'm43' },
  { idx: 15, expected: 1, key: 'm44' },
];

function ident16(): number[] {
  return IDENTITY_16.slice();
}

function parseTransform(css: string): CSSTransformValue {
  return CSSTransformValue.parse(css);
}

function matrixOf(css: string): DOMMatrix {
  const tv = parseTransform(css);
  const comp = tv.components[0];
  assert.ok(comp instanceof CSSMatrixComponent, `expected CSSMatrixComponent from ${JSON.stringify(css)}`);
  return comp.matrix;
}

function typeError(fn: () => unknown): void {
  assert.throws(fn, TypeError);
}

describe('MC/DC leftover unique-cause: has3DComponents instanceof DOMMatrixReadOnly (geometry-1 #dom-dommatrixreadonly-is2d)', { concurrency: false }, () => {
  test('L228 instanceof DOMMatrixReadOnly T (2D vs 3D) vs F dict/array', () => {
    // Unique-cause: init instanceof DOMMatrixReadOnly T vs F.
    // Public constructors clone DOMMatrixReadOnly without calling the helper.
    const twoD = new DOMMatrixReadOnly([1, 0, 0, 1, 4, 5]);
    assert.equal(twoD.is2D, true);
    assert.equal(has3DComponents(twoD), false);

    const threeD = new DOMMatrixReadOnly(ident16());
    assert.equal(threeD.is2D, false);
    assert.equal(has3DComponents(threeD), true);

    const mutable = new DOMMatrix('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.equal(mutable instanceof DOMMatrixReadOnly, true);
    assert.equal(has3DComponents(mutable), true);
    mutable.is2D = true;
    assert.equal(has3DComponents(mutable), false);

    // F: dict (parseMatrixInit) and sequences fall through the instanceof check.
    assert.equal(has3DComponents({}), false);
    assert.equal(has3DComponents({ m13: 1 }), true);
    assert.equal(has3DComponents(ident16()), false);
  });
});

describe('MC/DC leftover unique-cause: has3DComponents typed-array / Array OR (geometry-1 #dommatrix)', { concurrency: false }, () => {
  test('L229 Float64Array vs Float32Array vs Array.isArray unique-cause', () => {
    // Unique-cause of A || B || C requires one true at a time.
    // Existing is2D setter only samples Float64Array=T (Float32/Array skipped).
    const f64 = new Float64Array(ident16());
    assert.equal(f64 instanceof Float64Array, true);
    assert.equal(f64 instanceof Float32Array, false);
    assert.equal(Array.isArray(f64), false);
    assert.equal(has3DComponents(f64), false);

    const f32 = new Float32Array(ident16());
    assert.equal(f32 instanceof Float64Array, false);
    assert.equal(f32 instanceof Float32Array, true);
    assert.equal(Array.isArray(f32), false);
    assert.equal(has3DComponents(f32), false);

    const arr = ident16();
    assert.equal(arr instanceof Float64Array, false);
    assert.equal(arr instanceof Float32Array, false);
    assert.equal(Array.isArray(arr), true);
    assert.equal(has3DComponents(arr), false);

    // All F: DOMMatrixInit dict (public fromMatrix / constructor).
    const dict = new DOMMatrix({ m11: 2, m22: 3, e: 10 });
    assert.equal(dict.is2D, true);
    assert.equal(has3DComponents({ m11: 2, m22: 3, e: 10 }), false);
    assert.equal(has3DComponents({ is2D: false }), false);
  });

  test('L230 length === 6 T vs F and L231 length === 16 T vs other', () => {
    // Unique-cause: length === 6 T returns false without inspecting values.
    assert.equal(has3DComponents([9, 8, 7, 6, 5, 4]), false);
    assert.equal(has3DComponents(new Float32Array([9, 8, 7, 6, 5, 4])), false);
    assert.equal(has3DComponents(new Float64Array([9, 8, 7, 6, 5, 4])), false);

    // length === 16 T: identity / affine-2D slots → false; one 3D slot → true.
    assert.equal(has3DComponents(ident16()), false);
    assert.equal(has3DComponents(AFFINE_16.slice()), false);
    const withM13 = ident16();
    withM13[2] = 1;
    assert.equal(has3DComponents(withM13), true);
    assert.equal(has3DComponents(new Float32Array(withM13)), true);
    assert.equal(has3DComponents(new Float64Array(withM13)), true);

    // length === 16 F (after length === 6 F): neither 6 nor 16 → true.
    assert.equal(has3DComponents([]), true);
    assert.equal(has3DComponents([1]), true);
    assert.equal(has3DComponents(new Float32Array(8)), true);
    assert.equal(has3DComponents(new Float64Array(15)), true);
    assert.equal(has3DComponents(new Float32Array(17)), true);
  });
});

describe('MC/DC leftover unique-cause: CSSTransformValue.parse matrix / matrix3d (css-typed-om-1 § 5.7 #cssmatrixcomponent)', { concurrency: false }, () => {
  test('matrix vs matrix3d parse, is2D setter, and CSSStyleValue.parse transform', () => {
    const m2 = parseTransform('matrix(1, 0, 0, 1, 10, 20)');
    assert.equal(m2.is2D, true);
    assert.ok(m2.components[0] instanceof CSSMatrixComponent);
    assert.equal(m2.toString().startsWith('matrix('), true);
    const inner2 = matrixOf('matrix(1, 0, 0, 1, 10, 20)');
    assert.equal(inner2.is2D, true);
    inner2.is2D = true;
    assert.equal(inner2.is2D, true);

    const m3 = parseTransform('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.equal(m3.is2D, false);
    const inner3 = matrixOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.equal(inner3.is2D, false);
    // 16-item identity: helper sees default 3D slots, so is2D=true is allowed.
    inner3.is2D = true;
    assert.equal(inner3.is2D, true);
    inner3.m13 = 1;
    typeError(() => {
      inner3.is2D = true;
    });
    assert.equal(inner3.is2D, false);

    const translated = matrixOf('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1)');
    assert.equal(translated.m43, 5);
    typeError(() => {
      translated.is2D = true;
    });
    translated.is2D = false;
    assert.equal(translated.is2D, false);

    const mixed = parseTransform('MATRIX3D(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 9, 8, 7, 1)');
    assert.equal(mixed.is2D, false);
    const mixedInner = (mixed.components[0] as CSSMatrixComponent).matrix;
    assert.equal(mixedInner.m41, 9);
    assert.equal(mixedInner.m43, 7);
    typeError(() => {
      mixedInner.is2D = true;
    });

    const fromStyle = CSSStyleValue.parse('transform', 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.ok(fromStyle instanceof CSSTransformValue);
    assert.equal((fromStyle as CSSTransformValue).is2D, false);

    const from2dStyle = CSSStyleValue.parse('transform', 'matrix(2, 0, 0, 2, 1, 1)');
    assert.ok(from2dStyle instanceof CSSTransformValue);
    assert.equal((from2dStyle as CSSTransformValue).is2D, true);

    const ctor3d = new DOMMatrix('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.equal(ctor3d.is2D, false);
    ctor3d.is2D = true;
    assert.equal(ctor3d.is2D, true);

    const affine16 = new DOMMatrix(AFFINE_16.slice());
    assert.equal(affine16.is2D, false);
    affine16.is2D = true;
    assert.equal(affine16.is2D, true);

    const composed = parseTransform('matrix(1, 0, 0, 1, 4, 5) matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.equal(composed.is2D, false);
    const product = composed.toMatrix();
    assert.equal(product.is2D, false);
    assert.equal(product.e, 4);
    assert.equal(product.f, 5);
  });

  test('CSSMatrixComponent options is2D vs inner matrix 3D slots', () => {
    const ident = new DOMMatrix(ident16());
    const forced2d = new CSSMatrixComponent(ident, { is2D: true });
    assert.equal(forced2d.is2D, true);
    assert.equal(forced2d.toString().startsWith('matrix('), true);
    const as2d = forced2d.toMatrix();
    assert.equal(as2d.is2D, true);

    const with3d = new DOMMatrix({ m13: 1 });
    const forced3d = new CSSMatrixComponent(with3d, { is2D: false });
    assert.equal(forced3d.is2D, false);
    assert.equal(forced3d.toString().startsWith('matrix3d('), true);
    typeError(() => {
      forced3d.matrix.is2D = true;
    });
    const copy = forced3d.toMatrix();
    assert.equal(copy.is2D, false);
    typeError(() => {
      copy.is2D = true;
    });
  });
});

describe('MC/DC leftover unique-cause: DOMMatrixInit NON_2D_KEYS via public fromMatrix (geometry-1 #dom-dommatrixreadonly-frommatrix)', { concurrency: false }, () => {
  test('each 3D key undefined vs expected vs non-default unique-cause', () => {
    // Unique-cause of init[k] !== undefined && init[k] !== expected:
    // undefined (second conjunct skipped), defined==expected, defined!=expected.
    for (const { key, expected } of NON_2D_KEYS) {
      const missing = DOMMatrix.fromMatrix({});
      assert.equal(missing.is2D, true, `${key} omitted stays 2D`);

      const atDefault = new DOMMatrix({ [key]: expected, is2D: true });
      assert.equal(atDefault.is2D, true, `${key}=${expected} stays 2D`);
      assert.equal(atDefault[key], expected);

      const off = expected === 0 ? 1 : 0;
      const inferred = new DOMMatrix({ [key]: off });
      assert.equal(inferred.is2D, false, `${key}=${off} infers 3D`);
      assert.equal(inferred[key], off);
      typeError(() => new DOMMatrix({ is2D: true, [key]: off }));
    }

    const empty = new DOMMatrix({});
    empty.is2D = true;
    assert.equal(empty.is2D, true);

    const aliases = new DOMMatrix({ a: 2, b: 0, c: 0, d: 3, e: 8, f: 9 });
    assert.equal(aliases.is2D, true);
    aliases.is2D = true;
    assert.equal(aliases.a, 2);
    assert.equal(aliases.f, 9);
  });
});

describe('MC/DC leftover unique-cause: is2D setter NON_2D_INDICES on _values (geometry-1 #dom-dommatrix-is2d)', { concurrency: false }, () => {
  test('each 3D slot independently blocks is2D=true then restoring the default allows it', () => {
    // Unique-cause of init[idx] !== expected on the Float64Array fast path
    // used by the public is2D setter (this._values is always length 16).
    for (const { key, expected } of NON_2D_INDICES) {
      const m = new DOMMatrix(ident16());
      assert.equal(m.is2D, false);
      m.is2D = true;
      assert.equal(m.is2D, true);

      const off = expected === 0 ? 1 : 0;
      m[key] = off;
      assert.equal(m.is2D, false, `${key}=${off} flips is2D`);
      typeError(() => {
        m.is2D = true;
      });
      m[key] = expected;
      m.is2D = true;
      assert.equal(m.is2D, true, `${key} restored to ${expected}`);
    }

    const parsed = matrixOf('matrix(1, 0, 0, 1, 0, 0)');
    parsed.m44 = 2;
    typeError(() => {
      parsed.is2D = true;
    });
    parsed.m44 = 1;
    parsed.is2D = true;
    assert.equal(parsed.is2D, true);
  });
});
