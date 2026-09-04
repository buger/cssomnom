/**
 * Reproducer for CRS-0027/C24 (src/parser.ts Parser.handleLayerRule).
 * css-cascade-5 #layer-block defines the block form as
 * `@layer <layer-name>? { <rule-list> }` (a single optional layer name);
 * only the statement form `@layer <layer-name>#;` takes a comma list.
 * The block path forwards the raw serialized prelude into
 * handleGroupingAtRule, so '@layer foo, bar { ... }' survives as a
 * CSSLayerBlockRule named "foo, bar" instead of being dropped.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet, CSSLayerBlockRule, CSSLayerStatementRule } from '../../src/CSSOM.ts';

test('control: a single-name @layer block parses', () => {
  const sheet = parse('@layer foo { div { color: red } }') as CSSStyleSheet;
  assert.ok(sheet.cssRules[0] instanceof CSSLayerBlockRule);
  assert.equal((sheet.cssRules[0] as unknown as { name: string }).name, 'foo');
});

test('control: the statement form keeps its comma list', () => {
  const sheet = parse('@layer foo, bar;') as CSSStyleSheet;
  assert.ok(sheet.cssRules[0] instanceof CSSLayerStatementRule);
});

test('CRS-0027/C24: a comma list is invalid as an @layer block prelude', () => {
  const sheet = parse('@layer foo, bar { div { color: red } }') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 0, 'css-cascade-5 #layer-block allows at most one <layer-name>');
});
