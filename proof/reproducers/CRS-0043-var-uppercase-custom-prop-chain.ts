/**
 * Reproducer for CRS-0043/C18 (requirement SW-REQ-260822-MN8Z,
 * src/parser.ts #resolveOneVariable / #resolveVarFunction).
 *
 * #resolveOneVariable compares the function token name with === 'var' and
 * === 'env'. css-values-4 #functional-notation states function names are
 * ASCII case-insensitive, and WPT css-variables/variable-reference-20.html
 * requires 'color: VAR(--a)' to substitute. Non-custom property values are
 * lowercased by the serializer, so the bug hides there, but custom property
 * values round-trip with preserved case: '--b: VAR(--a); color: var(--b)'
 * must resolve to 'green'. The case-sensitive compare recurses into the
 * function body without substituting, leaving 'var(--a)' behind.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';
import { Parser } from '../../src/parser.ts';

function styleWith(css: Record<string, string>): CSSStyleDeclaration {
  const style = new CSSStyleDeclaration();
  for (const [prop, value] of Object.entries(css)) style.setProperty(prop, value);
  return style;
}

test('CRS-0043/C18: VAR() inside a custom property chain substitutes', () => {
  const style = styleWith({ '--a': 'green', '--b': 'VAR(--a)', color: 'var(--b)' });
  assert.equal(Parser.resolveVariables(style, 'color'), 'green');
});

test('CRS-0043/C18: ENV() inside a custom property chain substitutes', () => {
  const style = styleWith({ '--a': 'blue', '--b': 'ENV(--a)', color: 'var(--b)' });
  assert.equal(Parser.resolveVariables(style, 'color'), 'blue');
});

test('control: lowercase var() inside a custom property chain substitutes', () => {
  const style = styleWith({ '--a': 'green', '--b': 'var(--a)', color: 'var(--b)' });
  assert.equal(Parser.resolveVariables(style, 'color'), 'green');
});
