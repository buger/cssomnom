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
// Leftover unique-cause for src/typed-om/numeric/*.ts (CSSNumericValue,
// CSSUnitValue, CSSMath*) not already in tests/mcdc-createsumvalue.test.ts,
// tests/mcdc-hotspot-typed-om-more.test.ts, or tests/typed-om-math.test.ts.
// Drive CSSNumericValue.parse / .add/.sub/.mul/.div/.min/.max/.to/.toSum/.equals
// and CSSMath* constructors. css-typed-om-1 § 4.1–4.4. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathValue,
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
} from '../src/typed-om.ts';
import { addTypes, addTypesForSum, applyPercentHint } from '../src/typed-om/numeric/CSSNumericType.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function leftoverMin(): CSSNumericValue {
  const node = parse('min(1px, 2em)');
  assert.ok(node instanceof CSSMathMin);
  return node;
}

function leftoverMax(): CSSNumericValue {
  const node = parse('max(1px, 2em)');
  assert.ok(node instanceof CSSMathMax);
  return node;
}

function leftoverSum(): CSSMathSum {
  const node = parse('calc(1px + 2em)');
  assert.ok(node instanceof CSSMathSum);
  return node;
}

class OpenParenNumeric extends CSSNumericValue {
  serialize(): string {
    return '(unclosed';
  }
  type() {
    return { length: 1 };
  }
}

describe('MC/DC leftover unique-cause: CSSUnitValue (css-typed-om-1 § 4.2 #unitvalue-objects)', { concurrency: false }, () => {
  test('constructor typeof unit === string F via boxed object key; invalid unit T', () => {
    // Unique-cause: typeof unit === 'string' F — ToPrimitive key still resolves unitToBase.
    const boxed = { toString(): string { return 'px'; } };
    const fromObj = new CSSUnitValue(10, boxed as unknown as CSSUnit);
    assert.equal(fromObj.value, 10);
    assert.equal(fromObj.toString(), '10px');

    assert.throws(() => new CSSUnitValue(1, 'nope' as CSSUnit), TypeError);
    const upper = new CSSUnitValue(5, 'PX' as CSSUnit);
    assert.equal(upper.unit, 'px');
  });

  test('type() number / percent / dimension / !base after unit mutation', () => {
    // Unique-cause: !base || base === 'number' — number T returns {}; length F falls through.
    assert.equal(Object.keys(CSS.number(1).type()).length, 0);
    assert.equal(CSS.percent(1).type().percent, 1);
    assert.equal(CSS.px(1).type().length, 1);
    assert.equal(CSS.Hz(1).type().frequency, 1);
    assert.equal(CSS.fr(1).type().flex, 1);
    assert.equal(CSS.dpi(1).type().resolution, 1);

    const mutated = CSS.px(1);
    mutated.unit = 'bogus' as CSSUnit;
    assert.equal(Object.keys(mutated.type()).length, 0);
  });

  test('to() length pixels TF/FT/TT, resolution, frequency else, number/percent mismatch', () => {
    // Unique-cause: unitToPixels[this] T and unitToPixels[target] F (px → em).
    assert.throws(() => CSS.px(1).to('em'), TypeError);
    // Unique-cause: unitToPixels[this] F (em → px) already throws; rem/vw too.
    assert.throws(() => CSS.em(1).to('px'), TypeError);
    assert.throws(() => CSS.em(1).to('rem'), TypeError);
    // Unique-cause: both pixel factors T.
    const inches = CSS.px(96).to('in');
    assert.equal(inches.unit, 'in');
    assert.equal(inches.value, 1);
    const q = CSS.Q(4).to('mm');
    assert.ok(q instanceof CSSUnitValue);

    const same = CSS.px(10).to('px');
    assert.equal(same.value, 10);

    // Unique-cause: base === 'resolution' T (dppx/x/dpi/dpcm) vs F (frequency/flex else throw).
    assert.equal(CSS.dppx(1).to('dpi').value, 96);
    assert.equal(CSS.x(2).to('dppx').value, 2);
    const dpcm = CSS.dpi(96).to('dpcm');
    assert.equal(dpcm.unit, 'dpcm');
    assert.ok(Math.abs(dpcm.value - 96 / 2.54) < 1e-6);
    const fromDpcm = CSS.dpcm(96 / 2.54).to('dppx');
    assert.equal(fromDpcm.unit, 'dppx');
    assert.ok(Math.abs(fromDpcm.value - 1) < 1e-6);
    assert.throws(() => CSS.Hz(1).to('khz'), TypeError);
    assert.throws(() => CSS.fr(1).to('px'), TypeError);

    // Unique-cause: base !== targetBase T for number and percent (number/percent conjuncts skipped).
    assert.throws(() => CSS.number(1).to('px'), TypeError);
    assert.throws(() => CSS.percent(1).to('px'), TypeError);
    assert.equal(CSS.number(3).to('number').value, 3);
    assert.equal(CSS.percent(3).to('percent').value, 3);

    assert.throws(() => CSS.px(1).to('nope'), DOMException);
    assert.throws(() => CSS.deg(1).to('px'), TypeError);
    assert.ok(Math.abs(CSS.grad(100).to('deg').value - 90) < 1e-6);
    assert.equal(CSS.ms(1000).to('s').value, 1);

    const bogus = CSS.px(1);
    bogus.unit = 'bogus' as CSSUnit;
    assert.throws(() => bogus.to('px'), TypeError);
  });
});

