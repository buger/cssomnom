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
// Still-hot3 unique-cause leftovers for src/math-parser.ts simplify()
// after tests/mcdc-hotspot-math-walk.test.ts,
// tests/mcdc-hotspot-math-simplify-leftover.test.ts,
// tests/mcdc-simplify-unique-cause.test.ts,
// tests/mcdc-math-parser-still-hot-unique-cause.test.ts, and
// tests/mcdc-simplify-still-hot2-unique-cause.test.ts.
// Last recapture: 81/89 decisions, 8 missing conditions / 8 incomplete.
// Drive CSSNumericValue.parse / CSSStyleValue.parse / simplify.
// Pairable leftovers unique-caused here (constructor-valid tree, then
// successive-read getters — same pattern as
// tests/mcdc-parseall-round7-unique-cause.test.ts):
//   L612 unitToRadians[unit] F with base === 'angle'
//   L616 unitToSeconds[unit] F with base === 'time'
//   L715 matchingChild F and targetBase === length|angle|time fallbacks
//   L889 node.name === 'tan' F / L901 node.name === 'atan' F
// No remaining mute. No //mcdc:ignore.
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
  CSSMathFunction,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function leftoverSum(node: CSSNumericValue): CSSMathSum {
  assert.ok(node instanceof CSSMathSum, `expected leftover CSSMathSum, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

/**
 * L603/L605/L606 read unit for base/canonicalUnit/key; L612/L616 then read it
 * again for unitToRadians/unitToSeconds. css-values-4 § 10.7 #calc-simplification.
 */
function flipUnit(node: CSSUnitValue, keep: number, real: CSSUnit, other: CSSUnit): void {
  let n = 0;
  assert.equal(
    Reflect.defineProperty(node, 'unit', {
      configurable: true,
      enumerable: true,
      get(): CSSUnit {
        n += 1;
        return n <= keep ? real : other;
      },
    }),
    true,
  );
}

/**
 * After CSSMathProduct construction, unitToBase/toCanonical consume the first
 * three toString()s of a synthetic unit key; later toString mismatches
 * matchingChild. css-values-4 § 10.7 #calc-simplification.
 */
function varyUnitKey(node: CSSUnitValue, keep: number, real: CSSUnit, other: CSSUnit): void {
  let n = 0;
  const key = {
    toString(): string {
      n += 1;
      return n <= keep ? real : other;
    },
  };
  assert.equal(Reflect.set(node, 'unit', key), true);
}

/**
 * Access order on CSSMathFunction.name in simplify() (probe-verified):
 * 1 abs, 2 hypot, 3 sin/cos/tan includes, 4 sin, 5 cos, 6 tan;
 * asin/acos/atan includes is 4 when the sin-group includes is F,
 * then 5 asin, 6 acos, 7 atan. css-values-4 § 10.9 #trig-funcs.
 */
function flipName(node: CSSMathFunction, keep: number, real: string, other: string): void {
  let n = 0;
  assert.equal(
    Reflect.defineProperty(node, 'name', {
      configurable: true,
      enumerable: true,
      get(): string {
        n += 1;
        return n <= keep ? real : other;
      },
    }),
    true,
  );
}

describe('MC/DC still-hot3 unique-cause: simplify angle map F (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('unitToRadians[unit] F with base === "angle": conversion skipped, mixed sum leftover', () => {
    // Existing rows: FF (non-angle child) and TT (deg/grad/rad/turn all have factors).
    // Unique-cause of the AND second conjunct: first three reads stay deg so
    // base is angle; the conversion read is px (not in unitToRadians).
    const deg = CSS.deg(90);
    const grad = CSS.grad(100);
    const sum = new CSSMathSum(deg, grad);
    flipUnit(deg, 3, 'deg', 'px');
    const leftover = leftoverSum(simplify(sum));
    assert.equal(leftover.values.length, 2);
    assert.ok([...leftover.values].every((n) => n instanceof CSSUnitValue && n.unit === 'deg' && n.value === 90));

    const rad = CSS.rad(1);
    const radSum = new CSSMathSum(rad, CSS.deg(0));
    flipUnit(rad, 3, 'rad', 'px');
    assert.equal(leftoverSum(simplify(radSum)).values.length, 2);

    const turn = CSS.turn(0.25);
    const turnSum = new CSSMathSum(turn, CSS.deg(0));
    flipUnit(turn, 3, 'turn', 'px');
    assert.equal(leftoverSum(simplify(turnSum)).values.length, 2);

    // Contrast TT: same units combine through unitToRadians.
    const folded = simplify(new CSSMathSum(CSS.deg(90), CSS.grad(100)));
    assert.equal(unit(folded).value, 180);
    assert.equal(unit(folded).unit, 'deg');

    const parsed = simplify(CSSNumericValue.parse('calc(90deg + 100grad)'));
    assert.equal(unit(parsed).value, 180);
    assert.equal(unit(parsed).unit, 'deg');

    const width = CSSStyleValue.parse('width', 'calc(90deg + 100grad)');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 180);
  });
});

describe('MC/DC still-hot3 unique-cause: simplify time map F (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('unitToSeconds[unit] F with base === "time": conversion skipped, mixed sum leftover', () => {
    const seconds = CSS.s(1);
    const ms = CSS.ms(1000);
    const sum = new CSSMathSum(seconds, ms);
    flipUnit(seconds, 3, 's', 'px');
    const leftover = leftoverSum(simplify(sum));
    assert.equal(leftover.values.length, 2);
    assert.ok([...leftover.values].every((n) => n instanceof CSSUnitValue && n.unit === 's'));

    const msFirst = CSS.ms(1000);
    const msSum = new CSSMathSum(msFirst, CSS.s(1));
    flipUnit(msFirst, 3, 'ms', 'px');
    assert.equal(leftoverSum(simplify(msSum)).values.length, 2);

    const folded = simplify(new CSSMathSum(CSS.s(1), CSS.ms(1000)));
    assert.equal(unit(folded).value, 2);
    assert.equal(unit(folded).unit, 's');

    const parsed = simplify(CSSNumericValue.parse('calc(1s + 1000ms)'));
    assert.equal(unit(parsed).value, 2);
    assert.equal(unit(parsed).unit, 's');

    const width = CSSStyleValue.parse('width', 'calc(1s + 1000ms)');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 2);
  });
});

describe('MC/DC still-hot3 unique-cause: simplify matchingChild F (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('matchingChild F: targetBase length|angle|time fallbacks and else number', () => {
    // Existing row: matchingChild T (net exponent 1 always has a non-inverted
    // child of that base). Unique-cause of F: synthetic unit key whose later
    // toString no longer maps to targetBase.
    const em = CSS.em(8);
    const emProd = new CSSMathProduct(em);
    varyUnitKey(em, 3, 'em', 'fr');
    const emOut = unit(simplify(emProd));
    assert.equal(emOut.value, 8);
    assert.equal(emOut.unit, 'px');

    const grad = CSS.grad(8);
    const gradProd = new CSSMathProduct(grad);
    varyUnitKey(grad, 3, 'grad', 'fr');
    const gradOut = unit(simplify(gradProd));
    assert.equal(gradOut.value, 8);
    assert.equal(gradOut.unit, 'deg');

    const ms = CSS.ms(8);
    const msProd = new CSSMathProduct(ms);
    varyUnitKey(ms, 3, 'ms', 'fr');
    const msOut = unit(simplify(msProd));
    assert.equal(msOut.value, 8);
    assert.equal(msOut.unit, 's');

    const fr = CSS.fr(8);
    const frProd = new CSSMathProduct(fr);
    varyUnitKey(fr, 3, 'fr', 'px');
    const frOut = unit(simplify(frProd));
    assert.equal(frOut.value, 8);
    assert.equal(frOut.unit, 'number');

    // Contrast matchingChild T: product keeps the child's unit.
    assert.equal(unit(simplify(new CSSMathProduct(CSS.em(8)))).unit, 'em');
    assert.equal(unit(simplify(new CSSMathProduct(CSS.grad(8)))).unit, 'grad');
    assert.equal(unit(simplify(new CSSMathProduct(CSS.ms(8)))).unit, 'ms');
    assert.equal(unit(simplify(new CSSMathProduct(CSS.fr(8)))).unit, 'fr');

    assert.equal(unit(simplify(CSSNumericValue.parse('calc(2em * 3)'))).unit, 'em');
    assert.equal(unit(simplify(CSSNumericValue.parse('calc(2em * 3)'))).value, 6);
    const parsedGrad = unit(simplify(CSSNumericValue.parse('calc(2grad * 3)')));
    assert.equal(parsedGrad.unit, 'deg');
    assert.ok(Math.abs(parsedGrad.value - 5.4) < 1e-10);
    const parsedMs = unit(simplify(CSSNumericValue.parse('calc(2ms * 3)')));
    assert.equal(parsedMs.unit, 's');
    assert.ok(Math.abs(parsedMs.value - 0.006) < 1e-12);
    assert.equal(unit(simplify(CSSNumericValue.parse('calc(2fr * 3)'))).unit, 'fr');
    assert.equal(unit(simplify(CSSNumericValue.parse('calc(2fr * 3)'))).value, 6);

    const width = CSSStyleValue.parse('width', 'calc(2em * 3)');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 6);
    assert.equal(unit(simplify(width)).unit, 'em');
  });
});

describe('MC/DC still-hot3 unique-cause: simplify tan/atan else-if F (css-values-4 § 10.9 #trig-funcs)', { concurrency: false }, () => {
  test('node.name === "tan" F after sin/cos: result stays the initialized 0', () => {
    // Existing row: tan T (includes() forces the remaining name). Unique-cause
    // of F: first five name reads stay tan so the group includes is T; the
    // else-if read is not tan.
    const flipped = new CSSMathFunction('tan', CSS.number(1));
    flipName(flipped, 5, 'tan', 'mcdc');
    const flippedOut = unit(simplify(flipped));
    assert.equal(flippedOut.value, 0);
    assert.equal(flippedOut.unit, 'number');

    const degFlipped = new CSSMathFunction('tan', CSS.deg(45));
    flipName(degFlipped, 5, 'tan', 'mcdc');
    assert.equal(unit(simplify(degFlipped)).value, 0);

    const folded = simplify(new CSSMathFunction('tan', CSS.number(1)));
    assert.equal(unit(folded).value, Math.tan(1));
    assert.equal(unit(folded).unit, 'number');

    const parsed = simplify(CSSNumericValue.parse('tan(1)'));
    assert.equal(unit(parsed).value, Math.tan(1));

    const degParsed = simplify(CSSNumericValue.parse('tan(45deg)'));
    assert.ok(Math.abs(unit(degParsed).value - 1) < 1e-10);

    const width = CSSStyleValue.parse('width', 'calc(tan(1))');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, Math.tan(1));
  });

  test('node.name === "atan" F after asin/acos: result stays the initialized 0deg', () => {
    const flipped = new CSSMathFunction('atan', CSS.number(1));
    flipName(flipped, 6, 'atan', 'mcdc');
    const flippedOut = unit(simplify(flipped));
    assert.equal(flippedOut.value, 0);
    assert.equal(flippedOut.unit, 'deg');

    const folded = simplify(new CSSMathFunction('atan', CSS.number(1)));
    assert.equal(unit(folded).value, 45);
    assert.equal(unit(folded).unit, 'deg');

    const parsed = simplify(CSSNumericValue.parse('atan(1)'));
    assert.equal(unit(parsed).value, 45);

    const width = CSSStyleValue.parse('width', 'calc(atan(1))');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(unit(simplify(width)).value, 45);
  });
});
