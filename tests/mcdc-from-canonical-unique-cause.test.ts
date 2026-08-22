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
// Verifies: SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5
// Leftover unique-cause for src/math-parser.ts fromCanonical after last
// recapture 4/7 D, 7/11 C, incomplete 3 (top-8 hotspot; next seam L64
// targetUnit === "dppx" || targetUnit === "x"). Existing
// tests/mcdc-math-parser-leftover-unique-cause.test.ts samples dppx T
// (x skipped) and x T, but unique-cause of the OR also needs FF, and
// L57 unitToRadians / L59 unitToSeconds F with base T.
// Drive CSSNumericValue.parse / CSSStyleValue.parse / simplify.
// Pairable leftovers unique-caused here (every spec resolution/angle/time
// unit is in the conversion maps, so a stable CSSUnit string cannot
// evaluate L64 FF / L57 unitToRadians F / L59 unitToSeconds F):
//   L64 dppx||x FF via boxed targetUnit after keep=7/8 string reads
//   L57 unitToRadians F with base === "angle" via boxed keep=6
//   L59 unitToSeconds F with base === "time" via boxed keep=6
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
  CSSMathClamp,
  CSSMathFunction,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function sumUnit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSMathSum, `expected CSSMathSum wrap, got ${node.constructor.name} (${node.toString()})`);
  assert.equal(node.values.length, 1);
  return unit(node.values[0] as CSSNumericValue);
}

/**
 * fromCanonical receives a snapshotted targetUnit. A getter that yields
 * strings through toCanonical then a boxed key makes L61–64 `===` F
 * (objects never equal those unit strings) while unitToBase still maps
 * via toString. keep is probe-verified. css-values-4 § 10.7.
 */
function flipToBoxed(node: CSSUnitValue, keep: number, real: CSSUnit, boxed: object): void {
  let n = 0;
  assert.equal(
    Reflect.defineProperty(node, 'unit', {
      configurable: true,
      enumerable: true,
      get(): CSSUnit | object {
        n += 1;
        return n <= keep ? real : boxed;
      },
    }),
    true,
  );
}

