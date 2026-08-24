/**
 * Overlay reproducer for KI-115.  This file intentionally stays red until
 * conditionText serialization stops dropping the grouping parentheses that
 * keep a negated media condition re-parseable.
 *
 * Reproduces: KI-115
 * Verifies: SYS-REQ-260823-EEQN (media query serialization round-trips)
 *
 * Spec anchors:
 * - css-syntax-3 § Serialization (id="serialization"):
 *     "The only requirement for serialization is that it must 'round-trip'
 *      with parsing, that is, parsing the stylesheet must produce the same
 *      data structures as parsing, serializing, and parsing again …"
 * - mediaqueries-4 §4 "Media Queries" grammar (#mq-syntax, ~line 900):
 *     <media-not> = not S* <media-in-parens>
 *   <media-not> is a COMPLETE production — no <media-and>* chain may follow a
 *   bare negation.  `(not (x)) and (r)` is grammatically valid because the
 *   outer parentheses wrap the negation into a <media-in-parens> term that
 *   CAN chain; stripping those parens yields text matching neither
 *   <media-condition> alternative.
 * - mediaqueries-4 § "Error Handling" (#error-handling, ~line 1031):
 *     "A media query that does not match the grammar in the previous section
 *      must be replaced by ''not all'' during parsing."
 *   Re-parsing our own serialized output therefore replaces the query with
 *   'not all' — the pass-2 collapse observed below.
 * - Local WPT fixture css/mediaqueries/mq-invalid-media-type-005.html asserts
 *   `query.conditionText === "not all"` for queries that fail the grammar;
 *   its assertion style is reused for the pass-2 leg.  The green controls
 *   mirror test_media_queries.html's query_is_parseable predicate
 *   (`mediaText != "screen, not all"`): grammatically valid queries must NOT
 *   become 'not all'.
 *
 * Observed defect: parse('@media(not (x))and (r){…}') keeps the condition
 * ("not (x) and (r)" — correct: the input is valid and merely evaluates to
 * unknown), but the serialized conditionText drops the grouping parens around
 * `not (x)`.  Feeding that text back through parse() replaces the query with
 * 'not all', so parse(parse(x)) ≠ x in violation of css-syntax-3 §Serialization.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/index.ts';
import type { CSSMediaRule } from '../../src/index.ts';

// Verifies: SYS-REQ-260823-EEQN (KI-115 reproducer helper: conditionText probe)
function condOf(cssText: string) {
  return ((parse(cssText).cssRules[0]) as CSSMediaRule).conditionText;
}

const SOURCE = '@media(not (x))and (r){.q{c:d}}';
const PASS1 = 'not (x) and (r)';

// ---------------------------------------------------------------------------
// Green controls.
// ---------------------------------------------------------------------------

// Verifies: SYS-REQ-260823-EEQN (WPT mq-invalid-media-type-005.html control rows)
// mq-invalid-media-type-005.html rows (grammar-error forms) are replaced by
// 'not all' during parsing — our parser already honors this contract.
for (const [query, label] of [
  ['not', 'bare not'],
  ['and', 'bare and'],
  ['only', 'bare only'],
] as const) {
  test(`KI-115 control: @media ${label} is replaced with 'not all' during parsing`, () => {
    assert.equal(condOf(`@media ${query} {div{x:red}}`), 'not all');
  });
}

// Pass 1 is correct: `(not (x)) and (r)` matches the MQ4 grammar, so it is
// retained verbatim (it merely evaluates unknown → false).  This also pins the
// honest scope of this KI: bare `@media (x){}` keeping "(x)" is spec-correct
// (test_media_queries.html expression_should_be_unknown requires unknown
// features to stay parseable, i.e. NOT become 'not all').
// Verifies: SYS-REQ-260823-EEQN (pass-1 retention control)
test('KI-115 control: valid grouped negation is preserved on first parse', () => {
  assert.equal(condOf(SOURCE), PASS1);
});

// Verifies: SYS-REQ-260823-EEQN (scope-honesty control per test_media_queries.html)
test('KI-115 control: bare unknown feature stays parseable text', () => {
  const c = condOf('@media (x){}');
  assert.equal(c, '(x)');
  assert.notEqual(c, 'not all');
});

// ---------------------------------------------------------------------------
// Defect legs (red until fixed).
// ---------------------------------------------------------------------------

// css-syntax-3 §Serialization: parsing, serializing, and parsing again must
// produce the same data structures.  The serialized condition fails the MQ4
// grammar (<media-not> cannot take an and-chain), so mediaqueries-4
// #error-handling forces its replacement with 'not all' on re-parse.
// Reproduces: KI-115
// Verifies: SYS-REQ-260823-EEQN leg 1.
test('KI-115: serialized conditionText re-parses to the same condition, not "not all"', () => {
  const pass2 = condOf(`@media ${condOf(SOURCE)} {.q{c:d}}`);
  assert.equal(
    pass2,
    PASS1,
    'serialization of a valid media condition must round-trip (css-syntax-3 #serialization)',
  );
  assert.notEqual(pass2, 'not all', 'own serialization must not degrade into a grammar-error query');
});

// Whole-document round-trip through cssRules[0].conditionText, mirroring how
// a serializer would emit the rule back out.
// Reproduces: KI-115
// Verifies: SYS-REQ-260823-EEQN leg 2.
test('KI-115: full rule round-trip keeps the rule structure stable', () => {
  const first = parse(SOURCE).cssRules[0] as CSSMediaRule;
  const second = parse(`@media ${first.conditionText} {.q{c:d}}`).cssRules[0] as CSSMediaRule;
  assert.equal(second.conditionText, first.conditionText, 'condition survives a serialize/parse cycle');
});
