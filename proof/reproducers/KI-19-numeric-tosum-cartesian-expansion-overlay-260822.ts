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
 * must reject CHEAPLY — intermediate allocation must stay under a small heap
 * budget instead of growing exponentially in expression size.
 *
 * Reproduces: KI-19
 * Verifies: SYS-REQ-260822-8BK4
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSNumericValue } from '../../src/typed-om.ts';

const HEAP_BUDGET_MB = 8;
const FACTORS = 16;

function productCalc(factors: number): string {
  return 'calc(' + Array.from({ length: factors }, () => '(1px + 1em)').join('*') + ')';
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
});
