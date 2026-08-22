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
// Verifies: SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5
// Leftover unique-cause for src/typed-om/transform/*.ts not already in
// tests/mcdc-hotspot-typed-om-more.test.ts, tests/typed-om-transforms.test.ts,
// tests/typed-om-transform-is2d.test.ts, tests/typed-om-transform-defaults.test.ts,
// or tests/typed-om-custom-serialization.test.ts.
// Drive CSSTransformValue.parse and public component constructors/setters/
// toString/toMatrix. css-typed-om-1 § 5 #transformvalue-objects / § 5.1–5.7.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSTransformValue,
  CSSTransformComponent,
  CSSTranslate,
  CSSScale,
  CSSRotate,
  CSSSkew,
  CSSSkewX,
  CSSSkewY,
  CSSPerspective,
  CSSMatrixComponent,
  CSSUnitValue,
  CSSKeywordValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathMin,
  CSSMathMax,
  CSSNumericValue,
  DOMMatrix,
  DOMMatrixReadOnly,
} from '../src/typed-om.ts';

function parse(css: string): CSSTransformValue {
  return CSSTransformValue.parse(css);
}

function first(css: string): CSSTransformComponent {
  const tv = parse(css);
  assert.ok(tv.components[0], `expected a component from ${JSON.stringify(css)}`);
  return tv.components[0];
}

