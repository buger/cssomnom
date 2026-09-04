/**
 * Reproducer for CRS-0025/C13 (src/typed-om/numeric/numeric-methods.ts
 * numericDiv). css-typed-om-1 #dom-cssnumericvalue-div inverts each divisor
 * then multiplies; the invert algorithm only throws RangeError when the
 * value is a CSSUnitValue with unit "number" and value 0. Dividing by
 * 0px/0em therefore returns a CSSMathProduct with an invert node instead of
 * throwing. numericDiv's paired CSSUnitValue fast path throws RangeError for
 * ANY zero divisor before the unit checks, so CSSUnitValue(10,'px').div(
 * CSSUnitValue(0,'px')) throws a RangeError the spec does not define.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';
import { CSSNumericValue } from '../../src/typed-om/numeric/CSSNumericValue.ts';
import '../../src/parser.ts';

test('CRS-0025/C13: div by 0px returns a product, not RangeError', () => {
  let out: CSSNumericValue;
  assert.doesNotThrow(() => { out = new CSSUnitValue(10, 'px').div(new CSSUnitValue(0, 'px')); }, 'spec throws RangeError only for unitless zero');
  assert.ok(out! instanceof CSSNumericValue);
});

test('CRS-0025/C13: div by 0em returns a product, not RangeError', () => {
  assert.doesNotThrow(() => { new CSSUnitValue(10, 'px').div(new CSSUnitValue(0, 'em')); });
});

test('control: div by unitless zero keeps the spec RangeError', () => {
  assert.throws(() => new CSSUnitValue(10, 'px').div(new CSSUnitValue(0, 'number')), RangeError);
});

test('control: ordinary division works', () => {
  const v = new CSSUnitValue(10, 'px').div(new CSSUnitValue(2, 'px'));
  assert.equal(v.toString(), '5');
});
