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
// Unique-cause leftovers for src/math-parser.ts simplify() not covered by
// tests/mcdc-hotspot-math-walk.test.ts or tests/mcdc-hotspot-math-simplify-leftover.test.ts.
// Parse already folds nested sums/products/negates, so these cases construct trees.
// No //mcdc:ignore.
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
  CSSMathClamp,
  CSSMathFunction,
  CSSKeywordValue,
} from '../src/typed-om.ts';

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function leftoverMin(): CSSNumericValue {
  const node = CSSNumericValue.parse('min(1px, 2em)');
  assert.ok(node instanceof CSSMathMin);
  return node;
}

function leftoverFn(node: CSSNumericValue, name: string): CSSMathFunction {
  assert.ok(node instanceof CSSMathFunction, `expected leftover CSSMathFunction, got ${node.constructor.name} (${node.toString()})`);
  assert.equal(node.name, name);
  return node;
}

describe('MC/DC unique-cause: math-parser simplify (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('constructed nested leftover sums flatten; nested leftover products flatten', () => {
    // Unique-cause: simplifiedChild instanceof CSSMathSum is T (parse already flattens nested calc()).
    const nestedSum = simplify(new CSSMathSum(new CSSMathSum(CSS.px(1), CSS.em(2)), CSS.percent(3)));
    assert.ok(nestedSum instanceof CSSMathSum);
    assert.equal(nestedSum.values.length, 3);
    const sumUnits = [...nestedSum.values].filter((n): n is CSSUnitValue => n instanceof CSSUnitValue);
    assert.ok(sumUnits.some((n) => n.unit === 'px' && n.value === 1));
    assert.ok(sumUnits.some((n) => n.unit === 'em' && n.value === 2));
    assert.ok(sumUnits.some((n) => n.unit === 'percent' && n.value === 3));

    // Unique-cause: simplifiedChild instanceof CSSMathProduct is T (px*s cannot collapse).
    const nestedProd = simplify(new CSSMathProduct(new CSSMathProduct(CSS.px(2), CSS.s(3)), CSS.number(4)));
    assert.ok(nestedProd instanceof CSSMathProduct);
    assert.equal(nestedProd.toString().includes('2px'), true);
    assert.equal(nestedProd.toString().includes('3s'), true);
  });

  test('product invert of leftover min, and otherChildren.length === 1 identity', () => {
    // Unique-cause: CSSMathInvert whose value is not a CSSUnitValue (invert of leftover min).
    const invertLeftover = simplify(new CSSMathProduct(CSS.number(2), new CSSMathInvert(leftoverMin())));
    assert.ok(invertLeftover instanceof CSSMathProduct);
    assert.equal(invertLeftover.values.length, 2);
    assert.ok([...invertLeftover.values].some((c) => c instanceof CSSMathInvert));

    // Unique-cause: otherChildren.length === 1 after numeric parts cannot combine (lone invert).
    const loneInvert = simplify(new CSSMathProduct(new CSSMathInvert(CSS.px(2))));
    assert.ok(loneInvert instanceof CSSMathInvert);
    assert.ok(loneInvert.value instanceof CSSUnitValue);
    assert.equal(unit(loneInvert.value).unit, 'px');
    assert.equal(unit(loneInvert.value).value, 2);

    // Single leftover child is a multiplicative identity product → the leftover itself.
    const loneMin = simplify(new CSSMathProduct(leftoverMin()));
    assert.ok(loneMin instanceof CSSMathMin);
  });

  test('constructed double negate and double invert unwrap (parse already folds calc(-(-x)))', () => {
    // css-values-4 § 10.7 #calc-simplification steps 6 / 7
    const doubleNeg = simplify(new CSSMathNegate(new CSSMathNegate(CSS.px(8))));
    assert.equal(unit(doubleNeg).value, 8);
    assert.equal(unit(doubleNeg).unit, 'px');

    const doubleInvPx = simplify(new CSSMathInvert(new CSSMathInvert(CSS.px(8))));
    assert.equal(unit(doubleInvPx).value, 8);
    assert.equal(unit(doubleInvPx).unit, 'px');

    const doubleInvNum = simplify(new CSSMathInvert(new CSSMathInvert(CSS.number(8))));
    assert.equal(unit(doubleInvNum).value, 8);
    assert.equal(unit(doubleInvNum).unit, 'number');

    const doubleInvLeftover = simplify(new CSSMathInvert(new CSSMathInvert(leftoverMin())));
    assert.ok(doubleInvLeftover instanceof CSSMathMin);
  });

  test('clamp unique-cause: min and value are units, max is leftover or none', () => {
    // Prior leftover clamp used leftover *value*; this flips only max instanceof CSSUnitValue.
    const leftoverMax = simplify(new CSSMathClamp(CSS.px(1), CSS.px(2), leftoverMin()));
    assert.ok(leftoverMax instanceof CSSMathClamp);
    assert.ok(leftoverMax.lower instanceof CSSUnitValue);
    assert.ok(leftoverMax.value instanceof CSSUnitValue);
    assert.ok(leftoverMax.upper instanceof CSSMathMin);

    const noneMax = simplify(new CSSMathClamp(CSS.px(1), CSS.px(2), new CSSKeywordValue('none')));
    assert.ok(noneMax instanceof CSSMathClamp);
    assert.ok(noneMax.upper instanceof CSSKeywordValue);
    assert.equal((noneMax.upper as CSSKeywordValue).value, 'none');
  });

  test('hypot of same-base leftover units: percent, frequency, flex fold', () => {
    // css-values-4 § 10.4 #funcdef-hypot — leftover tests mixed px/%; these share a non-length base.
    const pct = simplify(new CSSMathFunction('hypot', CSS.percent(3), CSS.percent(4)));
    assert.equal(unit(pct).value, 5);
    assert.equal(unit(pct).unit, 'percent');

    const hz = simplify(new CSSMathFunction('hypot', CSS.Hz(3), CSS.Hz(4)));
    assert.equal(unit(hz).value, 5);
    assert.equal(unit(hz).unit, 'hz');

    const fr = simplify(new CSSMathFunction('hypot', CSS.fr(3), CSS.fr(4)));
    assert.equal(unit(fr).value, 5);
    assert.equal(unit(fr).unit, 'fr');
  });

  test('trig unique-cause: length===1 but argument is leftover min, plus empty/extra arity', () => {
    leftoverFn(simplify(new CSSMathFunction('sin', leftoverMin())), 'sin');
    leftoverFn(simplify(new CSSMathFunction('cos', leftoverMin())), 'cos');
    leftoverFn(simplify(new CSSMathFunction('tan', leftoverMin())), 'tan');

    leftoverFn(simplify(new CSSMathFunction('asin')), 'asin');
    leftoverFn(simplify(new CSSMathFunction('asin', CSS.number(0), CSS.number(1))), 'asin');
    leftoverFn(simplify(new CSSMathFunction('asin', leftoverMin())), 'asin');
    leftoverFn(simplify(new CSSMathFunction('acos')), 'acos');
    leftoverFn(simplify(new CSSMathFunction('acos', leftoverMin())), 'acos');
    leftoverFn(simplify(new CSSMathFunction('atan', leftoverMin())), 'atan');
  });

  test('sqrt/pow/exp unique-cause: wrong arity and non-unit children', () => {
    leftoverFn(simplify(new CSSMathFunction('sqrt')), 'sqrt');
    leftoverFn(simplify(new CSSMathFunction('sqrt', CSS.number(4), CSS.number(9))), 'sqrt');
    leftoverFn(simplify(new CSSMathFunction('sqrt', leftoverMin())), 'sqrt');

    leftoverFn(simplify(new CSSMathFunction('pow', CSS.number(2), leftoverMin())), 'pow');
    leftoverFn(simplify(new CSSMathFunction('pow', CSS.number(2), CSS.px(3))), 'pow');

    leftoverFn(simplify(new CSSMathFunction('exp')), 'exp');
    leftoverFn(simplify(new CSSMathFunction('exp', CSS.number(1), CSS.number(2))), 'exp');
    leftoverFn(simplify(new CSSMathFunction('exp', leftoverMin())), 'exp');
  });

  test('atan2/mod/rem unique-cause: arity !== 2 and not-every-unit children', () => {
    leftoverFn(simplify(new CSSMathFunction('atan2')), 'atan2');
    leftoverFn(simplify(new CSSMathFunction('atan2', CSS.px(1))), 'atan2');
    leftoverFn(simplify(new CSSMathFunction('atan2', CSS.px(1), CSS.px(2), CSS.px(3))), 'atan2');
    leftoverFn(simplify(new CSSMathFunction('atan2', leftoverMin(), CSS.px(1))), 'atan2');

    leftoverFn(simplify(new CSSMathFunction('mod')), 'mod');
    leftoverFn(simplify(new CSSMathFunction('mod', CSS.px(10))), 'mod');
    leftoverFn(simplify(new CSSMathFunction('mod', CSS.px(10), CSS.px(3), CSS.px(1))), 'mod');
    leftoverFn(simplify(new CSSMathFunction('mod', leftoverMin(), CSS.px(1))), 'mod');

    leftoverFn(simplify(new CSSMathFunction('rem')), 'rem');
    leftoverFn(simplify(new CSSMathFunction('rem', CSS.px(10))), 'rem');
    leftoverFn(simplify(new CSSMathFunction('rem', leftoverMin(), CSS.px(1))), 'rem');
  });

  test('log/sign unique-cause: leftover children and sign arity !== 1', () => {
    leftoverFn(simplify(new CSSMathFunction('log', leftoverMin())), 'log');
    leftoverFn(simplify(new CSSMathFunction('log', CSS.number(10), leftoverMin())), 'log');

    leftoverFn(simplify(new CSSMathFunction('sign')), 'sign');
    leftoverFn(simplify(new CSSMathFunction('sign', CSS.px(1), CSS.px(2))), 'sign');
  });
});
