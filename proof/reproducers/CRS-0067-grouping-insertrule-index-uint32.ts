/**
 * Reproducer for CRS-0067/C15 (src/CSSOM.ts CSSGroupingRule.insertRule).
 * WebIDL types the index argument of insertRule as unsigned long, so the IDL
 * boundary converts the value before cssom-1 § 6.5.3 #insert-a-css-rule runs.
 * ToUint32 maps 0.5 to 0 and NaN to 0. The grouping rule compares the raw JS
 * value instead: index 0.5 on an empty child list fails `index > length` and
 * throws IndexSizeError before parsing, and NaN bypasses the bounds check and
 * is returned as the insertion index. Distinct from KI-163, which pins the
 * identical raw check on CSSStyleSheet.insertRule; this is the grouping copy
 * at line 688.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSMediaRule } from '../../src/CSSOM.ts';

function mediaRule(): CSSMediaRule & { insertRule(r: string, i?: number): number } {
  const sheet = parse('@media all { }');
  return sheet.cssRules[0] as CSSMediaRule & { insertRule(r: string, i?: number): number };
}

test('CRS-0067/C15: fractional index 0.5 parses the rule instead of IndexSizeError', () => {
  const media = mediaRule();
  assert.throws(
    () => media.insertRule('@@@', 0.5),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'ToUint32(0.5) is 0, so the bad rule must reach parsing and throw SyntaxError',
  );
  assert.equal(media.cssRules.length, 0, 'a failed insert must not mutate cssRules');
});

test('CRS-0067/C15: NaN index wraps to 0 and returns 0', () => {
  const media = mediaRule();
  const idx = media.insertRule('div {}', NaN);
  assert.equal(idx, 0, 'ToUint32(NaN) is 0, so insertRule returns 0');
  assert.equal(media.cssRules.length, 1);
});

test('control: integer indices still work and out-of-range still throws', () => {
  const media = mediaRule();
  assert.equal(media.insertRule('a {}', 0), 0);
  assert.throws(
    () => media.insertRule('b {}', 5),
    (e: unknown) => (e as DOMException).name === 'IndexSizeError',
  );
});
