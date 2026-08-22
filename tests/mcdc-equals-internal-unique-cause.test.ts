/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 *
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
// Verifies: SW-REQ-260821-E5D5, SW-REQ-260821-7AKJ
// Leftover unique-cause for src/typed-om/numeric/numeric-methods.ts
// equalsInternal / numericEquals (3rd hottest after leftover numeric tests).
// Drive CSSNumericValue.parse / .equals() and CSSMathSum/Product/Min/Max/
// Clamp/Negate/Invert/Round/Function constructors. css-typed-om-1 § 4.1
// #numericvalue-objects / § 4.4 #mathvalue-objects, css-values-4 § 10.6
// #round-func / § 10.8 #funcdef-clamp. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathRound,
  CSSMathFunction,
  CSSKeywordValue,
} from '../src/typed-om.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function leftoverSum(): CSSMathSum {
  const node = parse('calc(1px + 2em)');
  assert.ok(node instanceof CSSMathSum);
  return node;
}

function leftoverMin(): CSSMathMin {
  const node = parse('min(1px, 2em)');
  assert.ok(node instanceof CSSMathMin);
  return node;
}

function leftoverMax(): CSSMathMax {
  const node = parse('max(1px, 2em)');
  assert.ok(node instanceof CSSMathMax);
  return node;
}

function leftoverProduct(): CSSMathProduct {
  const node = CSS.px(2).mul(CSS.em(3));
  assert.ok(node instanceof CSSMathProduct);
  return node;
}

class BareNumeric extends CSSNumericValue {
  serialize(): string {
    return 'bare';
  }
  type() {
    return {};
  }
}

/**
 * Shadow `other.constructor` so equalsInternal reaches the `instanceof` AND
 * instead of returning on `a.constructor !== other.constructor`.
 */
function equalsAligned(a: CSSNumericValue, other: CSSNumericValue): boolean {
  Object.defineProperty(other, 'constructor', {
    configurable: true,
    value: a.constructor,
  });
  return a.equals(other);
}

