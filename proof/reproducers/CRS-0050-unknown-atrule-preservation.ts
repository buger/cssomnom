/**
 * Reproducer for CRS-0050/C07 + CRS-0050/C44 (src/parser.ts
 * Parser.getAtRuleHandler / Parser.isSupportedAtRule). css-syntax-3
 * #consume-at-rule returns unrecognized at-rules so they survive stylesheet
 * ingestion (cssom-1 #the-cssrule-interface reports them as type 0); the
 * mediaall special case of the same class is KI-176. getAtRuleHandler routes
 * EVERY name ending in '-keyframes' (not only vendor-prefixed keyframes) into
 * handleKeyframesRule, so '@not-keyframes foo {...}' is mis-typed as a
 * CSSKeyframesRule and a prelude-free '@not-keyframes {}' is dropped. And
 * isSupportedAtRule drops every at-name starting with '--', so '@--foo {}'
 * never reaches the preserved unknown-at-rule path.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

const ctor = (r: unknown) => (r as { constructor: { name: string } }).constructor.name;

test('CRS-0050/C07: @not-keyframes with a name survives as an unknown at-rule, not a keyframes rule', () => {
  const rules = parseStyleSheet('@not-keyframes spin { from { color: red } }');
  assert.equal(rules.length, 1, 'the unknown at-rule must survive');
  assert.notEqual(ctor(rules[0]), 'CSSKeyframesRule', 'a non-vendor *-keyframes name must not be typed as keyframes');
});

test('CRS-0050/C07: a prelude-free @not-keyframes block survives as an unknown at-rule', () => {
  const rules = parseStyleSheet('@not-keyframes { }');
  assert.equal(rules.length, 1, 'the unknown at-rule must survive instead of being dropped');
});

test('CRS-0050/C44: a dashed @--foo at-rule survives as an unknown at-rule', () => {
  const rules = parseStyleSheet('@--foo { color: red }');
  assert.equal(rules.length, 1, 'dashed at-names are valid at-keywords and must survive as unknown at-rules');
});

test('control: @foo {} survives as an unknown at-rule', () => {
  const rules = parseStyleSheet('@foo { }');
  assert.equal(rules.length, 1);
  assert.equal(ctor(rules[0]), 'CSSAtRule');
});
