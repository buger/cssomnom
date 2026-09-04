/**
 * Reproducer for CRS-0018/C10 (src/parser.ts consumeBlockContents /
 * Parser.isSupportedAtRule). css-cascade-5 #at-import: an @import rule must
 * precede all other valid rules in a style sheet or it is invalid; @import
 * inside a block is ignored (WPT css/CSS2/syntax/at-rule-004.xht asserts the
 * imported sheet never applies). The parser keeps the @import as a
 * CSSImportRule inside the @media rule instead of dropping it, contradicting
 * the same hierarchy rule that CSSGroupingRule.insertRule enforces with
 * HierarchyRequestError.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0018/C10: @import inside @media is dropped as invalid', () => {
  const sheet = parse('@media screen { @import url("foo.css"); }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules.length, 1, 'the @media rule itself parses');
  assert.equal(
    sheet.cssRules[0].cssRules.length,
    0,
    'css-cascade-5 #at-import + WPT css/CSS2/syntax/at-rule-004.xht: an @import inside a block is ignored'
  );
});

test('CRS-0018/C10: @import inside @supports is dropped as invalid', () => {
  const sheet = parse('@supports (color: red) { @import url("foo.css"); }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules[0].cssRules.length, 0, 'grouping-rule bodies cannot retain @import');
});

test('CRS-0027/C25: @import inside @scope is dropped as invalid', () => {
  const sheet = parse('@scope { @import url("foo.css"); }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules.length, 1, 'the @scope rule itself parses');
  assert.equal(sheet.cssRules[0].cssRules.length, 0, '@scope is a grouping rule, so its body cannot retain @import');
});

test('control: top-level @import still constructs the rule', () => {
  const sheet = parse('@import url("foo.css");') as unknown as { cssRules: { href: string }[] };
  assert.equal(sheet.cssRules.length, 1);
  assert.equal(sheet.cssRules[0].href, 'foo.css');
});
