/**
 * Overlay reproducer for KI-133. This file stays red until grammatically
 * invalid @supports rules are IGNORED (dropped with all contents) at
 * stylesheet ingest instead of being retained verbatim.
 *
 * Reproduces: KI-133
 * Source vector: V-MALFORMED-RECOVER
 *
 * Spec anchors:
 * - css-conditional-3 § #supports-syntax: "Any ''@supports'' rule that does
 *   not parse according to the grammar above ... is invalid. Style sheets
 *   must not use such a rule and processors MUST ignore such a rule
 *   (including all of its contents)."
 * - WPT css/css-conditional/at-supports-019/020/022/023/025/026.html pin
 *   the exact shapes used below as "Grammatically-invalid @supports rule
 *   is ignored" (recovery fixtures: the page must show the fallback).
 * - Dedup: KI-107 covers CSS.supports(property, value) accepting malformed
 *   var() syntax on the boolean-evaluation API — a different surface and a
 *   different clause; this filing pins rule retention at ingest.
 *
 * Observed defect at HEAD via public API:
 *   parse('@supports [margin: 0]{div{top:0}}').cssRules.length === 1 —
 *   every probed invalid condition is kept as a CSSSupportsRule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';

// Verifies: SYS-REQ-260826-0MVR (KI-133 helper: count rules for one text)
function ruleCount(source: string): number {
  return parse(source).cssRules.length;
}

// Verifies: SYS-REQ-260826-0MVR (KI-133 helper: inner rules of first rule)
function innerCount(source: string): number {
  const outer = parse(source).cssRules[0] as unknown as { cssRules?: { length: number } };
  return outer?.cssRules?.length ?? -1;
}

// Verifies: SYS-REQ-260826-0MVR (control leg)
test('control: valid @supports rule is retained', () => {
  assert.equal(ruleCount('@supports (top:0){div{color:red}}'), 1);
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: empty declaration value inside feature (WPT at-supports-019)', () => {
  assert.equal(ruleCount('@supports (margin: ) { div{top:0} }'), 0,
    '( <declaration> ) requires a non-empty value; rule must be ignored');
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: trailing close paren after condition (WPT at-supports-020)', () => {
  assert.equal(ruleCount('@supports (margin: 2px) ) { div{top:0} }'), 0);
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: bracket block instead of parens (WPT at-supports-022)', () => {
  assert.equal(ruleCount('@supports [margin: 0] { div{top:0} }'), 0);
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: nested trailing paren (WPT at-supports-023 shape)', () => {
  // Outer @media is valid and survives; the grammatically-invalid inner
  // @supports must be ignored (its contents dropped with it).
  assert.equal(innerCount('@media screen { @supports (width: 0)) {} }'), 0,
    'inner invalid @supports must be ignored inside the retained @media');
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: bracket feature inside and-chain (WPT at-supports-025)', () => {
  assert.equal(
    innerCount('@media screen { @supports ((margin:0) and [padding:0]) { div{top:0} } }'),
    0, 'only the outer @media remains; invalid inner condition ignored'
  );
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: mismatched closer inside feature (WPT at-supports-026)', () => {
  assert.equal(ruleCount('@supports (margin: 0]) { div{top:0} }'), 0);
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: operand-less not matches no production', () => {
  assert.equal(ruleCount('@supports not { div{top:0} }'), 0);
});

// Verifies: SYS-REQ-260826-0MVR (defect leg)
test('defect: dangling and without right operand', () => {
  assert.equal(ruleCount('@supports (top:0) and { div{top:0} }'), 0);
});
