/**
 * Overlay reproducer for KI-131. This file stays red until deeply nested
 * parentheses inside a @media prelude stop escaping parse()/insertRule()
 * as a raw engine RangeError.
 *
 * Reproduces: KI-131
 * Source vector: V-DOS-PARSE
 *
 * Spec anchors:
 * - css-syntax-3 § 5.5.1 #consume-stylesheet-contents / § 5.5.2
 *   #consume-at-rule: stylesheet ingestion must return a stylesheet;
 *   pathological nesting is recovered by dropping constructs, never by
 *   aborting the algorithm. An uncaught RangeError: Maximum call stack
 *   size exceeded violates that guarantee exactly like the block-nesting
 *   shape already filed as KI-18 — but this mechanism lives in the media
 *   condition parser's recursive descent over nested <parenthesis-block>s,
 *   not in consumeBlockContents/consumeAtRule, and KI-22's math parser is
 *   likewise a different subsystem. Balanced-paren probes show the
 *   tokenizer itself is iterative (50k-deep blocks survive tokenize()),
 *   isolating the recursion to MediaParser condition parsing.
 * - AGENTS.md resource-bounds doctrine: unbounded CSS text must not pin
 *   CPU or heap; recursion_depth_bounded / denial_of_service_resistant
 *   hazards model this class.
 *
 * Observed defect at HEAD via public API:
 *   parse('@media ' + '('.repeat(N) + 'width' + ')'.repeat(N) + '{a{b:c}}')
 *   throws RangeError for N >= ~2200 on the default Node stack; the same
 *   text through CSSStyleSheet.insertRule() throws the identical raw
 *   RangeError. Bounded N below stays deterministic across environments
 *   while remaining far above the observed ~2.2k threshold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, tokenize, CSSStyleSheet } from '../../src/index.ts';

const DEEP = 20000;

// Verifies: V-DOS-PARSE (KI-131 helper: balanced control at same depth)
function buildMediaQuery(depth: number): string {
  return '@media ' + '('.repeat(depth) + 'width' + ')'.repeat(depth) + '{a{b:c}}';
}

test('control: tokenizer is iterative and survives deep parenthesis nesting', () => {
  // css-syntax-3 consume-a-simple-block is iterative in our tokenizer; the
  // crash therefore cannot originate below the parser boundary.
  const tokens = tokenize(buildMediaQuery(DEEP));
  assert.ok(tokens.length > 2 * DEEP);
});

test('control: moderately nested media conditions parse cleanly', () => {
  const sheet = parse(buildMediaQuery(100));
  assert.equal(sheet.cssRules.length, 1);
});

test('control: shallow balanced nesting round-trips through insertRule', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule(buildMediaQuery(50), 0);
  assert.equal(sheet.cssRules.length, 1);
});

test('defect: parse() must not leak a raw RangeError on deep media parens', () => {
  let outcome = '';
  try {
    const sheet = parse(buildMediaQuery(DEEP));
    outcome = 'parsed:' + sheet.cssRules.length;
  } catch (e: unknown) {
    outcome = (e as Error).name;
  }
  // Contract: recover-drop (returning a stylesheet) or a loud structured
  // SyntaxError/DOMException. A bare RangeError means the engine stack was
  // exhausted inside recursive condition parsing.
  assert.ok(
    outcome.startsWith('parsed:') || outcome === 'SyntaxError',
    `expected recover-or-loud-error, got ${outcome} (RangeError = stack exhaustion)`
  );
});

test('defect: insertRule() must not leak a raw RangeError on deep media parens', () => {
  const sheet = new CSSStyleSheet();
  let outcome = '';
  try {
    sheet.insertRule(buildMediaQuery(DEEP), 0);
    outcome = 'inserted';
  } catch (e: unknown) {
    outcome = (e as Error).name;
  }
  assert.ok(
    outcome === 'inserted' || outcome === 'SyntaxError',
    `expected accept-or-SyntaxError, got ${outcome} (RangeError = stack exhaustion)`
  );
});
