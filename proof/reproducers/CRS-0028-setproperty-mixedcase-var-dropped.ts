/**
 * Reproducer for CRS-0028/C08 (src/CSSStyleDeclaration.ts setProperty).
 * CSS function names are ASCII case-insensitive (css-values-4 #keywords /
 * infra #ascii-case-insensitive), so 'VAR(--m)' is a var() substitution in a
 * shorthand. The shorthand branch detects var() with the case-sensitive
 * substring value.includes('var('), so mixed case skips the pending-
 * substitution store path, expand() rejects the tokens, and the declaration
 * is dropped instead of stored for later substitution.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('control: lowercase var() in a shorthand is stored pending substitution', () => {
  const s = new CSSStyleDeclaration();
  s.setProperty('margin', 'var(--m)');
  assert.equal(s.getPropertyValue('margin'), 'var(--m)');
});

test('CRS-0028/C08: mixed-case VAR() in a shorthand is stored, not dropped', () => {
  const s = new CSSStyleDeclaration();
  s.setProperty('margin', 'VAR(--m)');
  assert.equal(s.getPropertyValue('margin'), 'VAR(--m)', 'VAR() is ASCII case-insensitive and must be stored');
  assert.ok(s.cssText.includes('margin'), 'the shorthand declaration must survive setProperty');
});
