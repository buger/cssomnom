/**
 * Overlay reproducer for KI-33: CSSSupportsRule.matches is missing entirely.
 *
 * css-conditional-3 § 7.4 "The CSSSupportsRule interface"
 * (#the-csssupportsrule-interface,
 * submodules/csswg-drafts/css-conditional-3/Overview.bs:845-848) defines:
 *
 *   interface CSSSupportsRule : CSSConditionRule {
 *     readonly attribute boolean matches;
 *   };
 *
 * and § 7.4 (:856-859) gives the semantics: "The matches attribute returns
 * the evaluation of the CSS feature query represented in conditionText."
 *
 * The attribute is implementable fully offline: the library's own public
 * CSS.supports() (src/parser-api.ts:757, SYS-REQ-260821-SMW6) already
 * evaluates identical feature queries, so the expected value of each leg is
 * derived from the library's spec-conformant evaluator rather than any
 * browser oracle.
 *
 * Note (not asserted here): css-conditional-3 also defines CSSMediaRule.matches
 * (:806, semantics :820-827), but its value is environment-dependent ("true if
 * the rule is in a stylesheet attached to a document whose Window matches this
 * rule's media query") — it cannot be honestly asserted in a headless,
 * window-less harness and is intentionally excluded from this reproducer.
 *
 * Asserts the SAFE contract: every CSSSupportsRule exposes a boolean `matches`
 * equal to the evaluation of its conditionText.
 *
 * Reproduces: KI-33
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/parser-api.ts';
import { CSSSupportsRule } from '../../src/CSSOM.ts';

// Reproducer constants mirrored in specs/system/variables/cssom-condition-budget.vars.yaml:
const SUPPORTS_CONDITIONS_EVALUATED = 4;
const MISSING_MATCHES_ATTRIBUTES_BUDGET = 0;

const CASES: Array<{ name: string; source: string; expected: boolean }> = [
  { name: '(display: grid)', source: '@supports (display: grid){}', expected: true },
  { name: 'unknown feature', source: '@supports (foo: bar){}', expected: false },
  { name: 'not (display: grid)', source: '@supports not (display: grid){}', expected: false },
  {
    name: '((display: grid) and (display: flex))',
    source: '@supports ((display: grid) and (display: flex)){}',
    expected: true,
  },
];

describe('KI-33 CSSSupportsRule.matches exists and evaluates conditionText', () => {
  test('positive control: offline oracle CSS.supports discriminates the cases', () => {
    assert.equal(CSS.supports('(display: grid)'), true);
    assert.equal(CSS.supports('(foo: bar)'), false);
  });

  // Reproduces: KI-33
  for (const c of CASES) {
    test(`matches is boolean and equals CSS.supports() for ${c.name}`, () => {
      const rule = parse(c.source).cssRules[0];
      assert.ok(rule instanceof CSSSupportsRule);
      const rec = rule as unknown as Record<string, unknown>;
      const missing = typeof rec.matches === 'undefined' ? 1 : 0;
      assert.equal(
        missing,
        MISSING_MATCHES_ATTRIBUTES_BUDGET,
        `KI-33: CSSSupportsRule.matches is undefined for ${c.name}; css-conditional-3 #the-csssupportsrule-interface requires a readonly boolean matches`,
      );
      assert.equal(typeof rec.matches, 'boolean');
      assert.equal(
        rec.matches,
        CSS.supports(rule.conditionText),
        `KI-33: matches must return the evaluation of conditionText (${c.name})`,
      );
      assert.equal(rec.matches, c.expected);
    });
  }

  test('fixture count mirrors cssom-condition-budget.vars.yaml', () => {
    assert.equal(CASES.length, SUPPORTS_CONDITIONS_EVALUATED);
  });
});
