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
// Leftover unique-cause branches in src/DOMMatrix.ts not covered by
// tests/dom-matrix.test.ts. Public constructors/methods only
// (multiply, invert, translate, scale, rotate, fromFloat32Array, is2D).
// geometry-1 § 6 #DOMMatrix. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix, DOMMatrixReadOnly } from '../src/DOMMatrix.ts';

function nearly(actual: number, expected: number, label: string, eps = 1e-6): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < eps, `${label}: ${actual} vs ${expected}`);
}

function syntaxError(fn: () => unknown): void {
  assert.throws(fn, (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError');
}

function identity3d(): DOMMatrix {
  // geometry-1 #dom-dommatrixreadonly-dommatrixreadonly: 16-item sequence is 3D
  return new DOMMatrix([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ]);
}

describe('MC/DC leftover: DOMMatrix constructors / fromFloat32Array / is2D', () => {
  test('Float32Array constructor 6 vs 16 vs fromFloat32Array column-major transpose', () => {
    // geometry-1 #dom-dommatrixreadonly-dommatrixreadonly 6-item sequence [a,b,c,d,e,f]
    const f32_6 = new DOMMatrix(new Float32Array([2, 0, 0, 3, 10, 20]));
    assert.equal(f32_6.is2D, true);
    assert.equal(f32_6.a, 2);
    assert.equal(f32_6.d, 3);
    assert.equal(f32_6.e, 10);
    assert.equal(f32_6.f, 20);

    const f64_6 = new DOMMatrix(new Float64Array([4, 1, 0, 5, 7, 8]));
    assert.equal(f64_6.is2D, true);
    assert.equal(f64_6.a, 4);
    assert.equal(f64_6.b, 1);
    assert.equal(f64_6.e, 7);

    // 16-item typed-array ctor is row-major and always 3D (no transpose)
    const f32_16 = new DOMMatrix(new Float32Array([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ]));
    assert.equal(f32_16.is2D, false);
    assert.equal(f32_16.m11, 1);
    assert.equal(f32_16.m12, 2);
    assert.equal(f32_16.m21, 5);
    assert.equal(f32_16.m44, 16);

    // geometry-1 #dom-dommatrix-fromfloat32array: 16-element column-major, then transpose
    const col = new Float32Array([
      1, 5, 9, 13,
      2, 6, 10, 14,
      3, 7, 11, 15,
      4, 8, 12, 16,
    ]);
    const from32 = DOMMatrix.fromFloat32Array(col);
    assert.equal(from32.is2D, false);
    assert.equal(from32.m11, 1);
    assert.equal(from32.m12, 2);
    assert.equal(from32.m13, 3);
    assert.equal(from32.m14, 4);
    assert.equal(from32.m21, 5);
    assert.equal(from32.m22, 6);
    assert.equal(from32.m43, 15);
    assert.equal(from32.m44, 16);

    // Same 16-buffer: ctor is row-major, fromFloat32Array transposes column-major.
    const same16 = new Float32Array([
      1, 2, 3, 4,
      5, 6, 7, 8,
      9, 10, 11, 12,
      13, 14, 15, 16,
    ]);
    const ctorRow = new DOMMatrix(same16);
    const fromCol = DOMMatrix.fromFloat32Array(same16);
    assert.equal(ctorRow.m12, 2);
    assert.equal(ctorRow.m21, 5);
    assert.equal(fromCol.m12, 5);
    assert.equal(fromCol.m21, 2);

    const ro = DOMMatrixReadOnly.fromFloat32Array(col);
    assert.ok(ro instanceof DOMMatrixReadOnly);
    assert.equal(ro.m11, 1);
    assert.equal(ro.m21, 5);
    assert.throws(() => DOMMatrixReadOnly.fromFloat32Array(new Float32Array(6)), TypeError);
    assert.throws(() => DOMMatrixReadOnly.fromFloat32Array(new Float32Array(15)), TypeError);

    assert.throws(() => new DOMMatrix(new Float32Array([1, 2, 3])), TypeError);
    assert.throws(() => new DOMMatrix(new Float64Array(8)), TypeError);
  });

  test('iterable constructor and invalid init unique-cause', () => {
    const iterable = {
      *[Symbol.iterator]() {
        yield 1;
        yield 0;
        yield 0;
        yield 1;
        yield 4;
        yield 5;
      },
    };
    const m = new DOMMatrix(iterable);
    assert.equal(m.is2D, true);
    assert.equal(m.e, 4);
    assert.equal(m.f, 5);

    const sixteen = {
      *[Symbol.iterator]() {
        for (let i = 1; i <= 16; i++) yield i;
      },
    };
    const m16 = new DOMMatrix(sixteen);
    assert.equal(m16.is2D, false);
    assert.equal(m16.m11, 1);
    assert.equal(m16.m44, 16);

    assert.throws(() => new DOMMatrix(1 as unknown as number[]), TypeError);
    assert.throws(() => new DOMMatrix(true as unknown as number[]), TypeError);
    assert.throws(() => new DOMMatrix(null), TypeError);
    assert.throws(() => DOMMatrix.fromMatrix(null), TypeError);
    const identity = DOMMatrix.fromMatrix(undefined);
    assert.equal(identity.isIdentity, true);
    assert.equal(identity.is2D, true);
  });

  test('DOMMatrixInit dict, toFloat64Array, and is2D inference leftovers', () => {
    const fromA = new DOMMatrix({ a: 2, e: 10 });
    assert.equal(fromA.is2D, true);
    assert.equal(fromA.m11, 2);
    assert.equal(fromA.m41, 10);

    const fromM11 = new DOMMatrix({ m11: 3, m22: 4 });
    assert.equal(fromM11.a, 3);
    assert.equal(fromM11.d, 4);

    const inferred3d = new DOMMatrix({ m13: 1 });
    assert.equal(inferred3d.is2D, false);
    assert.equal(inferred3d.m13, 1);

    const forced2dDefault = new DOMMatrix({ is2D: true, m13: 0, m33: 1, m44: 1 });
    assert.equal(forced2dDefault.is2D, true);

    const forced3d = new DOMMatrix({ is2D: false });
    assert.equal(forced3d.is2D, false);
    assert.equal(forced3d.isIdentity, true);

    const via64 = new DOMMatrix({
      is2D: false,
      toFloat64Array() {
        return new Float64Array([
          1, 0, 0, 10,
          0, 1, 0, 20,
          0, 0, 1, 30,
          0, 0, 0, 1,
        ]);
      },
    });
    assert.equal(via64.is2D, false);
    assert.equal(via64.m11, 1);
    assert.equal(via64.m41, 10);
    assert.equal(via64.m42, 20);
    assert.equal(via64.m43, 30);

    const via64Default2d = new DOMMatrix({
      toFloat64Array() {
        return [
          1, 0, 0, 0,
          0, 1, 0, 0,
          0, 0, 1, 0,
          0, 0, 0, 1,
        ];
      },
    });
    assert.equal(via64Default2d.is2D, true);
    assert.equal(via64Default2d.isIdentity, true);

    assert.throws(() => new DOMMatrix({
      toFloat64Array() {
        return new Float64Array(6);
      },
    }), TypeError);

    assert.throws(() => new DOMMatrix({ is2D: true, m43: 1 }), TypeError);
    assert.throws(() => new DOMMatrix({ is2D: true, m14: 2 }), TypeError);
  });

  test('string ctor leftovers: NONE, matrix NaN / arity, matrix3d NaN / arity, ASCII case', () => {
    // geometry-1 #dom-dommatrixreadonly-dommatrixreadonly / css-transforms-1 #typedef-transform-list
    const none = new DOMMatrix('NONE');
    assert.equal(none.is2D, true);
    assert.equal(none.isIdentity, true);

    const padded = new DOMMatrix('  matrix(1, 2, 3, 4, 5, 6)  ');
    assert.equal(padded.is2D, true);
    assert.equal(padded.a, 1);
    assert.equal(padded.f, 6);

    const spaced = new DOMMatrix('matrix(1 2 3 4 5 6)');
    assert.equal(spaced.b, 2);
    assert.equal(spaced.e, 5);

    const upper = new DOMMatrix('MATRIX(2, 0, 0, 2, 1, 1)');
    assert.equal(upper.a, 2);
    assert.equal(upper.e, 1);

    syntaxError(() => new DOMMatrix('matrix(1, 2, foo, 4, 5, 6)'));
    syntaxError(() => new DOMMatrix('matrix(1, 2, 3, 4, 5)'));
    syntaxError(() => new DOMMatrix('matrix(1, 2, 3, 4, 5, 6, 7)'));

    const m3 = new DOMMatrix('MATRIX3D(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 9, 8, 7, 1)');
    assert.equal(m3.is2D, false);
    assert.equal(m3.m41, 9);
    assert.equal(m3.m43, 7);

    syntaxError(() => new DOMMatrix('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, foo)'));
    syntaxError(() => new DOMMatrix('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1)'));
    syntaxError(() => new DOMMatrix('nope'));

    const setNone = new DOMMatrix([1, 0, 0, 1, 5, 5]);
    setNone.setMatrixValue('none');
    assert.equal(setNone.is2D, true);
    assert.equal(setNone.isIdentity, true);
    syntaxError(() => setNone.setMatrixValue('rotateX('));
  });

  test('is2D setter leftover: 16-item identity can become 2D; 3D component setters', () => {
    const m = identity3d();
    assert.equal(m.is2D, false);
    m.is2D = true;
    assert.equal(m.is2D, true);

    m.m13 = 0;
    m.m33 = 1;
    m.m44 = 1;
    m.m14 = 0;
    assert.equal(m.is2D, true);

    m.m13 = 1;
    assert.equal(m.is2D, false);
    m.m13 = 0;
    assert.equal(m.is2D, false, '3D-component setters never restore is2D');
    m.is2D = true;
    assert.equal(m.is2D, true);

    m.m23 = 0.5;
    assert.equal(m.is2D, false);
    assert.throws(() => {
      m.is2D = true;
    }, TypeError);

    const n = new DOMMatrix();
    n.m43 = 4;
    assert.equal(n.is2D, false);
    n.m43 = 0;
    n.is2D = true;
    assert.equal(n.is2D, true);

    n.m44 = 2;
    assert.equal(n.is2D, false);
    n.m33 = 0.9;
    assert.equal(n.is2D, false);
    n.m24 = 1;
    n.m31 = 1;
    n.m32 = 1;
    n.m34 = 1;
    n.m14 = 1;
    assert.equal(n.is2D, false);
  });
});

describe('MC/DC leftover: multiply', () => {
  test('2D×3D, 3D×2D, 3D×3D post-multiply and is2D flip', () => {
    // geometry-1 #dom-dommatrix-multiplyself / #dom-dommatrixreadonly-multiply
    const t2 = new DOMMatrix().translate(1, 2);
    const t3 = new DOMMatrix().translate(0, 0, 3);
    const twoTimesThree = t2.multiply(t3);
    assert.notEqual(twoTimesThree, t2);
    assert.equal(t2.is2D, true);
    assert.equal(twoTimesThree.is2D, false);
    nearly(twoTimesThree.m41, 1, '2d*3d m41');
    nearly(twoTimesThree.m42, 2, '2d*3d m42');
    nearly(twoTimesThree.m43, 3, '2d*3d m43');

    const threeTimesTwo = t3.multiply(t2);
    assert.equal(threeTimesTwo.is2D, false);
    nearly(threeTimesTwo.m41, 1, '3d*2d m41');
    nearly(threeTimesTwo.m42, 2, '3d*2d m42');
    nearly(threeTimesTwo.m43, 3, '3d*2d m43');

    const t3b = new DOMMatrix().translate(4, 5, 6);
    const threeTimesThree = t3.multiply(t3b);
    assert.equal(threeTimesThree.is2D, false);
    nearly(threeTimesThree.m41, 4, '3d*3d m41');
    nearly(threeTimesThree.m42, 5, '3d*3d m42');
    nearly(threeTimesThree.m43, 9, '3d*3d m43');
  });

  test('multiplySelf / preMultiplySelf 3D aliasing path vs 2D fast path', () => {
    const m = new DOMMatrix().translate(1, 2);
    const same = m.multiplySelf(new DOMMatrix().translate(0, 0, 3));
    assert.equal(same, m);
    assert.equal(m.is2D, false);
    nearly(m.m41, 1, 'multiplySelf 2d*3d m41');
    nearly(m.m43, 3, 'multiplySelf 2d*3d m43');

    const already3d = identity3d();
    already3d.translateSelf(10, 0, 0);
    already3d.multiplySelf(new DOMMatrix().translate(1, 2));
    assert.equal(already3d.is2D, false);
    nearly(already3d.m41, 11, '3d*2d multiplySelf m41');
    nearly(already3d.m42, 2, '3d*2d multiplySelf m42');

    const pre = new DOMMatrix().translate(1, 2);
    pre.preMultiplySelf(new DOMMatrix().translate(0, 0, 5));
    assert.equal(pre.is2D, false);
    nearly(pre.m41, 1, 'preMultiply 3d*2d m41');
    nearly(pre.m43, 5, 'preMultiply 3d*2d m43');

    const pre3 = identity3d();
    pre3.translateSelf(1, 0, 0);
    pre3.preMultiplySelf(new DOMMatrix().translate(2, 3));
    assert.equal(pre3.is2D, false);
    nearly(pre3.m41, 3, 'preMultiply 2d*3d m41');
    nearly(pre3.m42, 3, 'preMultiply 2d*3d m42');
  });

  test('multiply default other and DOMMatrixInit dict', () => {
    const m = new DOMMatrix().translate(3, 4);
    const identityMul = m.multiply(undefined);
    assert.equal(identityMul.e, 3);
    assert.equal(identityMul.f, 4);
    assert.equal(m.e, 3);

    const fromDict = m.multiply({ e: 10, f: 20 });
    nearly(fromDict.e, 13, 'multiply dict e');
    nearly(fromDict.f, 24, 'multiply dict f');
    assert.equal(fromDict.is2D, true);
  });
});

describe('MC/DC leftover: invert', () => {
  test('3D invertSelf success vs singular vs non-finite det', () => {
    // geometry-1 #dom-dommatrix-invertself
    const scaled = new DOMMatrix([
      2, 0, 0, 0,
      0, 4, 0, 0,
      0, 0, 5, 0,
      0, 0, 0, 1,
    ]);
    assert.equal(scaled.is2D, false);
    const inv = scaled.inverse();
    assert.notEqual(inv, scaled);
    assert.equal(inv.is2D, false);
    nearly(inv.m11, 0.5, 'inv m11');
    nearly(inv.m22, 0.25, 'inv m22');
    nearly(inv.m33, 0.2, 'inv m33');

    const translated = new DOMMatrix([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      10, 20, 30, 1,
    ]);
    translated.invertSelf();
    assert.equal(translated.is2D, false);
    nearly(translated.m41, -10, 'inv tx');
    nearly(translated.m42, -20, 'inv ty');
    nearly(translated.m43, -30, 'inv tz');

    const singular = new DOMMatrix([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 0,
      0, 0, 0, 1,
    ]);
    singular.invertSelf();
    assert.equal(singular.is2D, false);
    assert.ok(Number.isNaN(singular.m11));
    assert.ok(Number.isNaN(singular.m33));
    assert.ok(Number.isNaN(singular.m44));

    const inf = new DOMMatrix([
      Infinity, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    inf.invertSelf();
    assert.equal(inf.is2D, false);
    assert.ok(Number.isNaN(inf.m11));

    const nan3d = new DOMMatrix([
      NaN, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
    const nanInv = nan3d.inverse();
    assert.equal(nanInv.is2D, false);
    assert.ok(Number.isNaN(nanInv.m11));
  });
});

describe('MC/DC leftover: translate', () => {
  test('defaults, 2D tz=0, already-3D tz=0 vs tz≠0', () => {
    // geometry-1 #dom-dommatrix-translateself
    const identity = new DOMMatrixReadOnly();
    const none = identity.translate();
    assert.equal(none.is2D, true);
    assert.equal(none.isIdentity, true);
    assert.notEqual(none, identity);

    const txOnly = identity.translate(10);
    assert.equal(txOnly.is2D, true);
    assert.equal(txOnly.e, 10);
    assert.equal(txOnly.f, 0);

    const two = identity.translate(1, 2);
    assert.equal(two.is2D, true);
    assert.equal(two.e, 1);
    assert.equal(two.f, 2);

    const already3d = identity3d();
    already3d.translateSelf(4, 5);
    assert.equal(already3d.is2D, false);
    nearly(already3d.m41, 4, '3d tz=0 m41');
    nearly(already3d.m42, 5, '3d tz=0 m42');
    nearly(already3d.m43, 0, '3d tz=0 m43');

    already3d.translateSelf(0, 0, 6);
    assert.equal(already3d.is2D, false);
    nearly(already3d.m43, 6, '3d tz≠0 m43');

    const from2d = new DOMMatrix().translateSelf(1, 2, 0);
    assert.equal(from2d.is2D, true);
    from2d.translateSelf(0, 0, 1);
    assert.equal(from2d.is2D, false);
    nearly(from2d.m43, 1, '2d then tz');
  });
});

describe('MC/DC leftover: scale', () => {
  test('sy default, 2D origin unique-cause, 3D sz/oz/origin paths', () => {
    // geometry-1 #dom-dommatrix-scaleself: scaleY defaults to scaleX; 3D if scaleZ≠1 or originZ≠0
    const uniform = new DOMMatrixReadOnly().scale(3);
    assert.equal(uniform.is2D, true);
    nearly(uniform.a, 3, 'sy default a');
    nearly(uniform.d, 3, 'sy default d');

    const oxOnly = new DOMMatrix([1, 0, 0, 1, 10, 20]);
    oxOnly.scaleSelf(2, 3, 1, 5, 0, 0);
    assert.equal(oxOnly.is2D, true);
    nearly(oxOnly.a, 2, 'ox-only a');
    nearly(oxOnly.d, 3, 'ox-only d');
    nearly(oxOnly.e, (10 + 5) * 2 - 5, 'ox-only e');
    nearly(oxOnly.f, 20 * 3, 'ox-only f (oy=0)');

    const oyOnly = new DOMMatrix([1, 0, 0, 1, 10, 20]);
    oyOnly.scaleSelf(2, 3, 1, 0, 5, 0);
    assert.equal(oyOnly.is2D, true);
    nearly(oyOnly.e, 10 * 2, 'oy-only e (ox=0)');
    nearly(oyOnly.f, (20 + 5) * 3 - 5, 'oy-only f');

    const sz = new DOMMatrixReadOnly().scale(2, 3, 4);
    assert.equal(sz.is2D, false);
    nearly(sz.a, 2, 'sz a');
    nearly(sz.d, 3, 'sz d');
    nearly(sz.m33, 4, 'sz m33');

    const oz = new DOMMatrixReadOnly().scale(2, 3, 1, 0, 0, 5);
    assert.equal(oz.is2D, false);
    nearly(oz.a, 2, 'oz a');
    nearly(oz.m33, 1, 'oz m33');
    nearly(oz.m43, 5 * 1 - 5, 'oz m43 origin cancel');

    const already3d = identity3d();
    already3d.scaleSelf(2, 3);
    assert.equal(already3d.is2D, false);
    nearly(already3d.m11, 2, '3d no-origin m11');
    nearly(already3d.m22, 3, '3d no-origin m22');
    nearly(already3d.m33, 1, '3d no-origin m33');

    const origin3d = identity3d();
    origin3d.scaleSelf(2, 2, 2, 10, 20, 30);
    assert.equal(origin3d.is2D, false);
    const expected = new DOMMatrix().scale(2, 2, 2, 10, 20, 30);
    nearly(origin3d.m11, expected.m11, '3d origin m11');
    nearly(origin3d.m41, expected.m41, '3d origin m41');
    nearly(origin3d.m42, expected.m42, '3d origin m42');
    nearly(origin3d.m43, expected.m43, '3d origin m43');

    const nonUniform = new DOMMatrixReadOnly().scaleNonUniform(3, 5);
    assert.equal(nonUniform.is2D, true);
    nearly(nonUniform.a, 3, 'scaleNonUniform a');
    nearly(nonUniform.d, 5, 'scaleNonUniform d');
  });
});

describe('MC/DC leftover: rotate', () => {
  test('zero-angle early return, 2-arg X, 3-arg Z-on-2D, Z-on-3D, axis length 0', () => {
    // geometry-1 #dom-dommatrix-rotateself: 1 arg → Z; 2/3 args → Euler X then Y then Z
    const ident = new DOMMatrix();
    const zero = ident.rotate();
    assert.equal(zero.isIdentity, true);
    assert.equal(zero.is2D, true);

    ident.rotateSelf(0);
    assert.equal(ident.isIdentity, true);

    ident.rotateSelf(0, 0, 0);
    assert.equal(ident.isIdentity, true);

    const xOnly = new DOMMatrixReadOnly().rotate(90, 0);
    assert.equal(xOnly.is2D, false);
    nearly(xOnly.m11, 1, 'rotate(90,0) m11');
    nearly(xOnly.m22, 0, 'rotate(90,0) m22');
    nearly(xOnly.m23, 1, 'rotate(90,0) m23');
    nearly(xOnly.m32, -1, 'rotate(90,0) m32');
    nearly(xOnly.m33, 0, 'rotate(90,0) m33');

    const yOnly = new DOMMatrixReadOnly().rotate(0, 90);
    assert.equal(yOnly.is2D, false);
    nearly(yOnly.m11, 0, 'rotate(0,90) m11');
    nearly(yOnly.m13, -1, 'rotate(0,90) m13');
    nearly(yOnly.m31, 1, 'rotate(0,90) m31');
    nearly(yOnly.m33, 0, 'rotate(0,90) m33');

    const zExplicit = new DOMMatrix().rotateSelf(0, 0, 90);
    assert.equal(zExplicit.is2D, true);
    nearly(zExplicit.a, 0, 'rotate(0,0,90) a');
    nearly(zExplicit.b, 1, 'rotate(0,0,90) b');
    nearly(zExplicit.c, -1, 'rotate(0,0,90) c');
    nearly(zExplicit.d, 0, 'rotate(0,0,90) d');

    const already3d = identity3d();
    already3d.rotateSelf(90);
    assert.equal(already3d.is2D, false);
    nearly(already3d.m11, 0, '3d Z-only m11');
    nearly(already3d.m12, 1, '3d Z-only m12');
    nearly(already3d.m21, -1, '3d Z-only m21');
    nearly(already3d.m22, 0, '3d Z-only m22');
    nearly(already3d.m33, 1, '3d Z-only m33');

    const rzUndef = new DOMMatrixReadOnly().rotate(30, 45, undefined);
    assert.equal(rzUndef.is2D, false);
    const rzZero = new DOMMatrixReadOnly().rotate(30, 45, 0);
    nearly(rzUndef.m11, rzZero.m11, 'rz default 0 m11');
    nearly(rzUndef.m13, rzZero.m13, 'rz default 0 m13');

    const axisZero = new DOMMatrix().rotateAxisAngleSelf(0, 0, 0, 90);
    assert.equal(axisZero.isIdentity, true);
    assert.equal(axisZero.is2D, true);

    const fromVec = new DOMMatrixReadOnly().rotateFromVector(0, 0);
    assert.equal(fromVec.is2D, true);

    const r3d = new DOMMatrixReadOnly().rotate3d(0, 1, 0, 90);
    assert.equal(r3d.is2D, false);
    nearly(r3d.m11, 0, 'rotate3d Y m11');
    nearly(r3d.m13, -1, 'rotate3d Y m13');
  });
});
