/**
 * Reproducer for CRS-0035/C04 (src/CSSOM.ts CSSGroupingRule.insertRule).
 *
 * cssom-1 #insert-a-css-rule steps 3-5 run parse a CSS rule (css-syntax-3
 * #parse-a-rule requires exactly one rule and no trailing garbage) and
 * throw SyntaxError when it fails. For a non-nested grouping rule such as
 * @media the nested-declaration recovery of step 4 must not run. The
 * implementation wraps ParseHooks.parseRule in an empty catch and then
 * always attempts _parseRuleInBlock, whose consumeBlockContents recovery
 * keeps the leading qualified rule and swallows the trailing garbage, so
 * insertRule succeeds and mutates cssRules. Distinct from KI-160, which
 * pins the constructed CSSStyleSheet default _parseRule; this is the
 * grouping-rule empty-catch path. Asserts the spec outcome so this
 * command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

function mediaRule(): { cssRules: { length: number } } {
  const sheet = parse('@media all { }');
  return (sheet as unknown as { cssRules: { length: number }[] }).cssRules[0] as unknown as { cssRules: { length: number } };
}

test('CRS-0035/C04: grouping insertRule rejects trailing garbage', () => {
  const media = mediaRule();
  assert.throws(
    () => (media as unknown as { insertRule(r: string, i?: number): number }).insertRule('.a { color: red; } garbage'),
    (e: Error) => e instanceof Error && (e as { name?: string }).name === 'SyntaxError',
    'parse a CSS rule fails on trailing garbage, so insertRule must throw SyntaxError');
  assert.equal(media.cssRules.length, 0, 'a failed insert must not mutate cssRules');
});

test('CRS-0035/C04: grouping insertRule rejects two concatenated rules', () => {
  const media = mediaRule();
  assert.throws(
    () => (media as unknown as { insertRule(r: string, i?: number): number }).insertRule('.a { color: red } .b { color: blue }'),
    (e: Error) => (e as { name?: string }).name === 'SyntaxError');
  assert.equal(media.cssRules.length, 0);
});

test('control: one complete rule still inserts into the grouping rule', () => {
  const media = mediaRule();
  (media as unknown as { insertRule(r: string, i?: number): number }).insertRule('.a { color: red; }');
  assert.equal(media.cssRules.length, 1);
});