function almost(actual: number, expected: number, label: string): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: expected ${expected}, got ${actual}`);
}

describe('MC/DC leftover unique-cause: CSSTransformValue.parse (css-typed-om-1 § 5 #dom-csstransformvalue-parse)', { concurrency: false }, () => {
  test('top-level comment unique-cause vs whitespace skip and empty leftover', () => {
    // Unique-cause: v.type === 'whitespace' T (comment skipped) vs comment T (whitespace F).
    const spaced = parse('translate(1px) scale(2)');
    assert.equal(spaced.length, 2);
    assert.ok(spaced.components[0] instanceof CSSTranslate);
    assert.ok(spaced.components[1] instanceof CSSScale);

    const commented = parse('translate(1px)/*mid*/scale(2)');
    assert.equal(commented.length, 2);
    assert.equal(commented.toString().includes('translate'), true);
    assert.equal(commented.toString().includes('scale'), true);

    const both = parse('  /*lead*/ translate(1px) /*a*/ /*b*/ scale(2) /*trail*/ ');
    assert.equal(both.length, 2);

    assert.throws(() => parse(''), TypeError);
    assert.throws(() => parse('/* only comment */'), TypeError);
    assert.throws(() => parse('   '), TypeError);
  });

  test('inner arg filter unique-cause of whitespace / comment / comma', () => {
    // Unique-cause: filter skips whitespace T, comment T (no space), comma T.
    const ws = parse('translate( 1px , 2px )');
    assert.ok(ws.components[0] instanceof CSSTranslate);
    assert.equal((ws.components[0] as CSSTranslate).x.toString(), '1px');
    assert.equal((ws.components[0] as CSSTranslate).y.toString(), '2px');

    const cmt = parse('translate(1px/*x*/,/*y*/2px)');
    assert.ok(cmt.components[0] instanceof CSSTranslate);
    assert.equal((cmt.components[0] as CSSTranslate).y.toString(), '2px');

    const commas = parse('scale(2,3,4)');
    assert.ok(commas.components[0] instanceof CSSScale);
    assert.equal((commas.components[0] as CSSScale).is2D, false);
  });

  test('matrix vs matrix3d unique-cause and non-number args', () => {
    // Unique-cause: name === 'matrix' T (matrix3d skipped) vs F,T matrix3d.
    const m2 = parse('matrix(1, 0, 0, 1, 10, 20)');
    assert.ok(m2.components[0] instanceof CSSMatrixComponent);
    assert.equal(m2.components[0].is2D, true);
    assert.equal(m2.components[0].toString().startsWith('matrix('), true);

    const m3 = parse('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1)');
    assert.ok(m3.components[0] instanceof CSSMatrixComponent);
    assert.equal(m3.components[0].is2D, false);
    assert.equal(m3.components[0].toString().startsWith('matrix3d('), true);
    const copied = m3.components[0].toMatrix();
    assert.equal(copied.is2D, false);
    almost(copied.m41, 10, 'matrix3d m41');
    almost(copied.m42, 20, 'matrix3d m42');
    almost(copied.m43, 30, 'matrix3d m43');

    const mixedCase = parse('MATRIX3D(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)');
    assert.ok(mixedCase.components[0] instanceof CSSMatrixComponent);

    // Unique-cause: a.type === 'number' F → 0 (dimension / percent / ident).
    const dim = parse('matrix(1px, 0, 0, 1, 0, 0)');
    assert.ok(dim.components[0] instanceof CSSMatrixComponent);
    assert.equal((dim.components[0] as CSSMatrixComponent).matrix.a, 0);

    const pct = parse('matrix(1, 0, 0, 1, 0, 50%)');
    assert.equal((pct.components[0] as CSSMatrixComponent).matrix.f, 0);

    const ident = parse('matrix(1, 0, 0, 1, auto, 0)');
    assert.equal((ident.components[0] as CSSMatrixComponent).matrix.e, 0);
  });

  test('translate arity unique-cause and axis names', () => {
    // Unique-cause: translatex/y/z args.length !== 1 T; translate3d !== 3 T;
    // translate length < 1 / > 3 T.
    assert.throws(() => parse('translateX(1px, 2px)'), TypeError);
    assert.throws(() => parse('translateY(1px, 2px)'), TypeError);
    assert.throws(() => parse('translateZ(1px, 2px)'), TypeError);
    assert.throws(() => parse('translate3d(1px, 2px)'), TypeError);
    assert.throws(() => parse('translate3d(1px)'), TypeError);
    assert.throws(() => parse('translate()'), TypeError);
    assert.throws(() => parse('translate(1px, 2px, 3px, 4px)'), TypeError);

    const x = parse('TRANSLATEX(1%)');
    assert.ok(x.components[0] instanceof CSSTranslate);
    assert.equal((x.components[0] as CSSTranslate).is2D, true);
    assert.equal((x.components[0] as CSSTranslate).x.toString(), '1%');

    const y = parse('translateY(2px)');
    assert.equal((y.components[0] as CSSTranslate).y.toString(), '2px');
    assert.equal((y.components[0] as CSSTranslate).x.toString(), '0px');

    const z = parse('translateZ(3px)');
    assert.equal((z.components[0] as CSSTranslate).is2D, false);
    assert.equal((z.components[0] as CSSTranslate).z.toString(), '3px');

    const t1 = parse('translate(4px)');
    assert.equal((t1.components[0] as CSSTranslate).y.toString(), '0px');

    const t2 = parse('translate(4px, 5%)');
    assert.equal((t2.components[0] as CSSTranslate).y.toString(), '5%');
    assert.equal((t2.components[0] as CSSTranslate).is2D, true);

    const t3 = parse('translate(4px, 5px, 6px)');
    assert.equal((t3.components[0] as CSSTranslate).is2D, false);
    assert.equal((t3.components[0] as CSSTranslate).z.toString(), '6px');

    const t3d = parse('translate3d(1px, 2px, 3px)');
    assert.equal((t3d.components[0] as CSSTranslate).z.toString(), '3px');
  });

  test('scale arity unique-cause and axis names', () => {
    assert.throws(() => parse('scaleX(1, 2)'), TypeError);
    assert.throws(() => parse('scaleY(1, 2)'), TypeError);
    assert.throws(() => parse('scaleZ(1, 2)'), TypeError);
    assert.throws(() => parse('scale3d(1, 2)'), TypeError);
    assert.throws(() => parse('scale()'), TypeError);
    assert.throws(() => parse('scale(1, 2, 3, 4)'), TypeError);

    const sx = parse('SCALEX(2)');
    assert.ok(sx.components[0] instanceof CSSScale);
    assert.equal((sx.components[0] as CSSScale).y.toString(), '1');

    const sy = parse('scaleY(3)');
    assert.equal((sy.components[0] as CSSScale).x.toString(), '1');
    assert.equal((sy.components[0] as CSSScale).y.toString(), '3');

    const sz = parse('scaleZ(4)');
    assert.equal((sz.components[0] as CSSScale).is2D, false);
    assert.equal((sz.components[0] as CSSScale).z.toString(), '4');

    const s1 = parse('scale(2)');
    assert.equal(s1.components[0].toString(), 'scale(2)');

    const s2 = parse('scale(2, 3)');
    assert.equal(s2.components[0].toString(), 'scale(2, 3)');

    const s3 = parse('scale(1, 2, 3)');
    assert.equal((s3.components[0] as CSSScale).is2D, false);
    assert.equal(s3.components[0].toString(), 'scale3d(1, 2, 3)');
  });

  test('rotate arity unique-cause 1 vs 4 and axis names', () => {
    assert.throws(() => parse('rotateX(1deg, 2deg)'), TypeError);
    assert.throws(() => parse('rotateY(1deg, 2deg)'), TypeError);
    assert.throws(() => parse('rotateZ(1deg, 2deg)'), TypeError);
    assert.throws(() => parse('rotate3d(1, 0, 0)'), TypeError);
    assert.throws(() => parse('rotate()'), TypeError);
    assert.throws(() => parse('rotate(1deg, 2deg)'), TypeError);
    assert.throws(() => parse('rotate(1, 0, 0)'), TypeError);

    const r1 = parse('rotate(90deg)');
    assert.ok(r1.components[0] instanceof CSSRotate);
    assert.equal((r1.components[0] as CSSRotate).is2D, true);

    const r4 = parse('rotate(1, 0, 0, 45deg)');
    assert.ok(r4.components[0] instanceof CSSRotate);
    assert.equal((r4.components[0] as CSSRotate).is2D, false);
    assert.equal((r4.components[0] as CSSRotate).x.toString(), '1');
    assert.equal((r4.components[0] as CSSRotate).angle.toString(), '45deg');

    const rx = parse('ROTATEX(10deg)');
    assert.equal((rx.components[0] as CSSRotate).x.toString(), '1');
    assert.equal((rx.components[0] as CSSRotate).y.toString(), '0');

    const ry = parse('rotateY(10deg)');
    assert.equal((ry.components[0] as CSSRotate).y.toString(), '1');

    const rz = parse('rotateZ(10deg)');
    assert.equal((rz.components[0] as CSSRotate).z.toString(), '1');

    const r3d = parse('rotate3d(0, 1, 0, 30deg)');
    assert.equal((r3d.components[0] as CSSRotate).y.toString(), '1');
  });

  test('parseNumeric function / ident leftover unique-cause', () => {
    // Unique-cause: v.type === 'function' T (calc/min) vs F (ident/hash).
    const calcLen = parse('translate(calc(1px + 2px))');
    assert.ok(calcLen.components[0] instanceof CSSTranslate);
    assert.ok((calcLen.components[0] as CSSTranslate).x instanceof CSSNumericValue);

    const leftover = parse('translate(calc(1px + 2em))');
    assert.ok((leftover.components[0] as CSSTranslate).x instanceof CSSMathSum);

    const minLen = parse('translate(min(1px, 2px))');
    assert.ok((minLen.components[0] as CSSTranslate).x instanceof CSSNumericValue);

    const rotCalc = parse('rotate(calc(45deg + 1rad))');
    assert.ok(rotCalc.components[0] instanceof CSSRotate);
    assert.ok(rotCalc.components[0].toString().startsWith('rotate('));

    const scaleFn = parse('scale(calc(1 + 1))');
    assert.ok(scaleFn.components[0] instanceof CSSScale);

    // mathNode instanceof CSSNumericValue F → CSSUnitValue(0, 'number').
    // scale accepts unitless 0; translate/rotate setters reject it.
    const scaleVar = parse('scale(var(--x))');
    assert.ok(scaleVar.components[0] instanceof CSSScale);
    assert.equal((scaleVar.components[0] as CSSScale).x.toString(), '0');

    const scaleRgb = parse('scale(rgb(1, 2, 3))');
    assert.equal((scaleRgb.components[0] as CSSScale).x.toString(), '0');

    const scaleIdent = parse('scale(auto)');
    assert.equal((scaleIdent.components[0] as CSSScale).x.toString(), '0');

    const scaleEmptyCalc = parse('scale(calc())');
    assert.equal((scaleEmptyCalc.components[0] as CSSScale).x.toString(), '0');

    assert.throws(() => parse('translate(auto)'), TypeError);
    assert.throws(() => parse('translate(var(--x))'), TypeError);
    assert.throws(() => parse('rotate(auto)'), TypeError);
    assert.throws(() => parse('rotate(#ff0)'), TypeError);
  });

  test('perspective ident none unique-cause vs other ident', () => {
    // Unique-cause: arg.type === 'ident' T and value === 'none' T vs F.
    const none = parse('perspective(none)');
    assert.ok(none.components[0] instanceof CSSPerspective);
    assert.ok((none.components[0] as CSSPerspective).length instanceof CSSKeywordValue);
    assert.equal(((none.components[0] as CSSPerspective).length as CSSKeywordValue).value, 'none');

    const NONE = parse('perspective(NONE)');
    assert.ok((NONE.components[0] as CSSPerspective).length instanceof CSSKeywordValue);

    const px = parse('perspective(100px)');
    assert.ok((px.components[0] as CSSPerspective).length instanceof CSSUnitValue);

    assert.throws(() => parse('perspective(auto)'), TypeError);
    assert.throws(() => parse('perspective(inherit)'), TypeError);
    assert.throws(() => parse('perspective(foo)'), TypeError);

    const calcP = parse('perspective(calc(50px + 50px))');
    assert.ok(calcP.components[0] instanceof CSSPerspective);
  });

  test('skew parse leftover one-arg vs two-arg and mixed case', () => {
    const one = parse('skew(10deg)');
    assert.ok(one.components[0] instanceof CSSSkew);
    assert.equal((one.components[0] as CSSSkew).ay.toString(), '0deg');

    const two = parse('SKEW(10deg, 20grad)');
    assert.ok(two.components[0] instanceof CSSSkew);
    assert.equal(two.components[0].toString().includes('deg'), true);

    const sx = parse('skewX(15rad)');
    assert.ok(sx.components[0] instanceof CSSSkewX);
    assert.equal(sx.components[0].toString().startsWith('skewX('), true);

    const sy = parse('skewY(20turn)');
    assert.ok(sy.components[0] instanceof CSSSkewY);
    assert.equal(sy.components[0].toString().startsWith('skewY('), true);
  });
});

describe('MC/DC leftover unique-cause: CSSTransformValue index set (css-typed-om-1 § 5 #transformvalue-objects)', { concurrency: false }, () => {
  test('proxy set unique-cause of string index, append, symbol, and non-component', () => {
    const t = parse('translate(1px)');
    assert.equal(t.length, 1);

    // Unique-cause: /^\d+$/.test T, index === length (append, not > length).
    t[1] = new CSSScale(2, 2);
    assert.equal(t.length, 2);
    assert.ok(t[1] instanceof CSSScale);

    t[0] = new CSSRotate(CSS.deg(10));
    assert.ok(t[0] instanceof CSSRotate);

    assert.throws(() => {
      t[3] = new CSSScale(1, 1);
    }, RangeError);

    assert.throws(() => {
      t[0] = CSS.px(1) as unknown as CSSTransformComponent;
    }, TypeError);

    // Unique-cause: typeof prop === 'string' F (symbol) vs T && test F (non-digits).
    const mark = Symbol('leftover-xform');
    (t as unknown as Record<symbol, number>)[mark] = 7;
    assert.equal((t as unknown as Record<symbol, number>)[mark], 7);

    const holder = t as unknown as { leftoverName?: string };
    holder.leftoverName = 'ok';
    assert.equal(holder.leftoverName, 'ok');
  });
});

describe('MC/DC leftover unique-cause: normalizeAngleUnits via component toString (css-typed-om-1 § 5.3 #cssrotate)', { concurrency: false }, () => {
  test('unit unique-cause turn/grad/rad/deg via parse then toString', () => {
    const turn = first('rotate(1turn)');
    assert.equal(turn.toString(), 'rotate(360deg)');

    // Unique-cause: node.unit === 'grad' T (existing coverage was F).
    const grad = first('rotate(50grad)');
    assert.equal(grad.toString(), 'rotate(45deg)');

    // Unique-cause: node.unit === 'rad' T.
    const rad = first('rotate(1rad)');
    const radStr = rad.toString();
    assert.equal(radStr.startsWith('rotate('), true);
    assert.equal(radStr.endsWith('deg)'), true);
    const radDeg = Number(radStr.slice('rotate('.length, -'deg)'.length));
    almost(radDeg, 180 / Math.PI, '1rad in deg');

    const deg = first('rotate(90deg)');
    assert.equal(deg.toString(), 'rotate(90deg)');

    const skewGrad = first('skew(50grad, 100grad)');
    assert.equal(skewGrad.toString(), 'skew(45deg, 90deg)');

    const skewXRad = first('skewX(1rad)');
    assert.equal(skewXRad.toString().startsWith('skewX('), true);

    const skewYTurn = first('skewY(0.5turn)');
    assert.equal(skewYTurn.toString(), 'skewY(180deg)');
  });

  test('math-node unique-cause sum/product/negate/invert/min fallthrough', () => {
    // Unique-cause: instanceof CSSMathSum / Product T via constructed angle.
    const sum = new CSSRotate(new CSSMathSum(CSS.deg(10), CSS.grad(50)));
    const sumStr = sum.toString();
    assert.equal(sumStr.startsWith('rotate('), true);
    assert.equal(sumStr.includes('deg'), true);

    // Invert T is reached on the recursive product child (invert of a number).
    const prod = new CSSRotate(new CSSMathProduct(new CSSMathInvert(CSS.number(2)), CSS.deg(90)));
    assert.ok(prod.toString().startsWith('rotate('));

    // Unique-cause: instanceof CSSMathNegate T.
    const neg = new CSSRotate(new CSSMathNegate(CSS.deg(45)));
    assert.ok(neg.toString().startsWith('rotate('));
    assert.ok(neg.toString().includes('-') || neg.toString().includes('calc'));

    const skewNeg = new CSSSkew(new CSSMathNegate(CSS.rad(1)), CSS.deg(0));
    assert.ok(skewNeg.toString().startsWith('skew('));

    // Unique-cause: instanceof CSSMathInvert F — leftover min is neither
    // UnitValue/Sum/Product/Negate/Invert, so normalizeAngleUnits returns node.
    const min = new CSSRotate(new CSSMathMin(CSS.deg(10), CSS.deg(20)));
    assert.ok(min.toString().includes('min(') || min.toString().startsWith('rotate('));

    const max = new CSSRotate(new CSSMathMax(CSS.deg(10), CSS.deg(20)));
    assert.ok(max.toString().startsWith('rotate('));
  });
});

describe('MC/DC leftover unique-cause: component setters and constructors (css-typed-om-1 § 5.2–5.7)', { concurrency: false }, () => {
  test('CSSTranslate.y / .z instanceof unique-cause F vs type mismatch', () => {
    const t = parse('translate(1px, 2px, 3px)').components[0] as CSSTranslate;
    assert.ok(t instanceof CSSTranslate);

    // Unique-cause: val instanceof CSSNumericValue F.
    assert.throws(() => {
      t.y = 10 as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      t.z = 10 as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      t.x = '1px' as unknown as CSSNumericValue;
    }, TypeError);

    // Unique-cause: instanceof T, matchesLengthPercentage / matchesLength F.
    assert.throws(() => {
      t.y = CSS.number(1);
    }, TypeError);
    assert.throws(() => {
      t.y = CSS.deg(1);
    }, TypeError);
    assert.throws(() => {
      t.z = CSS.percent(1);
    }, TypeError);
    assert.throws(() => {
      t.z = CSS.number(1);
    }, TypeError);

    t.y = CSS.percent(50);
    assert.equal(t.y.toString(), '50%');
    t.z = CSS.px(9);
    assert.equal(t.z.toString(), '9px');
  });

  test('CSSSkew.ay / CSSRotate.angle / CSSScale validateNumberish instanceof F', () => {
    const skew = parse('skew(10deg, 20deg)').components[0] as CSSSkew;
    // Unique-cause: val instanceof CSSNumericValue F on ay.
    assert.throws(() => {
      skew.ay = 20 as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      skew.ay = '20deg' as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      skew.ax = null as unknown as CSSNumericValue;
    }, TypeError);
    skew.ay = CSS.deg(30);
    assert.equal(skew.ay.toString(), '30deg');

    const sy = parse('skewY(10deg)').components[0] as CSSSkewY;
    assert.throws(() => {
      sy.ay = 10 as unknown as CSSNumericValue;
    }, TypeError);

    const sx = parse('skewX(10deg)').components[0] as CSSSkewX;
    assert.throws(() => {
      sx.ax = 10 as unknown as CSSNumericValue;
    }, TypeError);

    const rot = parse('rotate(1, 0, 0, 45deg)').components[0] as CSSRotate;
    assert.throws(() => {
      rot.angle = 45 as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      rot.x = '1' as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      rot.y = null as unknown as CSSNumericValue;
    }, TypeError);
    rot.x = 0;
    rot.y = CSS.number(1);
    rot.z = 0;
    assert.equal(rot.y.toString(), '1');

    const sc = parse('scale(2, 3)').components[0] as CSSScale;
    // Unique-cause: val instanceof CSSNumericValue F after typeof === 'number' F.
    assert.throws(() => {
      sc.x = '2' as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      sc.y = null as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      sc.z = {} as unknown as CSSNumericValue;
    }, TypeError);
    sc.x = 4;
    sc.y = CSS.number(5);
    assert.equal(sc.x.toString(), '4');
    assert.equal(sc.y.toString(), '5');
  });

  test('CSSPerspective.length leftover string/keyword/numeric unique-cause', () => {
    const p = parse('perspective(100px)').components[0] as CSSPerspective;
    p.length = 'NONE';
    assert.ok(p.length instanceof CSSKeywordValue);
    assert.equal((p.length as CSSKeywordValue).value, 'none');
    assert.throws(() => {
      p.length = 'auto';
    }, TypeError);
    p.length = new CSSKeywordValue('None');
    assert.ok(p.length instanceof CSSKeywordValue);
    p.length = CSS.px(80);
    assert.equal((p.length as CSSUnitValue).value, 80);
    assert.throws(() => {
      p.length = 80 as unknown as CSSNumericValue;
    }, TypeError);
    assert.throws(() => {
      p.length = null as unknown as CSSNumericValue;
    }, TypeError);
  });

  test('CSSMatrixComponent constructor matrix/options unique-cause', () => {
    // Unique-cause: !matrix T (null/undefined) vs typeof !== 'object' T.
    assert.throws(() => new CSSMatrixComponent(null as unknown as DOMMatrixReadOnly), TypeError);
    assert.throws(() => new CSSMatrixComponent(undefined as unknown as DOMMatrixReadOnly), TypeError);
    assert.throws(() => new CSSMatrixComponent(1 as unknown as DOMMatrixReadOnly), TypeError);
    assert.throws(() => new CSSMatrixComponent('matrix(1,0,0,1,0,0)' as unknown as DOMMatrixReadOnly), TypeError);

    // Unique-cause: 'a' in matrix F (m11 skipped); 'a' T && 'm11' F.
    assert.throws(() => new CSSMatrixComponent({ m11: 1 } as unknown as DOMMatrixReadOnly), TypeError);
    assert.throws(() => new CSSMatrixComponent({ a: 1 } as unknown as DOMMatrixReadOnly), TypeError);

    const duck = {
      a: 1, b: 0, c: 0, d: 1, e: 4, f: 5,
      m11: 1, m12: 0, m13: 0, m14: 0,
      m21: 0, m22: 1, m23: 0, m24: 0,
      m31: 0, m32: 0, m33: 1, m34: 0,
      m41: 4, m42: 5, m43: 0, m44: 1,
      is2D: true,
    };
    const fromDuck = new CSSMatrixComponent(duck as unknown as DOMMatrixReadOnly);
    assert.equal(fromDuck.is2D, true);
    almost(fromDuck.matrix.e, 4, 'duck e');

    const live = new DOMMatrix([1, 0, 0, 1, 0, 0]);
    // Unique-cause: options T, options.is2D !== undefined F (`{}` / explicit undefined).
    const noFlag = new CSSMatrixComponent(live, {});
    assert.equal(noFlag.is2D, live.is2D);
    const undefFlag = new CSSMatrixComponent(live, { is2D: undefined });
    assert.equal(undefFlag.is2D, live.is2D);
    const forced3d = new CSSMatrixComponent(live, { is2D: false });
    assert.equal(forced3d.is2D, false);
    const from3d = forced3d.toMatrix();
    assert.equal(from3d.is2D, false);
  });
});

describe('MC/DC leftover unique-cause: component toMatrix via parse (css-typed-om-1 § 5 #dom-csstransformcomponent-tomatrix)', { concurrency: false }, () => {
  test('translate/scale/rotate 2D vs 3D matrices from parse', () => {
    const t2 = parse('translate(10px, 20px)');
    const m2 = t2.components[0].toMatrix();
    assert.equal(m2.is2D, true);
    almost(m2.e, 10, 'tx');
    almost(m2.f, 20, 'ty');

    const t3 = parse('translate(10px, 20px, 30px)');
    const m3 = t3.components[0].toMatrix();
    assert.equal(m3.is2D, false);
    almost(m3.m41, 10, 't3 m41');
    almost(m3.m43, 30, 't3 m43');

    const s2 = parse('scale(2, 3)');
    almost(s2.components[0].toMatrix().a, 2, 'sx');
    almost(s2.components[0].toMatrix().d, 3, 'sy');

    const s3 = parse('scale(2, 3, 4)');
    const sm3 = s3.components[0].toMatrix();
    assert.equal(sm3.is2D, false);
    almost(sm3.m11, 2, 's3 m11');
    almost(sm3.m33, 4, 's3 m33');

    const r2 = parse('rotate(90deg)');
    almost(r2.components[0].toMatrix().b, 1, 'r2 b');

    const r3 = parse('rotate3d(0, 1, 0, 90deg)');
    const rm3 = r3.components[0].toMatrix();
    assert.equal(rm3.is2D, false);

    const zeroAxis = parse('rotate3d(0, 0, 0, 45deg)');
    assert.ok(zeroAxis.components[0].toMatrix());
  });

  test('perspective toMatrix keyword / non-positive / positive leftover', () => {
    const none = parse('perspective(none)');
    const id = none.components[0].toMatrix();
    assert.equal(id.m34, 0);

    const zero = parse('perspective(0px)');
    assert.equal(zero.components[0].toMatrix().m34, 0);

    const neg = parse('perspective(-50px)');
    assert.equal(neg.components[0].toMatrix().m34, 0);
    assert.equal(neg.components[0].toString().includes('calc('), true);

    const pos = parse('perspective(100px)');
    almost(pos.components[0].toMatrix().m34, -0.01, 'persp m34');

    const list = parse('translate(1px) scale(2)');
    const combined = list.toMatrix();
    almost(combined.a, 2, 'list a');
    almost(combined.e, 2, 'list e after scale');
  });

  test('CSSMatrixComponent toMatrix is2D F unique-cause via parse matrix3d', () => {
    const parsed = parse('matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 7, 8, 9, 1)');
    const comp = parsed.components[0] as CSSMatrixComponent;
    assert.equal(comp.is2D, false);
    const m = comp.toMatrix();
    assert.equal(m.is2D, false);
    almost(m.m41, 7, 'm41');
    almost(m.m42, 8, 'm42');
    almost(m.m43, 9, 'm43');

    const as2d = parse('matrix(1, 2, 3, 4, 5, 6)');
    const m2 = (as2d.components[0] as CSSMatrixComponent).toMatrix();
    assert.equal(m2.is2D, true);
    almost(m2.a, 1, 'a');
    almost(m2.f, 6, 'f');
  });
});
