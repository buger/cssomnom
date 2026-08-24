/**
 * Overlay reproducer for KI-44: CSSKeyframeRule.keyText setter accepts
 * JS-Number-coercible garbage — '0x10%' normalizes to '16%'.
 *
 * Reproduces: KI-44
 * CHARACTERIZATION + MUTATION TRIPWIRE for KI-44: the parser-leg below pins
 * the (correct) tokenizer behavior as a mutation tripwire; the setter legs
 * assert the secure grammar-fidelity contract and FAIL while the JS-coercion
 * defect is open. Tripwire mutation: remove raw Number() coercion from
 * src/CSSOM.ts normalizeKeyframeSelector so the setter throws SyntaxError.
 *
 * Verifies: SYS-REQ-260823-KTS6 (keyText setter grammar fidelity)
 *
 * Spec anchors:
 * - css-animations-1 § 4 #interface-csskeyframerule-attributes
 *   (submodules/csswg-drafts/css-animations-1/Overview.bs ~1072-1077):
 *   "If keyText is updated with an invalid keyframe selector, a SyntaxError
 *   exception must be thrown and the value of keyText must remain unchanged."
 * - css-animations-1 § 5 #keyframes-syntax (~205-212):
 *   <keyframe-selector> = from | to | <percentage [0,100]>
 *   '0x10%' is not a <percentage> at all (it is a dimension token '0x'
 *   followed by ident '%'-less text); it matches the grammar in no way. Only
 *   JS's Number('0x10') === 16 makes it look like 16%. '0X10%' likewise.
 *
 * Observed defect (src/CSSOM.ts normalizeKeyframeSelector ~1157): the setter
 * path parses with raw Number(valStr), so any JS-coercible string sneaks
 * through: keyText = '0x10%' silently becomes '16%' (and '0X10%' too).
 *
 * The TOKENIZER-based parse path is correct: parsing
 * '@keyframes k{0x10%{opacity:0}50%{a:b}}' drops the bad block and keeps only
 * '50%' (src/parser.ts ~571-591) — the setter must agree with the parser.
 *
 * Controls that correctly throw and leave keyText unchanged today:
 * '50%%', 'fifty%', 'Infinity%', '-5%', '0'.
 *
 * Distinctness: KI-101 covers child-rule link attachment; KI-103 covers
 * appendRule trailing garbage; KI-104 covers forbidden animation-* /
 * !important declarations inside keyframe blocks. This issue is the SETTER's
 * selector grammar check using JS coercion instead of the grammar.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/keytext-setter-budget.vars.yaml:
 * const INVALID_KEYTEXT_ACCEPT_BUDGET = 0;
 * const CONTROL_SELECTORS_THROW_MIN = 5;
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSKeyframeRule, CSSKeyframesRule, CSSStyleSheet } from '../../src/index.ts';

// Reproducer constants mirrored in specs/system/variables/keytext-setter-budget.vars.yaml:
const INVALID_KEYTEXT_ACCEPT_BUDGET = 0; // zero grammar violations may be accepted
const CONTROL_SELECTORS_THROW_MIN = 5; // '50%%','fifty%','Infinity%','-5%','0'

// Verifies: SYS-REQ-260823-KTS6 (KI-44 reproducer: first-keyframe rule helper)
// reqproof:proptest:skip trivial accessor returning the first keyframe of a live keyframes rule graph; nothing comparable in isolation
function firstKeyframe(): CSSKeyframeRule {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync('@keyframes k{0%{opacity:0}}');
  return (sheet.cssRules[0] as CSSKeyframesRule).cssRules[0] as CSSKeyframeRule;
}

// Verifies: SYS-REQ-260823-KTS6 (KI-44 reproducer suite: keyText setter rejects non-grammar selectors)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-44 keyText setter enforces the keyframe-selector grammar', () => {
  test(`control: ${CONTROL_SELECTORS_THROW_MIN} garbage selectors throw and leave keyText unchanged`, () => {
    for (const selector of ['50%%', 'fifty%', 'Infinity%', '-5%', '0'] as const) {
      const rule = firstKeyframe();
      assert.throws(
        () => {
          rule.keyText = selector;
        },
        (e: unknown) => (e as Error).name === 'SyntaxError',
        `expected SyntaxError for ${JSON.stringify(selector)}`,
      );
      assert.equal(rule.keyText, '0%', `${JSON.stringify(selector)} must leave keyText unchanged`);
    }
  });

  // css-animations-1 ~1072-1077 + ~211: '0x10%' violates <percentage [0,100]>;
  // the setter must throw and leave keyText unchanged, not Number()-coerce to 16%.
  // Verifies: SYS-REQ-260823-KTS6
  test(`setter throws on '0x10%' instead of Number()-coercing to 16% (${INVALID_KEYTEXT_ACCEPT_BUDGET} acceptances allowed)`, () => {
    const rule = firstKeyframe();
    let threw = false;
    try {
      rule.keyText = '0x10%';
    } catch {
      threw = true;
    }
    assert.ok(threw, `KI-44: expected SyntaxError, got accepted keyText ${JSON.stringify(rule.keyText)}`);
    assert.equal(rule.keyText, '0%', 'failed assignment must not mutate keyText');
  });

  // Same defect class with the capitalized hex prefix.
  // Verifies: SYS-REQ-260823-KTS6
  test("setter also rejects '0X10%'", () => {
    const rule = firstKeyframe();
    let threw = false;
    try {
      rule.keyText = '0X10%';
    } catch {
      threw = true;
    }
    assert.ok(threw, `KI-44: expected SyntaxError for '0X10%', got ${JSON.stringify(rule.keyText)}`);
  });

  // Parser/setter agreement: the tokenizer path already drops such blocks.
  // Verifies: SYS-REQ-260823-KTS6
  test('tokenizer parse path rejects 0x10% today (characterization: setter diverges from parser)', () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@keyframes k{0x10%{opacity:0}50%{a:b}}');
    const inner = Array.from((sheet.cssRules[0] as CSSKeyframesRule).cssRules).map(
      (r) => (r as CSSKeyframeRule).keyText,
    );
    assert.deepEqual(inner, ['50%']);
    assert.ok(!inner.includes('16%'), 'parser must not normalize 0x10% either');
  });
});
