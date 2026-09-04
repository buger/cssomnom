/**
 * Reproducer for CRS-0058/C01 (src/typed-om/values/style-value-parser.ts _parseAll).
 * The POSITION_PROPERTIES && LIST_PROPERTIES comma branch skips empty segments
 * (`if (segTrimmed.length === 0) continue;`) instead of failing the list grammar.
 * css-backgrounds-3 #background-position types the property as <bg-position>#,
 * so a leading, trailing, or doubled comma has an empty <bg-position> item and
 * the whole value is invalid. css-typed-om-1 § 6.6 #parse-a-cssstylevalue step 3
 * must then throw TypeError. The parse instead drops the empty items and returns
 * CSSPositionValue instances for the survivors.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0058/C01: background-position rejects a doubled comma (empty list item)', () => {
  assert.throws(
    () => CSSStyleValue.parse('background-position', 'left, , right'),
    TypeError,
    'an empty <bg-position> item must make the value invalid',
  );
});

test('CRS-0058/C01: background-position rejects a trailing comma', () => {
  assert.throws(() => CSSStyleValue.parse('background-position', 'left,'), TypeError);
});

test('CRS-0058/C01: background-position rejects a leading comma', () => {
  assert.throws(() => CSSStyleValue.parse('background-position', ',left'), TypeError);
});

test('CRS-0058/C01: parseAll rejects the same malformed lists', () => {
  assert.throws(() => CSSStyleValue.parseAll('background-position', 'center, , center'), TypeError);
});

test('control: a well-formed comma list still parses', () => {
  const values = CSSStyleValue.parseAll('background-position', 'left, right');
  assert.equal(values.length, 2);
  assert.equal(String(values[0]), '0% 50%');
  assert.equal(String(values[1]), '100% 50%');
});

test('control: a single position still parses', () => {
  assert.equal(String(CSSStyleValue.parse('background-position', 'left')), '0% 50%');
});
