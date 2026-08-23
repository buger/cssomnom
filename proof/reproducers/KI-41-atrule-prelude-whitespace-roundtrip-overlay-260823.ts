/**
 * Overlay reproducer for KI-41: Parser API at-rule prelude whitespace is
 * stripped, corrupting at-rule serialization and re-parse identity.
 *
 * Reproduces: KI-41
 * Verifies: SYS-REQ-260823-PRT3 (at-rule prelude round-trip fidelity)
 *
 * Spec anchors:
 * - css-syntax-3 round-trip requirement (#serialization,
 *   submodules/csswg-drafts/css-syntax-3/Overview.bs ~3706-3713): parsing the
 *   stylesheet must produce the same data structures as parsing, serializing,
 *   and parsing again (modulo collapsed whitespace). An at-rule named
 *   "mediascreen" instead of "media" is a different data structure.
 * - WICG CSS Parser API #parser-values: CSSParserAtRule carries
 *   `name` + `prelude` + `stringifier`; whitespace is parsed into DOMStrings —
 *   it is information, not garbage to delete ("whitespace and delims all get
 *   parsed into DOMStrings").
 * - cssom-1 § 6.6.2 #serialize-an-at-rule / css-syntax-3 § 5.5.2
 *   #consume-an-at-rule: the at-keyword, prelude and block are distinct parts
 *   of the rule; collapsing "@media screen" to "@mediascreen" merges them.
 *
 * Observed defect: CSSParserAtRule.toString() (src/parser-api.ts ~122-128)
 * joins the prelude tokens with '' directly after '@' + name, and
 * tokensToPrelude() (src/parser-api.ts ~202-205) filters whitespace/comment
 * component values out of the prelude entirely. Every at-rule family is hit:
 *   '@media screen{a{b:c}}'            serializes '@mediascreen{a{}}'
 *                                      → re-parses to at-rule NAMED 'mediascreen'
 *   '@keyframes k{...}'                → '@keyframesk{...}'  (named 'keyframesk')
 *   '@layer l{...}'                    → '@layerl{...}'      (named 'layerl')
 *   '@namespace svg url(...);'         → '@namespacesvgurl(...);' (named 'namespacesvgurl')
 *
 * Distinctness: KI-31/KI-115 cover media-condition TEXT corruption inside the
 * MediaParser/CSSOM layer (paren dropping, condition collapse); this issue is
 * the Parser-API adapter layer losing the keyword/prelude separator itself.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/parser-api-prelude-budget.vars.yaml:
 * const PRELUDE_ROUNDTRIP_CORRUPTION_BUDGET = 0;
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSParserAtRule, parseRuleListSync } from '../../src/parser-api.ts';

// Reproducer constants mirrored in specs/system/variables/parser-api-prelude-budget.vars.yaml:
const PRELUDE_ROUNDTRIP_CORRUPTION_BUDGET = 0; // zero corrupted round-trips allowed

// Verifies: SYS-REQ-260823-PRT3 (KI-41 reproducer: serialize/re-parse identity helper)
function serializeAndReparse(source: string): { name: string; preludeText: string } {
  const rule = parseRuleListSync(source)[0];
  assert.ok(rule instanceof CSSParserAtRule, `${source} did not map to CSSParserAtRule`);
  const serialized = String(rule);
  const reparsed = parseRuleListSync(serialized)[0];
  assert.ok(reparsed instanceof CSSParserAtRule, `serialization ${JSON.stringify(serialized)} did not re-parse to an at-rule`);
  const at = reparsed as CSSParserAtRule;
  return { name: at.name, preludeText: at.prelude.map((t) => String(t)).join('') };
}

// Verifies: SYS-REQ-260823-PRT3 (KI-41 reproducer suite: at-rule prelude round-trip identity)
describe('KI-41 at-rule serialization round-trips its name and prelude', () => {
  test(`positive control: qualified rules round-trip (${PRELUDE_ROUNDTRIP_CORRUPTION_BUDGET} corruptions allowed)`, () => {
    const rule = parseRuleListSync('div{}')[0];
    assert.equal(String(parseRuleListSync(String(rule))[0]), String(rule));
  });

  // css-syntax-3 #serialization: re-parsing must yield the SAME at-rule.
  // Verifies: SYS-REQ-260823-PRT3
  test('@media screen re-parses as an at-rule named media, not mediascreen', () => {
    const round = serializeAndReparse('@media screen{a{b:c}}');
    assert.equal(
      round.name,
      'media',
      `KI-41: serialized text re-parsed to at-rule named ${JSON.stringify(round.name)} — the @keyword/prelude separator was lost`,
    );
    assert.equal(round.preludeText, 'screen');
  });

  // Verifies: SYS-REQ-260823-PRT3
  test('@keyframes k re-parses as an at-rule named keyframes, not keyframesk', () => {
    const round = serializeAndReparse('@keyframes k{from{opacity:0}}');
    assert.notEqual(
      round.name,
      'keyframesk',
      `KI-41: keyframes name token swallowed into the at-rule name (${JSON.stringify(round.name)})`,
    );
    assert.equal(round.name, 'keyframes');
  });

  // Verifies: SYS-REQ-260823-PRT3
  test('@layer l and @namespace svg keep their names on round-trip', () => {
    const layer = serializeAndReparse('@layer l{a{b:c}}');
    assert.notEqual(layer.name, 'layerl', 'layer name token swallowed into at-rule name');
    const ns = serializeAndReparse('@namespace svg url(http://www.w3.org/2000/svg);');
    assert.notEqual(ns.name, 'namespacesvgurl', 'namespace prefix/url swallowed into at-rule name');
    assert.equal(ns.name, 'namespace');
  });
});
