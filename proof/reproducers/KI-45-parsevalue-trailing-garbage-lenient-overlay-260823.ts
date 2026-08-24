/**
 * Overlay reproducer for KI-45: CSS.parseValue('10% x') silently returns 10%
 * while CSS.parseComponentValue('10% x') throws SyntaxError — the two APIs
 * wrap the same css-syntax-3 algorithm, so they must agree.
 *
 * Reproduces: KI-45
 * Verifies: SYS-REQ-260823-PVE7 (parseValue rejects trailing garbage)
 *
 * Spec anchors:
 * - css-syntax-3 § 5.3.5 #parse-a-component-value
 *   (submodules/csswg-drafts/css-syntax-3/Overview.bs ~2457-2484):
 *   consume one component value; discard whitespace; "If input is non-empty,
 *   return a syntax error". BOTH parseValue and parseComponentValue are
 *   documented as exposing these parsing algorithms (WICG CSS Parser API
 *   #parsing-api IDL), so both must reject trailing garbage.
 * - WICG CSS Parser API #parsing-api: `CSSToken parseValue(DOMString css)` is
 *   a thin convenience member of the same namespace; the draft does not spell
 *   out separate lenient failure semantics for it. Honest caveat (also noted
 *   in the KI yaml): the violation is anchored on the shared css-syntax-3
 *   algorithm plus this library's own internal inconsistency, not on explicit
 *   parseValue failure prose.
 * - README.md documents the Parser API surface without any leniency deviation
 *   for parseValue; AGENTS.md lists css-syntax-3 as normative.
 *
 * Observed defect (src/parser-api.ts ~563-569): parseValueSync consumes one
 * component value and never calls ensureEOF()/checks for leftovers, unlike its
 * sibling parseComponentValueSync (~590-605) which throws when anything
 * remains after the first value. Result:
 *   CSS.parseValue('10% x')          → '10%'   (silent truncation)
 *   CSS.parseComponentValue('10% x') → SyntaxError
 *
 * Distinctness: KI-42 is about a lone BAD token (bad-url) inside a single
 * component value; this issue is about VALID single values followed by
 * REMAINDER input that the EOF step must reject.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/parse-value-eof-budget.vars.yaml:
 * const TRAILING_GARBAGE_REJECTING_APIS_MIN = 2;
 * const LENIENT_ACCEPT_BUDGET = 0;
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/index.ts';

// Reproducer constants mirrored in specs/system/variables/parse-value-eof-budget.vars.yaml:
const TRAILING_GARBAGE_REJECTING_APIS_MIN = 2; // parseValue AND parseComponentValue
const LENIENT_ACCEPT_BUDGET = 0; // zero silent truncations allowed

// Verifies: SYS-REQ-260823-PVE7 (KI-45 reproducer suite: consistent trailing-garbage rejection)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-45 parseValue and parseComponentValue agree on trailing garbage', () => {
  // Clean-input control (green): both APIs accept a well-formed single value.
  // Verifies: SYS-REQ-260823-PVE7
  test('control: clean single value parses identically on both APIs', () => {
    assert.equal(String(CSS.parseValue('10%')), '10%');
    assert.equal(
      String(CSS.parseComponentValue && CSS.parseComponentValue('10%')),
      '10%',
    );
  });

  // Sibling control (green today): parseComponentValue already rejects.
  // Verifies: SYS-REQ-260823-PVE7
  test("CSS.parseComponentValue('10% x') throws", () => {
    assert.throws(() => CSS.parseComponentValue!('10% x'));
  });

  // css-syntax-3 ~2479-2483: non-empty input after one value is a syntax error.
  // Verifies: SYS-REQ-260823-PVE7
  test(`CSS.parseValue('10% x') throws instead of truncating (${LENIENT_ACCEPT_BUDGET} silent truncations allowed)`, () => {
    let returned: unknown;
    let threw = false;
    try {
      returned = CSS.parseValue('10% x');
    } catch {
      threw = true;
    }
    assert.ok(
      threw,
      `KI-45: parseValue silently truncated trailing garbage to ${JSON.stringify(String(returned))}`,
    );
  });

  // Consistency leg: at least TRAILING_GARBAGE_REJECTING_APIS_MIN APIs reject.
  // Verifies: SYS-REQ-260823-PVE7
  test(`${TRAILING_GARBAGE_REJECTING_APIS_MIN}/${TRAILING_GARBAGE_REJECTING_APIS_MIN} value APIs reject '10% x'`, () => {
    const rejecting = [
      (() => {
        try {
          CSS.parseValue('10% x');
          return false;
        } catch {
          return true;
        }
      })(),
      (() => {
        try {
          CSS.parseComponentValue!('10% x');
          return false;
        } catch {
          return true;
        }
      })(),
    ].filter(Boolean).length;
    assert.ok(
      rejecting >= TRAILING_GARBAGE_REJECTING_APIS_MIN,
      `KI-45: only ${rejecting} API(s) reject trailing garbage`,
    );
  });
});
