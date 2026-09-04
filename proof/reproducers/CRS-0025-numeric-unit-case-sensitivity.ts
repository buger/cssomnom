/**
 * Reproducer for CRS-0025/C02, CRS-0025/C05, CRS-0025/C26 and CRS-0025/C32
 * (src/typed-om/numeric/numeric-methods.ts parseNumericValue/numericTo/
 * numericToSum and CSSUnitValue.to). css-values-4 #lengths: "Like keywords,
 * unit identifiers are ASCII case-insensitive." css-typed-om-1 #create-a-type
 * from a unit therefore succeeds for "PX" exactly as for "px". parseNumeric
 * Value looks up the raw token unit in unitToBase, and to()/toSum() pass the
 * raw argument to unitToBase and compare this.unit === unit, so "10PX" and
 * .to('PX') throw SyntaxError instead of parsing and converting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';
import { CSSNumericValue } from '../../src/typed-om/numeric/CSSNumericValue.ts';
import '../../src/parser.ts';

test('CRS-0025/C02: parseNumericValue accepts uppercase units', () => {
  const v = CSSNumericValue.parse('10PX');
  assert.ok(v instanceof CSSUnitValue);
  assert.equal((v as CSSUnitValue).unit, 'px', 'units normalize to lowercase');
  assert.equal((v as CSSUnitValue).value, 10);
});

test('CRS-0025/C05: CSSUnitValue.to accepts a mixed-case target unit', () => {
  const v = new CSSUnitValue(10, 'px').to('PX');
  assert.equal(v.unit, 'px');
  assert.equal(v.value, 10);
});

test('CRS-0025/C32: toSum accepts a mixed-case target unit', () => {
  const v = new CSSUnitValue(10, 'px').toSum('PX');
  assert.ok(v.toString().includes('10px'), `expected a px sum, got ${v.toString()}`);
});

test('controls: lowercase units keep working', () => {
  assert.equal(CSSNumericValue.parse('10px').toString(), '10px');
  assert.equal(new CSSUnitValue(10, 'px').to('in').value, 10 / 96);
  assert.ok(new CSSUnitValue(10, 'px').toSum('px').toString().includes('10px'));
});
