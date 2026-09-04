/**
 * Reproducer for CRS-0014/C01 (requirement SW-REQ-260821-2Z0N session packet
 * src/parser-api.ts parseRuleSync).
 *
 * css-syntax-3 5.4.6 #parse-a-rule:
 *   step 3 - "If the next token from input is an <EOF-token>, return a syntax
 *             error."
 *   step 4 - "Otherwise ... consume a qualified rule ... If nothing or an
 *             invalid rule error was returned, return a syntax error."
 * The WICG CSS Parser API parseRule() surfaces that as a rejected promise.
 * parseRuleSync (src/parser-api.ts L536-538) returns null instead, so callers
 * cannot distinguish "empty stylesheet" from "not one valid rule".
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRuleSync } from '../../src/parser-api.ts';

function assertSyntaxError(css: string): void {
  let returned: unknown = 'no-throw';
  try {
    returned = parseRuleSync(css);
  } catch (e) {
    assert.ok(e instanceof DOMException, `${JSON.stringify(css)} must raise a DOMException`);
    assert.equal((e as DOMException).name, 'SyntaxError');
    return;
  }
  assert.fail(`parseRuleSync(${JSON.stringify(css)}) returned ${JSON.stringify(String(returned))} instead of a syntax error`);
}

test('CRS-0014/C01: empty input is a syntax error, not null', () => {
  assertSyntaxError('');
  assertSyntaxError('   ');
  assertSyntaxError('/*c*/');
});

test('CRS-0014/C01: an EOF-truncated qualified rule is a syntax error', () => {
  assertSyntaxError('div');
  assertSyntaxError('}');
});

// control: one valid rule parses, and trailing garbage already throws.
test('control: one rule parses and trailing garbage throws', () => {
  assert.equal(String(parseRuleSync('div {}')), 'div{}');
  assert.equal(String(parseRuleSync('div {}\n\t  ')), 'div{}');
  assert.throws(() => parseRuleSync('div {} span {}'), DOMException);
});
