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
// Leftover unique-cause cases for src/math-parser.ts simplify() not covered by
// tests/mcdc-hotspot-math-walk.test.ts. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { simplify } from '../src/math-parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathRound,
  CSSMathFunction,
  CSSKeywordValue,
  CSSStyleValue,
} from '../src/typed-om.ts';

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function parseSimplify(css: string): CSSNumericValue {
  return simplify(CSSNumericValue.parse(css));
}

function termsOf(node: CSSNumericValue): CSSNumericValue[] {
  if (node instanceof CSSMathSum || node instanceof CSSMathProduct || node instanceof CSSMathMin || node instanceof CSSMathMax) {
    return [...node.values];
  }
  if (node instanceof CSSMathFunction) {
    return [...node.values];
  }
  return [node];
}

function hasUnit(nodes: CSSNumericValue[], unitName: string, value?: number): boolean {
  return nodes.some((n) => n instanceof CSSUnitValue && n.unit === unitName && (value === undefined || n.value === value));
}

describe('MC/DC leftover: math-parser simplify (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('mixed units that cannot collapse stay as sum/product/comparison leftovers', () => {
    // Frequency is not canonicalised in simplify(), unlike length/angle/time/resolution.
    const hzKhz = simplify(new CSSMathSum(CSS.Hz(1), CSS.kHz(1)));
    assert.ok(hzKhz instanceof CSSMathSum);
    assert.equal((hzKhz as CSSMathSum).values.length, 2);
    assert.ok(hasUnit(termsOf(hzKhz), 'hz', 1));
    assert.ok(hasUnit(termsOf(hzKhz), 'khz', 1));

    const cqwPx = parseSimplify('calc(1cqw + 10px)');
    assert.ok(cqwPx instanceof CSSMathSum);
    assert.equal((cqwPx as CSSMathSum).values.length, 2);
    assert.ok(hasUnit(termsOf(cqwPx), 'cqw', 1));
    assert.ok(hasUnit(termsOf(cqwPx), 'px', 10));

    const four = parseSimplify('calc((10px + 5%) + (1em + 2vw))');
    assert.ok(four instanceof CSSMathSum);
    assert.equal((four as CSSMathSum).values.length, 4);

    // css-values-4 § 10.7: products of two non-number dimensions are not a CSS dimension.
    const pxPerS = simplify(new CSSMathProduct(CSS.px(10), new CSSMathInvert(CSS.s(2))));
    assert.ok(pxPerS instanceof CSSMathProduct);

    const onlyFns = simplify(new CSSMathProduct(
      CSSNumericValue.parse('min(1px, 2em)'),
      CSSNumericValue.parse('max(1px, 2em)'),
    ));
    assert.ok(onlyFns instanceof CSSMathProduct);
    assert.equal((onlyFns as CSSMathProduct).values.length, 2);

    // Unique-cause: numberNode && sumNode but otherChildren.length !== 2 (no distribute).
    const noDist = simplify(new CSSMathProduct(
      CSS.number(2),
      new CSSMathSum(CSS.px(1), CSS.em(2)),
      CSSNumericValue.parse('min(1px, 2em)'),
    ));
    assert.ok(noDist instanceof CSSMathProduct);
    assert.equal((noDist as CSSMathProduct).values.length, 3);

    // Unique-cause: sumNode present, no numberNode — do not distribute 2px over (1px + 1em).
    const dimTimesSum = simplify(new CSSMathProduct(CSS.px(2), new CSSMathSum(CSS.px(1), CSS.em(2))));
    assert.ok(dimTimesSum instanceof CSSMathProduct);

    const mixedRound = simplify(new CSSMathRound('nearest', CSS.px(15), CSS.em(10)));
    assert.ok(mixedRound instanceof CSSMathRound);
    assert.equal((mixedRound as CSSMathRound).value instanceof CSSUnitValue, true);
    assert.equal(unit((mixedRound as CSSMathRound).value).unit, 'px');
    assert.equal(unit((mixedRound as CSSMathRound).precision).unit, 'em');
  });

  test('nested calc flattens when units combine and keeps mixed leftovers', () => {
    // css-values-4 § 10.7 #calc-simplification nested calculation trees
    const nestedFold = parseSimplify('calc(calc(1px + 2px) + 3px)');
    assert.equal(unit(nestedFold).value, 6);
    assert.equal(unit(nestedFold).unit, 'px');

    const nestedMixed = parseSimplify('calc(calc(1px + 2em) + 3px)');
    assert.ok(nestedMixed instanceof CSSMathSum);
    const mixedTerms = termsOf(nestedMixed);
    assert.equal(mixedTerms.length, 2);
    assert.ok(hasUnit(mixedTerms, 'em', 2));
    assert.ok(hasUnit(mixedTerms, 'px', 4));

    const innerLeftover = parseSimplify('calc(1px + calc(2em + 3%))');
    assert.ok(innerLeftover instanceof CSSMathSum);
    assert.equal((innerLeftover as CSSMathSum).values.length, 3);
    assert.ok(hasUnit(termsOf(innerLeftover), 'percent', 3));
    assert.ok(hasUnit(termsOf(innerLeftover), 'em', 2));
    assert.ok(hasUnit(termsOf(innerLeftover), 'px', 1));

    const hypotNested = parseSimplify('hypot(calc(3px), calc(4px))');
    assert.equal(unit(hypotNested).value, 5);
    assert.equal(unit(hypotNested).unit, 'px');

    const minNestedFold = parseSimplify('min(calc(10px + 2px), 5px)');
    assert.equal(unit(minNestedFold).value, 5);

    const minNestedLeftover = parseSimplify('min(calc(1px + 2px), calc(10px + 5%))');
    assert.ok(minNestedLeftover instanceof CSSMathMin);
    assert.equal((minNestedLeftover as CSSMathMin).values.length, 2);
    assert.ok(hasUnit(termsOf(minNestedLeftover), 'px', 3));

    const widthNested = CSSStyleValue.parse('width', 'calc(calc(1px + 2px) + 3%)');
    assert.ok(widthNested instanceof CSSMathSum);
    assert.equal((widthNested as CSSMathSum).values.length, 2);
    assert.ok(hasUnit(termsOf(widthNested as CSSNumericValue), 'percent', 3));
    assert.ok(hasUnit(termsOf(widthNested as CSSNumericValue), 'px', 3));
  });

  test('NaN and infinity constants fold, poison, or stay specified', () => {
    // css-values-4 § 10.8 #calc-error-constants / #calc-constants
    assert.equal(unit(parseSimplify('calc(infinity)')).value, Infinity);
    assert.equal(unit(parseSimplify('calc(+infinity)')).value, Infinity);
    assert.equal(unit(parseSimplify('calc(-infinity)')).value, -Infinity);
    assert.ok(Number.isNaN(unit(parseSimplify('calc(nan)')).value));

    assert.equal(unit(parseSimplify('calc(infinity + 1)')).value, Infinity);
    assert.ok(Number.isNaN(unit(parseSimplify('calc(infinity - infinity)')).value));
    assert.ok(Number.isNaN(unit(parseSimplify('calc(nan + 1)')).value));
    assert.ok(Number.isNaN(unit(parseSimplify('calc(0 / 0)')).value));
    assert.equal(unit(parseSimplify('calc(1 / 0)')).value, Infinity);

    const infPx = parseSimplify('calc(infinity * 1px)');
    assert.equal(unit(infPx).value, Infinity);
    assert.equal(unit(infPx).unit, 'px');

    const nanPx = parseSimplify('calc(nan * 1px)');
    assert.ok(Number.isNaN(unit(nanPx).value));
    assert.equal(unit(nanPx).unit, 'px');

    const infPxPlus = parseSimplify('calc(infinity * 1px + 1px)');
    assert.equal(unit(infPxPlus).value, Infinity);
    assert.equal(unit(infPxPlus).unit, 'px');

    assert.equal(unit(simplify(new CSSMathMin(CSS.number(Infinity), CSS.number(5)))).value, 5);
    assert.equal(unit(simplify(new CSSMathMax(CSS.number(Infinity), CSS.number(5)))).value, Infinity);
    assert.ok(Number.isNaN(unit(simplify(new CSSMathMin(CSS.number(NaN), CSS.number(1)))).value));

    assert.equal(unit(simplify(new CSSMathFunction('abs', CSS.number(-Infinity)))).value, Infinity);
    assert.ok(Number.isNaN(unit(simplify(new CSSMathFunction('abs', CSS.number(NaN)))).value));
    assert.ok(Number.isNaN(unit(simplify(new CSSMathFunction('sign', CSS.number(NaN)))).value));
    assert.equal(unit(simplify(new CSSMathFunction('log', CSS.number(Infinity)))).value, Infinity);
    assert.equal(unit(simplify(new CSSMathFunction('pow', CSS.number(2), CSS.number(Infinity)))).value, Infinity);
    assert.equal(unit(simplify(new CSSMathFunction('exp', CSS.number(Infinity)))).value, Infinity);
    assert.ok(Number.isNaN(unit(simplify(new CSSMathFunction('cos', CSS.number(Infinity)))).value));

    const hypotInf = simplify(new CSSMathFunction('hypot', CSS.px(Infinity), CSS.px(0)));
    assert.equal(unit(hypotInf).value, Infinity);
    assert.equal(unit(hypotInf).unit, 'px');

    assert.equal(unit(simplify(new CSSMathInvert(CSS.number(Infinity)))).value, 0);
    assert.equal(unit(simplify(new CSSMathNegate(CSS.number(Infinity)))).value, -Infinity);
    assert.ok(Number.isNaN(unit(simplify(new CSSMathNegate(CSS.number(NaN)))).value));
  });

  test('percentage + px cannot collapse across sum, min, clamp, hypot, atan2, mod', () => {
    const sum = parseSimplify('calc(10px + 5%)');
    assert.ok(sum instanceof CSSMathSum);
    assert.equal((sum as CSSMathSum).values.length, 2);
    assert.ok(hasUnit(termsOf(sum), 'percent', 5));
    assert.ok(hasUnit(termsOf(sum), 'px', 10));

    const distributed = parseSimplify('calc(2 * (10px + 5%))');
    assert.ok(distributed instanceof CSSMathSum);
    assert.equal((distributed as CSSMathSum).values.length, 2);
    assert.ok(hasUnit(termsOf(distributed), 'percent', 10));
    assert.ok(hasUnit(termsOf(distributed), 'px', 20));

    const width = CSSStyleValue.parse('width', 'calc(10px + 5%)');
    assert.ok(width instanceof CSSMathSum);
    assert.equal((width as CSSMathSum).values.length, 2);

    const minPct = simplify(new CSSMathMin(CSS.px(10), CSS.percent(5)));
    assert.ok(minPct instanceof CSSMathMin);
    assert.equal((minPct as CSSMathMin).values.length, 2);

    const clampPct = simplify(new CSSMathClamp(CSS.px(1), CSS.percent(50), CSS.px(100)));
    assert.ok(clampPct instanceof CSSMathClamp);

    const hypotPct = simplify(new CSSMathFunction('hypot', CSS.px(3), CSS.percent(4)));
    assert.ok(hypotPct instanceof CSSMathFunction);
    assert.equal((hypotPct as CSSMathFunction).name, 'hypot');

    const atan2Pct = simplify(new CSSMathFunction('atan2', CSS.percent(10), CSS.px(10)));
    assert.ok(atan2Pct instanceof CSSMathFunction);

    const modPct = simplify(new CSSMathFunction('mod', CSS.percent(10), CSS.px(3)));
    assert.ok(modPct instanceof CSSMathFunction);
  });

  test('type checking failures reject parse and leave constructed mismatches unsimplified', () => {
    assert.throws(
      () => CSSNumericValue.parse('min(1px, 1s)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSNumericValue.parse('max(1px, 1deg)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSNumericValue.parse('calc(1px + 1s)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSNumericValue.parse('calc(1fr + 1px)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );

    // CSSMathFunction does not type-check in the constructor; simplify must not fold.
    const hypotMismatch = simplify(new CSSMathFunction('hypot', CSS.px(3), CSS.s(4)));
    assert.ok(hypotMismatch instanceof CSSMathFunction);
    assert.equal((hypotMismatch as CSSMathFunction).toString(), 'hypot(3px, 4s)');

    const atan2Mismatch = simplify(new CSSMathFunction('atan2', CSS.px(1), CSS.s(1)));
    assert.ok(atan2Mismatch instanceof CSSMathFunction);

    const modMismatch = simplify(new CSSMathFunction('mod', CSS.px(10), CSS.s(3)));
    assert.ok(modMismatch instanceof CSSMathFunction);

    const powMismatch = simplify(new CSSMathFunction('pow', CSS.px(2), CSS.px(3)));
    assert.ok(powMismatch instanceof CSSMathFunction);

    const asinPct = simplify(new CSSMathFunction('asin', CSS.percent(1)));
    assert.ok(asinPct instanceof CSSMathFunction);
    const cosPct = simplify(new CSSMathFunction('cos', CSS.percent(1)));
    assert.ok(cosPct instanceof CSSMathFunction);
    const atanPx = simplify(new CSSMathFunction('atan', CSS.px(1)));
    assert.ok(atanPx instanceof CSSMathFunction);

    const logMixed = simplify(new CSSMathFunction('log', CSS.number(10), CSS.percent(10)));
    assert.ok(logMixed instanceof CSSMathFunction);

    const sinArity = simplify(new CSSMathFunction('sin', CSS.deg(0), CSS.deg(90)));
    assert.ok(sinArity instanceof CSSMathFunction);
    const powArity = simplify(new CSSMathFunction('pow', CSS.number(2)));
    assert.ok(powArity instanceof CSSMathFunction);
    const logArity = simplify(new CSSMathFunction('log', CSS.number(8), CSS.number(2), CSS.number(1)));
    assert.ok(logArity instanceof CSSMathFunction);

    assert.throws(
      () => simplify(new CSSMathInvert(CSS.number(0))),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => simplify(new CSSMathInvert(CSS.px(0))),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
  });

  test('empty min/max are rejected at parse and leftover through CSSMathFunction', () => {
    // css-values-4 § 10.2 #funcdef-min / #funcdef-max — min()/max() require ≥1 argument.
    assert.throws(
      () => CSSNumericValue.parse('min()'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSNumericValue.parse('max()'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSNumericValue.parse('max( )'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
    assert.throws(
      () => CSSStyleValue.parse('width', 'min()'),
      TypeError,
    );

    // Unique-cause leftover: simplify() sees CSSMathFunction('min'|'max') not CSSMathMin/Max.
    const emptyMin = simplify(new CSSMathFunction('min'));
    assert.ok(emptyMin instanceof CSSMathFunction);
    assert.equal((emptyMin as CSSMathFunction).name, 'min');
    assert.equal((emptyMin as CSSMathFunction).values.length, 0);
    assert.equal(emptyMin.toString(), 'min()');

    const emptyMax = simplify(new CSSMathFunction('max'));
    assert.ok(emptyMax instanceof CSSMathFunction);
    assert.equal((emptyMax as CSSMathFunction).name, 'max');
    assert.equal((emptyMax as CSSMathFunction).values.length, 0);

    const emptyAbs = simplify(new CSSMathFunction('abs'));
    assert.ok(emptyAbs instanceof CSSMathFunction);
    const emptyLog = simplify(new CSSMathFunction('log'));
    assert.ok(emptyLog instanceof CSSMathFunction);

    // Nested min(max(...)) does not flatten across operators; mixed inner max is leftover.
    const minOfMax = simplify(new CSSMathMin(new CSSMathMax(CSS.px(1), CSS.em(2)), CSS.px(3)));
    assert.ok(minOfMax instanceof CSSMathMin);
    assert.ok(termsOf(minOfMax).some((c) => c instanceof CSSMathMax));

    const maxOfMin = simplify(new CSSMathMax(new CSSMathMin(CSS.px(1), CSS.em(2)), CSS.px(3)));
    assert.ok(maxOfMin instanceof CSSMathMax);
    assert.ok(termsOf(maxOfMin).some((c) => c instanceof CSSMathMin));
  });

  test('single-arg hypot leftover vs fold, empty hypot leftover', () => {
    // css-values-4 § 10.4 #funcdef-hypot — hypot() is 1+ args; one compatible unit folds.
    const foldedPx = parseSimplify('hypot(5px)');
    assert.equal(unit(foldedPx).value, 5);
    assert.equal(unit(foldedPx).unit, 'px');

    const foldedEm = simplify(new CSSMathFunction('hypot', CSS.em(3)));
    assert.equal(unit(foldedEm).value, 3);
    assert.equal(unit(foldedEm).unit, 'em');

    // Single argument that is not a CSSUnitValue cannot collapse.
    const leftoverMin = simplify(new CSSMathFunction('hypot', CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(leftoverMin instanceof CSSMathFunction);
    assert.equal((leftoverMin as CSSMathFunction).name, 'hypot');
    assert.equal((leftoverMin as CSSMathFunction).values.length, 1);
    assert.ok((leftoverMin as CSSMathFunction).values[0] instanceof CSSMathMin);

    const parsedLeftover = parseSimplify('hypot(min(1px, 2em))');
    assert.ok(parsedLeftover instanceof CSSMathFunction);

    assert.throws(
      () => CSSNumericValue.parse('hypot()'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );

    const emptyHypot = simplify(new CSSMathFunction('hypot'));
    assert.ok(emptyHypot instanceof CSSMathFunction);
    assert.equal((emptyHypot as CSSMathFunction).values.length, 0);
    assert.equal(emptyHypot.toString(), 'hypot()');

    const absLeftover = simplify(new CSSMathFunction('abs', CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(absLeftover instanceof CSSMathFunction);
    const signLeftover = simplify(new CSSMathFunction('sign', CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(signLeftover instanceof CSSMathFunction);

    const clampLeftover = simplify(new CSSMathClamp(CSS.px(1), CSSNumericValue.parse('min(1px, 2em)'), CSS.px(3)));
    assert.ok(clampLeftover instanceof CSSMathClamp);
    const clampNone = simplify(new CSSMathClamp(
      CSS.px(1),
      CSSNumericValue.parse('min(1px, 2em)'),
      new CSSKeywordValue('none'),
    ));
    assert.ok(clampNone instanceof CSSMathClamp);
    assert.ok((clampNone as CSSMathClamp).upper instanceof CSSKeywordValue);

    const roundVal = simplify(new CSSMathRound('nearest', CSSNumericValue.parse('min(1px, 2em)'), CSS.px(1)));
    assert.ok(roundVal instanceof CSSMathRound);
    const roundPrec = simplify(new CSSMathRound('nearest', CSS.px(15), CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(roundPrec instanceof CSSMathRound);
  });

  test('product fromCanonical leftovers: resolution, flex, percent, numbers, tan(0), sqrt(0)', () => {
    const dppxScaled = simplify(new CSSMathProduct(CSS.dppx(2), CSS.number(3)));
    assert.equal(unit(dppxScaled).value, 6);
    assert.equal(unit(dppxScaled).unit, 'dppx');

    const dpcmScaled = simplify(new CSSMathProduct(CSS.dpcm(2), CSS.number(3)));
    assert.equal(unit(dpcmScaled).value, 6);
    assert.equal(unit(dpcmScaled).unit, 'dpcm');

    const flexScaled = simplify(new CSSMathProduct(CSS.fr(2), CSS.number(3)));
    assert.equal(unit(flexScaled).value, 6);
    assert.equal(unit(flexScaled).unit, 'fr');

    const pctScaled = simplify(new CSSMathProduct(CSS.percent(50), CSS.number(2)));
    assert.equal(unit(pctScaled).value, 100);
    assert.equal(unit(pctScaled).unit, 'percent');

    assert.equal(unit(simplify(new CSSMathFunction('mod', CSS.number(10), CSS.number(3)))).value, 1);
    assert.equal(unit(simplify(new CSSMathFunction('rem', CSS.number(-10), CSS.number(3)))).value, -1);
    assert.equal(unit(simplify(new CSSMathFunction('tan', CSS.number(0)))).value, 0);
    assert.equal(unit(simplify(new CSSMathFunction('sqrt', CSS.number(0)))).value, 0);
  });
});
