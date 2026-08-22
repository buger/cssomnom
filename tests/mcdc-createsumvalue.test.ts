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
// Verifies: SW-REQ-260821-E5D5, SW-REQ-260821-7AKJ
// Unique-cause leftovers for src/typed-om/numeric/numeric-methods.ts createSumValue
// (5/30 decisions, 16.7%). CSSUnitValue.to is overridden and does not call
// createSumValue; drive CSSNumericValue.parse / add (and sub/mul/div/min/max)
// then .to() / .toSum() on the resulting math nodes or units.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathMin,
  CSSMathMax,
  CSSMathNegate,
} from '../src/typed-om.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function sumNode(node: CSSNumericValue): CSSMathSum {
  assert.ok(node instanceof CSSMathSum, `expected CSSMathSum, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function itemAt(sum: CSSMathSum, i: number): CSSUnitValue {
  const v = sum.values.item(i);
  assert.ok(v instanceof CSSUnitValue, `expected unit at ${i}, got ${v?.constructor.name}`);
  return v;
}

function almost(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < 1e-6, `expected ${expected}, got ${actual}`);
}

describe('MC/DC unique-cause: createSumValue (css-typed-om-1 § 4.3 #dom-cssnumericvalue-to / #dom-cssnumericvalue-tosum)', { concurrency: false }, () => {
  test('unit canonicalization via toSum: length/angle/time/frequency/resolution/number', () => {
    // Unique-cause: unitToBase === 'length' && unitToPixels.
    // TT: absolute length (px/in/cm). TF: relative length (em) — pixels missing.
    // F-: non-length (deg) so the length conjunct is false (pixels skipped).
    const px = sumNode(parse('10px').toSum());
    assert.equal(itemAt(px, 0).unit, 'px');
    assert.equal(itemAt(px, 0).value, 10);

    const inches = sumNode(parse('1in').toSum());
    assert.equal(itemAt(inches, 0).unit, 'px');
    assert.equal(itemAt(inches, 0).value, 96);

    const cm = sumNode(parse('1cm').add(parse('1mm')).toSum());
    assert.equal(itemAt(cm, 0).unit, 'px');
    almost(itemAt(cm, 0).value, 37.79527559055118 + 3.7795275590551185);

    const em = sumNode(parse('2em').toSum());
    assert.equal(itemAt(em, 0).unit, 'em');
    assert.equal(itemAt(em, 0).value, 2);

    const vw = sumNode(parse('10vw').toSum());
    assert.equal(itemAt(vw, 0).unit, 'vw');

    // Unique-cause: unitToBase === 'angle' && unitToRadians. T from deg/rad/grad/turn;
    // F from em (length, pixels missing, falls through to the angle else-if).
    const deg = sumNode(parse('45deg').toSum());
    assert.equal(itemAt(deg, 0).unit, 'deg');
    assert.equal(itemAt(deg, 0).value, 45);

    const turn = sumNode(parse('1deg').add(parse('1turn')).toSum());
    assert.equal(itemAt(turn, 0).unit, 'deg');
    almost(itemAt(turn, 0).value, 361);

    const rad = sumNode(parse('1rad').toSum());
    assert.equal(itemAt(rad, 0).unit, 'deg');
    almost(itemAt(rad, 0).value, 180 / Math.PI);

    const grad = sumNode(parse('100grad').toSum());
    assert.equal(itemAt(grad, 0).unit, 'deg');
    almost(itemAt(grad, 0).value, 90);

    // Unique-cause: unitToBase === 'time' && unitToSeconds.
    const seconds = sumNode(parse('1s').add(parse('500ms')).toSum());
    assert.equal(itemAt(seconds, 0).unit, 's');
    almost(itemAt(seconds, 0).value, 1.5);

    const ms = sumNode(parse('500ms').toSum());
    assert.equal(itemAt(ms, 0).unit, 's');
    almost(itemAt(ms, 0).value, 0.5);

    // Unique-cause: unit === 'khz' T vs F (hz is frequency, not khz).
    const khz = sumNode(parse('1khz').toSum());
    assert.equal(itemAt(khz, 0).unit, 'hz');
    assert.equal(itemAt(khz, 0).value, 1000);

    const hz = sumNode(parse('1hz').toSum());
    assert.equal(itemAt(hz, 0).unit, 'hz');
    assert.equal(itemAt(hz, 0).value, 1);

    const khzHz = sumNode(parse('1khz').add(parse('1hz')).toSum());
    assert.equal(itemAt(khzHz, 0).unit, 'hz');
    assert.equal(itemAt(khzHz, 0).value, 1001);

    // Unique-cause: unit === 'dpi' / 'dpcm' / 'x' each T vs F (dppx falls through).
    const dpi = sumNode(parse('96dpi').toSum());
    assert.equal(itemAt(dpi, 0).unit, 'dppx');
    almost(itemAt(dpi, 0).value, 1);

    const dpcm = sumNode(parse('2.54dpcm').toSum());
    assert.equal(itemAt(dpcm, 0).unit, 'dppx');
    almost(itemAt(dpcm, 0).value, 2.54 / (96 / 2.54));

    const x = sumNode(parse('2x').toSum());
    assert.equal(itemAt(x, 0).unit, 'dppx');
    assert.equal(itemAt(x, 0).value, 2);

    const dppx = sumNode(parse('2dppx').toSum());
    assert.equal(itemAt(dppx, 0).unit, 'dppx');
    assert.equal(itemAt(dppx, 0).value, 2);

    const dpiX = sumNode(parse('96dpi').add(parse('1x')).toSum());
    assert.equal(itemAt(dpiX, 0).unit, 'dppx');
    almost(itemAt(dpiX, 0).value, 2);

    // Unique-cause: unit !== 'number' F (unitless) vs T (percent / flex).
    const num = sumNode(parse('12').toSum());
    assert.equal(itemAt(num, 0).unit, 'number');
    assert.equal(itemAt(num, 0).value, 12);

    const pct = sumNode(parse('50%').toSum());
    assert.equal(itemAt(pct, 0).unit, 'percent');
    assert.equal(itemAt(pct, 0).value, 50);

    const fr = sumNode(parse('1fr').toSum());
    assert.equal(itemAt(fr, 0).unit, 'fr');
  });

  test('CSSMathSum: merge same unit maps, leftover mixed units, itemSum null', () => {
    // Unique-cause: existing unit-map match T (1px + 1in both become px) vs F (px + em).
    const merged = sumNode(parse('calc(1px + 1in)').toSum());
    assert.equal(merged.values.length, 1);
    assert.equal(itemAt(merged, 0).unit, 'px');
    assert.equal(itemAt(merged, 0).value, 97);

    const leftover = parse('calc(1px + 2em)').add(parse('3px'));
    const leftoverSum = sumNode(leftover.toSum('px', 'em'));
    assert.equal(leftoverSum.values.length, 2);
    assert.equal(itemAt(leftoverSum, 0).unit, 'px');
    assert.equal(itemAt(leftoverSum, 0).value, 4);
    assert.equal(itemAt(leftoverSum, 1).unit, 'em');
    assert.equal(itemAt(leftoverSum, 1).value, 2);

    const three = parse('calc(1px + 2em)').add(parse('4%'));
    const threeSum = sumNode(three.toSum('px', 'em', 'percent'));
    assert.equal(threeSum.values.length, 3);

    // Unique-cause: !itemSum T — a summand whose createSumValue returns null (leftover min).
    const leftoverMin = parse('min(1px, 2em)');
    assert.ok(leftoverMin instanceof CSSMathMin);
    assert.throws(() => leftoverMin.add(CSS.px(1)).toSum(), TypeError);

    // Nested sum via add of two mixed sums (numericAdd flattens CSSMathSum args).
    const nested = parse('calc(1px + 2em)').add(parse('calc(3px + 4em)'));
    const nestedSum = sumNode(nested.toSum('px', 'em'));
    assert.equal(itemAt(nestedSum, 0).value, 4);
    assert.equal(itemAt(nestedSum, 1).value, 6);
  });

  test('CSSMathNegate via sub: success vs createSumValue-null child', () => {
    // Unique-cause: node instanceof CSSMathNegate T. Parse folds calc(-10px) into a unit,
    // so sub() of a same-unit min keeps a negate node.
    const negOk = CSS.px(0).sub(parse('min(10px, 2px)'));
    assert.ok(negOk instanceof CSSMathSum);
    assert.ok([...negOk.values].some((n) => n instanceof CSSMathNegate));
    const folded = unit(negOk.to('px'));
    assert.equal(folded.value, -2);
    assert.equal(folded.unit, 'px');

    // Unique-cause: !sum T on the negate child (leftover min cannot create a sum value).
    const negFail = CSS.px(0).sub(parse('min(1px, 2em)'));
    assert.throws(() => negFail.toSum(), TypeError);
    assert.throws(() => negFail.to('px'), TypeError);
  });

  test('CSSMathInvert via parse/div: single term, mixed-sum length>1, leftover null', () => {
    // Unique-cause: node instanceof CSSMathInvert T (product of 1 and invert(2px)).
    // !sum || sum.length > 1 is FF — invert of a single unit succeeds inside createSumValue
    // but toSum still fails because the inverted power is not 1.
    const invertPx = parse('calc(1 / 2px)');
    assert.ok(invertPx instanceof CSSMathProduct);
    assert.throws(() => invertPx.toSum(), TypeError);

    // Unique-cause: sum.length > 1 T — invert of a mixed leftover sum.
    const invertMixed = parse('calc(1 / (1px + 2em))');
    assert.ok(invertMixed instanceof CSSMathProduct);
    assert.throws(() => invertMixed.toSum(), TypeError);
    assert.throws(() => CSS.number(1).div(parse('calc(1px + 2em)')).toSum(), TypeError);

    // Unique-cause: !sum T — invert of leftover min (createSumValue of min(px, em) is null).
    const invertLeftover = parse('calc(1 / min(1px, 2em))');
    assert.throws(() => invertLeftover.toSum(), TypeError);
    assert.throws(() => CSS.number(1).div(parse('min(1px, 2em)')).toSum(), TypeError);

    // Invert of a same-unit min still yields a single-item inverted map (length > 1 is F).
    assert.throws(() => parse('calc(1 / min(10px, 2px))').to('px'), TypeError);
  });

  test('CSSMathProduct: scale leftover min, unit cancellation, leftover nextSum', () => {
    // Unique-cause: node instanceof CSSMathProduct T. Product of leftover-same-unit min * number.
    const scaled = parse('min(10px, 2px)').mul(2);
    assert.ok(scaled instanceof CSSMathProduct);
    const scaledUnit = unit(scaled.to('px'));
    assert.equal(scaledUnit.value, 4);
    assert.equal(scaledUnit.unit, 'px');

    // Unique-cause: newUnitMap.get(u) === 0 T — px * (1 / 2px) cancels the length power.
    const cancelled = CSS.px(10).mul(parse('calc(1 / 2px)'));
    assert.ok(cancelled instanceof CSSMathProduct);
    const cancelledUnit = unit(cancelled.to('number'));
    assert.equal(cancelledUnit.value, 5);
    assert.equal(cancelledUnit.unit, 'number');

    // Unique-cause: newUnitMap.get(u) === 0 F — px * em never hits power 0.
    const area = parse('calc(2px * 3em)');
    assert.ok(area instanceof CSSMathProduct);
    assert.throws(() => area.toSum(), TypeError);

    // Unique-cause: !nextSum T — product containing leftover min (createSumValue null).
    const prodLeftover = parse('calc(2 * min(1px, 2em))');
    assert.ok(prodLeftover instanceof CSSMathProduct);
    assert.throws(() => prodLeftover.toSum(), TypeError);
  });

  test('CSSMathMin / CSSMathMax: fold same unit, leftover maps, length>1 args, un-summable args', () => {
    // Unique-cause: args.some(!a || a.length > 1) F and unit-maps-equal F vs T.
    const minSame = unit(parse('min(10px, 2px)').to('px'));
    assert.equal(minSame.value, 2);
    const minSameSum = sumNode(parse('min(10px, 2px)').toSum());
    assert.equal(itemAt(minSameSum, 0).value, 2);

    const maxSame = unit(parse('max(10px, 2px)').to('px'));
    assert.equal(maxSame.value, 10);
    const maxEm = unit(parse('max(1em, 2em)').to('em'));
    assert.equal(maxEm.value, 2);

    // Canonical absolute lengths share a unit map after createSumValue.
    const minAbs = unit(parse('min(1in, 10px)').to('px'));
    assert.equal(minAbs.value, 10);

    // Unique-cause: unit maps not equal T — leftover relative vs absolute.
    const minMixed = parse('min(1px, 2em)');
    assert.throws(() => minMixed.to('px'), TypeError);
    assert.throws(() => minMixed.toSum(), TypeError);
    const maxMixed = parse('max(1px, 2em)');
    assert.throws(() => maxMixed.to('px'), TypeError);

    // Unique-cause: args.some length>1 T — min/max of a mixed leftover sum.
    const minSum = parse('min(calc(1px + 2em), 3px)');
    assert.ok(minSum instanceof CSSMathMin);
    assert.throws(() => minSum.to('px'), TypeError);
    const maxSum = parse('max(calc(1px + 2em), 3px)');
    assert.ok(maxSum instanceof CSSMathMax);
    assert.throws(() => maxSum.to('px'), TypeError);

    // Unique-cause: args.some !a T — child whose createSumValue is null (round / abs).
    assert.throws(() => parse('min(round(1.2px, 1px), 2px)').to('px'), TypeError);
    assert.throws(() => parse('min(abs(1px), 2px)').to('px'), TypeError);

    const minPct = sumNode(parse('min(1%, 2%)').toSum());
    assert.equal(itemAt(minPct, 0).unit, 'percent');
    assert.equal(itemAt(minPct, 0).value, 1);
  });

  test('CSSMathClamp: fold, keyword none, mixed maps, leftover sums, un-summable children', () => {
    // Unique-cause: node instanceof CSSMathClamp T. Success path (maps equal, single-term).
    const mid = unit(parse('clamp(10px, 15px, 20px)').to('px'));
    assert.equal(mid.value, 15);
    const low = unit(parse('clamp(10px, 5px, 20px)').to('px'));
    assert.equal(low.value, 10);
    const high = unit(parse('clamp(10px, 25px, 20px)').to('px'));
    assert.equal(high.value, 20);
    const absClamp = unit(parse('clamp(1in, 10px, 2cm)').to('px'));
    assert.equal(absClamp.value, 96);

    // Unique-cause: lower/upper instanceof CSSKeywordValue TF / FT / TT vs FF.
    assert.throws(() => parse('clamp(none, 10px, 20px)').toSum(), TypeError);
    assert.throws(() => parse('clamp(10px, 15px, none)').toSum(), TypeError);
    assert.throws(() => parse('clamp(none, 15px, none)').toSum(), TypeError);

    // Unique-cause: !lowerSum T (leftover min) vs lowerSum.length > 1 T (mixed sum).
    assert.throws(() => parse('clamp(min(1px, 2em), 3px, 4px)').to('px'), TypeError);
    assert.throws(() => parse('clamp(calc(1px + 2em), 3px, 4px)').to('px'), TypeError);

    // Unique-cause: !valueSum T vs valueSum.length > 1 T.
    assert.throws(() => parse('clamp(1px, min(1px, 2em), 4px)').to('px'), TypeError);
    assert.throws(() => parse('clamp(1px, calc(2px + 3em), 4px)').to('px'), TypeError);

    // Unique-cause: !upperSum T vs upperSum.length > 1 T.
    assert.throws(() => parse('clamp(1px, 2px, min(1px, 2em))').to('px'), TypeError);
    assert.throws(() => parse('clamp(1px, 2px, calc(3px + 4em))').to('px'), TypeError);

    // Unique-cause: areUnitMapsEqual(lower, value) F — lower px vs value em.
    assert.throws(() => parse('clamp(1px, 2em, 3px)').to('px'), TypeError);
    // Unique-cause: areUnitMapsEqual(upper, value) F — lower/value px, upper em.
    assert.throws(() => parse('clamp(1px, 2px, 3em)').to('px'), TypeError);
    assert.throws(() => parse('clamp(1em, 2px, 3px)').to('px'), TypeError);
  });

  test('fallthrough null: round, abs, hypot are not a sum value (CSSMathClamp F)', () => {
    // Unique-cause: node instanceof CSSMathClamp F after failing unit/sum/negate/invert/product/min/max.
    assert.throws(() => parse('round(1.2px, 1px)').toSum(), TypeError);
    assert.throws(() => parse('abs(-10px)').to('px'), TypeError);
    assert.throws(() => parse('hypot(3px, 4px)').toSum(), TypeError);
  });
});
