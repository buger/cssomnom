/**
 * Reproducer for CRS-0069/C21+C22+C23+C24+C26: parse-a-rule entries
 * overflow with a raw host RangeError instead of a structured failure.
 *
 * css-syntax-3 § 5.4.6 #parse-rule step 3 returns a syntax error when
 * consume-a-rule yields nothing; cssom-1 #parse-a-css-rule surfaces that as
 * a thrown DOMException SyntaxError. Every parse-a-rule entry below either
 * returns a rule or throws that structured error — never a raw engine
 * RangeError escaping the unbounded consume walk (SYS-REQ-260821-7521
 * recursion_depth_bounded / denial_of_service_resistant).
 *
 * Reproduces: CRS-0069 parse-rule entries
 * Verifies: SYS-REQ-260821-7521
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRule, parseRuleInBlock, Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

function nestStyle(depth: number): string {
  return 'a{'.repeat(depth) + 'x:1' + '}'.repeat(depth);
}

function assertStructuredFailure(fn: () => unknown, label: string): void {
  let threw: unknown;
  let result: unknown;
  try {
    result = fn();
  } catch (e) {
    threw = e;
  }
  if (threw === undefined) {
    assert.ok(result !== undefined && result !== null, `${label}: a rule must come back on success`);
    return;
  }
  assert.ok(
    !(threw instanceof RangeError),
    `CRS-0069: ${label} escaped as ${(threw as Error).name}: ${(threw as Error).message} — parse-a-rule must fail with a structured SyntaxError, not an engine RangeError (css-syntax-3 § 5.4.6 #parse-rule; SYS-REQ-260821-7521)`,
  );
  assert.ok(
    threw instanceof Error && (threw as Error).name === 'SyntaxError',
    `${label}: failure must be a SyntaxError, got ${(threw as Error).name}`,
  );
}

test('control: shallow rule text parses through every entry', () => {
  assert.ok(parseRule('a{x:1}'));
  const inBlock = parseRuleInBlock('b { c: 1 }');
  assert.ok(inBlock);
  assert.ok(new Parser([]).parseRule('a{x:1}'));
});

test('control: trailing garbage still raises the structured SyntaxError', () => {
  assert.throws(() => parseRule('a{x:1} junk{'), (e: Error) => e.name === 'SyntaxError');
});

test('CRS-0069/C21+C24: parseRule(deep nesting) fails with SyntaxError, never RangeError', () => {
  assertStructuredFailure(() => parseRule(nestStyle(4000)), 'parseRule(nestStyle(4000))');
});

test('CRS-0069/C22: instance Parser.parseRule(deep nesting) fails structured, never RangeError', () => {
  assertStructuredFailure(() => new Parser([]).parseRule(nestStyle(4000)), 'new Parser([]).parseRule(nestStyle(4000))');
});

test('CRS-0069/C23+C26: parseRuleInBlock(deep nesting) fails with SyntaxError, never RangeError', () => {
  assertStructuredFailure(() => parseRuleInBlock(nestStyle(4000)), 'parseRuleInBlock(nestStyle(4000))');
});

test('CRS-0069/C23: grouping-rule insertRule (parseRuleInBlock wiring) fails structured, never RangeError', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('@media all { a{x:1} }');
  const media = sheet.cssRules[0] as unknown as { insertRule(rule: string): number };
  assertStructuredFailure(() => media.insertRule(nestStyle(4000)), 'CSSMediaRule.insertRule(nestStyle(4000))');
});
