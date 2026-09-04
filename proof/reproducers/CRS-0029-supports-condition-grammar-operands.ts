/**
 * Reproducer for CRS-0029/C18 and CRS-0029/C19 (src/parser-api.ts
 * evalSupportsConditionValues).
 * css-conditional-3 #supports-condition grammar:
 *   <supports-condition> = not <supports-in-parens>
 *                        | <supports-in-parens> [ and <supports-in-parens> ]*
 *                        | <supports-in-parens> [ or <supports-in-parens> ]*
 *   <supports-in-parens> = ( <supports-condition> ) | <supports-feature> | <general-enclosed>>
 * A bare ident after 'not', or after an 'or' operator, is none of those, so
 * the whole condition fails to parse and CSS.supports() must return false.
 * The evaluator inverts and ORs the operands without checking that each one
 * is a grammatical <supports-in-parens>, so 'not foo' and
 * '(color: red) or foo' return true.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports } from '../../src/parser-api.ts';

test('control: well-formed conditions still evaluate', () => {
  assert.equal(supports('not (color: red)'), false);
  assert.equal(supports('not (color: not-a-color)'), true);
  assert.equal(supports('(color: red) or (color: blue)'), true);
  assert.equal(supports('(color: red) or (color: not-a-color)'), true);
});

test('CRS-0029/C18: "not foo" is not a <supports-condition>', () => {
  assert.equal(supports('not foo'), false, "'foo' is not a <supports-in-parens>, so the condition does not parse");
});

test('CRS-0029/C18: "not screen" is not a <supports-condition>', () => {
  assert.equal(supports('not screen'), false);
});

test('CRS-0029/C19: an invalid operand invalidates the or-chain', () => {
  assert.equal(supports('(color: red) or foo'), false, "'foo' after 'or' does not parse as <supports-in-parens>");
});

test('CRS-0029/C19: an invalid operand invalidates the and-chain', () => {
  assert.equal(supports('(color: red) and foo'), false);
});
