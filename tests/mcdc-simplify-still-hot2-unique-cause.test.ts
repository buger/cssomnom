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
// Still-hot2 unique-cause leftovers for src/math-parser.ts simplify()
// after tests/mcdc-hotspot-math-walk.test.ts,
// tests/mcdc-hotspot-math-simplify-leftover.test.ts,
// tests/mcdc-simplify-unique-cause.test.ts, and
// tests/mcdc-math-parser-still-hot-unique-cause.test.ts.
// Last recapture: 79/89 decisions, 10 missing conditions / 10 incomplete.
// Drive CSSNumericValue.parse / CSSStyleValue.parse / simplify.
// CSSMathRound / CSSMathFunction constructors type-check; leftover unique-cause
// of mixed number/dimension round and hypot-without-unitToBase mutates .unit
// after construction (same pattern as tests/mcdc-math-ops-color-unique-cause.test.ts).
// Pairable leftovers unique-caused here: L835 precision.unit === 'number' with
// val.unit !== precision.unit; L869 hypot `base` F.
// Structurally unpairable left mute (no ignore):
//   L612 unitToRadians[unit] F when base === 'angle' — every angle unit is in the map
//   L616 unitToSeconds[unit] F when base === 'time' — only s/ms
//   L715 matchingChild F and targetBase === length|angle|time fallbacks — net
//     exponent 1 always has a non-inverted child of that base
//   L889 node.name === 'tan' F / L901 node.name === 'atan' F — else-if remainder
//     after sin/cos or asin/acos; outer includes() forces the remaining name
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
  CSSMathRound,
  CSSMathFunction,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function leftoverFn(node: CSSNumericValue, name: string): CSSMathFunction {
  assert.ok(node instanceof CSSMathFunction, `expected leftover CSSMathFunction, got ${node.constructor.name} (${node.toString()})`);
  assert.equal(node.name, name);
  return node;
}

describe('MC/DC still-hot2 unique-cause: simplify round number precision (css-values-4 § 10.6 #round-func / § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('precision.unit === "number" T with val.unit !== precision.unit F: fold after constructor-valid same-type tree', () => {
    // Existing rows: FF leftover round(15px, 10em); TF same-unit fold (number skipped).
    // Unique-cause of the OR second conjunct: units differ, precision is number.
    // CSSMathRound addTypesForSum rejects mixed number/dimension at construct time.
    const prec = CSS.px(10);
    const nearest = new CSSMathRound('nearest', CSS.px(15), prec, false);
    prec.unit = 'number';
    assert.equal(unit(simplify(nearest)).value, 20);
    assert.equal(unit(simplify(nearest)).unit, 'px');

    const upPrec = CSS.px(10);
    const up = new CSSMathRound('up', CSS.px(11), upPrec, false);
    upPrec.unit = 'number';
    assert.equal(unit(simplify(up)).value, 20);

    const downPrec = CSS.px(10);
    const down = new CSSMathRound('down', CSS.px(19), downPrec, false);
    downPrec.unit = 'number';
    assert.equal(unit(simplify(down)).value, 10);

    const tzPrec = CSS.px(10);
    const toZero = new CSSMathRound('to-zero', CSS.px(-19), tzPrec, false);
    tzPrec.unit = 'number';
    assert.equal(unit(simplify(toZero)).value, -10);

    const emPrec = CSS.em(10);
    const emRound = new CSSMathRound('nearest', CSS.em(15), emPrec, false);
    emPrec.unit = 'number';
    assert.equal(unit(simplify(emRound)).value, 20);
    assert.equal(unit(simplify(emRound)).unit, 'em');

    // Contrast FF: same-type leftover already unique-caused mixed px/em without mutation.
    const mixed = simplify(new CSSMathRound('nearest', CSS.px(15), CSS.em(10)));
    assert.ok(mixed instanceof CSSMathRound);
    assert.equal(unit(mixed.value).unit, 'px');
    assert.equal(unit(mixed.precision).unit, 'em');
  });

  test('number precision zero-step and unmatched strategy still enter the OR', () => {
    const zeroPrec = CSS.px(0);
    const zeroStep = new CSSMathRound('nearest', CSS.px(15), zeroPrec, false);
    zeroPrec.unit = 'number';
    assert.equal(unit(simplify(zeroStep)).value, 15);
    assert.equal(unit(simplify(zeroStep)).unit, 'px');

    const lwPrec = CSS.px(10);
    const lineWidth = new CSSMathRound('line-width', CSS.px(15), lwPrec, false);
    lwPrec.unit = 'number';
    assert.equal(unit(simplify(lineWidth)).value, 15);

    // Constructor-valid numbers, then mutate the value unit to a dimension.
    const val = CSS.number(15);
    const fromNumbers = new CSSMathRound('nearest', val, CSS.number(10), false);
    val.unit = 'px';
    assert.equal(unit(simplify(fromNumbers)).value, 20);
    assert.equal(unit(simplify(fromNumbers)).unit, 'px');

    const parsed = simplify(CSSNumericValue.parse('round(nearest, 15px, 10px)'));
    assert.equal(unit(parsed).value, 20);
    assert.equal(unit(parsed).unit, 'px');

    // CSSStyleValue.parse('width', 'round(...)') reifies generic CSSStyleValue
    // and does not enter simplify(); calc() wrapping does.
    const width = CSSStyleValue.parse('width', 'calc(round(15px, 10px))');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 20);
  });
});

describe('MC/DC still-hot2 unique-cause: simplify hypot base F (css-values-4 § 10.4 #funcdef-hypot / § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('unitToBase[firstUnit] F: first argument unit missing from the map', () => {
    // Existing rows all have base T (CSSUnitValue rejects unknown units at construct).
    // Unique-cause of `base` F: mutate first child after a valid hypot tree.
    const first = CSS.px(3);
    const second = CSS.px(4);
    const hypot = new CSSMathFunction('hypot', first, second);
    first.unit = 'bogus' as CSSUnit;
    const leftoverFirst = leftoverFn(simplify(hypot), 'hypot');
    assert.equal(leftoverFirst.values.length, 2);

    const only = CSS.px(5);
    const single = new CSSMathFunction('hypot', only);
    only.unit = 'bogus' as CSSUnit;
    const leftoverSingle = leftoverFn(simplify(single), 'hypot');
    assert.equal(leftoverSingle.values.length, 1);

    // Unique-cause contrast: first unit in the map, second missing → every() F (base T).
    const px = CSS.px(3);
    const other = CSS.px(4);
    const secondMissing = new CSSMathFunction('hypot', px, other);
    other.unit = 'bogus' as CSSUnit;
    leftoverFn(simplify(secondMissing), 'hypot');

    // base T, every T, compatible T: parse-time hypot folds.
    const folded = simplify(CSSNumericValue.parse('hypot(3px, 4px)'));
    assert.equal(unit(folded).value, 5);
    assert.equal(unit(folded).unit, 'px');

    const numbers = simplify(CSSNumericValue.parse('hypot(3, 4)'));
    assert.equal(unit(numbers).value, 5);
    assert.equal(unit(numbers).unit, 'number');

    const width = CSSStyleValue.parse('width', 'calc(hypot(3px, 4px))');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 5);
  });
});
