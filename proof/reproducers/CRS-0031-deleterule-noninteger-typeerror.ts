/**
 * Reproducer for CRS-0031/C10 (CSSStyleSheet.deleteRule non-integer index).
 *
 * WebIDL types CSSStyleSheet.deleteRule(index) as unsigned long: the raw JS
 * value converts through ToUint32 BEFORE the cssom-1 #remove-a-css-rule
 * bounds check runs. ToUint32(0.5) and ToUint32(NaN) are both 0, so both
 * calls must delete the first rule. The implementation compares the raw
 * number (0.5 >= length is false), reads this._rules[0.5] -> undefined,
 * then isNamespaceRule(undefined) dereferences .type and leaks a raw
 * TypeError instead of any DOMException.
 *
 * Asserts the SAFE contract: non-integer indices convert to 0 and delete
 * the first rule; never a raw TypeError.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: cssom-1 #dom-cssstylesheet-deleterule
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

function freshSheet(): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('a { color: red } b { color: blue }');
  return sheet;
}

test('CRS-0031/C10: deleteRule(0.5) wraps to index 0 per WebIDL ToUint32', () => {
  const sheet = freshSheet();
  sheet.deleteRule(0.5);
  assert.equal(sheet.cssRules.length, 1, 'ToUint32(0.5) is 0, so the first rule is deleted');
  assert.equal((sheet.cssRules[0] as unknown as { selectorText: string }).selectorText, 'b');
});

test('CRS-0031/C10: deleteRule(NaN) wraps to index 0 per WebIDL ToUint32', () => {
  const sheet = freshSheet();
  sheet.deleteRule(NaN);
  assert.equal(sheet.cssRules.length, 1, 'ToUint32(NaN) is 0, so the first rule is deleted');
  assert.equal((sheet.cssRules[0] as unknown as { selectorText: string }).selectorText, 'b');
});
