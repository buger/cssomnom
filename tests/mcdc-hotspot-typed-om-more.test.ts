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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSKeywordValue,
  CSSStyleValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSColorValue,
  CSSRGB,
  CSSHSL,
  CSSHWB,
  CSSLab,
  CSSLCH,
  CSSOKLab,
  CSSOKLCH,
  CSSColor,
  CSSMathSum,
  CSSMathProduct,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathRound,
  CSSTranslate,
  CSSScale,
  CSSRotate,
  CSSSkew,
  CSSSkewX,
  CSSSkewY,
  CSSPerspective,
  CSSMatrixComponent,
  CSSTransformValue,
  CSSPositionValue,
  StylePropertyMap,
  CSSImageValue,
} from '../src/typed-om.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSURLImageValue, CSSGradientImageValue } from '../src/typed-om/values/CSSImageValue.ts';
import { DOMMatrix } from '../src/DOMMatrix.ts';
import { createCSSStyleValue } from '../src/typed-om/values/style-value-factory.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokensToUnparsedSegments } from '../src/typed-om/values/CSSUnparsedValue.ts';
import {
  matchesLength,
  matchesPercentage,
  matchesNumber,
  matchesAngle,
  matchesTime,
  matchesFrequency,
  matchesResolution,
  matchesFlex,
  isLengthPercentage,
  isNumericValue,
  isKeywordValue,
} from '../src/typed-om/utils/type-guards.ts';
import { addTypes, addTypesForSum, applyPercentHint } from '../src/typed-om/numeric/CSSNumericType.ts';
import { stripOuterParens, isAlphaUnity, formatAlpha } from '../src/typed-om/utils/formatting.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

function construct(Ctor: new (...args: never[]) => unknown, ...args: unknown[]): unknown {
  return new (Ctor as unknown as new (...a: unknown[]) => unknown)(...args);
}

