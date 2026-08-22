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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5
// Leftover unique-cause for:
//   src/typed-om/numeric/math/CSSMathOperations.ts type() (L124 values.length === 0
//   plus remaining type-map AND/ORs: percent hint, product exponents, incompatible)
//   src/typed-om/color/color-spaces.ts parseColorArgs L583 / L591
//     val === null || (constructor.name !== 'CSSUnitValue' &&
//     constructor.name !== 'CSSKeywordValue' && !instanceof CSSUnitValue &&
//     !instanceof CSSKeywordValue)
// Drive CSSNumericValue.parse / math .type() / CSSStyleValue.parse of color
// properties / CSSColorValue.parse / new CSSRGB / new CSSColor.
// CSS.color() is not exported. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSKeywordValue,
  CSSNumericArray,
  CSSMathSum,
  CSSMathProduct,
  CSSMathMin,
  CSSMathMax,
  CSSMathInvert,
  CSSMathFunction,
  CSSMathRound,
  CSSStyleValue,
  CSSUnparsedValue,
  CSSColorValue,
  CSSRGB,
  CSSColor,
} from '../src/typed-om.ts';
import type { CSSNumericType } from '../src/typed-om.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

type MathList = CSSMathSum | CSSMathMin | CSSMathMax | CSSMathProduct | CSSMathFunction;

