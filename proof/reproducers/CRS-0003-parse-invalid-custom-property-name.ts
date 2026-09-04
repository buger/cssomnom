/**
 * Reproducer for CRS-0003/C34 (src/typed-om/values/style-value-parser.ts
 * parseAllStyleValues). css-typed-om-1 #parse-a-cssstylevalue steps 1-2:
 * the property must be a custom property name string or a valid CSS
 * property, otherwise TypeError. '-- ' (trailing space) and '--\n' are not
 * <dashed-ident>s; only '--' itself and length<3 are rejected, so these
 * names slip through and reify as CSSUnparsedValue instead of throwing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0003/C34: parse rejects "-- " as a property name', () => {
  assert.throws(() => CSSStyleValue.parse('-- ', 'red'), TypeError);
});

test('CRS-0003/C34: parse rejects "--\\n" as a property name', () => {
  assert.throws(() => CSSStyleValue.parse('--\n', 'red'), TypeError);
});

test('CRS-0003/C34: parse rejects "--4x" (not ident-start after dashes)', () => {
  assert.throws(() => CSSStyleValue.parse('--4x', 'red'), TypeError);
});

test('controls: valid names still parse', () => {
  assert.ok(CSSStyleValue.parse('--x', 'red'));
  assert.throws(() => CSSStyleValue.parse('--', 'red'), TypeError);
});