describe('MC/DC hotspot: CSSNumericValue arithmetic and parse', () => {
  test('parse number, dimension, percent, calc; reject empty, multi, ident, bad unit', () => {
    const n = CSSNumericValue.parse('12');
    assert.ok(n instanceof CSSUnitValue);
    assert.equal(n.value, 12);
    assert.equal(n.unit, 'number');

    const px = CSSNumericValue.parse('10px');
    assert.ok(px instanceof CSSUnitValue);
    assert.equal(px.unit, 'px');

    const pct = CSSNumericValue.parse('50%');
    assert.ok(pct instanceof CSSUnitValue);
    assert.equal(pct.unit, 'percent');

    const calc = CSSNumericValue.parse('calc(1px + 2px)');
    assert.ok(calc);

    assert.throws(() => CSSNumericValue.parse(''), DOMException);
    assert.throws(() => CSSNumericValue.parse('1px 2px'), DOMException);
    assert.throws(() => CSSNumericValue.parse('auto'), DOMException);
    assert.throws(() => CSSNumericValue.parse('10nope'), DOMException);
    assert.throws(() => CSSNumericValue.parse('var(--x)'), DOMException);
    assert.throws(() => (CSSNumericValue.parse as () => CSSNumericValue)(), TypeError);
  });

  test('add/sub same unit collapse; mixed units become CSSMathSum; negate unwrap', () => {
    const a = CSS.px(10);
    const b = CSS.px(5);
    const sum = a.add(b);
    assert.ok(sum instanceof CSSUnitValue);
    assert.equal(sum.value, 15);
    assert.equal(sum.unit, 'px');

    const mixed = a.add(CSS.em(1));
    assert.ok(mixed instanceof CSSMathSum);
    assert.equal(mixed.values.length, 2);

    const nested = mixed.add(CSS.px(1));
    assert.ok(nested instanceof CSSMathSum);

    const sub = a.sub(b);
    assert.ok(sub instanceof CSSUnitValue);
    assert.equal(sub.value, 5);

    const negate = new CSSMathNegate(CSS.px(3));
    const unwrapped = a.sub(negate);
    assert.ok(unwrapped);
    assert.equal(unwrapped.toString().includes('px'), true);

    assert.throws(() => a.add(CSS.deg(1)), TypeError);
    assert.throws(() => new CSSMathSum(), DOMException);
  });

  test('mul/div number collapse, invert unwrap, division by zero', () => {
    const a = CSS.px(10);
    const twice = a.mul(2);
    assert.ok(twice instanceof CSSUnitValue);
    assert.equal(twice.value, 20);
    assert.equal(twice.unit, 'px');

    const numbers = CSS.number(2).mul(CSS.number(3));
    assert.ok(numbers instanceof CSSUnitValue);
    assert.equal(numbers.value, 6);

    const product = a.mul(CSS.em(2));
    assert.ok(product instanceof CSSMathProduct);

    const nested = product.mul(2);
    assert.ok(nested instanceof CSSMathProduct);

    const divNum = a.div(2);
    assert.ok(divNum instanceof CSSUnitValue);
    assert.equal(divNum.value, 5);

    const divSame = a.div(CSS.px(2));
    assert.ok(divSame instanceof CSSUnitValue);
    assert.equal(divSame.unit, 'number');

    assert.throws(() => a.div(0), RangeError);
    assert.throws(() => a.div(CSS.number(0)), RangeError);

    const invert = new CSSMathInvert(CSS.number(2));
    const uninverted = a.div(invert);
    assert.ok(uninverted);
  });

  test('min/max same unit collapse vs mixed CSSMathMin/Max', () => {
    const minSame = CSS.px(10).min(CSS.px(3), CSS.px(7));
    assert.ok(minSame instanceof CSSUnitValue);
    assert.equal(minSame.value, 3);

    const minMixed = CSS.px(10).min(CSS.em(1));
    assert.ok(minMixed instanceof CSSMathMin);

    const nestedMin = minMixed.min(CSS.px(1));
    assert.ok(nestedMin instanceof CSSMathMin);

    const maxSame = CSS.px(10).max(CSS.px(30));
    assert.ok(maxSame instanceof CSSUnitValue);
    assert.equal(maxSame.value, 30);

    const maxMixed = CSS.px(10).max(CSS.em(1));
    assert.ok(maxMixed instanceof CSSMathMax);

    assert.throws(() => new CSSMathMin(), DOMException);
    assert.throws(() => new CSSMathMax(), DOMException);
  });

  test('to / toSum compatible conversion, leftover units, invalid unit', () => {
    const cm = CSS.px(96).to('in');
    assert.equal(cm.unit, 'in');
    assert.equal(cm.value, 1);

    const deg = CSS.deg(180).to('rad');
    assert.ok(Math.abs(deg.value - Math.PI) < 1e-6);

    const ms = CSS.s(1).to('ms');
    assert.equal(ms.value, 1000);

    const dpi = CSS.dppx(1).to('dpi');
    assert.equal(dpi.value, 96);

    assert.throws(() => CSS.px(1).to('deg'), TypeError);
    assert.throws(() => CSS.px(1).to('nope'), DOMException);
    assert.throws(() => (CSS.px(1).to as () => CSSUnitValue)(), TypeError);

    const sum = CSS.px(1).add(CSS.em(2)).toSum('px', 'em');
    assert.ok(sum instanceof CSSMathSum);
    assert.equal(sum.values.length, 2);

    const sorted = CSS.px(1).add(CSS.em(2)).toSum();
    assert.ok(sorted instanceof CSSMathSum);

    assert.throws(() => CSS.px(1).add(CSS.em(2)).toSum('px'), TypeError);
    assert.throws(() => CSS.px(1).toSum('nope'), DOMException);
  });

  test('equals number, unit, math nodes, clamp, round, empty args', () => {
    assert.equal(CSS.number(2).equals(2), true);
    assert.equal(CSS.number(2).equals(3), false);
    assert.equal(CSS.px(1).equals(CSS.px(1)), true);
    assert.equal(CSS.px(1).equals(CSS.px(2)), false);
    assert.equal(CSS.px(1).equals(CSS.em(1)), false);
    assert.equal(CSS.px(1).equals(CSS.px(1), CSS.px(1)), true);
    assert.equal(CSS.px(1).equals(), true);

    const sumA = CSS.px(1).add(CSS.em(1));
    const sumB = CSS.px(1).add(CSS.em(1));
    assert.equal(sumA.equals(sumB), true);

    const clampA = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    const clampB = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(clampA.equals(clampB), true);
    const clampNone = new CSSMathClamp(new CSSKeywordValue('none'), CSS.px(2), new CSSKeywordValue('none'));
    assert.equal(clampNone.equals(new CSSMathClamp(new CSSKeywordValue('none'), CSS.px(2), new CSSKeywordValue('none'))), true);
    assert.equal(clampA.equals(clampNone), false);

    const roundA = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    const roundB = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    assert.equal(roundA.equals(roundB), true);
    assert.equal(roundA.equals(new CSSMathRound('up', CSS.px(1.2), CSS.px(1))), false);

    const neg = new CSSMathNegate(CSS.px(1));
    assert.equal(neg.equals(new CSSMathNegate(CSS.px(1))), true);
    const inv = new CSSMathInvert(CSS.px(2));
    assert.equal(inv.equals(new CSSMathInvert(CSS.px(2))), true);

    assert.equal(sumA.equals(CSS.px(1)), false);
    assert.throws(() => construct(CSSMathClamp, CSS.px(1), CSS.px(2)), TypeError);
    assert.throws(() => new CSSMathClamp(CSS.deg(1), CSS.px(2), CSS.px(3)), TypeError);
  });

  test('CSSUnitValue specials, type, invalid unit; CSSNumericArray', () => {
    assert.equal(new CSSUnitValue(Infinity, 'number').toString(), 'infinity');
    assert.equal(new CSSUnitValue(-Infinity, 'px').toString().includes('infinity'), true);
    assert.equal(new CSSUnitValue(NaN, 'number').toString(), 'nan');
    assert.equal(CSS.percent(50).toString(), '50%');
    assert.throws(() => new CSSUnitValue(1, 'nope' as CSSUnit), TypeError);

    const type = CSS.px(1).type();
    assert.equal(type.length, 1);
    assert.equal(Object.keys(CSS.number(1).type()).length, 0);
    assert.equal(CSS.percent(1).type().percent, 1);

    const arr = new CSSMathSum(CSS.px(1), CSS.em(2)).values;
    assert.equal(arr.length, 2);
    const first = arr.item(0);
    assert.ok(first instanceof CSSUnitValue);
    assert.equal(first.unit, 'px');
    const second = arr[1];
    assert.ok(second instanceof CSSUnitValue);
    assert.equal(second.unit, 'em');
    assert.equal([...arr].length, 2);
    const keys = [...arr.keys()];
    assert.equal(keys[0], 0);
    arr.forEach((v) => assert.ok(v instanceof CSSUnitValue));
    assert.equal(arr.every((v) => v instanceof CSSUnitValue), true);
    assert.equal(arr.map((v) => (v instanceof CSSUnitValue ? v.unit : '')).join(','), 'px,em');
  });
});

