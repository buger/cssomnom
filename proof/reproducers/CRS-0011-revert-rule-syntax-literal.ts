/**
 * Reproducer for CRS-0011/C28 (src/PropertyRegistry.ts consumeSyntaxComponent).
 * The CSS-wide keyword rejection list is
 * [initial, inherit, unset, revert, revert-layer, default] and omits
 * revert-rule. css-cascade-5 #revert-rule-keyword defines revert-rule as a
 * CSS-wide keyword, and css-properties-values-api #consume-a-syntax-component
 * requires a literal name that parses as <custom-ident>; css-values-4
 * excludes CSS-wide keywords from <custom-ident>. So the syntax string
 * 'revert-rule' must throw SyntaxError; the implementation accepts it as a
 * literal ident (and then matches the value 'revert-rule').
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

const isSyntaxError = (e: unknown) => (e as DOMException)?.name === 'SyntaxError';

test('CRS-0011/C28: syntax "revert-rule" is rejected as a CSS-wide keyword', () => {
  PropertyRegistry.clear();
  assert.throws(
    () => CSS.registerProperty({ name: '--c28-revert-rule', inherits: false, syntax: 'revert-rule', initialValue: 'revert-rule' }),
    isSyntaxError,
    'revert-rule is a CSS-wide keyword (css-cascade-5 #revert-rule-keyword)',
  );
});

test('control: a plain literal keyword syntax still registers', () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() =>
    CSS.registerProperty({ name: '--c28-literal', inherits: false, syntax: 'small', initialValue: 'small' }));
  PropertyRegistry.clear();
});

test('control: the other CSS-wide keywords are already rejected', () => {
  PropertyRegistry.clear();
  for (const kw of ['initial', 'unset', 'revert-layer']) {
    assert.throws(
      () => CSS.registerProperty({ name: `--c28-${kw}`, inherits: false, syntax: kw, initialValue: kw }),
      isSyntaxError,
      `${kw} must be rejected`,
    );
  }
  PropertyRegistry.clear();
});
