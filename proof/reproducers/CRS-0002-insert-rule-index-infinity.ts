/**
 * Reproducer for CRS-0002/C13 (src/CSSOM.ts CSSStyleSheet.insertRule).
 * WebIDL types the index argument as unsigned long, so Infinity converts
 * via ToUint32 to 0 (WebIDL #es-unsigned-long; ECMAScript ToUint32 maps
 * +/-Infinity and NaN to +0). cssom-1 #dom-cssstylesheet-insertrule must
 * therefore insert at 0, but the raw numeric range check throws
 * IndexSizeError before the conversion ever happens.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('CRS-0002/C13: insertRule index Infinity wraps to 0 per WebIDL ToUint32', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('a { color: red }');
  const idx = sheet.insertRule('p { color: blue }', Infinity);
  assert.equal(idx, 0, 'ToUint32(Infinity) is 0, so the rule inserts at index 0');
  assert.equal(sheet.cssRules.length, 2);
  assert.equal((sheet.cssRules[0] as unknown as { selectorText: string }).selectorText, 'p');
});

test('CRS-0002/C13: insertRule index NaN wraps to 0 per WebIDL ToUint32', () => {
  const sheet = new CSSStyleSheet();
  const idx = sheet.insertRule('p { color: red }', NaN);
  assert.equal(idx, 0);
  assert.equal(sheet.cssRules.length, 1);
});

test('control: index 0 and true out-of-range still behave', () => {
  const sheet = new CSSStyleSheet();
  assert.equal(sheet.insertRule('a { color: red }', 0), 0);
  assert.throws(
    () => sheet.insertRule('b { color: red }', 5),
    (e: unknown) => (e as DOMException).name === 'IndexSizeError',
    'an index beyond length after conversion must still throw IndexSizeError',
  );
});
