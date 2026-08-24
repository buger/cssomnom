/**
 * Overlay reproducer for KI-39: calc() serialization is not
 * fixpoint-stable - a degenerate single-child Sum serializes with parens
 * inside Products, so toString() output re-parses to a DIFFERENT structure.
 *
 * css-syntax-3 § 4.3.2 "Serialization" (#serialization,
 * submodules/csswg-drafts/css-syntax-3/Overview.bs:3710-3712) is load-bearing:
 *
 *   The only requirement for serialization is that it must "round-trip" with
 *   parsing, that is, parsing the stylesheet must produce the same data
 *   structures as parsing, serializing, and parsing again ...
 *
 * css-values-4 § 5.10 "Serialize a calculation tree"
 * (#serialize-a-calculation-tree,
 * submodules/csswg-drafts/css-values-4/Overview.bs:5270) defines the Sum node
 * step (:5312-5340) and Product node step (:5342-5365); both engines and the
 * spec's own examples keep single-child Sums paren-free when nested in a
 * product operand position ("calc(1px + 2px)" folds to 3px, never "(3px)").
 *
 * Observed at HEAD via fully public APIs:
 *
 *   const v = CSSStyleValue.parse('width', 'calc(1px + 2px)'); // folds to a
 *                                                              // degenerate
 *                                                              // CSSMathSum
 *   v.toString();                       // 'calc(3px)'
 *   v.mul(3).toString();                // 'calc((3px) * 3)'
 *   CSSStyleValue.parse(...that...).toString(); // 'calc(9px)' - STRUCTURE
 *                                               // CHANGED across round-trip
 *
 * Root cause: src/typed-om/values/style-value-factory.ts:47 deliberately
 * wraps folded unit values in a degenerate single-child CSSMathSum, and the
 * Product serializer (src/typed-om/numeric/math/CSSMathOperations.ts ~L150)
 * wraps every non-first child in parens without collapsing single-child
 * Sums - so the same numeric value serializes as both 'calc((3px) * 3)'
 * (via arithmetic on a parsed value) and 'calc(9px)' (via fresh parse).
 * Direct construction shows the same defect:
 * new CSSMathProduct(new CSS.number(3), new CSSMathSum(new CSS.px(3)))
 * .toString() === 'calc(3 * (3px))', which re-parses to 'calc(9px)'.
 *
 * Distinctness from KI-31 (media condition parens): different layer entirely
 * (math expression trees vs media conditions).
 *
 * Asserts the SAFE contract: toString() must be a fixpoint -
 * String(v) === String(CSSStyleValue.parse(property, String(v))).
 *
 * Reproduces: KI-39
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import * as CSSOM from '../../src/index.ts';

// Reproducer constants mirrored in specs/system/variables/math-serialize-budget.vars.yaml:
const MATH_FIXPOINT_SHAPES = 2; // shapes probed: parsed-value arithmetic + direct degenerate-Sum construction
const FIXPOINT_DRIFT_BUDGET = 0; // zero serializations may drift across parse->toString->parse->toString

// Verifies: SYS-REQ-260823-MFS9 (KI-39 reproducer: parse->toString fixpoint predicate)
// reqproof:proptest:skip fixpoint predicate over the live parse-serialize pipeline inside a known-issue reproducer; any oracle would restate the very serialization under test
function isFixpoint(v: { toString(): string }): boolean {
  return v.toString() === CSSOM.CSSStyleValue.parse('width', v.toString()).toString();
}

// CSSStyleValue.parse returns the base class; arithmetic lives on CSSNumericValue
// (repo convention: structural cast, cf. KI-37's `as unknown as { selectorText }`).
// Verifies: SYS-REQ-260823-MFS9 (KI-39 reproducer: arithmetic mul() accessor cast)
// reqproof:proptest:skip structural-cast accessor exposing typed-om numeric internals for the enclosing scenario; carries no comparable logic of its own
function mulBy(v: CSSOM.CSSStyleValue, n: number): CSSOM.CSSStyleValue {
  return (v as unknown as { mul(n: number): CSSOM.CSSStyleValue }).mul(n);
}

// Verifies: SYS-REQ-260823-MFS9 (KI-39 reproducer suite: serialization fixpoint contract)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-39 calc() serialization fixpoint stability', () => {
  test('positive control: fully-folded calc serializes identically across re-parse', () => {
    const v = CSSOM.CSSStyleValue.parse('width', 'calc(9px)');
    assert.equal(v.toString(), 'calc(9px)');
    assert.equal(CSSOM.CSSStyleValue.parse('width', v.toString()).toString(), 'calc(9px)');
  });

  test('positive control: unfolded sum keeps required grouping parens', () => {
    const v = CSSOM.CSSStyleValue.parse('width', 'calc((1px + 2em) * 3)');
    assert.ok(v.toString().includes('em'), v.toString());
    assert.ok(isFixpoint(v));
  });

  // Reproduces: KI-39
  test(`parsed-value arithmetic serializations are fixpoints (${MATH_FIXPOINT_SHAPES} shapes, ${FIXPOINT_DRIFT_BUDGET} drift allowed)`, () => {
    let drifts = 0;
    const v = CSSOM.CSSStyleValue.parse('width', 'calc(1px + 2px)');
    const scaled = mulBy(v, 3);
    if (!isFixpoint(scaled)) drifts++;
    const degenerate = new CSSOM.CSSMathSum(new CSSOM.CSSUnitValue(3, 'px'));
    const constructed = new CSSOM.CSSMathProduct(new CSSOM.CSSUnitValue(3, 'number'), degenerate);
    if (!isFixpoint(constructed)) drifts++;
    assert.equal(
      drifts,
      FIXPOINT_DRIFT_BUDGET,
      `KI-39: ${drifts}/${MATH_FIXPOINT_SHAPES} calc serializations drifted across re-parse (e.g. ${JSON.stringify(scaled.toString())} -> ${JSON.stringify(CSSOM.CSSStyleValue.parse('width', scaled.toString()).toString())}); css-syntax-3 #serialization requires round-tripping`,
    );
  });

  // Reproduces: KI-39
  test('toString equals re-parse(toString()).toString() structural fixpoint', () => {
    const z = mulBy(CSSOM.CSSStyleValue.parse('width', 'calc(1px + 2px)'), 3);
    const first = z.toString();
    const second = CSSOM.CSSStyleValue.parse('width', first).toString();
    assert.equal(
      second,
      first,
      `KI-39: toString produced ${JSON.stringify(first)} but its own re-parse serializes ${JSON.stringify(second)}; a degenerate single-child Sum must not serialize as a parenthesized product operand`,
    );
  });
});
