/**
 * Reproducer for CRS-0003/C38 (src/parser.ts isSupportedAtRule).
 * '@mediaall' is an unknown at-keyword, distinct from '@media'. Unknown
 * at-rules survive stylesheet parsing (css-syntax-3 #consume-at-rule
 * returns them; cssom-1 #the-cssrule-interface notes every at-rule beyond
 * the listed constants reports type 0, implying such rules exist). The
 * hard-coded 'mediaall' rejection drops the whole rule, disagreeing with
 * the uniform unknown-at-rule treatment of '@foo' and every other name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C38: parse keeps @mediaall like any unknown at-rule', () => {
  const mediaall = parse('@mediaall { p { color: red } }') as unknown as { cssRules: unknown[] };
  const foo = parse('@foo { p { color: red } }') as unknown as { cssRules: unknown[] };
  assert.equal(mediaall.cssRules.length, foo.cssRules.length,
    '@mediaall is an unknown at-rule and must be retained exactly like @foo');
  assert.ok(mediaall.cssRules.length === 1, 'the unknown at-rule must survive');
});

test('CRS-0003/C38: insertRule accepts @mediaall like any unknown at-rule', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('@foo { p { color: red } }');
  const at = sheet.insertRule('@mediaall { p { color: red } }');
  assert.equal(at, 1, 'insertRule must not special-case the @mediaall name');
  assert.equal(sheet.cssRules.length, 2);
});
