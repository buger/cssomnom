/**
 * Reproducer for CRS-0007/C06 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * Parser.#resolveVarFunction). css-variables-1 #guaranteed-invalid: the only
 * way to create the guaranteed-invalid value is an invalid substitution
 * function; replace-a-var() step 2 parses the first argument as a
 * <custom-property-name> and, failing that, yields the guaranteed-invalid
 * value, which makes the containing property invalid at computed-value time.
 * #resolveVarFunction returns an EMPTY component-value array for a var()
 * whose first argument is not a dashed ident (src/parser.ts:1752-1757), and
 * #resolveVariablesInComponentValues spreads that array away, so
 * 'red var(foo) blue' silently resolves to 'red blue' instead of invalid.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';

test('CRS-0007/C06: a malformed var() must poison the whole value, not splice out', () => {
  const sheet = parse('a { color: red var(foo) blue; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('color').trim(), 'red var(foo) blue', 'precondition: declaration parses (var() defers grammar checking)');
  const resolved = Parser.resolveVariables(style, 'color');
  assert.equal(resolved.trim(), '', 'an invalid substitution function makes the property invalid at computed-value time');
});

test('CRS-0007/C06: a numeric var() name is equally invalid substitution', () => {
  const sheet = parse('a { color: red var(123) blue; }');
  const style = sheet.cssRules[0].style;
  const resolved = Parser.resolveVariables(style, 'color');
  assert.equal(resolved.trim(), '', '123 does not parse as a custom-property-name');
});

test('control: a valid var() still substitutes', () => {
  const sheet = parse('a { --x: green; color: var(--x); }');
  const style = sheet.cssRules[0].style;
  assert.equal(Parser.resolveVariables(style, 'color').trim(), 'green');
});