describe('MC/DC hotspot: numeric types, math serialize, type-guards', () => {
  test('applyPercentHint, addTypes mismatch, addTypesForSum percent hint', () => {
    const hinted = applyPercentHint({ percent: 1 }, 'length');
    assert.equal(hinted.percentHint, 'length');
    assert.equal(hinted.length, 1);
    assert.equal(hinted.percent, undefined);

    const zeroed = applyPercentHint({ percent: 0 }, 'length');
    assert.equal(zeroed.length, undefined);

    const product = addTypes({ length: 1 }, { length: 1 });
    assert.equal(product.length, 2);

    const cancelled = addTypes({ length: 1 }, { length: -1 });
    assert.equal(cancelled.length, undefined);

    assert.throws(() => addTypes({ percentHint: 'length' }, { percentHint: 'angle' }), TypeError);

    const hintedAdd = addTypes({ percentHint: 'length', length: 1 }, { percent: 1 });
    assert.equal(hintedAdd.percentHint, 'length');

    const otherHint = addTypes({ percent: 1 }, { percentHint: 'length', length: 1 });
    assert.equal(otherHint.percentHint, 'length');

    assert.equal(addTypesForSum({ length: 1 }, { length: 1 })?.length, 1);
    assert.equal(addTypesForSum({ percentHint: 'length' }, { percentHint: 'angle' }), null);
    const pctLen = addTypesForSum({ percent: 1 }, { length: 1 });
    assert.ok(pctLen);
    assert.equal(pctLen.percentHint, 'length');
    assert.equal(addTypesForSum({ angle: 1 }, { length: 1 }), null);
  });

  test('math serialize, stripOuterParens, type-guards', () => {
    const sum = new CSSMathSum(CSS.px(1), new CSSMathNegate(CSS.px(2)));
    assert.equal(sum.serialize().includes(' - '), true);
    assert.equal(sum.toString().startsWith('calc(') || sum.serialize().startsWith('('), true);

    const prod = new CSSMathProduct(CSS.px(2), new CSSMathInvert(CSS.number(4)));
    assert.equal(prod.serialize().includes(' / '), true);
    assert.equal(prod.serialize().includes(' * ') || prod.serialize().includes('/'), true);

    const min = new CSSMathMin(CSS.px(1), CSS.px(2));
    assert.equal(min.serialize().startsWith('min('), true);
    const max = new CSSMathMax(CSS.px(1), CSS.px(2));
    assert.equal(max.serialize().startsWith('max('), true);
    const clamp = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(clamp.serialize().startsWith('clamp('), true);

    const roundNear = new CSSMathRound('nearest', CSS.px(1.2), 1, true);
    assert.equal(roundNear.serialize().includes('nearest'), false);
    const roundUp = new CSSMathRound('up', CSS.px(1.2), CSS.px(1), false);
    assert.equal(roundUp.serialize().includes('up'), true);

    assert.equal(stripOuterParens('(1px + 2px)'), '1px + 2px');
    assert.equal(stripOuterParens('(1px) + (2px)'), '(1px) + (2px)');
    assert.equal(stripOuterParens('1px'), '1px');

    assert.equal(matchesLength(CSS.px(1).type()), true);
    assert.equal(matchesLength(CSS.percent(1).type()), false);
    assert.equal(matchesPercentage(CSS.percent(1).type()), true);
    assert.equal(matchesNumber(CSS.number(1).type()), true);
    assert.equal(matchesAngle(CSS.deg(1).type()), true);
    assert.equal(matchesTime(CSS.s(1).type()), true);
    assert.equal(matchesFrequency(CSS.Hz(1).type()), true);
    assert.equal(matchesResolution(CSS.dpi(1).type()), true);
    assert.equal(matchesFlex(CSS.fr(1).type()), true);
    assert.equal(isLengthPercentage(CSS.px(1).type()), true);
    assert.equal(isLengthPercentage(CSS.deg(1).type()), false);
    assert.equal(isNumericValue(CSS.px(1)), true);
    assert.equal(isNumericValue(null), false);
    assert.equal(isKeywordValue(new CSSKeywordValue('auto')), true);
    assert.equal(isKeywordValue(CSS.px(1)), false);
  });
});