describe('MC/DC leftover unique-cause: CSSNumericValue methods (css-typed-om-1 § 4.1 #numericvalue-objects)', { concurrency: false }, () => {
  test('parseNumericValue empty/multi/ident/unit/function/sign/type-error wrap', () => {
    // Unique-cause: arguments.length < 1 T.
    assert.throws(() => {
      (CSSNumericValue.parse as unknown as () => CSSNumericValue)();
    }, TypeError);

    assert.throws(() => parse(''), DOMException);
    assert.throws(() => parse('/* only a comment */'), DOMException);
    assert.throws(() => parse('1px 2px'), DOMException);
    assert.throws(() => parse('auto'), DOMException);
    assert.throws(() => parse('1foo'), DOMException);
    assert.throws(() => parse('var(--x)'), DOMException);
    assert.throws(() => parse('rgb(1, 2, 3)'), DOMException);

    const calc = parse('calc(1px + 2em)');
    assert.ok(calc instanceof CSSMathSum);

    // Unique-cause: isStandardCSSNumericValue CSSMathFunction T then name === 'sign' T → unsupported.
    assert.throws(() => parse('sign(1)'), DOMException);

    const abs = parse('abs(-10px)');
    assert.ok(abs instanceof CSSMathFunction);
    assert.equal(abs.name, 'abs');

    const hypot = parse('hypot(3px, 4px)');
    assert.ok(hypot instanceof CSSMathFunction);

    // Unique-cause: type() TypeError inside parse is wrapped as SyntaxError DOMException.
    assert.throws(() => parse('sin(1px)'), DOMException);
    assert.throws(() => parse('min(1px, 1s)'), DOMException);
  });

  test('numericTo arguments.length < 2 T and sum.length > 1 T', () => {
    // CSSUnitValue.to is overridden; drive prototype numericTo via a leftover min.
    // Prototype wrapper always forwards `unit`, so numericTo sees arguments.length === 2
    // and !unitToBase[undefined] throws SyntaxError (the 0-arg TypeError is CSSUnitValue.to).
    const min = leftoverMin();
    assert.throws(() => {
      (min.to as unknown as () => CSSUnitValue)();
    }, DOMException);
    assert.throws(() => {
      (CSS.px(1).to as unknown as () => CSSUnitValue)();
    }, TypeError);

    // Unique-cause: sum is non-null and sum.length > 1 (mixed leftover).
    assert.throws(() => leftoverSum().to('px'), TypeError);
    assert.throws(() => leftoverMin().to('px'), TypeError);
    assert.equal(parse('min(10px, 2px)').to('px').value, 2);
  });

  test('numericToSum isCompatible number/percent/cross-base leftover', () => {
    // Unique-cause: b1 === 'number' T — leftover number cannot convert into px.
    assert.throws(() => CSS.number(1).toSum('px'), TypeError);
    // Unique-cause: b1 === 'percent' T.
    assert.throws(() => CSS.percent(1).toSum('px'), TypeError);
    // Unique-cause: b1 !== b2 T (frequency vs length).
    assert.throws(() => CSS.Hz(1).toSum('px'), TypeError);
    // Unique-cause: same base, target missing from abs list (px → em).
    assert.throws(() => CSS.px(1).toSum('em'), TypeError);

    const abs = CSS.cm(1).toSum('mm');
    assert.equal(abs.values.length, 1);
    assert.ok(abs.values.item(0) instanceof CSSUnitValue);

    const mixed = leftoverSum().toSum('px', 'em');
    assert.equal(mixed.values.length, 2);

    assert.equal(CSS.number(4).toSum('number').values.length, 1);
    assert.throws(() => leftoverSum().toSum('px'), TypeError);
    assert.throws(() => CSS.px(1).toSum('nope'), DOMException);
  });

  test('numericDiv length !== 1, invert number zero, invert non-number', () => {
    // Unique-cause: self is CSSUnitValue and rectifiedValues.length === 1 F.
    const twoDiv = CSS.px(12).div(2, 3);
    assert.ok(twoDiv instanceof CSSUnitValue);
    assert.equal(twoDiv.value, 2);

    const sameUnit = CSS.px(10).div(CSS.px(2));
    assert.ok(sameUnit instanceof CSSUnitValue);
    assert.equal(sameUnit.unit, 'number');
    assert.equal(sameUnit.value, 5);

    assert.throws(() => CSS.px(10).div(0), RangeError);
    assert.throws(() => CSS.px(10).div(CSS.number(0)), RangeError);

    // Unique-cause: invert path num instanceof CSSUnitValue T, unit === 'number' T, value === 0 T.
    const mixed = leftoverSum();
    assert.throws(() => mixed.div(CSS.number(0)), RangeError);
    const scaled = mixed.div(CSS.number(2));
    assert.ok(scaled instanceof CSSMathProduct);
    // Unique-cause: instanceof T, unit === 'number' F → CSSMathInvert.
    const invertedPx = mixed.div(CSS.px(2));
    assert.ok(invertedPx instanceof CSSMathProduct);
    assert.ok([...invertedPx.values].some((n) => n instanceof CSSMathInvert));
  });

  test('numericMin / numericMax flatten self/arg CSSMath* and every F', () => {
    const minMixed = leftoverMin();
    // Unique-cause: self instanceof CSSMathMin T (already nested in hotspot); v instanceof T.
    const fromArg = CSS.px(3).min(minMixed);
    assert.ok(fromArg instanceof CSSMathMin);
    assert.ok(fromArg.values.length >= 3);

    const nestedSelf = minMixed.min(CSS.vw(1));
    assert.ok(nestedSelf instanceof CSSMathMin);

    // Unique-cause: allValues.every(instanceof CSSUnitValue) F — a leftover sum is not a unit.
    const minSum = CSS.px(1).min(leftoverSum());
    assert.ok(minSum instanceof CSSMathMin);

    const maxMixed = leftoverMax();
    const maxFromArg = CSS.px(3).max(maxMixed);
    assert.ok(maxFromArg instanceof CSSMathMax);
    const maxSelf = maxMixed.max(CSS.vw(1));
    assert.ok(maxSelf instanceof CSSMathMax);
    const maxSum = CSS.px(1).max(leftoverSum());
    assert.ok(maxSum instanceof CSSMathMax);

    const minSame = CSS.px(8).min(CSS.px(2), CSS.px(5));
    assert.ok(minSame instanceof CSSUnitValue);
    assert.equal(minSame.value, 2);
    const maxSame = CSS.px(8).max(CSS.px(2), CSS.px(5));
    assert.ok(maxSame instanceof CSSUnitValue);
    assert.equal(maxSame.value, 8);
  });

  test('equalsInternal product/min/max/function/clamp mixed keyword', () => {
    // Unique-cause: both instanceof CSSMathProduct T (constructor already matched).
    const p1 = CSS.px(2).mul(CSS.em(3));
    const p2 = CSS.px(2).mul(CSS.em(3));
    const p3 = CSS.px(2).mul(CSS.em(4));
    const p4 = new CSSMathProduct(CSS.px(2), CSS.em(3), CSS.number(1));
    assert.equal(p1.equals(p2), true);
    assert.equal(p1.equals(p3), false);
    assert.equal(p1.equals(p4), false);
    assert.equal(p1.equals(CSS.px(2)), false);

    const n1 = leftoverMin();
    const n2 = parse('min(1px, 2em)');
    const n3 = parse('min(1px, 3em)');
    const n4 = new CSSMathMin(CSS.px(1), CSS.em(2), CSS.vw(1));
    assert.equal(n1.equals(n2), true);
    assert.equal(n1.equals(n3), false);
    assert.equal(n1.equals(n4), false);

    const x1 = leftoverMax();
    const x2 = parse('max(1px, 2em)');
    const x3 = parse('max(1px, 3em)');
    assert.equal(x1.equals(x2), true);
    assert.equal(x1.equals(x3), false);

    const f1 = new CSSMathFunction('sin', CSS.deg(90));
    const f2 = new CSSMathFunction('sin', CSS.deg(90));
    const f3 = new CSSMathFunction('sin', CSS.deg(90), CSS.deg(1));
    assert.equal(f1.equals(f2), true);
    assert.equal(f1.equals(f3), false);
    assert.equal(f1.equals(p1), false);

    const none = new CSSKeywordValue('none');
    const clampNum = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    const clampNoneL = new CSSMathClamp(none, CSS.px(2), CSS.px(3));
    const clampNoneU = new CSSMathClamp(CSS.px(1), CSS.px(2), none);
    const clampNoneBoth = new CSSMathClamp(none, CSS.px(2), none);
    assert.equal(clampNum.equals(clampNoneL), false);
    assert.equal(clampNum.equals(clampNoneU), false);
    assert.equal(clampNoneL.equals(clampNoneBoth), false);
    assert.equal(clampNoneBoth.equals(new CSSMathClamp(none, CSS.px(2), none)), true);
    assert.equal(clampNoneL.equals(new CSSMathClamp(none, CSS.px(9), CSS.px(3))), false);

    assert.equal(CSS.px(1).equals(1), false);
    assert.equal(CSS.number(1).equals(1), true);
    assert.equal(p1.equals(p1), true);
  });
});

