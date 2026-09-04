/**
 * Reproducer for CRS-0066/C14 (src/typed-om/values/style-value-parser.ts _parseAll).
 * The non-position LIST_PROPERTIES comma branch filters empty segments
 * (`.filter(seg => seg.some(v => v.type !== 'whitespace'))`) and then calls
 * createValueFromTokens per surviving segment. css-values-4 § 2.2 #comb-comma
 * types these properties as a #-multiplied list, and # has no empty items.
 * A leading, trailing, or doubled comma therefore invalidates the whole value,
 * and css-typed-om-1 § 6.6 #parse-a-cssstylevalue step 3 must throw TypeError.
 * The parse instead drops the empty items and returns the surviving values.
 * Distinct from KI-340, which pins the same drop on the POSITION list branch
 * (src/typed-om/values/style-value-parser.ts line 227); this is the
 * non-position branch at line 278.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0066/C14: transition rejects a doubled comma (empty list item)', () => {
  assert.throws(
    () => CSSStyleValue.parse('transition', 'color 1s, , red'),
    TypeError,
    'an empty item in a comma list must make the value invalid',
  );
});

test('CRS-0066/C14: font-family rejects a trailing comma', () => {
  assert.throws(() => CSSStyleValue.parse('font-family', 'foo,'), TypeError);
});

test('CRS-0066/C14: font-family rejects a leading comma', () => {
  assert.throws(() => CSSStyleValue.parse('font-family', ', foo'), TypeError);
});

test('CRS-0066/C14: parseAll rejects the same malformed lists', () => {
  assert.throws(() => CSSStyleValue.parseAll('font-family', 'foo, , bar'), TypeError);
});

test('control: well-formed comma lists still parse', () => {
  const values = CSSStyleValue.parseAll('font-family', 'foo, bar');
  assert.equal(values.length, 2);
});

test('control: a single item still parses', () => {
  assert.ok(CSSStyleValue.parse('transition', 'color 1s'));
});
