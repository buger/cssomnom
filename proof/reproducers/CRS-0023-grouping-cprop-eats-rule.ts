/**
 * Reproducer for CRS-0023/C04 (requirement SW-REQ-260821-9KNX,
 * src/parser.ts consumeNestedQualifiedRuleFromStream). css-syntax-3
 * #consume-a-qualified-rule '{'-token arm with |nested| false: a prelude shaped
 * like a custom property consumes a block and returns nothing; the construct
 * after the block stays available to the rule-list caller. The stream variant
 * instead runs consumeRemnantsOfABadDeclaration regardless of the nested flag,
 * so inside a top-level @media body the remnants eat the following valid rule.
 * '@media all { --foo:hover { color: blue } div { color: red } }' therefore
 * loses the div rule; the spec keeps it.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0023/C04: a custom-property rule in a rule-list does not eat its sibling', () => {
  const sheet = parse('@media all { --foo:hover { color: blue } div { color: red } }');
  const media = sheet.cssRules[0] as { cssRules: { selectorText?: string; constructor: { name: string } }[] };
  const selectors = Array.from(media.cssRules, r => r.selectorText ?? r.constructor.name);
  assert.deepEqual(
    selectors,
    ['div'],
    `spec keeps the div rule after the dropped custom-property rule, got ${JSON.stringify(selectors)}`,
  );
});

test('control: plain invalid preludes still drop inside @media', () => {
  const sheet = parse('@media all { div { color: red } }');
  const media = sheet.cssRules[0] as { cssRules: unknown[] };
  assert.equal(media.cssRules.length, 1);
});