describe('MC/DC equalsInternal unique-cause: instanceof AND pairs (css-typed-om-1 § 4.1 #numericvalue-objects)', { concurrency: false }, () => {
  test('natural mixed-type equals: constructor !== returns before instanceof AND', () => {
    const unit = CSS.px(1);
    const sum = leftoverSum();
    const product = leftoverProduct();
    const min = leftoverMin();
    const max = leftoverMax();
    const clamp = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    const neg = new CSSMathNegate(CSS.px(1));
    const inv = new CSSMathInvert(CSS.px(2));
    const round = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    const fn = new CSSMathFunction('sin', CSS.deg(90));

    // Unique-cause: a.constructor !== other.constructor T (mixed types).
    assert.equal(unit.equals(sum), false);
    assert.equal(sum.equals(unit), false);
    assert.equal(sum.equals(product), false);
    assert.equal(product.equals(unit), false);
    assert.equal(product.equals(sum), false);
    assert.equal(min.equals(unit), false);
    assert.equal(min.equals(max), false);
    assert.equal(max.equals(unit), false);
    assert.equal(max.equals(min), false);
    assert.equal(clamp.equals(unit), false);
    assert.equal(clamp.equals(sum), false);
    assert.equal(neg.equals(unit), false);
    assert.equal(neg.equals(inv), false);
    assert.equal(inv.equals(unit), false);
    assert.equal(round.equals(unit), false);
    assert.equal(round.equals(fn), false);
    // Unique-cause: Function first conjunct F of Unit AND is not reached here
    // (constructor !== already returned). Still drives mixed Function vs unit.
    assert.equal(fn.equals(unit), false);
    assert.equal(unit.equals(fn), false);
    assert.equal(fn.equals(sum), false);
  });

  test('constructor-aligned mixed equals: instanceof AND T,F unique-cause of second conjunct', () => {
    // Unique-cause: a instanceof X T, other instanceof X F (second conjunct).
    // Aligning constructor is required; otherwise constructor !== returns first.
    assert.equal(equalsAligned(CSS.px(1), leftoverSum()), false);
    assert.equal(equalsAligned(CSS.px(1), leftoverProduct()), false);

    const sum = leftoverSum();
    assert.equal(equalsAligned(sum, CSS.px(1)), false);
    assert.equal(equalsAligned(sum, leftoverProduct()), false);

    const product = leftoverProduct();
    assert.equal(equalsAligned(product, CSS.px(1)), false);
    assert.equal(equalsAligned(product, leftoverSum()), false);

    const min = leftoverMin();
    assert.equal(equalsAligned(min, CSS.px(1)), false);
    assert.equal(equalsAligned(min, leftoverMax()), false);

    const max = leftoverMax();
    assert.equal(equalsAligned(max, CSS.px(1)), false);
    assert.equal(equalsAligned(max, leftoverMin()), false);

    const clamp = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(equalsAligned(clamp, CSS.px(1)), false);
    assert.equal(equalsAligned(clamp, leftoverSum()), false);

    const neg = new CSSMathNegate(CSS.px(1));
    assert.equal(equalsAligned(neg, CSS.px(1)), false);
    assert.equal(equalsAligned(neg, new CSSMathInvert(CSS.px(1))), false);

    const inv = new CSSMathInvert(CSS.px(2));
    assert.equal(equalsAligned(inv, CSS.px(2)), false);
    assert.equal(equalsAligned(inv, new CSSMathNegate(CSS.px(2))), false);

    const round = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    assert.equal(equalsAligned(round, CSS.px(1.2)), false);
    assert.equal(equalsAligned(round, leftoverMin()), false);

    const fn = new CSSMathFunction('sin', CSS.deg(90));
    assert.equal(equalsAligned(fn, leftoverProduct()), false);
    // Unique-cause: Function AND T,F (second conjunct) and Unit AND F,skip
    // (first conjunct F of the Unit pair, reached only after constructor align).
    assert.equal(equalsAligned(fn, CSS.px(1)), false);
    // Unique-cause: Unit AND T,F then Function AND F,skip (first conjunct F).
    assert.equal(equalsAligned(CSS.px(1), new CSSMathFunction('sin', CSS.deg(90))), false);
  });

  test('instanceof AND both-T bodies: length/every and value/unit unique-cause', () => {
    // Unique-cause: CSSUnitValue value === T/F with unit held T; unit === T/F with value held T.
    assert.equal(CSS.px(1).equals(CSS.px(1)), true);
    assert.equal(CSS.px(1).equals(CSS.px(2)), false);
    assert.equal(CSS.px(1).equals(CSS.em(1)), false);
    assert.equal(CSS.number(4).equals(CSS.number(4)), true);

    const sum = leftoverSum();
    const sumEq = parse('calc(1px + 2em)');
    const sumFirst = new CSSMathSum(CSS.px(9), CSS.em(2));
    const sumSecond = new CSSMathSum(CSS.px(1), CSS.em(9));
    const sumLong = new CSSMathSum(CSS.px(1), CSS.em(2), CSS.vw(1));
    // Unique-cause: length === T, every T / first-child F / second-child F; length F skip every.
    assert.equal(sum.equals(sumEq), true);
    assert.equal(sum.equals(sumFirst), false);
    assert.equal(sum.equals(sumSecond), false);
    assert.equal(sum.equals(sumLong), false);

    const product = leftoverProduct();
    const productEq = new CSSMathProduct(CSS.px(2), CSS.em(3));
    const productFirst = new CSSMathProduct(CSS.px(9), CSS.em(3));
    const productSecond = new CSSMathProduct(CSS.px(2), CSS.em(9));
    const productLong = new CSSMathProduct(CSS.px(2), CSS.em(3), CSS.number(1));
    assert.equal(product.equals(productEq), true);
    assert.equal(product.equals(productFirst), false);
    assert.equal(product.equals(productSecond), false);
    assert.equal(product.equals(productLong), false);

    const min = leftoverMin();
    const minEq = parse('min(1px, 2em)');
    const minFirst = new CSSMathMin(CSS.px(9), CSS.em(2));
    const minSecond = new CSSMathMin(CSS.px(1), CSS.em(9));
    const minLong = new CSSMathMin(CSS.px(1), CSS.em(2), CSS.vw(1));
    assert.equal(min.equals(minEq), true);
    assert.equal(min.equals(minFirst), false);
    assert.equal(min.equals(minSecond), false);
    assert.equal(min.equals(minLong), false);

    const max = leftoverMax();
    const maxEq = parse('max(1px, 2em)');
    const maxFirst = new CSSMathMax(CSS.px(9), CSS.em(2));
    const maxSecond = new CSSMathMax(CSS.px(1), CSS.em(9));
    const maxLong = new CSSMathMax(CSS.px(1), CSS.em(2), CSS.vw(1));
    assert.equal(max.equals(maxEq), true);
    assert.equal(max.equals(maxFirst), false);
    assert.equal(max.equals(maxSecond), false);
    assert.equal(max.equals(maxLong), false);
  });

  test('Negate/Invert/Round/Function inner unique-cause of strategy/name/length/every', () => {
    const neg = new CSSMathNegate(CSS.px(1));
    assert.equal(neg.equals(new CSSMathNegate(CSS.px(1))), true);
    assert.equal(neg.equals(new CSSMathNegate(CSS.px(2))), false);
    assert.equal(neg.equals(new CSSMathNegate(CSS.em(1))), false);

    const inv = new CSSMathInvert(CSS.px(2));
    assert.equal(inv.equals(new CSSMathInvert(CSS.px(2))), true);
    assert.equal(inv.equals(new CSSMathInvert(CSS.px(3))), false);
    assert.equal(inv.equals(new CSSMathInvert(CSS.em(2))), false);

    const round = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1));
    // Unique-cause of strategy === / value.equals / precision.equals held T then one F.
    assert.equal(round.equals(new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1))), true);
    assert.equal(round.equals(new CSSMathRound('up', CSS.px(1.2), CSS.px(1))), false);
    assert.equal(round.equals(new CSSMathRound('nearest', CSS.px(2.2), CSS.px(1))), false);
    assert.equal(round.equals(new CSSMathRound('nearest', CSS.px(1.2), CSS.px(2))), false);

    const fn = new CSSMathFunction('sin', CSS.deg(90));
    // Unique-cause: name === T/F; length === T/F; every T/F (first vs extra arg).
    assert.equal(fn.equals(new CSSMathFunction('sin', CSS.deg(90))), true);
    assert.equal(fn.equals(new CSSMathFunction('cos', CSS.deg(90))), false);
    assert.equal(fn.equals(new CSSMathFunction('sin', CSS.deg(45))), false);
    assert.equal(fn.equals(new CSSMathFunction('sin', CSS.deg(90), CSS.deg(1))), false);
    const abs = parse('abs(-10px)');
    assert.ok(abs instanceof CSSMathFunction);
    assert.equal(abs.equals(new CSSMathFunction('abs', CSS.px(-10))), true);
    assert.equal(abs.equals(new CSSMathFunction('abs', CSS.px(10))), false);
  });
});

