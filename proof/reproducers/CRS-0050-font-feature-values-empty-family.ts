/**
 * Reproducer for CRS-0050/C42 (src/parser.ts Parser.handleFontFeatureValuesRule).
 * css-fonts-4 #font-feature-values types the rule as
 * `@font-feature-values <font-family-name># { <declaration-rule-list> }`;
 * the `#` multiplier requires at least one family name, so an empty prelude
 * is syntactically invalid and the rule must be dropped.
 * handleFontFeatureValuesRule serializes the prelude into fontFamily and
 * constructs CSSFontFeatureValuesRule('') unconditionally.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

test('CRS-0050/C42: @font-feature-values without a family name is dropped', () => {
  const rules = parseStyleSheet('@font-feature-values { @swash { x: 1 } }');
  assert.equal(rules.length, 0, '<family-name># requires at least one name');
});

test('control: the named form keeps parsing', () => {
  const rules = parseStyleSheet('@font-feature-values Foo { @swash { x: 1 } }');
  assert.equal(rules.length, 1);
});
