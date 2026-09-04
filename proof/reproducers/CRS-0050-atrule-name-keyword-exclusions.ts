/**
 * Reproducer for CRS-0050/C17 + CRS-0050/C34 (src/parser.ts
 * handleCounterStyleRule / handleKeyframesRule). css-values-4 #custom-ident
 * excludes the CSS-wide keywords (initial, inherit, unset, revert,
 * revert-layer per css-cascade-5 #all-shorthand) and 'default' from every
 * <custom-ident>. css-counter-styles-3 #counter-style further requires
 * <counter-style-name> to be a <custom-ident> that is not an ASCII
 * case-insensitive match for 'none' (an empty name is likewise not an
 * <custom-ident>), and css-animations-1 #keyframes types <keyframes-name>
 * as <custom-ident> | <string>. handleKeyframesRule therefore must drop
 * 'revert-layer' (it only lists none/initial/inherit/unset/revert/default),
 * and handleCounterStyleRule performs no name check at all, so empty,
 * 'none' and 'inherit' names survive.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

test('CRS-0050/C34: @keyframes revert-layer is dropped (CSS-wide keyword)', () => {
  const rules = parseStyleSheet('@keyframes revert-layer { from { color: red } }');
  assert.equal(rules.length, 0, 'revert-layer is a CSS-wide keyword, excluded from <custom-ident>');
});

test('CRS-0050/C17: @counter-style with an empty name is dropped', () => {
  const rules = parseStyleSheet('@counter-style { system: cyclic; }');
  assert.equal(rules.length, 0, 'an empty name is not a <custom-ident>');
});

test('CRS-0050/C17: @counter-style none is dropped', () => {
  const rules = parseStyleSheet('@counter-style none { system: cyclic; }');
  assert.equal(rules.length, 0, "'none' is excluded from <counter-style-name>");
});

test('CRS-0050/C17: @counter-style inherit is dropped (CSS-wide keyword)', () => {
  const rules = parseStyleSheet('@counter-style inherit { system: cyclic; }');
  assert.equal(rules.length, 0, 'CSS-wide keywords are excluded from <custom-ident>');
});

test('control: valid keyframes and counter-style names keep parsing', () => {
  const rules = parseStyleSheet('@keyframes spin { from { color: red } } @counter-style thumbs { system: cyclic; suffix: " "; }');
  assert.equal(rules.length, 2);
});
