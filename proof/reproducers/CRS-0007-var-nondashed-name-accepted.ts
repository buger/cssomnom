/**
 * Reproducer for CRS-0007/C13 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * validateVarFunction). css-variables-1 #-at-rule... precisely §2 "Defining
 * Custom Properties": "if the value of a custom property contains a var()
 * reference, the var() reference must be valid according to the specified
 * var() grammar. If not, the custom property is invalid and must be
 * ignored." The var() grammar is var( <custom-property-name> ,
 * <declaration-value>? ) and a <custom-property-name> is a dashed ident.
 * validateVarFunction only rejects an empty name and curly-block mixes; it
 * accepts var(foo)/var(123), so '--x: var(foo)' is retained verbatim in the
 * CSSOM instead of being ignored at parse time.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0007/C13: a custom property holding a non-dashed var() name is ignored', () => {
  const sheet = parse('a { --x: var(foo); color: green; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('--x'), '', 'css-variables-1 §2: invalid var() reference makes the custom property invalid');
  assert.equal(style.length, 1, 'the ignored custom property must not count as a declaration');
  assert.equal(style.getPropertyValue('color').trim(), 'green');
});

test('CRS-0007/C13: a numeric var() name is likewise not a custom-property-name', () => {
  const sheet = parse('a { --x: var(123); }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('--x'), '');
});

test('control: a well-formed var() reference is kept', () => {
  const sheet = parse('a { --x: var(--y, red); }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('--x').trim(), 'var(--y, red)');
});
