/**
 * Reproducer for CRS-0024/C14 (src/PropertyRegistry.ts validate).
 * css-properties-values-api #consume-a-syntax-definition step 1 strips
 * leading and trailing ASCII whitespace before step 3 recognizes the single
 * asterisk as the universal syntax definition. WPT at-property.html line 104
 * therefore treats "*", " * ", "* " and "\t*\t" as the same universal syntax
 * that needs no initial value. validate keeps the untrimmed string, so the
 * `syntax !== '*'` guard throws 'initialValue is required' and drops a valid
 * @property rule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/parser-api.ts';

test('CRS-0024/C14: registerProperty accepts the padded universal syntax', () => {
  assert.doesNotThrow(
    () => CSS.registerProperty({ name: '--crs0024c14a', syntax: ' * ', inherits: false }),
    'whitespace-padded "*" is the universal syntax after stripping',
  );
});

test('CRS-0024/C14: @property keeps " * " without initial value', () => {
  const sheet = parse('@property --crs0024c14b { syntax: " * "; inherits: false; }') as unknown as { cssRules: { syntax?: string }[] };
  assert.equal(sheet.cssRules.length, 1, 'WPT at-property.html lists " * " as valid universal syntax');
  assert.equal(sheet.cssRules[0].syntax, ' * ');
});

test('control: bare "*" stays valid without initial value', () => {
  const sheet = parse('@property --crs0024c14c { syntax: "*"; inherits: false; }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 1);
});

test('control: non-universal syntax without initial value stays invalid', () => {
  const sheet = parse('@property --crs0024c14d { syntax: "<color>"; inherits: false; }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0);
});
