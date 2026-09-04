/**
 * Reproducer for CRS-0025/C04, CRS-0025/C10 and CRS-0025/C33
 * (src/typed-om/numeric/CSSUnitValue.ts to, numeric-methods.ts numericTo).
 * css-typed-om-1 #convert-a-cssunitvalue converts between compatible units
 * and css-values-4 #frequency makes hz and khz compatible absolute frequency
 * units. CSSUnitValue.to only implements length/angle/time/resolution arms,
 * so every frequency conversion throws TypeError even though
 * isCompatible('hz','khz') reports true and createSumValue canonicalizes
 * khz to hz.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';

test('CRS-0025/C04: hz converts to khz', () => {
  const v = new CSSUnitValue(1000, 'hz').to('khz');
  assert.equal(v.unit, 'khz');
  assert.equal(v.value, 1);
});

test('CRS-0025/C10: khz converts to hz', () => {
  const v = new CSSUnitValue(1, 'khz').to('hz');
  assert.equal(v.unit, 'hz');
  assert.equal(v.value, 1000);
});

test('control: angle and length conversions keep working', () => {
  const deg = new CSSUnitValue(180, 'deg').to('rad');
  assert.ok(Math.abs(deg.value - Math.PI) < 1e-9);
  const inch = new CSSUnitValue(96, 'px').to('in');
  assert.equal(inch.value, 1);
});
