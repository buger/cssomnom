/**
 * Reproducer for CRS-0002/C01 (requirement INT-REQ-260821-30ZA, src/CSSOM.ts).
 * Constructed stylesheets parse insertRule text with ParseHooks.consumeRule
 * and never check that only whitespace remains, so trailing extra rules are
 * silently discarded. cssom-1 #insert-a-css-rule step 3 runs css-syntax-3
 * #parse-rule, which is a syntax error unless the input is exactly one rule.
 * WPT css/cssom/insertRule-syntax-error-01.html pins insertRule("p { color:
 * red; } garbage") to a SyntaxError. The parser-injected sheet path already
 * throws; only the constructed default _parseRule skips the EOF check.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0002/C01: constructed insertRule rejects two rules with SyntaxError', () => {
  const sheet = new CSSStyleSheet();
  assert.throws(
    () => sheet.insertRule('p { color: red } p { color: blue }'),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'two rules in one insertRule call must throw SyntaxError',
  );
  assert.equal(sheet.cssRules.length, 0, 'a failed insertRule must not mutate cssRules');
});

test('CRS-0002/C01: constructed insertRule rejects trailing garbage (WPT shape)', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('p { color: green; }');
  assert.throws(
    () => sheet.insertRule('p { color: red; } garbage', 1),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'trailing garbage after the rule must throw SyntaxError',
  );
});

test('CRS-0002/C01 control: one valid rule still inserts on a constructed sheet', () => {
  const sheet = new CSSStyleSheet();
  const idx = sheet.insertRule('p { color: red }');
  assert.equal(idx, 0);
  assert.equal(sheet.cssRules.length, 1);
});

test('CRS-0002/C01 control: parser-created sheets already enforce the EOF check', () => {
  const sheet = parse('div {}') as unknown as CSSStyleSheet;
  assert.throws(
    () => sheet.insertRule('p { color: red } p { color: blue }'),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
  );
});
