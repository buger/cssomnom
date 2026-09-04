/**
 * Reproducer for CRS-0043/C02 (requirement SW-REQ-260822-MN8Z,
 * src/parser.ts handleKeyframesRule + src/AbstractTokenizer.ts consumeNumber).
 *
 * consumeNumber accumulates the integer part as an IEEE double, then multiplies
 * by Math.pow(10, power + expSign * exp). A 400-digit integer saturates to
 * Infinity; a trailing e-400 underflows the factor to 0; Infinity * 0 is NaN.
 * css-syntax-3 #consume-a-number interprets the digit string as a base-10
 * number with real-number semantics, so '9...9e-400' is ~1, a valid
 * <percentage>. handleKeyframesRule then compares the NaN against 0 and 100;
 * both comparisons are false, 'NaN%' becomes the keyText, and the
 * CSSKeyframeRule constructor throws SyntaxError out of parseStyleSheet.
 * css-syntax-3 #parse-stylesheet never throws; an invalid keyframe selector
 * means the keyframe is ignored (css-animations-1 #keyframes).
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';

const OVERFLOW_OFFSET = `${'9'.repeat(400)}e-400%`;

test('CRS-0043/C02: parseStyleSheet never throws on a numeric-overflow offset', () => {
  const sheet = new Parser(tokenize(`@keyframes a { ${OVERFLOW_OFFSET} { top: 0 } }`)).parseStyleSheet();
  assert.equal(sheet.cssRules.length, 1, '@keyframes survives');
});

test('CRS-0043/C02: the overflow keyframe keeps a numeric offset keyText', () => {
  const sheet = new Parser(tokenize(`@keyframes a { ${OVERFLOW_OFFSET} { top: 0 } }`)).parseStyleSheet();
  const kf = sheet.cssRules[0] as unknown as { cssRules: { length: number } };
  assert.equal(kf.cssRules.length, 1, 'the ~1% keyframe is kept, not dropped');
});

test('control: a plain huge exponent stays Infinity and the keyframe is ignored', () => {
  const sheet = new Parser(tokenize('@keyframes a { 1e400% { top: 0 } }')).parseStyleSheet();
  const kf = sheet.cssRules[0] as unknown as { cssRules: { length: number } };
  assert.equal(kf.cssRules.length, 0, 'offset > 100 is ignored without throwing');
});