describe('MC/DC equalsInternal unique-cause: CSSMathClamp keyword vs numeric (css-values-4 § 10.8 #funcdef-clamp)', { concurrency: false }, () => {
  test('lower/upper auto keyword vs length unique-cause of keyword AND and numeric AND', () => {
    const auto = new CSSKeywordValue('auto');
    const none = new CSSKeywordValue('none');
    const num = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    const numEq = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    const autoL = new CSSMathClamp(auto, CSS.px(2), CSS.px(3));
    const autoU = new CSSMathClamp(CSS.px(1), CSS.px(2), auto);
    const autoBoth = new CSSMathClamp(auto, CSS.px(2), auto);
    const noneL = new CSSMathClamp(none, CSS.px(2), CSS.px(3));
    const noneU = new CSSMathClamp(CSS.px(1), CSS.px(2), none);
    const noneBoth = new CSSMathClamp(none, CSS.px(2), none);

    assert.equal(num.equals(numEq), true);

    // Unique-cause: lower keyword AND T,F (auto vs length) and F,skip then numeric AND T,F.
    assert.equal(autoL.equals(num), false);
    assert.equal(num.equals(autoL), false);
    // Unique-cause: upper keyword AND T,F (auto vs length) and reverse numeric AND T,F.
    assert.equal(autoU.equals(num), false);
    assert.equal(num.equals(autoU), false);

    // Unique-cause: both keyword, value === F (auto vs none) with the other bound held.
    assert.equal(autoL.equals(noneL), false);
    assert.equal(autoU.equals(noneU), false);
    assert.equal(autoBoth.equals(noneBoth), false);

    // Unique-cause: both keyword, value === T.
    assert.equal(autoL.equals(new CSSMathClamp(new CSSKeywordValue('auto'), CSS.px(2), CSS.px(3))), true);
    assert.equal(autoBoth.equals(new CSSMathClamp(new CSSKeywordValue('auto'), CSS.px(2), new CSSKeywordValue('auto'))), true);
    assert.equal(noneBoth.equals(new CSSMathClamp(none, CSS.px(2), none)), true);

    // Unique-cause: one side keyword, other numeric (mixed lower vs mixed upper).
    assert.equal(autoL.equals(autoU), false);
    assert.equal(autoU.equals(autoL), false);
    assert.equal(autoL.equals(autoBoth), false);
    assert.equal(autoBoth.equals(autoL), false);
  });

  test('lowerEquals && value.equals && upperEquals unique-cause and null bounds', () => {
    const auto = new CSSKeywordValue('auto');
    const num = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    // Unique-cause: lower F, value T, upper T.
    assert.equal(num.equals(new CSSMathClamp(CSS.px(9), CSS.px(2), CSS.px(3))), false);
    // Unique-cause: lower T, value F, upper T.
    assert.equal(num.equals(new CSSMathClamp(CSS.px(1), CSS.px(9), CSS.px(3))), false);
    // Unique-cause: lower T, value T, upper F.
    assert.equal(num.equals(new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(9))), false);

    const autoL = new CSSMathClamp(auto, CSS.px(2), CSS.px(3));
    // Unique-cause: keyword lower T, value F, numeric upper T.
    assert.equal(autoL.equals(new CSSMathClamp(new CSSKeywordValue('auto'), CSS.px(9), CSS.px(3))), false);
    // Unique-cause: keyword lower T, value T, numeric upper F.
    assert.equal(autoL.equals(new CSSMathClamp(new CSSKeywordValue('auto'), CSS.px(2), CSS.px(9))), false);

    const autoBoth = new CSSMathClamp(auto, CSS.px(2), new CSSKeywordValue('auto'));
    assert.equal(autoBoth.equals(new CSSMathClamp(new CSSKeywordValue('auto'), CSS.px(9), new CSSKeywordValue('auto'))), false);

    // Unique-cause: neither keyword nor numeric (null) → both ANDs fail → false.
    const nullL = new CSSMathClamp(null as unknown as CSSNumericValue, CSS.px(2), CSS.px(3));
    const nullU = new CSSMathClamp(CSS.px(1), CSS.px(2), null as unknown as CSSNumericValue);
    assert.equal(num.equals(nullL), false);
    assert.equal(nullL.equals(num), false);
    assert.equal(autoL.equals(nullL), false);
    assert.equal(nullL.equals(autoL), false);
    assert.equal(num.equals(nullU), false);
    assert.equal(nullU.equals(num), false);
    assert.equal(nullL.equals(nullL), true);
  });
});

