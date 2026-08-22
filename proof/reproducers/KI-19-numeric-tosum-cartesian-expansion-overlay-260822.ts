/**
 * Overlay reproducer for KI-19: CSSNumericValue.to/toSum cartesian expansion
 * without a term cap.
 *
 * CSS Typed OM Level 1 § #numeric-objects defines .to(unit) / .toSum(...).
 * The conversion normalizes a numeric tree into sum-of-unit-map terms; the
 * product branch distributes products of sums with nested cartesian loops
 * and no intermediate term cap. A compact calc((1px + 1em)*(1px + 1em)*...)
 * with n factors (relative units keep distinct unit maps) allocates 2^n
 * terms — at n=16 that is 65536 terms and ~30MB of live heap growth — before
 * the conversion rejects the mixed-unit result with TypeError.
 *
 * Asserts the SAFE contract via public CSSNumericValue.parse().toSum():
 * converting an unconvertible mixed-unit product may throw TypeError, but it
 * must reject CHEAPLY instead of growing exponentially in expression size.
 * Two independent proxies guard this:
 *   1. live heap delta <= 8MB around the call (allocation witness), and
 *   2. a GC-insensitive work-ratio witness: the wall time of the mixed-unit
 *      product must stay within a small multiple of an identical-shape
 *      same-unit product, whose px-only sum factors canonicalize per factor
 *      and therefore reject after linear work.
 * (A serialize-the-result length cap is not implementable against the current
 * semantics: numericToSum throws TypeError before returning whenever more
 * than one term survives, because distributed product unit maps always exceed
 * the single-unit/power-1 sum-term limits, so there is no expanded result to
 * serialize.)
 *
 * Reproduces: KI-19
 * Verifies: SYS-REQ-260822-8BK4
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSNumericValue } from '../../src/typed-om.ts';

const HEAP_BUDGET_MB = 8;
const FACTORS = 16;
const WORK_RATIO_BUDGET = 128;

function productCalc(factors: number): string {
  return 'calc(' + Array.from({ length: factors }, () => '(1px + 1em)').join('*') + ')';
}

/** Same product shape, but px-only sums collapse per factor -> linear-cost rejection. */
function sameUnitProductCalc(factors: number): string {
  return 'calc(' + Array.from({ length: factors }, () => '(1px + 2px)').join('*') + ')';
}

function bestOf3ToSum(v: CSSNumericValue): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    try {
      v.toSum();
    } catch {
      /* rejection is expected; only the cost profile is under test */
    }
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

describe('KI-19 e2e numeric conversion term budget', () => {
  test('positive control: same-unit sum converts without error', () => {
    const v = CSSNumericValue.parse('calc(1px + 2px)');
    const sum = v.toSum();
    assert.match(sum.serialize(), /3px/);
  });

  // Reproduces: KI-19
  // Verifies: SYS-REQ-260822-8BK4
  test(`mixed-unit ${FACTORS}-factor product converts without exponential intermediate allocation`, () => {
    const v = CSSNumericValue.parse(productCalc(FACTORS));
    let errorName = '';
    const before = process.memoryUsage().heapUsed;
    try {
      v.toSum();
    } catch (e) {
      errorName = (e as Error).name;
    }
    const after = process.memoryUsage().heapUsed;
    const deltaMB = (after - before) / (1024 * 1024);

    // Mixed px/em can never reify into one unit: TypeError is the CORRECT
    // eventual answer. The hole is paying 2^n allocation before it.
    assert.equal(errorName, 'TypeError', `expected mixed-unit conversion to be rejected as TypeError, got: ${errorName || 'success'}`);
    assert.ok(
      deltaMB <= HEAP_BUDGET_MB,
      `KI-19: .toSum() on a ${FACTORS}-factor mixed-unit product allocated ~${deltaMB.toFixed(1)}MB of heap ` +
        `(budget ${HEAP_BUDGET_MB}MB; 2^${FACTORS}=${2 ** FACTORS} cartesian terms before rejection) — ` +
        'createSumValue product branch has no term cap (SYS-REQ-260822-8BK4 conversion_terms_bounded)',
    );
  });

  // Reproduces: KI-19
  // Verifies: SYS-REQ-260822-8BK4
  test(`mixed-unit rejection cost stays within ${WORK_RATIO_BUDGET}x of an identical same-unit product (GC-insensitive)`, () => {
    // heapUsed sampling is sensitive to GC timing, so this leg bounds the
    // distribution WORK structurally instead: the same-unit control
    // canonicalizes each px-only factor before distribution and rejects after
    // linear work, while the mixed-unit product pays the full 2^n cartesian
    // walk first. Today that is hundreds-fold at n=16 (~37ms vs ~0.03-0.09ms
    // across runs); any real term cap aborts early and collapses the ratio.
    const sameUnit = CSSNumericValue.parse(sameUnitProductCalc(FACTORS));
    let controlErrorName = '';
    try {
      sameUnit.toSum();
    } catch (e) {
      controlErrorName = (e as Error).name;
    }
    assert.equal(controlErrorName, 'TypeError', `expected the px-only control to reject as TypeError too, got: ${controlErrorName || 'success'}`);

    const tControl = Math.max(bestOf3ToSum(sameUnit), 0.01);
    const tMixed = bestOf3ToSum(CSSNumericValue.parse(productCalc(FACTORS)));
    const ratio = tMixed / tControl;
    assert.ok(
      ratio <= WORK_RATIO_BUDGET,
      `KI-19: mixed-unit ${FACTORS}-factor .toSum() rejection took ${tMixed.toFixed(2)}ms vs ` +
        `${tControl.toFixed(2)}ms for the identical same-unit product (${ratio.toFixed(0)}x > ${WORK_RATIO_BUDGET}x budget) — ` +
        `distribution pays 2^${FACTORS}=${2 ** FACTORS} terms before rejecting (SYS-REQ-260822-8BK4 conversion_terms_bounded)`,
    );
  });
});
