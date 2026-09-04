/**
 * Reproducer for CRS-0003/C01, CRS-0003/C03, CRS-0003/C07, CRS-0003/C30
 * (src/typed-om/values/style-value-parser.ts _parseAll).
 * css-typed-om-1 #parse-a-cssstylevalue step 3: parse the value against
 * the property grammar and throw TypeError when it fails. Four paths
 * return before the matchesSyntax gate runs: the comma-separated
 * LIST_PROPERTIES early return, shouldFallbackToCSSStyleValue, the
 * shorthand check that only counts parsed declarations, and properties
 * with no STANDARD_PROPERTIES_SYNTAX entry. Invalid values therefore
 * reify as raw CSSStyleValue instead of throwing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0003/C01: comma-list segments still face the grammar gate', () => {
  assert.throws(
    () => CSSStyleValue.parse('transition', 'color 1s, not-a-transition'),
    TypeError,
    'an invalid transition segment must throw TypeError',
  );
});

test('CRS-0003/C03: will-change rejects a grammar-invalid number', () => {
  assert.throws(() => CSSStyleValue.parse('will-change', '123'), TypeError);
});

test('CRS-0003/C03b: filter rejects a grammar-invalid bare ident', () => {
  assert.throws(() => CSSStyleValue.parse('filter', 'not-a-filter'), TypeError);
});

test('CRS-0003/C07: a semicolon cannot smuggle extra declarations past a shorthand', () => {
  assert.throws(
    () => CSSStyleValue.parse('transition', '1px; color: red'),
    TypeError,
    'the value must match the shorthand grammar, not merely produce declarations',
  );
});

test('CRS-0003/C30: supported properties without a syntax entry still grammar-check', () => {
  assert.throws(
    () => CSSStyleValue.parse('-webkit-box-orient', 'foo(bar'),
    TypeError,
    'an unclosed junk function fails the property grammar',
  );
});

test('controls: valid values on the same properties still parse', () => {
  assert.ok(CSSStyleValue.parse('transition', 'color 1s'));
  assert.ok(CSSStyleValue.parse('will-change', 'contents'));
  assert.ok(CSSStyleValue.parse('filter', 'none'));
  assert.ok(CSSStyleValue.parse('transition', 'color 1s ease'));
  assert.ok(CSSStyleValue.parse('-webkit-box-orient', 'horizontal'));
});
