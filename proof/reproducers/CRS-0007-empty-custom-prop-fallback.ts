/**
 * Reproducer for CRS-0007/C04 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * Parser.#resolveVarFunction). css-variables-1 #guaranteed-invalid states:
 * "actually writing an empty value into a custom property, like '--foo:;',
 * is a valid (empty) value, not the guaranteed-invalid value." The
 * replace-a-var() algorithm therefore only consults the fallback when the
 * referenced property's value CONTAINS the guaranteed-invalid value.
 * #resolveVarFunction gates substitution on `rawValue && rawValue.trim() !== ''`
 * (src/parser.ts:1769-1770), so a specified-empty '--x:;' is treated as unset
 * and the fallback is spliced in: var(--x, red) resolves to 'red' instead of
 * an empty (invalid at computed-value time) value.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';

test('CRS-0007/C04: a specified-empty custom property must not trigger the var() fallback', () => {
  const sheet = parse('a { --x:; color: var(--x, red); }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.length, 2, 'precondition: --x is declared (empty) next to color');
  const resolved = Parser.resolveVariables(style, 'color');
  assert.equal(resolved.trim(), '', 'empty specified value substitutes empty; the property is invalid at computed-value time, not red');
});

test('control: an unset custom property still uses the fallback', () => {
  const sheet = parse('a { color: var(--missing, red); }');
  const style = sheet.cssRules[0].style;
  assert.equal(Parser.resolveVariables(style, 'color').trim(), 'red');
});

test('control: a non-empty custom property still substitutes', () => {
  const sheet = parse('a { --x: green; color: var(--x, red); }');
  const style = sheet.cssRules[0].style;
  assert.equal(Parser.resolveVariables(style, 'color').trim(), 'green');
});
