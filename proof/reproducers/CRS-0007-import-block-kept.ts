/**
 * Reproducer for CRS-0007/C22 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * Parser.consumeAtRule / AT_RULE_HANDLERS.import). css-cascade-5 #at-import
 * defines @import as a statement at-rule terminated by ';':
 *   @import [ <url> | <string> ] [ layer | layer(<layer-name>) ]?
 *           <import-conditions> ;
 * css-syntax-3 #consume-at-rule '{' arm consumes the block and then returns
 * the at-rule only "if valid in the current context", otherwise nothing.
 * An @import prelude followed by a style block does not match the @import
 * grammar, so the rule must be dropped. AT_RULE_HANDLERS.import drops the
 * block argument and handleImportRule unconditionally constructs a
 * CSSImportRule, so '@import "x.css" { }' is kept with the block discarded.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0007/C22: @import with a style block is dropped', () => {
  const sheet = parse('@import "x.css" { }');
  assert.equal(sheet.cssRules.length, 0, '@import grammar has no block form; the rule is invalid in context');
});

test('CRS-0007/C22: a blockful @import does not shadow later rules', () => {
  const sheet = parse('@import "x.css" { div { color: red } } p { color: blue }');
  assert.equal(sheet.cssRules.length, 1, 'the blockful import disappears and p remains');
  assert.equal(sheet.cssRules[0].constructor.name, 'CSSStyleRule');
});

test('control: a semicolon-terminated @import is kept', () => {
  const sheet = parse('@import "x.css";');
  assert.equal(sheet.cssRules.length, 1);
  assert.equal(sheet.cssRules[0].constructor.name, 'CSSImportRule');
});
