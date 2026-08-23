/**
 * Overlay reproducer for KI-40: the Parser API silently drops every
 * style-rule declaration from CSSParserQualifiedRule.body.
 *
 * Reproduces: KI-40
 * Verifies: SYS-REQ-260823-QBD2 (qualified rule body declarations preserved)
 *
 * Spec anchors:
 * - WICG CSS Parser API #parser-values
 *   (https://github.com/wicg/css-parser-api index.bs): CSSParserQualifiedRule
 *   exposes `body` as the rule's member list; for qualified rules those members
 *   are the block's declarations, represented as CSSParserDeclaration nodes
 *   (css-syntax-3 consumes a qualified rule's block into a declaration list).
 * - css-syntax-3 § 5.5.3 #consume-a-qualified-rule
 *   (submodules/csswg-drafts/css-syntax-3/Overview.bs ~3660-3722):
 *   consume a qualified rule = prelude + block contents consumed per
 *   declaration-list grammar; the data structure must retain the declarations.
 * - css-syntax-3 round-trip requirement (#serialization, Overview.bs ~3706-3713):
 *   parsing serialized output must produce the same data structures; a body of
 *   length 0 cannot round-trip "div { color: red; margin: 0px }".
 *
 * Observed defect (src/parser-api.ts ~452-461): toParserRule tests
 * `qr.cssRules ? ... : (qr.style ? ...)` — a CSSOM CSSStyleRule always HAS a
 * cssRules list (inherited, possibly empty), so the truthiness check makes the
 * qr.style → CSSParserDeclaration branch dead and body serializes [].
 * The keyframe path (cssomKeyframeToQualified → styleToParserDeclarations)
 * DOES map declarations — inconsistent adapter behavior;
 * tests/parser-api.test.ts (~L122) only asserts the keyframe leg.
 *
 * Distinctness: KI-6/KI-14 covered toParserRule TYPE mapping (raw-rule /
 * at-rule misclassification) and are fixed; this is the declaration CONTENT
 * loss inside correctly-typed CSSParserQualifiedRule nodes.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/parser-api-rule-body-budget.vars.yaml:
 * const TOP_LEVEL_DECLARATIONS_MIN = 2;  // 'color', 'margin'
 * const NESTED_DECLARATIONS_MIN = 1;     // 'b'
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSSParserDeclaration,
  CSSParserQualifiedRule,
  parseRuleListSync,
  parseRuleSync,
} from '../../src/parser-api.ts';

// Reproducer constants mirrored in specs/system/variables/parser-api-rule-body-budget.vars.yaml:
const TOP_LEVEL_DECLARATIONS_MIN = 2; // 'color', 'margin'
const NESTED_DECLARATIONS_MIN = 1; // 'b'

// Verifies: SYS-REQ-260823-QBD2 (KI-40 reproducer: keyframe-path contrast helper)
function keyframeBodyDeclarationNames(): string[] {
  // css-animations-1 #CSSKeyframeRule maps through styleToParserDeclarations,
  // so this leg documents the working branch of the same adapter.
  const sheet = parseRuleListSync('@keyframes k{from{opacity:0}}');
  const inner = (sheet[0] as unknown as { body: CSSParserQualifiedRule[] }).body[0];
  return inner.body.map((d) => (d instanceof CSSParserDeclaration ? d.name : String(d)));
}

// Verifies: SYS-REQ-260823-QBD2 (KI-40 reproducer suite: qualified rule body declaration contract)
describe('KI-40 Parser API qualified rule body preserves declarations', () => {
  // Positive contrast control (green today): the keyframe path maps declarations.
  // Verifies: SYS-REQ-260823-QBD2
  test('control: keyframe qualified rules DO expose their declarations', () => {
    const names = keyframeBodyDeclarationNames();
    assert.deepEqual(names, ['opacity']);
  });

  // css-syntax-3 #consume-a-qualified-rule + WICG #parser-values: both authored
  // declarations must survive as CSSParserDeclaration entries in .body.
  // Verifies: SYS-REQ-260823-QBD2
  test(`top-level style rule body carries >= ${TOP_LEVEL_DECLARATIONS_MIN} declarations`, () => {
    const rule = parseRuleSync('div { color: red; margin: 0px }');
    assert.ok(rule instanceof CSSParserQualifiedRule);
    const names = (rule as CSSParserQualifiedRule).body.map((d) =>
      d instanceof CSSParserDeclaration ? d.name : null,
    );
    const declared = names.filter((n): n is string => n !== null);
    assert.ok(
      declared.length >= TOP_LEVEL_DECLARATIONS_MIN,
      `KI-40: body dropped all declarations (got ${JSON.stringify(
        (rule as CSSParserQualifiedRule).body.map(String),
      )}); expected ${TOP_LEVEL_DECLARATIONS_MIN} CSSParserDeclaration entries`,
    );
    assert.ok(declared.includes('color'), `missing 'color' in ${JSON.stringify(declared)}`);
    assert.ok(declared.includes('margin'), `missing 'margin' in ${JSON.stringify(declared)}`);
  });

  // The same dead branch corrupts nested qualified rules under grouping at-rules.
  // Verifies: SYS-REQ-260823-QBD2
  test(`@media-nested style rule body carries >= ${NESTED_DECLARATIONS_MIN} declaration`, () => {
    const media = parseRuleListSync('@media screen{a{b:c}}')[0] as unknown as {
      body: CSSParserQualifiedRule[];
    };
    const inner = media.body[0];
    assert.ok(inner instanceof CSSParserQualifiedRule);
    const hasDecl = inner.body.some((d) => d instanceof CSSParserDeclaration && d.name === 'b');
    assert.ok(
      hasDecl,
      `KI-40: nested body lost its declaration (got ${JSON.stringify(inner.body.map(String))})`,
    );
  });
});
