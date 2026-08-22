/**
 * Overlay reproducer for KI-17: acyclic var()/env() exponential expansion.
 *
 * css-variables-1 § #using-variables ("substitute a var()") requires cycle
 * detection — which the library implements — but a library resolving
 * attacker-supplied custom properties must also bound substitution size:
 * an acyclic fan-out DAG (--vN: var(--v(N-1)) var(--v(N-1))) unfolds to
 * 2^(N+1)-1 characters and 2^N re-substitutions with no budget, ending in
 * RangeError at modest depth.
 *
 * Asserts the SAFE contract via public cascade entry getCascadedStyle():
 * resolved output length must stay within a small polynomial bound
 * (<= 10000 chars) at depth 20; currently it is 2^21-1 = 2097151 chars or
 * a RangeError from unbounded recursion.
 *
 * Reproduces: KI-17
 * Verifies: SYS-REQ-260822-EGPW
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade.ts';

const SUBSTITUTION_CHAR_BUDGET = 10000;

function doublingChainCss(depth: number): string {
  let css = '.ki17 { --k0: x; color: var(--k' + depth + ');';
  for (let i = 1; i <= depth; i++) {
    css += ' --k' + i + ': var(--k' + (i - 1) + ') var(--k' + (i - 1) + ');';
  }
  return css + ' }';
}

function cascadeColor(depth: number): string {
  const { document } = parseHTML('<div class="ki17"></div>');
  const element = document.querySelector('.ki17');
  assert.ok(element, 'missing .ki17 fixture element');
  const style = getCascadedStyle(element, parseStyleSheet(doublingChainCss(depth)));
  return style.getPropertyValue('color');
}

describe('KI-17 e2e acyclic var()/env() expansion budget', () => {
  test('positive control: small doubling chain resolves to expected string', () => {
    assert.equal(cascadeColor(2), 'x x x x');
  });

  // Reproduces: KI-17
  // Verifies: SYS-REQ-260822-EGPW
  test('depth-20 doubling chain stays within the substitution char budget', () => {
    let color: string;
    try {
      color = cascadeColor(20);
    } catch (e) {
      assert.fail(
        `KI-17: acyclic substitution threw ${(e as Error).name}: ${(e as Error).message} — ` +
          `expansion has no size/depth budget (SYS-REQ-260822-EGPW substitution_size_bounded); ` +
          `expected resolved length <= ${SUBSTITUTION_CHAR_BUDGET} chars`,
      );
    }
    assert.ok(
      color.length <= SUBSTITUTION_CHAR_BUDGET,
      `KI-17: depth-20 doubling chain expanded to ${color.length} chars, budget is ${SUBSTITUTION_CHAR_BUDGET} ` +
        `(acyclic DAG expands as 2^(N+1)-1; SYS-REQ-260822-EGPW substitution_size_bounded)`,
    );
  });
});