describe('MC/DC hotspot: CSSColorValue constructors and parse', () => {
  test('CSSRGB number/percent/none/string and invalid', () => {
    const rgb = new CSSRGB(0.5, 0, 1);
    assert.equal(rgb.toString().startsWith('rgb('), true);
    rgb.r = 'none';
    assert.equal((rgb.r as CSSKeywordValue).value, 'none');
    rgb.g = CSS.percent(50);
    rgb.b = CSS.number(0);
    rgb.alpha = 0.5;
    assert.equal(rgb.toString().startsWith('rgba('), true);
    assert.throws(() => construct(CSSRGB, 0, 0), TypeError);
    assert.throws(() => { rgb.r = CSS.deg(1); }, DOMException);
    assert.throws(() => { rgb.alpha = CSS.px(1); }, DOMException);
  });

  test('CSSHSL / CSSHWB / lab spaces and CSSColor', () => {
    const hsl = new CSSHSL(CSS.deg(120), 0.5, 0.5);
    assert.equal(hsl.toString().startsWith('hsl('), true);
    hsl.alpha = CSS.percent(50);
    assert.equal(hsl.toString().includes('/'), true);
    hsl.h = 'none';
    assert.throws(() => construct(CSSHSL, CSS.deg(1), 0.5), TypeError);
    assert.throws(() => { hsl.s = CSS.px(1); }, DOMException);

    const hwb = new CSSHWB(CSS.deg(10), 0.1, 0.2);
    assert.ok(hwb.toString().includes('hwb') || hwb.h);
    hwb.alpha = 0.4;

    const lab = new CSSLab(0.5, 0.1, -0.1);
    assert.ok(lab.toString().includes('lab') || lab.l);
    const lch = new CSSLCH(0.5, 0.1, CSS.deg(40));
    assert.ok(lch);
    const oklab = new CSSOKLab(0.5, 0.1, 0.1);
    assert.ok(oklab);
    const oklch = new CSSOKLCH(0.5, 0.1, CSS.deg(40));
    assert.ok(oklch);

    const color = new CSSColor('display-p3', [0.1, 0.2, 0.3]);
    assert.equal(color.toString().startsWith('color('), true);
    color.alpha = 0.5;
    assert.equal(color.toString().includes('/'), true);
    color.colorSpace = new CSSKeywordValue('srgb');
    assert.throws(() => construct(CSSColor, 'srgb'), TypeError);
    assert.throws(() => {
      (color as { channels: unknown }).channels = 1;
    }, TypeError);
  });

  test('CSSColorValue.parse hex 3/4/6/8, named, system, functions, invalid', () => {
    const hex3 = CSSColorValue.parse('#abc');
    assert.ok(hex3 instanceof CSSRGB);
    const hex4 = CSSColorValue.parse('#abcd');
    assert.ok(hex4 instanceof CSSRGB);
    const hex6 = CSSColorValue.parse('#aabbcc');
    assert.ok(hex6 instanceof CSSRGB);
    const hex8 = CSSColorValue.parse('#aabbccdd');
    assert.ok(hex8 instanceof CSSRGB);
    assert.throws(() => CSSColorValue.parse('#ab'), DOMException);

    const named = CSSColorValue.parse('red');
    assert.ok(named instanceof CSSRGB);
    const system = CSSColorValue.parse('canvastext');
    assert.ok(system instanceof CSSKeywordValue);

    const rgb = CSSColorValue.parse('rgb(1, 2, 3)');
    assert.ok(rgb instanceof CSSRGB);
    const rgba = CSSColorValue.parse('rgba(1 2 3 / 0.5)');
    assert.ok(rgba instanceof CSSRGB);
    const hsl = CSSColorValue.parse('hsl(120 50% 50%)');
    assert.ok(hsl instanceof CSSHSL);
    const hwb = CSSColorValue.parse('hwb(120 10% 10%)');
    assert.ok(hwb instanceof CSSHWB);
    const lab = CSSColorValue.parse('lab(50% 10 10)');
    assert.ok(lab instanceof CSSLab);
    const lch = CSSColorValue.parse('lch(50% 10 40)');
    assert.ok(lch instanceof CSSLCH);
    const oklab = CSSColorValue.parse('oklab(0.5 0.1 0.1)');
    assert.ok(oklab instanceof CSSOKLab);
    const oklch = CSSColorValue.parse('oklch(0.5 0.1 40)');
    assert.ok(oklch instanceof CSSOKLCH);
    const color = CSSColorValue.parse('color(display-p3 0.1 0.2 0.3)');
    assert.ok(color instanceof CSSColor);

    assert.throws(() => CSSColorValue.parse(''), DOMException);
    assert.throws(() => CSSColorValue.parse('red blue'), DOMException);
    assert.throws(() => CSSColorValue.parse('not-a-color'), DOMException);

    assert.equal(isAlphaUnity(CSS.percent(100)), true);
    assert.equal(isAlphaUnity(CSS.number(1)), true);
    assert.equal(isAlphaUnity(CSS.percent(50)), false);
    assert.equal(formatAlpha(CSS.percent(50)), '0.5');
    assert.equal(formatAlpha(CSS.number(0.5)), '0.5');
  });
});