describe('MC/DC leftover unique-cause: fromCanonical resolution (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {

  test('L64 dppx T / x T via real CSS product and sum (dpi/dpcm return before the OR)', () => {
    // Unique-cause: targetUnit === 'dppx' T, x skipped. parse-time
    // combineProductTerms / combineSumTerms call fromCanonical with the
    // first child's unit. simplify of a sum canonicalizes to dpi and
    // never calls fromCanonical.
    const dppxProd = sumUnit(parse('calc(2dppx * 3)'));
    assert.equal(dppxProd.value, 6);
    assert.equal(dppxProd.unit, 'dppx');
    const dppxSum = sumUnit(parse('calc(2dppx + 96dpi)'));
    assert.equal(dppxSum.value, 3);
    assert.equal(dppxSum.unit, 'dppx');

    // Unique-cause: dppx F, x T.
    const xProd = sumUnit(parse('calc(2x * 3)'));
    assert.equal(xProd.value, 6);
    assert.equal(xProd.unit, 'x');
    const xSum = sumUnit(parse('calc(2x + 96dpi)'));
    assert.equal(xSum.value, 3);
    assert.equal(xSum.unit, 'x');

    // dpi T / dpcm T return before L64, so the OR is not evaluated.
    const dpi = sumUnit(parse('calc(2dpi * 3)'));
    assert.equal(dpi.value, 6);
    assert.equal(dpi.unit, 'dpi');
    const dpcm = sumUnit(parse('calc(2dpcm * 3)'));
    assert.equal(dpcm.value, 6);
    assert.equal(dpcm.unit, 'dpcm');

    assert.equal(unit(simplify(new CSSMathProduct(CSS.dppx(2), CSS.number(3)))).unit, 'dppx');
    assert.equal(unit(simplify(new CSSMathProduct(new CSSUnitValue(2, 'x'), CSS.number(3)))).unit, 'x');
    assert.equal(unit(simplify(new CSSMathClamp(CSS.dppx(1), CSS.dppx(2), CSS.dppx(3)))).value, 2);
    assert.equal(unit(simplify(new CSSMathClamp(new CSSUnitValue(1, 'x'), new CSSUnitValue(2, 'x'), new CSSUnitValue(3, 'x')))).value, 2);
    assert.equal(unit(simplify(new CSSMathFunction('mod', CSS.dppx(3), CSS.dppx(2)))).value, 1);
    assert.equal(unit(simplify(new CSSMathFunction('mod', new CSSUnitValue(3, 'x'), new CSSUnitValue(2, 'x')))).value, 1);

    const widthPx = CSSStyleValue.parse('width', 'calc(2px * 3)');
    assert.ok(widthPx instanceof CSSMathSum);
    assert.equal(sumUnit(widthPx).value, 6);
  });

  test('L64 dppx||x FF: boxed targetUnit so === is F while unitToBase still maps', () => {
    // Existing rows: dppx T (x skipped) and dppx F / x T. Unique-cause of
    // either conjunct needs FF. Every spec resolution unit is one of the
    // four names, and dpi/dpcm return before the OR, so a stable CSSUnit
    // string cannot evaluate FF. Pairable leftover: successive-read
    // getter then a boxed key (objects never === 'dppx'|'x').
    // Probe-verified keep=7: toCanonical still sees string 'dppx' (*96);
    // targetUnit then becomes boxed so L64 === is FF and /96 is skipped
    // (192 vs 2). keep=8 on 'x' is one extra toCanonical read because
    // dppx F does not short-circuit the OR.
    const lo = CSS.dppx(1);
    const mid = CSS.dppx(2);
    const hi = CSS.dppx(3);
    const boxed = { toString(): string { return 'dppx'; } };
    flipToBoxed(mid, 7, 'dppx', boxed);
    const skipped = unit(simplify(new CSSMathClamp(lo, mid, hi)));
    assert.equal(skipped.value, 192);

    const xLo = new CSSUnitValue(1, 'x');
    const xMid = new CSSUnitValue(2, 'x');
    const xHi = new CSSUnitValue(3, 'x');
    const boxedX = { toString(): string { return 'x'; } };
    flipToBoxed(xMid, 8, 'x', boxedX);
    const skippedX = unit(simplify(new CSSMathClamp(xLo, xMid, xHi)));
    assert.equal(skippedX.value, 192);

    const folded = unit(simplify(new CSSMathClamp(CSS.dppx(1), CSS.dppx(2), CSS.dppx(3))));
    assert.equal(folded.value, 2);
    assert.equal(folded.unit, 'dppx');
    const foldedX = unit(simplify(new CSSMathClamp(
      new CSSUnitValue(1, 'x'),
      new CSSUnitValue(2, 'x'),
      new CSSUnitValue(3, 'x'),
    )));
    assert.equal(foldedX.value, 2);
    assert.equal(foldedX.unit, 'x');

    const modA = CSS.dppx(3);
    const modB = CSS.dppx(2);
    const boxedMod = { toString(): string { return 'dppx'; } };
    flipToBoxed(modA, 7, 'dppx', boxedMod);
    const skippedMod = unit(simplify(new CSSMathFunction('mod', modA, modB)));
    assert.equal(skippedMod.value, 96);
    assert.equal(unit(simplify(new CSSMathFunction('mod', CSS.dppx(3), CSS.dppx(2)))).value, 1);
  });
});

