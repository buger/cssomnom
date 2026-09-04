/**
 * Reproducer for CRS-0062/C07 (requirement SYS-REQ-260821-NHZ8, src/parser.ts).
 *
 * css-syntax-3 #consume-an-at-rule keeps unrecognized at-rules: their block is
 * retained and the rule is returned for verbatim CSSOM preservation. Reaching
 * the stream-path fallback (consumeAtRuleFromStream, src/parser.ts ~L1311-1314)
 * parses the block via consumeBlockContents(block, nested=false), which drops
 * declaration runs. When the block also contains a qualified rule, childRules
 * is non-empty and CSSAtRule.cssText serializes from those structured children
 * instead of the raw block, so the declarations vanish from the stylesheet.
 *
 * Note: the claim's literal top-level trigger keeps the raw text through the
 * token-stream path (consumeAtRule). The reachable manifestation of the same
 * fallback line is an unknown at-rule inside a top-level group rule, where
 * isNestedStyleRule is false. That trigger silently deletes 'color: red;'.
 *
 * Asserts the intended contract so this command FAILS while the bug is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0062/C07: unknown at-rule inside a group rule keeps its block verbatim', () => {
  const css = '@media screen { @foo { .a { color: blue } color: red; } }';
  const sheet = parse(css);
  const media = sheet.cssRules[0];
  const foo = media.cssRules[0] as unknown as { cssText: string };

  // css-syntax-3 #consume-an-at-rule: unrecognized at-rules are preserved.
  // The declaration 'color: red;' must survive the round trip.
  assert.ok(
    foo.cssText.includes('color: red'),
    `unknown at-rule cssText must keep the block declaration, got ${JSON.stringify(foo.cssText)}`,
  );
});

test('CRS-0062/C07: declarations-only unknown at-rule body stays intact', () => {
  const css = '@media screen { @foo { .a { color: blue } color: red; background: green; } }';
  const sheet = parse(css);
  const foo = sheet.cssRules[0].cssRules[0] as unknown as { cssText: string };
  assert.ok(foo.cssText.includes('background'),
    `second declaration must survive, got ${JSON.stringify(foo.cssText)}`);
});

test('control: top-level unknown at-rule already preserves raw text', () => {
  const sheet = parse('@foo { .a { color: blue } color: red; }');
  const foo = sheet.cssRules[0] as unknown as { cssText: string };
  assert.ok(foo.cssText.includes('color: red'), 'the token-stream path keeps the raw block');
});
