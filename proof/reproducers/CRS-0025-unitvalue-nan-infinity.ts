/**
 * Reproducer for CRS-0025/C07 (src/typed-om/numeric/CSSUnitValue.ts
 * constructor). css-typed-om-1 IDL declares `constructor(double value,
 * CSSUnit unit)` and `attribute double value` — plain WebIDL double, not
 * unrestricted double. WebIDL double conversion throws a TypeError for NaN,
 * +Infinity and -Infinity, so constructing CSSUnitValue with those values
 * must throw. The constructor stores them verbatim and toString()
 * special-cases them, proving they are accepted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';

test('CRS-0025/C07: constructor rejects NaN', () => {
  assert.throws(() => new CSSUnitValue(NaN, 'px'), TypeError, 'WebIDL double rejects NaN');
});

test('CRS-0025/C07: constructor rejects Infinity', () => {
  assert.throws(() => new CSSUnitValue(Infinity, 'px'), TypeError, 'WebIDL double rejects +Infinity');
});

test('CRS-0025/C07: constructor rejects -Infinity', () => {
  assert.throws(() => new CSSUnitValue(-Infinity, 'number'), TypeError, 'WebIDL double rejects -Infinity');
});

test('control: finite doubles construct', () => {
  const v = new CSSUnitValue(0, 'px');
  assert.equal(v.value, 0);
  assert.equal(v.unit, 'px');
});
