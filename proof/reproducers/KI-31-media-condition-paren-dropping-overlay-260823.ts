/**
 * Overlay reproducer for KI-31: media condition serialization drops required
 * parentheses, corrupting semantics on round-trip.
 *
 * mediaqueries-4 § 3 "Syntax" (#mq-syntax,
 * submodules/csswg-drafts/mediaqueries-4/Overview.bs:876) defines the
 * condition grammar so that every operand of and/or is a <media-in-parens>;
 * for @media rules this is the load-bearing citation:
 *
 *   <media-condition> = <media-not> | <media-in-parens> [ <media-and>* | <media-or>* ]
 *   <media-not> = not <media-in-parens>
 *   <media-and> = and <media-in-parens>
 *   <media-or>  = or  <media-in-parens>          (Overview.bs:900-904)
 *
 * css-conditional-3 § 7.2 CSSConditionRule.conditionText
 * (#the-cssconditionrule-interface,
 * submodules/csswg-drafts/css-conditional-3/Overview.bs:752-795) requires
 * getting to return "the result of serializing the associated condition"
 * (:789). The anti-simplification language — "without any logical
 * simplifications, so that the returned condition will evaluate to the same
 * result as the specified condition"; "logical simplifications (such as
 * removal of unneeded parentheses ...) are not allowed" — lives in the
 * CSSSupportsRule-specific conditionText definition inherited by
 * conditional-rule subclasses (§ 7.4 #the-csssupportsrule-interface,
 * Overview.bs:861-876). Dropping the parentheses around an `or` group
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
import { parse } from '../../src/parser.ts';

// Reproducer constants mirrored in specs/system/variables/media-roundtrip-budget.vars.yaml:
const CONDITION_OPERAND_COUNT = 3; // operands exercised: (width >= 100px), (grid), (hover)
const ROUND_TRIP_SEMANTIC_FLIP_BUDGET = 0; // zero round-trip degradations allowed

// Verifies: SYS-REQ-260823-MRT1 (KI-31 reproducer: first-rule media-query invalid/conditionText probe)
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

// Verifies: SYS-REQ-260823-MRT1 (KI-31 reproducer suite: serialize -> re-parse semantic-preservation contract)
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
      `KI-31: conditionText dropped the grouping parens around the or-operand: ${JSON.stringify(first.conditionText)} (mediaqueries-4 #mq-syntax requires every and/or operand to be a <media-in-parens>)`,
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