describe('MC/DC leftover unique-cause: CSSMath* (css-typed-om-1 § 4.4 #mathvalue-objects)', { concurrency: false }, () => {
  test('CSSMathValue toString operator number vs calc wrap; 0-arg constructors', () => {
    // Unique-cause: this.operator === 'number' T — CSSMathFunction name is the operator.
    const asNumber = new CSSMathFunction('number', 4);
    assert.equal(asNumber.operator, 'number');
    assert.equal(asNumber.toString(), asNumber.serialize());
    assert.equal(asNumber.toString().startsWith('calc('), false);

    const sum = new CSSMathSum(CSS.px(1), CSS.em(2));
    assert.equal(sum.toString().startsWith('calc('), true);
    const min = new CSSMathMin(CSS.px(1), CSS.em(2));
    assert.equal(min.toString().startsWith('min('), true);

    assert.throws(() => {
      // @ts-expect-error arity unique-cause
      new CSSMathNegate();
    }, TypeError);
    assert.throws(() => {
      // @ts-expect-error arity unique-cause
      new CSSMathInvert();
    }, TypeError);
    assert.throws(() => {
      // @ts-expect-error arity unique-cause
      new CSSMathClamp(CSS.px(1), CSS.px(2));
    }, TypeError);
    assert.throws(() => new (CSSMathValue as unknown as new () => CSSMathValue)(), TypeError);
  });

  test('CSSMathFunction serialize calc name, paren strip, startsWith T endsWith F', () => {
    // Unique-cause: this.name === 'calc' T vs F.
    const calc = new CSSMathFunction('calc', CSS.px(1));
    assert.equal(calc.serialize(), 'calc(1px)');
    const abs = new CSSMathFunction('abs', CSS.px(1));
    assert.equal(abs.serialize(), 'abs(1px)');
    const calcUpper = new CSSMathFunction('Calc', CSS.px(1));
    assert.equal(calcUpper.serialize(), 'Calc(1px)');

    // Unique-cause: child serialize startsWith '(' AND endsWith ')' T — strip.
    const wrapped = new CSSMathFunction('abs', leftoverSum());
    assert.equal(wrapped.serialize().includes('('), true);
    assert.equal(wrapped.serialize().startsWith('abs('), true);
    assert.equal(wrapped.serialize().includes('1px'), true);

    // Unique-cause: startsWith '(' T, endsWith ')' F.
    const open = new CSSMathFunction('abs', new OpenParenNumeric());
    assert.equal(open.serialize(), 'abs((unclosed)');
  });

  test('CSSMathFunction.type trig/pow/log/hypot/mod leftover unique-cause', () => {
    // Unique-cause: values.length === 0 T (empty returns {} before arity).
    assert.deepEqual(new CSSMathFunction('sin').type(), {});
    assert.deepEqual(new CSSMathFunction('log').type(), {});
    assert.deepEqual(new CSSMathFunction('abs').type(), {});

    // Unique-cause: addTypesForSum(t, {angle:1}) === null T && addTypesForSum(t, {}) === null T (px).
    assert.throws(() => new CSSMathFunction('sin', CSS.px(1)).type(), TypeError);
    assert.throws(() => new CSSMathFunction('cos', CSS.s(1)).type(), TypeError);
    // Unique-cause: first null T, second null F (unitless number).
    assert.deepEqual(new CSSMathFunction('tan', CSS.number(1)).type(), {});
    // Unique-cause: first null F (angle) short-circuits.
    assert.deepEqual(new CSSMathFunction('sin', CSS.deg(45)).type(), {});
    assert.throws(() => new CSSMathFunction('sin', CSS.deg(1), CSS.deg(2)).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('asin', 0.5).type(), { angle: 1 });
    assert.throws(() => new CSSMathFunction('acos', CSS.px(1)).type(), TypeError);
    assert.throws(() => new CSSMathFunction('atan', 0.5, 0.1).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('atan2', 1, 1).type(), { angle: 1 });
    assert.throws(() => new CSSMathFunction('atan2', 1).type(), TypeError);
    assert.throws(() => new CSSMathFunction('atan2', CSS.px(1), CSS.s(1)).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('sign', CSS.px(1)).type(), {});
    assert.throws(() => new CSSMathFunction('sign', 1, 2).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('sqrt', 4).type(), {});
    assert.throws(() => new CSSMathFunction('sqrt', CSS.px(4)).type(), TypeError);
    assert.throws(() => new CSSMathFunction('exp', 1, 2).type(), TypeError);
    assert.throws(() => new CSSMathFunction('exp', CSS.px(1)).type(), TypeError);

    // Unique-cause: pow addTypesForSum(t1, {}) === null T vs t2 === null T.
    assert.throws(() => new CSSMathFunction('pow', CSS.px(2), 3).type(), TypeError);
    assert.throws(() => new CSSMathFunction('pow', 2, CSS.px(3)).type(), TypeError);
    assert.deepEqual(new CSSMathFunction('pow', 2, 3).type(), {});
    assert.throws(() => new CSSMathFunction('pow', 2).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('log', 10).type(), {});
    assert.deepEqual(new CSSMathFunction('log', 8, 2).type(), {});
    assert.throws(() => new CSSMathFunction('log', 1, 2, 3).type(), TypeError);
    assert.throws(() => new CSSMathFunction('log', CSS.px(10)).type(), TypeError);
    assert.throws(() => new CSSMathFunction('log', 10, CSS.px(2)).type(), TypeError);

    assert.deepEqual(new CSSMathFunction('hypot', CSS.px(3), CSS.px(4)).type(), { length: 1 });
    assert.throws(() => new CSSMathFunction('hypot', CSS.px(3), CSS.s(4)).type(), TypeError);
    assert.deepEqual(new CSSMathFunction('hypot', CSS.px(5)).type(), { length: 1 });

    assert.deepEqual(new CSSMathFunction('mod', CSS.px(10), CSS.px(3)).type(), { length: 1 });
    assert.throws(() => new CSSMathFunction('mod', CSS.px(10)).type(), TypeError);
    assert.throws(() => new CSSMathFunction('mod', CSS.px(10), CSS.s(3)).type(), TypeError);
    assert.deepEqual(new CSSMathFunction('rem', 10, 3).type(), {});
    assert.throws(() => new CSSMathFunction('rem', 10, 3, 1).type(), TypeError);

    assert.equal(new CSSMathFunction('abs', CSS.px(1)).type().length, 1);
  });

  test('CSSMathRound omitted precision unique-cause of pOmitted T with inner F/T', () => {
    // Unique-cause: pOmitted T, p instanceof CSSUnitValue T, unit number T, value === 1 T,
    // v instanceof CSSUnitValue T, v.unit !== 'number' T → precision rewritten as 1px.
    const omittedPx = new CSSMathRound('nearest', CSS.px(10.2), 1, true);
    assert.equal(omittedPx.precisionOmitted, true);
    assert.ok(omittedPx.precision instanceof CSSUnitValue);
    assert.equal(omittedPx.precision.unit, 'px');
    assert.equal(omittedPx.serialize().includes('nearest'), false);

    // Unique-cause: pOmitted T, instanceof CSSUnitValue F (leftover min precision).
    const omittedMin = new CSSMathRound('nearest', CSS.px(10), leftoverMin(), true);
    assert.equal(omittedMin.precisionOmitted, true);
    assert.ok(omittedMin.precision instanceof CSSMathMin);

    // Unique-cause: pOmitted T, unit === 'number' F (precision already 1px).
    const omittedPxStep = new CSSMathRound('up', CSS.px(10), CSS.px(1), true);
    assert.equal(omittedPxStep.strategy, 'up');
    assert.equal(omittedPxStep.serialize().includes('up'), true);

    // Unique-cause: pOmitted T, value === 1 F (number value so types still match).
    const omittedTwo = new CSSMathRound('nearest', CSS.number(10), CSS.number(2), true);
    assert.ok(omittedTwo.precision instanceof CSSUnitValue);
    assert.equal(omittedTwo.precision.unit, 'number');
    assert.equal(omittedTwo.precision.value, 2);

    // Unique-cause: v instanceof CSSUnitValue F (value is a leftover numeric min of numbers).
    const omittedValMin = new CSSMathRound(
      'nearest',
      new CSSMathMin(CSS.number(1), CSS.number(2)),
      1,
      true,
    );
    assert.ok(omittedValMin.value instanceof CSSMathMin);

    const explicit = new CSSMathRound('nearest', CSS.px(1.2), CSS.px(1), false);
    assert.equal(explicit.precisionOmitted, false);
    assert.equal(explicit.serialize().includes('1px'), true);
  });

  test('CSSMathClamp null/keyword lower-upper type guards and mutated !combined', () => {
    const none = new CSSKeywordValue('none');
    // Unique-cause: l T and typeof type === 'function' F (keyword has no type()).
    const noneLower = new CSSMathClamp(none, CSS.px(2), CSS.px(3));
    assert.equal(noneLower.lower, none);
    assert.equal(noneLower.type().length, 1);

    const noneUpper = new CSSMathClamp(CSS.px(1), CSS.px(2), none);
    assert.equal(noneUpper.upper, none);

    // Unique-cause: l F / u F (null bounds skip the type() conjunct).
    const nullLower = new CSSMathClamp(null as unknown as CSSNumericValue, CSS.px(2), CSS.px(3));
    assert.equal(nullLower.lower, null);
    assert.equal(nullLower.type().length, 1);
    const nullUpper = new CSSMathClamp(CSS.px(1), CSS.px(2), null as unknown as CSSNumericValue);
    assert.equal(nullUpper.upper, null);

    const clamp = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    (clamp.lower as CSSUnitValue).unit = 's';
    assert.equal(clamp.type().length, 1);

    const hinted = new CSSMathClamp(
      CSS.px(1).add(CSS.percent(1)),
      CSS.px(2),
      CSS.px(3),
    );
    assert.equal(hinted.type().percentHint, 'length');
  });

  test('CSSMathSum/Min/Max type() !combined T after mutating a child unit', () => {
    // Constructor validates addTypesForSum; type() re-checks. Public unit is writable.
    const a = CSS.px(1);
    const b = CSS.px(2);
    const sum = new CSSMathSum(a, b);
    a.unit = 's';
    assert.throws(() => sum.type(), TypeError);

    const c = CSS.px(1);
    const d = CSS.px(2);
    const min = new CSSMathMin(c, d);
    c.unit = 'deg';
    assert.throws(() => min.type(), TypeError);

    const e = CSS.px(1);
    const f = CSS.px(2);
    const max = new CSSMathMax(e, f);
    e.unit = 'Hz' as CSSUnit;
    assert.throws(() => max.type(), TypeError);

    assert.equal(new CSSMathSum(CSS.px(1), CSS.em(2)).type().length, 1);
    assert.equal(new CSSMathMin(CSS.px(1), CSS.percent(2)).type().percentHint, 'length');
  });

  test('addTypes / addTypesForSum same percentHint and applyPercentHint hint === percent', () => {
    // Unique-cause: t1.percentHint && t2.percentHint T and !== F (same hint).
    const hinted = addTypes(
      { percentHint: 'length', length: 1 },
      { percentHint: 'length', length: 2 },
    );
    assert.equal(hinted.percentHint, 'length');
    assert.equal(hinted.length, 3);

    const sumHinted = addTypesForSum(
      { percentHint: 'angle', angle: 1 },
      { percentHint: 'angle', percent: 1 },
    );
    assert.ok(sumHinted);
    assert.equal(sumHinted.percentHint, 'angle');

    // Unique-cause: hasPercent both F, hasOther T (length vs time) — skip hint loop.
    assert.equal(addTypesForSum({ length: 1 }, { time: 1 }), null);
    // Unique-cause: hasPercent T, hasOther F vs empty number type.
    assert.equal(addTypesForSum({ percent: 1 }, {}), null);
    // Unique-cause: percent vs flex walks the base-type loop.
    const flexPct = addTypesForSum({ percent: 1 }, { flex: 1 });
    assert.ok(flexPct);
    assert.equal(flexPct.percentHint, 'flex');
    const timePct = addTypesForSum({ percent: 1 }, { time: 1 });
    assert.ok(timePct);
    assert.equal(timePct.percentHint, 'time');
    const freqPct = addTypesForSum({ percent: 1 }, { frequency: 1 });
    assert.ok(freqPct);
    assert.equal(freqPct.percentHint, 'frequency');
    const resPct = addTypesForSum({ percent: 1 }, { resolution: 1 });
    assert.ok(resPct);
    assert.equal(resPct.percentHint, 'resolution');

    // Unique-cause: hint !== 'percent' F.
    const asPercent = applyPercentHint({ percent: 1, length: 1 }, 'percent');
    assert.equal(asPercent.percentHint, 'percent');
    assert.equal(asPercent.percent, 1);
    assert.equal(asPercent.length, 1);

    const noPercent = applyPercentHint({ length: 1 }, 'length');
    assert.equal(noPercent.length, 1);

    const a = CSS.px(1).add(CSS.percent(2));
    const b = CSS.px(3).add(CSS.percent(4));
    const prod = a.mul(b);
    assert.equal(prod.type().percentHint, 'length');
  });
});
