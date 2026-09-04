/**
 * Reproducer for CRS-0015/C06 (requirement SW-REQ-260821-3553, src/parser-api.ts
 * parseValueSync). css-syntax-3 § 5.4.8 #parse-a-component-value discards
 * whitespace BEFORE consuming the one component value. parseValueSync calls
 * parser.consumeComponentValue() directly, so a leading whitespace token becomes
 * the returned value: parseValueSync('  red') returns a token stringifying to
 * ' ' instead of the ident 'red'. The sibling parseComponentValueSync applies
 * the discard and returns 'red'. (Trailing-garbage leniency of the same function
 * is KI-45; this reproducer pins the leading-whitespace leg only.)
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseValueSync, parseComponentValueSync } from '../../src/parser-api.ts';

test('CRS-0015/C06: parseValueSync skips leading whitespace', () => {
  const value = parseValueSync('  red');
  assert.equal(String(value), 'red', 'css-syntax-3 5.4.8 step 2 discards whitespace before consuming the value');
});

test('CRS-0015/C06: a block-shaped prelude value is not swallowed either', () => {
  assert.equal(String(parseValueSync('  (a b)')).startsWith('('), true,
    'the returned value must be the first real component value, never the padding');
});

test('control: trailing whitespace and clean values already come back right', () => {
  assert.equal(String(parseValueSync('red ')), 'red');
  assert.equal(String(parseValueSync('10%')), '10%');
});

test('control: the sibling parseComponentValueSync already skips the whitespace', () => {
  assert.equal(String(parseComponentValueSync('  red')), 'red');
});

test('control: a clean value is unaffected', () => {
  assert.equal(String(parseValueSync('10%')), '10%');
});