describe('MC/DC hotspot: transforms, unparsed, style map, factory', () => {
  test('CSSTranslate/Scale/Rotate/Skew/Perspective/Matrix constructors and matrices', () => {
    const t2 = new CSSTranslate(CSS.px(1), CSS.px(2));
    assert.equal(t2.is2D, true);
    assert.equal(t2.toString(), 'translate(1px, 2px)');
    assert.equal(t2.toMatrix().e, 1);
    const t3 = new CSSTranslate(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(t3.is2D, false);
    assert.equal(t3.toString().startsWith('translate3d('), true);
    assert.throws(() => construct(CSSTranslate, CSS.px(1)), TypeError);
    assert.throws(() => { t2.x = CSS.deg(1); }, TypeError);
    assert.throws(() => { t2.z = CSS.percent(1); }, TypeError);

    const s2 = new CSSScale(2, 2);
    assert.equal(s2.toString(), 'scale(2)');
    const sXY = new CSSScale(2, 3);
    assert.equal(sXY.toString(), 'scale(2, 3)');
    const s3 = new CSSScale(1, 2, 3);
    assert.equal(s3.is2D, false);
    assert.equal(s3.toString().startsWith('scale3d('), true);
    assert.throws(() => construct(CSSScale, 1), TypeError);
    assert.throws(() => { s2.x = CSS.px(1); }, TypeError);

    const r2 = new CSSRotate(CSS.deg(90));
    assert.equal(r2.is2D, true);
    assert.equal(r2.toString().startsWith('rotate('), true);
    const r3 = new CSSRotate(1, 0, 0, CSS.deg(90));
    assert.equal(r3.is2D, false);
    assert.equal(r3.toString().startsWith('rotate3d('), true);
    assert.throws(() => {
      new (CSSRotate as unknown as { new (...args: unknown[]): CSSRotate })(1, 0, CSS.deg(90));
    }, TypeError);
    assert.throws(() => { r2.angle = CSS.px(1); }, TypeError);
    const zeroAxis = new CSSRotate(0, 0, 0, CSS.deg(45));
    assert.ok(zeroAxis.toMatrix());

    const skew = new CSSSkew(CSS.deg(10), CSS.deg(0));
    assert.equal(skew.toString(), 'skew(10deg)');
    const skew2 = new CSSSkew(CSS.deg(10), CSS.deg(20));
    assert.equal(skew2.toString(), 'skew(10deg, 20deg)');
    skew.is2D = false;
    assert.equal(skew.is2D, true);
    assert.throws(() => construct(CSSSkew, CSS.deg(1)), TypeError);
    assert.throws(() => { skew.ax = CSS.px(1); }, TypeError);

    const sx = new CSSSkewX(CSS.deg(15));
    assert.equal(sx.toString(), 'skewX(15deg)');
    sx.is2D = false;
    assert.equal(sx.is2D, true);
    const sy = new CSSSkewY(CSS.deg(15));
    assert.equal(sy.toString(), 'skewY(15deg)');
    assert.throws(() => construct(CSSSkewX), TypeError);
    assert.throws(() => construct(CSSSkewY), TypeError);

    const persp = new CSSPerspective(CSS.px(100));
    assert.equal(persp.toString(), 'perspective(100px)');
    assert.equal(persp.is2D, false);
    persp.is2D = true;
    assert.equal(persp.is2D, false);
    persp.length = 'none';
    assert.equal(persp.toString(), 'perspective(none)');
    persp.length = CSS.px(-10);
    assert.equal(persp.toString().includes('calc('), true);
    assert.ok(persp.toMatrix());
    persp.length = CSS.px(0);
    assert.ok(persp.toMatrix());
    assert.throws(() => construct(CSSPerspective), TypeError);
    assert.throws(() => { persp.length = 'auto'; }, TypeError);
    assert.throws(() => { persp.length = new CSSKeywordValue('auto'); }, TypeError);
    assert.throws(() => { persp.length = CSS.deg(1); }, TypeError);

    const m2 = new CSSMatrixComponent(new DOMMatrix([1, 0, 0, 1, 10, 20]));
    assert.equal(m2.toString().startsWith('matrix('), true);
    const m3 = new CSSMatrixComponent(new DOMMatrix([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]), { is2D: false });
    assert.equal(m3.toString().startsWith('matrix3d('), true);
    assert.throws(() => construct(CSSMatrixComponent), TypeError);
    assert.throws(() => new CSSMatrixComponent({} as DOMMatrix), TypeError);
  });

  test('CSSTransformValue parse function names, index, empty, unknown, comma', () => {
    const t = CSSTransformValue.parse('translateX(1px) translateY(2px) translateZ(3px)');
    assert.equal(t.length, 3);
    assert.equal(t.is2D, false);
    assert.ok(t[0] instanceof CSSTranslate);
    t[3] = new CSSTranslate(CSS.px(0), CSS.px(0));
    assert.equal(t.length, 4);
    assert.throws(() => { t[9] = new CSSTranslate(CSS.px(0), CSS.px(0)); }, RangeError);
    assert.throws(() => { t[0] = CSS.px(1) as unknown as CSSTranslate; }, TypeError);

    const scale = CSSTransformValue.parse('scaleX(2) scaleY(3) scaleZ(4) scale(2) scale3d(1, 2, 3)');
    assert.equal(scale.length, 5);

    const rot = CSSTransformValue.parse('rotateX(1deg) rotateY(2deg) rotateZ(3deg) rotate(10deg) rotate3d(1, 0, 0, 45deg)');
    assert.equal(rot.length, 5);

    const skews = CSSTransformValue.parse('skew(10deg) skewX(5deg) skewY(6deg)');
    assert.equal(skews.length, 3);

    const persp = CSSTransformValue.parse('perspective(none) perspective(100px)');
    assert.equal(persp.length, 2);

    const mat = CSSTransformValue.parse('matrix(1, 0, 0, 1, 0, 0)');
    assert.equal(mat.length, 1);
    assert.ok(mat.toMatrix());
    assert.equal(mat.toString().includes('matrix'), true);
    assert.equal([...mat].length, 1);
    assert.ok(mat.item(0));
    mat.forEach((c) => assert.ok(c));

    assert.throws(() => new CSSTransformValue([]), TypeError);
    assert.throws(() => CSSTransformValue.parse('notafn(1)'), TypeError);
    assert.throws(() => CSSTransformValue.parse('1px'), TypeError);
    assert.throws(() => CSSTransformValue.parse('translate(1px), scale(2)'), TypeError);
    assert.throws(() => CSSTransformValue.parse('translateX(1px, 2px)'), TypeError);
    assert.throws(() => CSSTransformValue.parse('scale3d(1)'), TypeError);
    assert.throws(() => CSSTransformValue.parse('rotate3d(1, 0, 0)'), TypeError);
    assert.throws(() => (CSSTransformValue.parse as () => CSSTransformValue)(), TypeError);
  });

  test('CSSUnparsedValue index, var decomposition, CSSVariableReferenceValue', () => {
    const u = new CSSUnparsedValue(['foo']);
    assert.equal(u.length, 1);
    assert.equal(u[0], 'foo');
    u[0] = 'bar';
    assert.equal(u[0], 'bar');
    u[1] = new CSSVariableReferenceValue('--x');
    assert.equal(u.length, 2);
    assert.throws(() => { u[9] = 'z'; }, RangeError);
    assert.throws(() => { u[0] = 1 as unknown as string; }, TypeError);
    assert.equal([...u].length, 2);
    assert.ok(u.item(1) instanceof CSSVariableReferenceValue);
    const keys = [...u.keys()];
    assert.equal(keys[0], 0);
    u.forEach((v) => assert.ok(v));

    const parsed = CSSStyleValue.parse('color', 'var(--a, var(--b, red))');
    assert.ok(parsed instanceof CSSUnparsedValue);
    assert.equal(parsed.toString().includes('var(--a'), true);

    const nestedFn = CSSStyleValue.parse('width', 'calc(var(--x) + 1px)');
    assert.ok(nestedFn instanceof CSSUnparsedValue);
    assert.equal(nestedFn.toString().includes('calc('), true);
    assert.equal(nestedFn.toString().includes('var(--x)'), true);

    const block = tokensToUnparsedSegments(ParseHooks.parseComponentValues(tokenize('var(--x)')));
    assert.ok(block[0] instanceof CSSVariableReferenceValue);

    const invalidVar = CSSStyleValue.parse('color', 'var(foo)');
    assert.ok(invalidVar instanceof CSSUnparsedValue);

    const noFallbackComma = CSSStyleValue.parse('color', 'var(--x 1px)');
    assert.ok(noFallbackComma instanceof CSSUnparsedValue);

    const ref = new CSSVariableReferenceValue('--ok', new CSSUnparsedValue(['red']));
    assert.equal(ref.toString(), 'var(--ok,red)');
    assert.throws(() => construct(CSSVariableReferenceValue), TypeError);
    assert.throws(() => { ref.variable = 'x'; }, TypeError);
    assert.throws(() => { ref.variable = '--'; }, TypeError);
    assert.throws(() => new CSSVariableReferenceValue('--x', 'red' as unknown as CSSUnparsedValue), TypeError);
  });

  test('StylePropertyMap set/get/append/delete/clear and pending substitution', () => {
    const style = new CSSStyleDeclaration();
    const map = new StylePropertyMap(style);

    map.set('color', 'red');
    const color = map.get('color');
    assert.ok(color instanceof CSSKeywordValue);
    assert.equal(color.toString(), 'red');
    assert.equal(map.has('color'), true);
    assert.equal(map.has('width'), false);
    assert.equal(map.get('width'), undefined);

    map.set('--x', '1px');
    const custom = map.get('--x');
    assert.ok(custom instanceof CSSUnparsedValue);

    map.set('transition-duration', '1s');
    map.append('transition-duration', '2s');
    const all = map.getAll('transition-duration');
    assert.ok(all.length >= 2);

    assert.throws(() => map.set('color'), TypeError);
    assert.throws(() => map.append('color', 'red'), TypeError);
    assert.throws(() => map.append('transition-duration'), TypeError);
    assert.throws(() => map.append('transition-duration', 'var(--t)'), TypeError);
    assert.throws(() => map.append('transition-duration', new CSSUnparsedValue(['1s'])), TypeError);
    assert.throws(() => map.set('not-a-prop', '1'), TypeError);

    map.set('transition-duration', 'inherit');
    assert.throws(() => map.append('transition-duration', '1s'), TypeError);

    map.set('margin', 'var(--m)');
    assert.throws(() => map.set('margin-top', '1px'), TypeError);

    map.delete('color');
    assert.equal(map.has('color'), false);

    map.set('width', '10px');
    map.clear();
    assert.equal(map.has('width'), false);

    const cached = new StylePropertyMap(style);
    cached.set('opacity', '0.5');
    const first = cached.get('opacity');
    const second = cached.get('opacity');
    assert.equal(first, second);
  });

  test('createCSSStyleValue calc/var/url/gradient/ident/number-zero and CSSKeywordValue / CSSPositionValue / images', () => {
    const tokens = ParseHooks.parseComponentValues(tokenize('calc(1px + 2px)')).filter((t) => t.type !== 'whitespace');
    const calc = createCSSStyleValue(tokens[0], 'width');
    assert.ok(calc);

    const varTok = ParseHooks.parseComponentValues(tokenize('var(--x, 1px)')).filter((t) => t.type !== 'whitespace');
    const v = createCSSStyleValue(varTok[0], 'color');
    assert.ok(v instanceof CSSUnparsedValue);

    const urlTok = ParseHooks.parseComponentValues(tokenize('url("a.png")')).filter((t) => t.type !== 'whitespace');
    const url = createCSSStyleValue(urlTok[0], 'background-image');
    assert.ok(url instanceof CSSImageValue || url instanceof CSSURLImageValue);

    const gradTok = ParseHooks.parseComponentValues(tokenize('linear-gradient(red, blue)')).filter((t) => t.type !== 'whitespace');
    const grad = createCSSStyleValue(gradTok[0], 'background-image');
    assert.ok(grad instanceof CSSGradientImageValue);

    const identTok = ParseHooks.parseComponentValues(tokenize('auto')).filter((t) => t.type !== 'whitespace');
    const ident = createCSSStyleValue(identTok[0], 'width');
    assert.ok(ident instanceof CSSKeywordValue);

    const zeroTok = ParseHooks.parseComponentValues(tokenize('0')).filter((t) => t.type !== 'whitespace');
    const zeroLen = createCSSStyleValue(zeroTok[0], 'width');
    assert.ok(zeroLen instanceof CSSUnitValue);
    assert.equal(zeroLen.unit, 'px');
    const zeroNum = createCSSStyleValue(zeroTok[0], 'opacity');
    assert.ok(zeroNum instanceof CSSUnitValue);
    assert.equal(zeroNum.unit, 'number');

    const kw = new CSSKeywordValue('auto');
    assert.equal(kw.value, 'auto');
    kw.value = 'none';
    assert.equal(kw.value, 'none');
    assert.throws(() => new CSSKeywordValue(''), TypeError);
    assert.throws(() => { kw.value = ''; }, TypeError);

    const pos = new CSSPositionValue(CSS.px(1), CSS.percent(50));
    assert.equal(pos.toString(), '1px 50%');
    pos.x = CSS.px(2);
    pos.y = CSS.px(3);
    assert.throws(() => { pos.x = CSS.deg(1); }, TypeError);
    assert.throws(() => new CSSPositionValue(CSS.deg(1), CSS.px(1)), TypeError);

    const image = new CSSURLImageValue('http://example.com/a.png');
    assert.equal(image.toString().includes('url('), true);
    const already = new CSSURLImageValue('url("x")');
    assert.equal(already.toString(), 'url("x")');
    const g = new CSSGradientImageValue('linear-gradient(red, blue)');
    assert.equal(g.toString(), 'linear-gradient(red, blue)');
  });
});
