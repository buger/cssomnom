/**
 * Overlay reproducer for KI-31: media condition serialization drops required
 * parentheses, corrupting semantics on round-trip.
 *
 * mediaqueries-4 § 2 "Media Queries" syntax section (#mq-syntax,
 * submodules/csswg-drafts/mediaqueries-4/Overview.bs:876) defines the
 * condition grammar so that every operand of and/or is a <media-in-parens>:
 *
 *   <media-condition> = <media-not> | <media-in-parens> [ <media-and>* | <media-or>* ]
 *   <media-and> = and <media-in-parens>
 *   <media-or>  = or  <media-in-parens>          (Overview.bs:895-904)
 *
 * css-conditional-3 § 6.2 CSSConditionRule.conditionText
 * (#the-cssconditionrule-interface,
 * submodules/csswg-drafts/css-conditional-3/Overview.bs:862-867) requires the
 * serialized condition to "evaluate to the same result as the specified
 * condition" and explicitly forbids "logical simplifications (such as removal
 * of unneeded parentheses)". Dropping the parentheses around an `or` group
 * changes evaluation: "(a) or (b) and (c)" re-parses as a mixed and/or chain,
 * which the grammar above cannot represent, so the query becomes invalid and
 * serializes as 'not all' — a semantic flip from true-capable to never-match.
 *
 * Distinctness from KI-5: KI-5 covers unbalanced-paren input '(( ' being
 * rejected/serialized; this issue concerns VALID nested conditions whose
 * serialization loses required structure.
 *
 * Asserts the SAFE contract: serialize -> re-parse must preserve the
 * condition's evaluability (never degrade to 'not all').
 *
 * Reproduces: KI-31
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '/workspace/src/parser.ts';
import { parse } from '/workspace/src/parser.ts';

// Reproducer constants mirrored in specs/system/variables/media-roundtrip-budget.vars.yaml:
const CONDITION_OPERAND_COUNT = 3; // operands exercised: (width >= 100px), (grid), (hover)
const ROUND_TRIP_SEMANTIC_FLIP_BUDGET = 0; // zero round-trip degradations allowed

function firstQueryInvalid(source: string): { invalid: unknown; conditionText: string } {
  const rule = parse(source).cssRules[0] as unknown as {
    media?: { _mediaQueries?: Array<{ invalid?: boolean }> };
    conditionText: string;
  };
  return {
    invalid: rule.media?._mediaQueries?.[0]?.invalid ?? false,
    conditionText: rule.conditionText,
  };
}

describe('KI-31 media condition round-trip semantic preservation', () => {
  test('positive control: flat and-chain serializes identically and round-trips', () => {
    const original = '@media (width >= 100px) and (hover){div{}}';
    const first = firstQueryInvalid(original);
    assert.equal(first.invalid, false);
    const second = firstQueryInvalid(`@media ${first.conditionText}{div{}}`);
    assert.equal(second.conditionText, '(width >= 100px) and (hover)');
    assert.equal(second.invalid, false);
  });

  // Reproduces: KI-31
  test(`or-group of ${CONDITION_OPERAND_COUNT} operands keeps required parens through round-trip`, () => {
    const first = firstQueryInvalid('@media ((width >= 100px) or (grid)) and (hover){div{}}');
    // The hole: serializer joins children bare -> "(width >= 100px) or (grid) and (hover)"
    assert.ok(
      /\(\(.*\)\s+or\s+\(.*\)\)/.test(first.conditionText),
      `KI-31: conditionText dropped the grouping parens around the or-operand: ${JSON.stringify(first.conditionText)} (css-conditional-3 #the-cssconditionrule-interface forbids removal of unneeded parentheses)`,
    );
    let flips = 0;
    const second = firstQueryInvalid(`@media ${first.conditionText}{div{}}`);
    if (second.conditionText === 'not all' || second.invalid === true) flips++;
    assert.equal(
      flips,
      ROUND_TRIP_SEMANTIC_FLIP_BUDGET,
      `KI-31: re-parsing serialized conditionText degraded the query to ${JSON.stringify(second.conditionText)} (invalid=${second.invalid}); round-trip must preserve semantics`,
    );
  });

  // Reproduces: KI-31
  test('or inside type-scoped condition survives round-trip', () => {
    const first = firstQueryInvalid('@media screen and ((color) or (monochrome)){div{}}');
    assert.equal(first.invalid, false);
    const second = firstQueryInvalid(`@media ${first.conditionText}{div{}}`);
    assert.notEqual(
      second.conditionText,
      'not all',
      `KI-31: re-parsing "${first.conditionText}" flipped the valid query to not all`,
    );
    assert.equal(second.invalid, false);
  });
});