function parseNum(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function unit(v: unknown, value: number, unitName: string): CSSUnitValue {
  assert.ok(v instanceof CSSUnitValue, `expected CSSUnitValue, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value, value);
  assert.equal(v.unit, unitName);
  return v;
}

function none(v: unknown): CSSKeywordValue {
  assert.ok(v instanceof CSSKeywordValue, `expected CSSKeywordValue, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value.toLowerCase(), 'none');
  return v;
}

// Sum/Min/Max/Product constructors throw on 0 args. type() still has
// `values.length === 0`. Public CSSNumericArray([]) is the empty list.
function installEmptyValues(node: MathList): void {
  const empty = new CSSNumericArray([]);
  assert.equal(empty.length, 0);
  assert.equal(Reflect.set(node, 'values', empty), true);
  assert.equal(node.values.length, 0);
}

class PercentHintOnlyNumeric extends CSSNumericValue {
  serialize(): string {
    return '0';
  }
  type(): CSSNumericType {
    return { percentHint: 'length' };
  }
}

class LengthOnlyNumeric extends CSSNumericValue {
  serialize(): string {
    return '1px';
  }
  type(): CSSNumericType {
    return { length: 1 };
  }
}

function assertParseArgsNull(css: string): void {
  assert.throws(
    () => CSSColorValue.parse(css),
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      err.message.startsWith('Invalid color value:'),
    css,
  );
}

function assertRectifyReject(css: string): void {
  assert.throws(
    () => CSSColorValue.parse(css),
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      !err.message.startsWith('Invalid color value:'),
    css,
  );
}

function assertInvalidStyleColor(property: string, css: string): void {
  assert.throws(() => CSSStyleValue.parse(property, css), TypeError, `${property}: ${css}`);
}

describe('MC/DC unique-cause: CSSMath*.type values.length === 0 (css-typed-om-1 § 4.4 #cssmathsum / #cssmathmin / #cssmathmax / #cssmathproduct)', { concurrency: false }, () => {
  test('empty sum/min/max/product/function type() {} vs length > 0', () => {
    // Unique-cause T: values.length === 0. Constructors reject 0 args
    // (asserted below); CSSNumericArray([]) is the constructible empty list.
    assert.throws(() => new CSSMathSum(), DOMException);
    assert.throws(() => new CSSMathMin(), DOMException);
    assert.throws(() => new CSSMathMax(), DOMException);
    assert.throws(() => new CSSMathProduct(), DOMException);

    const sum = new CSSMathSum(CSS.px(1));
    installEmptyValues(sum);
    assert.deepEqual(sum.type(), {});

    const min = new CSSMathMin(CSS.px(1));
    installEmptyValues(min);
    assert.deepEqual(min.type(), {});

    const max = new CSSMathMax(CSS.px(1));
    installEmptyValues(max);
    assert.deepEqual(max.type(), {});

    const product = new CSSMathProduct(CSS.px(1));
    installEmptyValues(product);
    assert.deepEqual(product.type(), {});

    // Function is natively constructible with 0 args; type() returns {} before arity.
    assert.deepEqual(new CSSMathFunction('sin').type(), {});
    assert.deepEqual(new CSSMathFunction('hypot').type(), {});
    assert.deepEqual(new CSSMathFunction('abs').type(), {});

    // Unique-cause F: length === 1 skips reduce; length >= 2 runs addTypesForSum.
    assert.deepEqual(new CSSMathSum(CSS.px(4)).type(), { length: 1 });
    assert.deepEqual(new CSSMathMin(CSS.em(2)).type(), { length: 1 });
    assert.deepEqual(new CSSMathMax(CSS.s(1)).type(), { time: 1 });
    assert.deepEqual(new CSSMathProduct(CSS.px(3)).type(), { length: 1 });
    assert.deepEqual(new CSSMathSum(CSS.px(1), CSS.em(2)).type(), { length: 1 });
    assert.deepEqual(parseNum('min(1px, 2em)').type(), { length: 1 });
    assert.deepEqual(parseNum('max(1px, 2%)').type(), { length: 1, percentHint: 'length' });
  });
});

describe('MC/DC unique-cause: CSSMath*.type type-map AND/ORs (css-typed-om-1 § 4.4 #cssmathinvert / #cssmathproduct / #cssmathround / #numeric-typing)', { concurrency: false }, () => {
  test('invert type: key !== percentHint T/F and t.percentHint T/F', () => {
    // Unique-cause: t.percentHint F, key !== 'percentHint' T (length only).
    assert.deepEqual(new CSSMathInvert(CSS.px(2)).type(), { length: -1 });
    assert.deepEqual(new CSSMathInvert(parseNum('1px')).type(), { length: -1 });
    // Unique-cause: no keys, t.percentHint F (loop never sees percentHint).
    assert.deepEqual(new CSSMathInvert(CSS.number(2)).type(), {});
    assert.deepEqual(new CSSMathInvert(1).type(), {});

    // Unique-cause: t.percentHint T and key !== 'percentHint' T then F in one type map.
    const hinted = parseNum('calc(1px + 2%)');
    assert.equal(hinted.type().percentHint, 'length');
    const invHinted = new CSSMathInvert(hinted);
    assert.deepEqual(invHinted.type(), { length: -1, percentHint: 'length' });

    // Unique-cause: key !== 'percentHint' F only (hint-only map, no other keys).
    const hintOnly = new CSSMathInvert(new PercentHintOnlyNumeric());
    assert.deepEqual(hintOnly.type(), { percentHint: 'length' });
    // Unique-cause: key !== 'percentHint' T only (length, no hint).
    assert.deepEqual(new CSSMathInvert(new LengthOnlyNumeric()).type(), { length: -1 });
  });

  test('product type: exponents add/cancel, percent hint apply/mismatch', () => {
    // Unique-cause: addTypes exponents {length:1}+{length:1} → 2.
    const squared = parseNum('calc(1px * 1px)');
    assert.ok(squared instanceof CSSMathProduct);
    assert.deepEqual(squared.type(), { length: 2 });
    assert.deepEqual(new CSSMathProduct(CSS.px(2), CSS.em(3)).type(), { length: 2 });

    // Unique-cause: exponents cancel to 0 and the key is deleted.
    const cancelled = parseNum('calc(1px / 1px)');
    assert.deepEqual(cancelled.type(), {});
    assert.deepEqual(new CSSMathProduct(CSS.px(2), new CSSMathInvert(CSS.px(4))).type(), {});

    // Unique-cause: cross-base product keeps both dimensions.
    assert.deepEqual(parseNum('calc(1px * 1s)').type(), { length: 1, time: 1 });

    // Unique-cause: one side percentHint T, other F → applyPercentHint.
    const hinted = CSS.px(1).add(CSS.percent(2));
    const timesNum = hinted.mul(2);
    assert.equal(timesNum.type().percentHint, 'length');
    assert.equal(timesNum.type().length, 1);
    const timesLen = new CSSMathProduct(hinted, CSS.em(2));
    assert.deepEqual(timesLen.type(), { length: 2, percentHint: 'length' });

    // Unique-cause: both percentHint T and !== T — constructor rejects; type()
    // re-checks after a child unit mutation.
    const left = CSS.px(1).add(CSS.percent(1));
    const right = CSS.px(2).add(CSS.percent(2));
    assert.ok(left instanceof CSSMathSum);
    assert.ok(right instanceof CSSMathSum);
    const prod = new CSSMathProduct(left, right);
    assert.equal(prod.type().percentHint, 'length');
    (right.values.item(0) as CSSUnitValue).unit = 'deg';
    assert.throws(() => prod.type(), TypeError);
  });

  test('sum/min/max incompatible types T vs percent-hint combine; round type !combined', () => {
    // Unique-cause: addTypesForSum !combined F (compatible leftover / percent hint).
    assert.deepEqual(parseNum('calc(1px + 2%)').type(), { length: 1, percentHint: 'length' });
    assert.equal(new CSSMathMin(CSS.px(1), CSS.percent(2)).type().percentHint, 'length');
    assert.equal(new CSSMathMax(CSS.deg(1), CSS.percent(2)).type().percentHint, 'angle');

    // Unique-cause: !combined T after mutating a child unit (constructor validated).
    const a = CSS.px(1);
    const b = CSS.px(2);
    const sum = new CSSMathSum(a, b);
    a.unit = 's';
    assert.throws(() => sum.type(), TypeError);

    const c = CSS.px(1);
    const d = CSS.px(2);
    const min = new CSSMathMin(c, d);
    c.unit = 'Hz' as CSSUnit;
    assert.throws(() => min.type(), TypeError);

    const e = CSS.px(1);
    const f = CSS.px(2);
    const max = new CSSMathMax(e, f);
    e.unit = 'deg';
    assert.throws(() => max.type(), TypeError);

    // Unique-cause: CSSMathRound.type !combined T vs F.
    const ok = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    assert.deepEqual(ok.type(), { length: 1 });
    const bad = new CSSMathRound('up', CSS.px(1.2), CSS.px(1), false);
    (bad.value as CSSUnitValue).unit = 's';
    assert.throws(() => bad.type(), TypeError);
  });
});

describe('MC/DC unique-cause: parseColorArgs L583/L591 constructor.name vs null (css-typed-om-2 § 2 #colorvalue-objects, css-color-4 #rgb-functions)', { concurrency: false }, () => {
  test('constructor.name !== CSSUnitValue F: actual CSSUnitValue keep (comma and space)', () => {
    // Unique-cause: val === null F and constructor.name !== 'CSSUnitValue' F.
    // Number / percent / dimension all reify as CSSUnitValue (B=F short-circuit).
    const rgb = CSSColorValue.parse('rgb(1, 2, 3)') as CSSRGB;
    unit(rgb.r, 1, 'number');
    unit(rgb.g, 2, 'number');
    unit(rgb.b, 3, 'number');

    const rgbSpace = CSSColorValue.parse('rgb(10 20 30)') as CSSRGB;
    unit(rgbSpace.r, 10, 'number');

    const pct = CSSColorValue.parse('rgb(100%, 0%, 50%)') as CSSRGB;
    unit(pct.r, 100, 'percent');

    const hsl = CSSColorValue.parse('hsl(90deg, 50%, 40%)');
    assert.ok(hsl);
    const color = CSSColorValue.parse('color(srgb, 0.1, 0.2, 0.3)') as CSSColor;
    unit(color.channels[0], 0.1, 'number');

    // parseColorArgs keeps a CSSUnitValue with a non-rgb unit; rectify then throws
    // (not "Invalid color value", which is parseColorArgs returning null).
    assertRectifyReject('rgb(1px, 2, 3)');
    assertRectifyReject('rgb(1px 2 3)');
    assertRectifyReject('hsl(1px, 50%, 50%)');

    const viaStyle = CSSStyleValue.parse('color', 'rgb(4, 5, 6)');
    assert.ok(viaStyle instanceof CSSRGB);
    unit((viaStyle as CSSRGB).r, 4, 'number');
    const viaBg = CSSStyleValue.parse('background-color', 'rgb(7 8 9)');
    assert.ok(viaBg instanceof CSSRGB);
  });

  test('constructor.name !== CSSKeywordValue F: actual CSSKeywordValue keep (comma and space)', () => {
    // Unique-cause: name !== 'CSSUnitValue' T, name !== 'CSSKeywordValue' F.
    const rgb = CSSColorValue.parse('rgb(none, none, none)') as CSSRGB;
    none(rgb.r);
    none(rgb.g);
    none(rgb.b);

    const rgbSpace = CSSColorValue.parse('rgb(none none none)') as CSSRGB;
    none(rgbSpace.r);

    const hsla = CSSColorValue.parse('hsla(none, none, none, none)');
    assert.ok(hsla);

    const color = CSSColorValue.parse('color(srgb, none, none)') as CSSColor;
    assert.equal(color.colorSpace.value, 'srgb');
    none(color.channels[0]);
    none(color.channels[1]);

    // parseColorArgs keeps leftover idents (CSSKeywordValue); rectify rejects
    // 'foo' (not none). Distinct from parseColorArgs null.
    assertRectifyReject('rgb(foo, 2, 3)');
    assertRectifyReject('rgb(foo 2 3)');
    assertRectifyReject('hsl(bar, 50%, 50%)');

    const viaStyle = CSSStyleValue.parse('border-top-color', 'rgb(none, none, none)');
    assert.ok(viaStyle instanceof CSSRGB);
    none((viaStyle as CSSRGB).r);
  });

  test('neither without null: CSSMathSum/min/max/clamp/var/url/gradient (comma and space)', () => {
    // Unique-cause: val === null F, name is neither CSSUnitValue nor CSSKeywordValue,
    // instanceof both F → AND T → parseColorArgs returns null ("Invalid color value").
    // Comma path is L583; space path is L591.
    const neitherComma = [
      'rgb(1, calc(1), 3)',
      'rgb(calc(1), 2, 3)',
      'rgb(1, calc(1px + 2em), 3)',
      'rgb(1, min(1, 2), 3)',
      'rgb(1, max(1, 2), 3)',
      'rgb(1, clamp(0, 1, 2), 3)',
      'rgb(1, var(--x), 3)',
      'rgb(1, url(x), 3)',
      'rgb(1, linear-gradient(red, blue), 3)',
      'hsl(calc(1), 50%, 50%)',
      'lab(50%, min(1, 2), 10)',
      'color(srgb, calc(0.1), 0.2)',
    ];
    for (const css of neitherComma) assertParseArgsNull(css);

    const neitherSpace = [
      'rgb(calc(1) 2 3)',
      'rgb(1 min(1, 2) 3)',
      'rgb(1 max(1, 2) 3)',
      'rgb(1 clamp(0, 1, 2) 3)',
      'rgb(var(--x) 2 3)',
      'rgb(url(x) 2 3)',
      'rgb(linear-gradient(red, blue) 2 3)',
      'hsl(calc(1) 50% 50%)',
      'oklab(0.5 min(1, 2) 0.1)',
      'color(srgb calc(0.1) 0.2 0.3)',
    ];
    for (const css of neitherSpace) assertParseArgsNull(css);

    // Unique-cause pair of val === null T (already observed) vs the keep arms above.
    // String / hash / unknown function → createCSSStyleValue null, not a math node.
    assertParseArgsNull('rgb(1, "a", 3)');
    assertParseArgsNull('rgb("a" 2 3)');
    assertParseArgsNull('rgb(1, #fff, 3)');
    assertParseArgsNull('rgb(#fff 0 0)');
    assertParseArgsNull('rgb(1, attr(x), 3)');

    assertInvalidStyleColor('color', 'rgb(1, calc(1), 3)');
    assertInvalidStyleColor('background-color', 'rgb(1, min(1, 2), 3)');
    assertInvalidStyleColor('border-top-color', 'rgb(1, url(x), 3)');
    // var() on a color property reifies as CSSUnparsedValue before parseColorArgs.
    const pending = CSSStyleValue.parse('border-top-color', 'rgb(var(--x) 2 3)');
    assert.ok(pending instanceof CSSUnparsedValue);
    assert.equal(pending.toString().includes('var(--x)'), true);
  });

  test('CSSColorValue.parse / CSSStyleValue.parse / constructors; CSS.color() not exported', () => {
    const rgb = new CSSRGB(CSS.number(1), CSS.number(2), CSS.number(3));
    assert.ok(rgb instanceof CSSRGB);
    unit(rgb.r, 1, 'number');

    const color = new CSSColor(new CSSKeywordValue('srgb'), [0.1, 0.2, 0.3]);
    assert.equal(color.toString(), 'color(srgb 0.1 0.2 0.3)');

    const parsedColor = CSSColorValue.parse('color(display-p3 0.2 0.3 0.4 / 0.5)') as CSSColor;
    assert.equal(parsedColor.colorSpace.value, 'display-p3');
    unit(parsedColor.alpha, 0.5, 'number');

    const styleColor = CSSStyleValue.parse('color', 'color(srgb none none none / none)') as CSSColor;
    none(styleColor.channels[0]);
    none(styleColor.alpha);

    assert.equal(typeof (CSS as { color?: unknown }).color, 'undefined');
  });
});
