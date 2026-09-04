/**
 * Reproducer for CRS-0025/C08 and CRS-0025/C09
 * (src/typed-om/numeric/numeric-methods.ts isCompatible/numericToSum).
 * css-values-4 #resolution defines dppx, x, dpi and dpcm as one compatible
 * resolution family ("x" is the serialization of dppx). CSSUnitValue.to
 * converts x like dppx, but isCompatible's absolute-unit list omits 'x', so
 * numericToSum drops every x item into the leftover bucket and throws
 * TypeError even for identity conversions like CSSUnitValue(1,'x').toSum('x').
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSUnitValue } from '../../src/typed-om/numeric/CSSUnitValue.ts';
import '../../src/parser.ts';

test('CRS-0025/C09: toSum keeps the x unit for an x value', () => {
  const v = new CSSUnitValue(1, 'x').toSum('x');
  assert.ok(v.toString().includes('1x'), `expected 1x, got ${v.toString()}`);
});

test('CRS-0025/C09: dppx converts to x in toSum', () => {
  const v = new CSSUnitValue(1, 'dppx').toSum('x');
  assert.ok(v.toString().includes('1x'), `expected 1x, got ${v.toString()}`);
});

test('control: dpi to x converts through to()', () => {
  const v = new CSSUnitValue(96, 'dpi').to('x');
  assert.equal(v.unit, 'x');
  assert.equal(v.value, 1);
});

test('control: dppx toSum round-trips', () => {
  const v = new CSSUnitValue(2, 'dppx').toSum('dppx');
  assert.ok(v.toString().includes('2dppx'), `expected 2dppx, got ${v.toString()}`);
});
