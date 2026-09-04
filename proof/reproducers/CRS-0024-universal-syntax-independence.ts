/**
 * Reproducer for CRS-0024/C02 (src/PropertyRegistry.ts validate).
 * css-properties-values-api #register-a-custom-property step 4 parses
 * initialValue according to <declaration-value>? when the syntax is the
 * universal definition, then requires the parsed value to be computationally
 * independent in ALL cases. var() depends on another custom property, so a
 * universal-syntax registration with initialValue var(--y) must throw
 * SyntaxError. WPT css-properties-values-api/at-property.html line 148
 * (test_descriptor('initial-value','var(--x)',null) with the default '*')
 * expects the @property rule invalid for the same reason.
 * PropertyRegistry.validate only calls validateCustomPropertyValue on the
 * universal arm and never isComputationallyIndependent, so both the JS
 * registration and the CSS @property rule survive.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/parser-api.ts';

const isSyntaxError = (e: unknown) => (e as DOMException)?.name === 'SyntaxError';

test('CRS-0024/C02: registerProperty rejects var() initial value under universal syntax', () => {
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0024c02a', syntax: '*', inherits: false, initialValue: 'var(--y)' }),
    isSyntaxError,
    'universal syntax still requires computational independence',
  );
});

test('CRS-0024/C02: @property drops var() initial value under universal syntax', () => {
  const sheet = parse('@property --crs0024c02b { syntax: "*"; inherits: false; initial-value: var(--y); }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, 'WPT at-property.html expects this rule invalid');
});

test('control: universal syntax without initial value stays valid', () => {
  const sheet = parse('@property --crs0024c02c { syntax: "*"; inherits: false; }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 1);
});

test('control: typed syntax rejects var() initial value already', () => {
  const sheet = parse('@property --crs0024c02d { syntax: "<length>"; inherits: false; initial-value: var(--y); }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0);
});
