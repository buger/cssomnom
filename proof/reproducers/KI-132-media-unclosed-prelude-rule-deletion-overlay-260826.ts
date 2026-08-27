/**
 * Overlay reproducer for KI-132. This file stays red until a @media rule
 * whose prelude contains an unclosed parenthesis-block is RETAINED as the
 * not-all media query instead of being silently deleted from the sheet.
 *
 * Reproduces: KI-132
 * Source vector: V-CROSS-SURFACE-POSTURE-TRIAGE (secondary: V-MALFORMED-RECOVER)
 *
 * Spec anchors:
 * - mediaqueries-4 § 3.2 #error-handling: "A media query that does not
 *   match the grammar ... must be replaced by ''not all'' during parsing"
 *   and "a grammar mismatch does NOT wipe out an entire media query list,
 *   just the problematic media query". The unclosed-paren example in that
 *   section ("@media (example, speech { ...") turns the query into
 *   not all — the rule and its recovery position survive.
 * - css-syntax-3 § 5.5.2 #consume-an-at-rule returns an at-rule even when
 *   its prelude swallowed the remainder (unclosed simple block runs to
 *   EOF); nothing licenses dropping the rule from cssom-1
 *   #parse-a-css-stylesheet.
 * - Cross-surface inconsistency (the triage angle): MediaParser.parse on
 *   the same condition text already returns invalid:true and
 *   serializeMediaQuery emits "not all" (KI-5's landed fix), so the CSSOM
 *   ingest layer deletes exactly what its own media layer recovered; and
 *   insertRule() throws SyntaxError for text whose specified parse cannot
 *   fail at rule level because MQ4 error handling makes it valid.
 *
 * Observed defect at HEAD via public API:
 *   parse('@media ((width){a{color:red}}').cssRules.length === 0 — the
 *   whole grouping rule vanishes, while '@media screen or {a{b:c}}'
 *   correctly survives as "@media not all" with its child intact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, CSSStyleSheet } from '../../src/index.ts';
import type { CSSMediaRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260826-XS91 (KI-132 helper; V-CROSS-SURFACE-POSTURE-TRIAGE)
function firstRule(source: string): CSSMediaRule | undefined {
  return parse(source).cssRules[0] as CSSMediaRule | undefined;
}

// Verifies: SYS-REQ-260826-XS91 (control leg)
test('control: balanced prelude parses to a retained media rule', () => {
  const rule = firstRule('@media ((width)){a{color:red}}');
  assert.ok(rule, 'balanced nesting must be retained');
});

// Verifies: SYS-REQ-260826-XS91 (control leg: recovery path exists)
test('control: malformed-but-recoverable condition becomes not all with child kept', () => {
  // MQ4 #error-handling: dangling `or` is replaced by not all; the RULE
  // and its contents must survive. This control proves the retention path
  // exists on this exact entry point.
  const rule = firstRule('@media screen or {a{b:c}}') as unknown as {
    conditionText?: string;
    condition?: { text?: string };
    cssRules: { length: number };
  };
  assert.equal(rule?.conditionText ?? rule?.condition?.text, 'not all');
  assert.equal(rule.cssRules.length, 1);
});

// Verifies: SYS-REQ-260826-XS91 (defect leg: deletion shape 1)
test('defect: unclosed paren in @media prelude must retain the rule as not all', () => {
  const sheet = parse('@media ((width){a{color:red}}');
  assert.equal(
    sheet.cssRules.length, 1,
    'MQ4 #error-handling requires retention as not all; whole rule was deleted'
  );
});

// Verifies: SYS-REQ-260826-XS91 (defect leg: deletion shape 2)
test('defect: single unclosed paren likewise must not delete the rule', () => {
  const sheet = parse('@media (width{a{color:red}}');
  assert.equal(sheet.cssRules.length, 1);
});

// Verifies: SYS-REQ-260826-XS91 (defect leg: deletion shape 3)
test('defect: unclosed paren inside compound condition must not delete the rule', () => {
  const sheet = parse('@media ((width) or (height){a{b:c}}');
  assert.equal(sheet.cssRules.length, 1);
});

// Verifies: SYS-REQ-260826-XS91 (defect leg: insertRule cross-surface split)
test('defect: insertRule rejects text MQ4 error handling makes rule-valid', () => {
  // The same malformed text through the mutation surface throws
  // SyntaxError although the media-query layer recovers it to not all;
  // cssom-1 #insert-a-css-rule can only fail when parse-a-css-rule fails,
  // and MQ4 guarantees this input parses into a valid (not-all) rule.
  let outcome = '';
  try {
    const sheet = new CSSStyleSheet();
    sheet.insertRule('@media ((width){a{color:red}}', 0);
    outcome = 'inserted';
  } catch (e: unknown) {
    outcome = (e as Error).name;
  }
  assert.equal(outcome, 'inserted', 'insertRule threw where MQ4 recovery yields a valid rule');
});
