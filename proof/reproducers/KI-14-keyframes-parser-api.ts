/**
 * Overlay reproducer for KI-14. Not a product-suite test.
 * WICG CSS Parser API / INT-REQ-260821-WTPD: parseStylesheetSync adapts nested
 * rules recursively. A @keyframes child is a qualified keyframe rule
 * (CSSKeyframeRule / selector "from"), not an at-rule named "unknown".
 * Asserts the child is CSSParserQualifiedRule with prelude "from" so this
 * command FAILS while toParserRule maps type 8 through the numeric at-rule
 * branch. Distinct from KI-6 (type-0 CSSLayer and CSSContainer rules).
 *
 * Reproduces: KI-14
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  CSSParserAtRule,
  CSSParserDeclaration,
  CSSParserQualifiedRule,
} from '../../src/index.ts';

// reqproof:proptest:skip known-issue overlay reproducer executed as a scripted contract check, not an isolable pure function
function ki14Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const media = CSS.parseStylesheetSync('@media all { .x { color: red; } }');
  const mediaTop = media[0] as CSSParserAtRule | undefined;
  if (!(mediaTop instanceof CSSParserAtRule) || !(mediaTop.body?.[0] instanceof CSSParserQualifiedRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: @media nested style should adapt, got ${mediaTop?.constructor?.name} body0=${mediaTop?.body?.[0]?.constructor?.name}`,
    };
  }

  const fromTop = CSS.parseStylesheetSync('from { color: red }');
  if (!(fromTop[0] instanceof CSSParserQualifiedRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: top-level from { } should be CSSParserQualifiedRule, got ${fromTop[0]?.constructor?.name}`,
    };
  }

  const sheet = CSS.parseStylesheetSync('@keyframes x { from { color: red } }');
  const top = sheet[0] as CSSParserAtRule | undefined;
  if (sheet.length !== 1 || !(top instanceof CSSParserAtRule)) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: @keyframes should adapt to CSSParserAtRule, got ${top?.constructor?.name}`,
    };
  }

  const child = top.body?.[0];
  if (!(child instanceof CSSParserQualifiedRule)) {
    const asAt = child as CSSParserAtRule | undefined;
    return {
      setupOk: true,
      holds: false,
      message: `KI-14: keyframe child was ${child?.constructor?.name} name=${JSON.stringify(asAt?.name)} preludeLen=${asAt?.prelude?.length} body=${asAt?.body === null ? 'null' : asAt?.body?.length}; intended CSSParserQualifiedRule`,
    };
  }

  const prelude = child.prelude.map((t) => t.toString()).join('');
  if (!prelude.includes('from')) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-14: keyframe qualified prelude was ${JSON.stringify(prelude)}; intended to include from`,
    };
  }

  const color = child.body.find(
    (d) => d instanceof CSSParserDeclaration && d.name === 'color',
  );
  if (!color) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-14: keyframe qualified body lacked color declaration (body=${JSON.stringify(child.body)})`,
    };
  }

  return { setupOk: true, holds: true, message: 'KI-14 contract holds: keyframe child is CSSParserQualifiedRule from { color }' };
}

// Reproduces: KI-14
// Verifies: INT-REQ-260821-WTPD
// MCDC INT-REQ-260821-WTPD: parse_stylesheet_sync_called=T, parser_ast_adapted=T => TRUE
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('parseStylesheetSync keyframe child is a qualified rule, not unknown at-rule', () => {
  const outcome = ki14Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
