/**
 * Reproducer for CRS-0011/C06 (src/PropertyRegistry.ts matchesSyntax).
 * The <url> branch compares the function token name with === 'url'.
 * css-values-4 #functional-notation makes function names ASCII
 * case-insensitive, and css-syntax-3 #consume-ident-like-token matches the
 * url spelling ASCII case-insensitively, so Url("x") is a valid <url>.
 * A registered <url> property therefore accepts initialValue 'Url("x.png")'.
 * Unquoted URL(x) already works because the tokenizer folds it into a
 * <url-token>; only the quoted functional form hits the name comparison.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0011/C06: <url> accepts the mixed-case Url("x") functional form', () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(
    () => CSS.registerProperty({ name: '--c06-url', inherits: false, syntax: '<url>', initialValue: 'Url("sheet.png")' }),
    'Url("sheet.png") is a valid <url> value',
  );
});

test('control: lowercase url("x") registers for <url>', () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() =>
    CSS.registerProperty({ name: '--c06-url-lower', inherits: false, syntax: '<url>', initialValue: 'url("sheet.png")' }));
  PropertyRegistry.clear();
});
