/**
 * Reproducer for CRS-0044/C08 (requirement SW-REQ-260822-YBF2,
 * src/CSSOM.ts normalizeKeyframeSelector).
 *
 * normalizeKeyframeSelector accepts '50 %': trimmed.endsWith('%') is true,
 * slice+trim strips the interior space, and Number('50') passes the range
 * check, so the setter stores '50%'. css-animations-1
 * #interface-csskeyframerule-attributes requires a SyntaxError for an
 * invalid keyframe selector, and the keyframe selector grammar is
 * from | to | <percentage>: a CSSOM string parse of '50 %' yields a
 * <number-token> plus a '%' delim, not a <percentage-token>. KI-44 pins the
 * JS-radix leg ('0x10%'); this pins the whitespace leg.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSKeyframeRule } from '../../src/CSSOM.ts';

test('CRS-0044/C08: keyText "50 %" throws SyntaxError', () => {
  const rule = new CSSKeyframeRule('0%', []);
  assert.throws(() => { rule.keyText = '50 %'; }, DOMException);
  assert.equal(rule.keyText, '0%', 'keyText remains unchanged after the throw');
});

test('CRS-0044/C08: findRule-style normalization also rejects "0 %"', () => {
  const rule = new CSSKeyframeRule('0%', []);
  assert.throws(() => { rule.keyText = '0 %'; }, DOMException);
});

test('controls: token-form percentages and from/to still normalize', () => {
  const rule = new CSSKeyframeRule('0%', []);
  rule.keyText = '50%';
  assert.equal(rule.keyText, '50%');
  rule.keyText = ' from , to ';
  assert.equal(rule.keyText, '0%, 100%');
});
