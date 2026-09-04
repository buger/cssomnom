/**
 * Reproducer for CRS-0028/C25 (src/CSSOM.ts CSSPageRule constructor /
 * src/parser.ts handlePageRule).
 * css-page-3 #syntax-page-selector defines <<page-selector> as
 * [ <<ident-token>>? <<pseudo-page>>* ]! with <<pseudo-page>> restricted to
 * :left | :right | :first | :blank. ':bogus' matches none of them, so an
 * @page rule with that prelude fails its grammar and css-syntax-3
 * #consume-at-rule requires the whole rule to be dropped. The constructor
 * stores the raw selector text (the selectorText setter correctly ignores
 * it), so parse()/insertRule() keep '@page :bogus { ... }'.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet, CSSPageRule } from '../../src/CSSOM.ts';

test('control: a valid page pseudo-class parses', () => {
  const sheet = parse('@page :left { margin: 1px }') as CSSStyleSheet;
  assert.ok(sheet.cssRules[0] instanceof CSSPageRule);
  assert.equal((sheet.cssRules[0] as unknown as { selectorText: string }).selectorText, ':left');
});

test('CRS-0028/C25: an invalid page selector drops the @page rule', () => {
  const sheet = parse('@page :bogus { margin: 1px }') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 0, ':bogus is not a <<pseudo-page>>, so the rule is invalid');
});

test('CRS-0028/C25: insertRule rejects an invalid page selector too', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('@page :bogus { margin: 1px }');
  assert.equal(sheet.cssRules.length, 0);
});
