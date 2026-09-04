/**
 * Reproducer for CRS-0056/C11, C13, C14 (src/CSSOM.ts constructors).
 * CSSKeyframesRule, CSSGroupingRule subclasses such as CSSMediaRule, and
 * StyleSheetList store the caller-supplied array by reference
 * (`this._rules = rules`, `this._sheets = sheets`). Mutating the object
 * model through the rule therefore mutates the caller's array, and later
 * caller-side pushes surface as new OM members. The constructors are
 * exported public API (src/index.ts `export * from './CSSOM.ts'`), and
 * CSSStyleSheet.createInternal in the same file copies via push(...),
 * so the aliasing is an isolation gap, not a design choice.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSKeyframesRule, CSSMediaRule, StyleSheetList, CSSStyleRule } from '../../src/CSSOM.ts';
import { parseRuleInBlock } from '../../src/parser.ts';

test('CRS-0056/C13: grouping-rule insertRule does not mutate the caller array', () => {
  const base = parse('a { color: red }') as unknown as { cssRules: CSSStyleRule[] };
  const kids = [base.cssRules[0]];
  const media = new CSSMediaRule('all', kids, parseRuleInBlock);
  media.insertRule('div { color: blue }', 1);
  assert.equal(kids.length, 1, 'insertRule must not splice the caller-owned array');
});

test('CRS-0056/C11: keyframes appendRule does not mutate the caller array', () => {
  const kids: never[] = [];
  const kf = new CSSKeyframesRule('x', kids);
  kf.appendRule('0% { opacity: 0 }');
  assert.equal(kids.length, 0, 'appendRule must not push into the caller-owned array');
});

test('CRS-0056/C14: StyleSheetList length does not track the caller array', () => {
  const arr: unknown[] = [];
  const list = new StyleSheetList(arr as never);
  arr.push('extra');
  assert.equal(list.length, 0, 'pushing to the caller array must not grow the StyleSheetList');
});

test('control: sheet-level createInternal isolates its rule list', () => {
  const base = parse('a { color: red }') as unknown as { cssRules: CSSStyleRule[] };
  const kids = [base.cssRules[0]];
  const sheet2 = parse('b { color: green }') as unknown as { cssRules: CSSStyleRule[] };
  assert.equal(sheet2.cssRules.length, 1);
  assert.notEqual(sheet2.cssRules, kids);
});
