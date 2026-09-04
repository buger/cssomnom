/**
 * Reproducer for CRS-0025/C06 (src/typed-om/numeric/CSSUnitValue.ts to).
 * css-typed-om-1 #convert-a-cssunitvalue step 3 returns a NEW CSSUnitValue on
 * every call; #dom-cssnumericvalue-to feeds that conversion for identity
 * conversions too. CSSUnitValue.to returns `this` when this.unit === unit,
 * so mutating the returned object mutates the original through the public
 * writable value field.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';

test('CRS-0025/C06: identity conversion returns a distinct object', () => {
  const a = new CSSUnitValue(10, 'px');
  const b = a.to('px');
  b.value = 99;
  assert.equal(a.value, 10, 'mutating the converted result must not alias the original');
});

test('control: real conversions already return a fresh object', () => {
  const a = new CSSUnitValue(96, 'px');
  const b = a.to('in');
  b.value = 5;
  assert.equal(a.value, 96);
});
