/**
 * Overlay reproducer for KI-118.  This file intentionally stays red until
 * math-function results that evaluate to NaN serialize with the canonical
 * `NaN` keyword (and never leak a lowercase `nan` identifier).
 *
 * Reproduces: KI-118
 * Verifies: SYS-REQ-260824-N9AE
 *
 * Spec anchors:
 * - css-values-4 § "Serialization" (#calc-serialize, ~line 5214), algorithm
 *   "serialize a math function", step 2: "If |fn| represents an infinite or
 *   NaN value: Let |s| be the string 'calc('. Serialize the keyword
 *   'infinity', '-infinity', or 'NaN', as appropriate to represent the value"
 *   — the keyword spelling is normative and case-sensitive ('NaN').
 * - css-values-4 #calc-infinities note (~line 4737): "The rules for producing
 *   NaN ... supersede the above rules for producing infinities" and NaN is
 *   infectious across function arguments (~line 4147).
 * - Local WPT fixture css/css-values/calc-infinity-nan-serialize-length.html:
 *     "1px * NaN"                -> "calc(NaN * 1px)"
 *     "1px * iNFinIty"           -> "calc(infinity * 1px)"
 *   (the wpt-cssom known-failure baseline carries 160 entries across the five
 *   calc-infinity-nan-serialize-* fixtures.)
 *
 * Root-dedup note vs KI-39: KI-39 pins the degenerate single-child Sum /
 * parenthesization structure drift (`calc(calc(...))` double wrap).  This KI
 * pins ONLY the canonical keyword casing of evaluated NaN results, asserted
 * through a structure-independent predicate (no lowercase standalone 'nan'),
 * so the two reproducers fail/pass independently.
 *
 * Observed defect at HEAD via public API:
 *   CSSStyleValue.parse('width', 'calc(NaN)').toString() === 'calc(nan)'
 *   CSSStyleValue.parse('width', 'calc(1px * NaN)').toString()
 *     === 'calc(calc(nan * 1px))'   // lowercase 'nan'; wrapper is KI-39's root
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

// Verifies: SYS-REQ-260824-N9AE (KI-118 reproducer helper: parse().toString() probe)
// reqproof:proptest:skip one-line parse-then-serialize probe over live CSSStyleValue.parse; its oracle would restate the same parse+serialize pipeline
function toStringOf(value: string): string {
  return String(CSSStyleValue.parse('width', value));
}

// Positive control (green today): the infinity keyword already serializes in
// its canonical lowercase form per css-values-4 step 2 ('infinity').
// Verifies: SYS-REQ-260824-N9AE (infinity-keyword control per css-values-4 step 2)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-118 control', () => {
  test('infinity keyword is spelled canonically', () => {
    const s = toStringOf('calc(1px * infinity)');
    assert.ok(s.includes('infinity'), `expected canonical 'infinity' in ${JSON.stringify(s)}`);
    assert.ok(!/\bnan\b/i.test(s), `control must not involve NaN; got ${JSON.stringify(s)}`);
  });
});

// Reproduces: KI-118
// Verifies: SYS-REQ-260824-N9AE (canonical-NaN-keyword defect legs)
describe('KI-118: NaN results must serialize with the canonical NaN keyword', () => {
  // css-values-4 #calc-serialize step 2: bare NaN has empty type, so the
  // serialization is exactly "calc(NaN)".
  test('calc(NaN) serializes as calc(NaN)', () => {
    assert.equal(toStringOf('calc(NaN)'), 'calc(NaN)');
  });

  // Structure-independent casing predicate (avoids KI-39's wrapper overlap):
  // no serialization of an NaN result may contain a standalone lowercase
  // 'nan' token; the canonical keyword is 'NaN'.
  // Verifies: SYS-REQ-260824-N9AE (structure-independent casing predicate).
  test('no lowercase nan token leaks from calc(1px * NaN)', () => {
    const s = toStringOf('calc(1px * NaN)');
    assert.doesNotMatch(
      s,
      /(^|[^A-Za-z])nan([^A-Za-z]|$)/,
      `evaluated NaN must use the canonical 'NaN' keyword per css-values-4 #calc-serialize step 2; got ${JSON.stringify(s)}`,
    );
  });

  test('infectious NaN via infinity/infinity keeps canonical keyword', () => {
    const s = toStringOf('calc(1px * iNfInItY / iNfInItY)');
    assert.doesNotMatch(
      s,
      /(^|[^A-Za-z])nan([^A-Za-z]|$)/,
      `WPT row '1px * infinity / infinity' expects calc(NaN * 1px); got ${JSON.stringify(s)}`,
    );
  });
});
