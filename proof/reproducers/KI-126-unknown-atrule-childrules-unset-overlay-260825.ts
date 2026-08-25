/**
 * Overlay reproducer for KI-126.  This file stays red until unknown at-rules
 * parsed through parse() expose their child rules via CSSAtRule.childRules.
 *
 * Reproduces: KI-126
 * Verifies: SYS-REQ-260825-ENH2
 *
 * Spec anchors:
 * - css-syntax-3 § 5.5.2 #consume-an-at-rule (~line 2607): an at-rule whose
 *   name matches nothing is still consumed in full — prelude plus block — and
 *   retained as an at-rule.  cssom-1 #parse-a-css-stylesheet wraps the parsed
 *   rule list; it defines no CSSUnknownRule and leaves child access for
 *   unrecognized at-rules unregulated.  The defect below is therefore filed
 *   as internal API-consistency interop fidelity (low severity), not as a
 *   cssom-1 violation: our own CSSAtRule contract (src/CSSOM.ts ~L1717)
 *   declares `childRules?: CSSRule[]`, its serializer branches on it
 *   (~L1749), and src/cascade/rule-filter.ts walks `(rule as ASTAtRule)
 *   .childRules` — but the token-stream path in src/parser.ts consumeAtRule
 *   (~L407) constructs `new CSSAtRule(name, prelude, block)` WITHOUT the
 *   children, while the component-value-stream sibling consumeAtRuleFromStream
 *   (~L1308-1310) populates them.  Same class, two entry points, divergent
 *   population.
 * - postcss#8 records the downstream expectation that a retained at-rule
 *   block keeps its inner rules reachable.
 *
 * Observed defect at HEAD via public API:
 *   parse('@support selector(:focus-visible){a:focus-visible{color:red}}')
 *     .cssRules[0] -> CSSAtRule, childRules === undefined, so the inner
 *   qualified rule is reachable only by re-parsing raw cssText text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CSSAtRule } from '../../src/index.ts';
import type { CSSStyleRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260825-ENH2 (KI-126 helper: unknown-at-rule probe)
// reqproof:proptest:skip trivial accessor handing back the first parsed rule; assertions live in the enclosing overlay tests below
function firstRule(source: string): CSSAtRule {
  return parse(source).cssRules[0] as CSSAtRule;
}

test('control: known grouping rule keeps working child rules', () => {
  // Structural view of a grouping rule; avoids widening to any.
  const media = parse('@media screen{a{color:red}}').cssRules[0] as unknown as {
    cssRules: { length: number };
  };
  assert.equal(media.cssRules.length, 1);
});

test('control: unknown at-rule itself is retained with its block text', () => {
  // css-syntax-3 retention of the unknown at-rule works; only child access
  // is dead, so this pins the legs below to that single gap.
  const at = firstRule('@support selector(:focus-visible){a:focus-visible{color:red}}');
  assert.ok(at instanceof CSSAtRule);
  assert.match(at.cssText, /color:red/);
});

test('defect: @support (unknown name) exposes its qualified rule child', () => {
  const at = firstRule('@support selector(:focus-visible){a:focus-visible{color:red}}');
  const kids = at.childRules ?? [];
  assert.equal(kids.length, 1, 'inner qualified rule must be reachable');
  const inner = kids[0] as CSSStyleRule;
  assert.equal(inner.style.getPropertyValue('color'), 'red');
});

test('defect: bare unknown block at-rule exposes its qualified rule child', () => {
  const at = firstRule('@unknownfoo{a{color:red}}');
  const kids = at.childRules ?? [];
  assert.equal(kids.length, 1);
  const inner = kids[0] as CSSStyleRule;
  assert.equal(inner.style.getPropertyValue('color'), 'red');
});

test('defect: nested unknown at-rule inside unknown at-rule stays reachable', () => {
  const outer = firstRule('@x{@y{a{top:0}}}');
  const outerKids = outer.childRules ?? [];
  assert.equal(outerKids.length, 1, 'outer block child must be reachable');
});
