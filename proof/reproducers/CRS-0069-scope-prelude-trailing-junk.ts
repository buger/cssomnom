/**
 * Reproducer for CRS-0069/C48: @scope keeps trailing prelude junk instead
 * of dropping the rule.
 *
 * css-cascade-6 § scope-syntax defines
 * '@scope <scope-boundaries>? { <block-contents> }' with
 * '<scope-boundaries> = [ ( <scope-start> ) ]? [ to ( <scope-end> ) ]?'
 * — nothing may follow the end-selector block. handleScopeRule returns the
 * CSSScopeRule without checking that the prelude ended (src/parser.ts:494),
 * unlike handlePropertyRule which rejects extra prelude tokens (720-722).
 * '@scope (a) to (b) junk { }' must be dropped.
 *
 * Reproduces: CRS-0069 @scope trailing prelude junk
 * Verifies: SYS-REQ-260821-7521
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('control: well-formed @scope prelude keeps the rule', () => {
  const sheet = parse('@scope (a) to (b) { div { color: red } }') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 1);
});

test('control: scope-start only is also valid', () => {
  const sheet = parse('@scope (a) { div { color: red } }') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 1);
});

test('CRS-0069/C48: junk after the end-selector block drops the rule', () => {
  const sheet = parse('@scope (a) to (b) junk { div { color: red } }') as CSSStyleSheet;
  assert.equal(
    sheet.cssRules.length,
    0,
    `css-cascade-6 #scope-syntax allows nothing after <scope-end>; got ${sheet.cssRules.length} rule(s): ${JSON.stringify((sheet.cssRules[0] as unknown as { cssText: string } | undefined)?.cssText?.slice(0, 60))}`,
  );
});

test('CRS-0069/C48: junk after the start-selector block drops the rule too', () => {
  const sheet = parse('@scope (a) junk { div { color: red } }') as CSSStyleSheet;
  assert.equal(sheet.cssRules.length, 0);
});
