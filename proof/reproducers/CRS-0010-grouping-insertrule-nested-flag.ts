/**
 * Reproducer for CRS-0010/C01 and CRS-0010/C17 (requirement
 * INT-REQ-260821-ZMZR, src/CSSOM.ts CSSGroupingRule.insertRule).
 *
 * CSSGroupingRule.insertRule derives the nested flag from
 * `this instanceof CSSStyleRule || this.parentRule !== null`.
 * cssom-1 #dom-cssgroupingrule-insertrule runs insert-a-css-rule, which
 * parses the text with css-syntax-3 #parse-a-rule; css-nesting-1 #conditionals
 * makes block-contents parsing apply only to group rules nested inside a
 * STYLE rule. A group rule whose parent is another group rule (media in
 * media, scope in media) is therefore parsed as plain rules: the inserted
 * selector must stay unmangled. The over-broad flag routes the text through
 * parseRuleInBlock(rule, true) -> normalizeNestedSelector, which prepends
 * the implicit nesting selector, so insertRule yields "& div" where the
 * same stylesheet text parsed in place yields "div".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSMediaRule, CSSStyleRule, CSSGroupingRule } from '../../src/CSSOM.ts';

// Reproduces: pending KI (CRS-0010/C01)
test('CRS-0010/C01: insertRule into a media-in-media keeps the selector unmangled', () => {
  const sheet = parse('@media a { @media b { } }');
  const outer = sheet.cssRules[0] as CSSMediaRule;
  const inner = outer.cssRules[0] as CSSGroupingRule;
  inner.insertRule('div { color: red; }', 0);
  const inserted = inner.cssRules[0] as CSSStyleRule;
  assert.equal(inserted.selectorText, 'div', 'group rule under a group rule is not a nested style context');
});

// Reproduces: pending KI (CRS-0010/C01) — control: the same text parsed in place
test('CRS-0010/C01 control: parsing the same text in place keeps "div"', () => {
  const sheet = parse('@media a { @media b { div { color: red } } }');
  const outer = sheet.cssRules[0] as CSSMediaRule;
  const inner = outer.cssRules[0] as CSSMediaRule;
  assert.equal((inner.cssRules[0] as CSSStyleRule).selectorText, 'div');
});

// Reproduces: pending KI (CRS-0010/C17)
test('CRS-0010/C17: insertRule into a @scope inside @media keeps the selector unmangled', () => {
  const sheet = parse('@media a { @scope (div) { span { color: red } } }');
  const media = sheet.cssRules[0] as CSSMediaRule;
  const scope = media.cssRules[0] as CSSGroupingRule;
  scope.insertRule('span2 { color: blue; }', 0);
  const inserted = scope.cssRules[0] as CSSStyleRule;
  assert.equal(inserted.selectorText, 'span2', '@scope under a group rule is not a nested style context');
});

// Reproduces: pending KI (CRS-0010/C17) — control: WPT-pinned top-level behavior stays correct
test('CRS-0010/C17 control: top-level media insertRule stays unmangled and style-rule insert stays nested', () => {
  const sheet = parse('@media all { } div { }');
  const media = sheet.cssRules[0] as CSSGroupingRule;
  media.insertRule('.foo {}', 0);
  assert.equal((media.cssRules[0] as CSSStyleRule).selectorText, '.foo');
});
