/**
 * Reproducer for CRS-0067/C03 (src/CSSOM.ts CSSStyleSheet.insertRule).
 * WebIDL types the rule argument as CSSOMString. An explicit undefined
 * converts to the string "undefined", which fails css-syntax-3 #parse-a-rule,
 * so cssom-1 § 6.5.3 #insert-a-css-rule step 3-5 must throw a SyntaxError
 * DOMException. insertRule passes the raw value to _parseRule, and tokenize
 * dereferences it, so a raw engine TypeError ("Cannot read properties of
 * undefined") escapes instead of the required SyntaxError.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('CRS-0067/C03: insertRule(undefined) throws SyntaxError, not a raw TypeError', () => {
  const sheet = new CSSStyleSheet();
  assert.throws(
    () => sheet.insertRule(undefined as unknown as string),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'WebIDL converts undefined to "undefined", whose parse must fail with SyntaxError',
  );
  assert.equal(sheet.cssRules.length, 0, 'a failed insert must not mutate cssRules');
});

test('CRS-0067/C03: insertRule(null) throws SyntaxError, not a raw TypeError', () => {
  const sheet = new CSSStyleSheet();
  assert.throws(
    () => sheet.insertRule(null as unknown as string),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'WebIDL converts null to "null", whose parse must fail with SyntaxError',
  );
});

test('control: one valid rule still inserts', () => {
  const sheet = new CSSStyleSheet();
  assert.equal(sheet.insertRule('p { color: red }'), 0);
  assert.equal(sheet.cssRules.length, 1);
});
