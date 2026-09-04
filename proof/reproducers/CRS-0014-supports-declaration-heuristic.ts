/**
 * Reproducer for CRS-0014/C09 (requirement SW-REQ-260821-2Z0N session packet
 * src/parser-api.ts supports / CSS.supports).
 *
 * css-conditional-3 12.1 #supports(conditionText) runs the string as a
 * <supports-condition>, then - step 2 - retries the string WRAPPED IN
 * PARENTHESES and evaluated as a <supports-condition>. Wrapping a declaration
 * in parens makes it a <supports-decl>, so every browser returns true for
 *   CSS.supports('--not-foo: 1')     custom property, any value is valid
 *   CSS.supports('content: "and"')   valid <string> for content
 *   CSS.supports('color: red [trailing comment with "not"]')
 *                                      comments are stripped by the tokenizer
 *
 * supports() guards its declaration shortcut with a word-boundary regexp for
 * and-or-not over the raw string (src/parser-api.ts ~770), so those three
 * inputs skip the shortcut,
 * fall through to evalSupportsConditionValues on a bare declaration, and
 * return false. The heuristic matches "not" inside '--not-foo', "and" inside a
 * quoted string, and "not" inside a comment.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';

test('CRS-0014/C09: a declaration whose custom property name contains "not"', () => {
  assert.equal(CSS.supports('--not-foo: 1'), true, 'css-conditional-3 12.1 step 2 wraps it in parens');
});

test('CRS-0014/C09: a declaration whose value is a quoted string containing "and"', () => {
  assert.equal(CSS.supports('content: "and"'), true);
});

test('CRS-0014/C09: a declaration followed by a comment containing "not"', () => {
  assert.equal(CSS.supports('color: red /* not */'), true);
});

// controls: the shortcut still works without the reserved words, and
// genuinely invalid declarations stay false.
test('control: declaration shortcut and rejection both still work', () => {
  assert.equal(CSS.supports('color: red'), true);
  assert.equal(CSS.supports('(color: red)'), true);
  assert.equal(CSS.supports('not (color: red)'), false);
  assert.equal(CSS.supports('--not-foo'), false, 'no colon: not a declaration');
});