describe('MC/DC numericEquals unique-cause: empty args and loop (css-typed-om-1 § 4.1 #numericvalue-objects)', { concurrency: false }, () => {
  test('values.length === 0 T vs loop first-mismatch vs all true', () => {
    const unit = CSS.px(1);
    const sum = leftoverSum();
    const fn = new CSSMathFunction('sin', CSS.deg(90));

    // Unique-cause: values.length === 0 T (no comparands → true).
    assert.equal(unit.equals(), true);
    assert.equal(sum.equals(), true);
    assert.equal(fn.equals(), true);
    assert.equal(new CSSMathNegate(CSS.px(1)).equals(), true);
    assert.equal(new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3)).equals(), true);

    // Unique-cause: length F, loop first mismatch → false.
    assert.equal(unit.equals(CSS.px(2)), false);
    assert.equal(unit.equals(1), false);
    assert.equal(CSS.number(1).equals(2), false);
    assert.equal(sum.equals(leftoverProduct()), false);

    // Unique-cause: first match then second mismatch (loop continues, then false).
    assert.equal(unit.equals(CSS.px(1), CSS.px(2)), false);
    assert.equal(CSS.number(1).equals(1, 2), false);
    assert.equal(sum.equals(parse('calc(1px + 2em)'), CSS.px(1)), false);
    assert.equal(fn.equals(new CSSMathFunction('sin', CSS.deg(90)), CSS.px(1)), false);

    // Unique-cause: all comparands true (loop never returns false).
    assert.equal(unit.equals(CSS.px(1)), true);
    assert.equal(unit.equals(CSS.px(1), CSS.px(1)), true);
    assert.equal(CSS.number(3).equals(3, CSS.number(3)), true);
    assert.equal(sum.equals(parse('calc(1px + 2em)'), leftoverSum()), true);
    assert.equal(fn.equals(new CSSMathFunction('sin', CSS.deg(90)), fn), true);
  });

  test('typeof number conjuncts, identity, and fallthrough subclass', () => {
    // Unique-cause: typeof other === 'number' T with instanceof/value/unit unique-cause.
    assert.equal(CSS.number(1).equals(1), true);
    assert.equal(CSS.number(2).equals(3), false);
    assert.equal(CSS.px(1).equals(1), false);
    assert.equal(leftoverMin().equals(1), false);
    assert.equal(leftoverSum().equals(0), false);
    assert.equal(new CSSMathFunction('sin', CSS.deg(90)).equals(0), false);

    // Unique-cause: a === other T (same reference) vs equal-but-not-identical.
    const unit = CSS.px(4);
    assert.equal(unit.equals(unit), true);
    assert.equal(unit.equals(CSS.px(4)), true);
    const clamp = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(clamp.equals(clamp), true);

    // Unique-cause: matching constructors that are none of the math/unit classes
    // fall through every instanceof AND (F,skip) to return false.
    const a = new BareNumeric();
    const b = new BareNumeric();
    assert.equal(a.equals(b), false);
    assert.equal(a.equals(a), true);
    assert.equal(a.equals(CSS.px(1)), false);
    assert.equal(equalsAligned(a, CSS.px(1)), false);
    assert.equal(equalsAligned(CSS.px(1), new BareNumeric()), false);
  });
});