describe('MC/DC leftover unique-cause: fromCanonical angle/time map F (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('L57 unitToRadians F with base === "angle"', () => {
    // Existing rows: FF (non-angle, second conjunct skipped) and TT
    // (deg/grad/rad/turn all have factors). Unique-cause of the AND
    // second conjunct: every angle unit is in unitToRadians, so a
    // stable CSSUnit string cannot evaluate TF. Pairable leftover:
    // successive-read boxed key (same pattern as
    // tests/mcdc-simplify-still-hot3-unique-cause.test.ts).
    // Probe-verified keep=6 on clamp(10grad, 20grad, 30grad): toCanonical
    // converts to deg (18); fromCanonical then sees boxed toString
    // 'grad' then 'px' so unitToRadians F and the value stays 18deg
    // instead of converting back to 20grad.
    const lo = CSS.grad(10);
    const mid = CSS.grad(20);
    const hi = CSS.grad(30);
    let boxedReads = 0;
    const boxed = {
      toString(): string {
        boxedReads += 1;
        return boxedReads <= 1 ? 'grad' : 'px';
      },
    };
    flipToBoxed(mid, 6, 'grad', boxed);
    const skipped = unit(simplify(new CSSMathClamp(lo, mid, hi)));
    assert.equal(skipped.value, 18);

    const folded = unit(simplify(new CSSMathClamp(CSS.grad(10), CSS.grad(20), CSS.grad(30))));
    assert.equal(folded.value, 20);
    assert.equal(folded.unit, 'grad');

    const parsed = sumUnit(parse('calc(2grad * 3)'));
    assert.equal(parsed.value, 6);
    assert.equal(parsed.unit, 'grad');
    const rad = sumUnit(parse('calc(2rad * 3)'));
    assert.equal(rad.unit, 'rad');
    const turn = sumUnit(parse('calc(2turn * 3)'));
    assert.equal(turn.unit, 'turn');
    const deg = sumUnit(parse('calc(2deg * 3)'));
    assert.equal(deg.value, 6);
    assert.equal(deg.unit, 'deg');

    const width = CSSStyleValue.parse('width', 'calc(90deg + 100grad)');
    assert.ok(width instanceof CSSMathSum);
  });

  test('L59 unitToSeconds F with base === "time"', () => {
    // Existing rows: FF (non-time, second conjunct skipped) and TT
    // (s/ms both have factors). Unique-cause of the AND second
    // conjunct: only s/ms are time units, both are in unitToSeconds.
    // Probe-verified keep=6: 20ms canonicalizes to 0.02s; fromCanonical
    // then skips unitToSeconds so the value stays 0.02 instead of 20ms.
    const lo = CSS.ms(10);
    const mid = CSS.ms(20);
    const hi = CSS.ms(30);
    let boxedReads = 0;
    const boxed = {
      toString(): string {
        boxedReads += 1;
        return boxedReads <= 1 ? 'ms' : 'px';
      },
    };
    flipToBoxed(mid, 6, 'ms', boxed);
    const skipped = unit(simplify(new CSSMathClamp(lo, mid, hi)));
    assert.ok(Math.abs(skipped.value - 0.02) < 1e-12);

    const folded = unit(simplify(new CSSMathClamp(CSS.ms(10), CSS.ms(20), CSS.ms(30))));
    assert.equal(folded.value, 20);
    assert.equal(folded.unit, 'ms');

    const parsedMs = sumUnit(parse('calc(2ms * 3)'));
    assert.equal(parsedMs.value, 6);
    assert.equal(parsedMs.unit, 'ms');
    const parsedS = sumUnit(parse('calc(2s * 3)'));
    assert.equal(parsedS.value, 6);
    assert.equal(parsedS.unit, 's');
    assert.equal(unit(simplify(parse('mod(10ms, 3ms)'))).value, 1);

    const width = CSSStyleValue.parse('width', 'calc(1s + 1000ms)');
    assert.ok(width instanceof CSSMathSum);
  });
});

describe('MC/DC leftover unique-cause: fromCanonical length AND and fallthrough (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('length && unitToPixels TT vs TF vs non-length fallthrough', () => {
    // TT: absolute length in unitToPixels. fromCanonical divides by the
    // factor so mixed px+in combine, and same-unit product keeps px.
    const mixed = sumUnit(parse('calc(1px + 1in)'));
    assert.equal(mixed.value, 97);
    assert.equal(mixed.unit, 'px');
    const px = sumUnit(parse('calc(2px * 3)'));
    assert.equal(px.value, 6);
    assert.equal(px.unit, 'px');
    const cm = sumUnit(parse('calc(2cm * 3)'));
    assert.equal(cm.unit, 'cm');

    // TF: relative length is base length but not in unitToPixels, so
    // fromCanonical returns the raw sum (already complete; contrast).
    const em = sumUnit(parse('calc(2em * 3)'));
    assert.equal(em.value, 6);
    assert.equal(em.unit, 'em');
    const emSum = sumUnit(parse('calc(1em + 2em)'));
    assert.equal(emSum.value, 3);
    assert.equal(emSum.unit, 'em');

    // Fallthrough: not length/angle/time/resolution (percent / flex /
    // frequency / number). fromCanonical returns value unchanged.
    const pct = sumUnit(parse('calc(10% + 15%)'));
    assert.equal(pct.value, 25);
    assert.equal(pct.unit, 'percent');
    const fr = sumUnit(parse('calc(1fr + 2fr)'));
    assert.equal(fr.value, 3);
    assert.equal(fr.unit, 'fr');
    const hz = unit(simplify(new CSSMathProduct(CSS.Hz(2), CSS.number(3))));
    assert.equal(hz.value, 6);
    assert.equal(hz.unit, 'hz');
    const num = sumUnit(parse('calc(2 * 3)'));
    assert.equal(num.value, 6);
    assert.equal(num.unit, 'number');

    const widthEm = CSSStyleValue.parse('width', 'calc(2em * 3)');
    assert.ok(widthEm instanceof CSSMathSum);
    assert.equal(sumUnit(widthEm).value, 6);
    assert.equal(sumUnit(widthEm).unit, 'em');
  });
});
