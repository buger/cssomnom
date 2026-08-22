/**
 * Overlay reproducer for KI-16: :has()/combinator matching lacks a
 * complexity budget.
 *
 * css-selectors-4 § 4.5 #relational defines :has() semantics; it does not
 * license unbounded evaluation cost. The matcher eagerly materializes the
 * whole neighborhood (getAllDescendants / subsequent-sibling walks) with no
 * step or time budget, and querySelectorAll re-enters that path for every
 * visited node, so a flat miss selector ':has(~ .missing)' over a wide
 * sibling list costs Theta(w^2) sibling-pair checks.
 *
 * Nested ':has(:has())' is already rejected at parse time — that control is
 * asserted below and is only a partial mitigation; a single accepted ':has'
 * remains unbounded.
 *
 * Asserts the SAFE contract via public querySelectorAll(): a ':has' miss
 * query must cost at most a small bounded multiple of a plain class scan on
 * the same tree. Today the ratio is in the hundreds (~69x at width 3000,
 ~1722x at width 5000 per the security scan), so the bound fails while the
 * hole is present.
 *
 * Reproduces: KI-16
 * Verifies: SYS-REQ-260822-ZQJT
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { querySelectorAll, matches } from '../../src/matcher.ts';
import type { DOMElement } from '../../src/matcher.ts';

const WIDTH = 3000;
const RATIO_BUDGET = 8;

interface MockEl extends DOMElement {
  children: DOMElement[];
}

function makeElement(tag: string, cls: string): MockEl {
  const el: MockEl = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    localName: tag,
    className: cls,
    classList: { contains: (c) => cls.split(/\s+/).includes(c) },
    getAttribute: (name) => (name === 'class' ? cls : null),
    children: [],
    parentElement: null,
    nextElementSibling: null,
    previousElementSibling: null,
  };
  return el;
}

/** Flat tree: one root with WIDTH children linked as siblings. */
function flatTree(width: number): MockEl {
  const root = makeElement('div', 'ki16-root');
  let prev: MockEl | null = null;
  for (let i = 0; i < width; i++) {
    const kid = makeElement('span', 'ki16-kid');
    kid.parentElement = root;
    root.children.push(kid);
    if (prev) {
      prev.nextElementSibling = kid;
      kid.previousElementSibling = prev;
    }
    prev = kid;
  }
  return root;
}

function bestOf3(fn: () => unknown): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t0 = performance.now();
    fn();
    best = Math.min(best, performance.now() - t0);
  }
  return best;
}

describe('KI-16 e2e selector matching complexity budget', () => {
  test('positive controls: plain class scans linearly and nested :has stays rejected', () => {
    const root = flatTree(WIDTH);
    const hits = querySelectorAll(root, '.ki16-kid');
    assert.equal(hits.length, WIDTH);
    // Parse-time partial mitigation control (css-selectors-4 § 4.5 #relational).
    // Discriminating shape: the probed span gains a descendant chain
    // (.ki16-mid -> .x), so IF nested ':has' were accepted the inner
    // ':has(.x)' would match .ki16-mid and this assertion would flip true.
    // Asserting false therefore proves parse-time rejection of the nested
    // form, not a vacuous non-match over an empty subtree.
    const probe = root.children[0] as MockEl;
    const mid = makeElement('div', 'ki16-mid');
    const leaf = makeElement('span', 'x');
    mid.children.push(leaf);
    leaf.parentElement = mid;
    mid.parentElement = probe;
    probe.children.push(mid);
    assert.equal(matches(probe, ':has(:has(.x))'), false);
  });

  // Reproduces: KI-16
  // Verifies: SYS-REQ-260822-ZQJT
  test(':has miss query cost is a bounded multiple of a plain class scan', () => {
    const root = flatTree(WIDTH);
    const tPlain = Math.max(bestOf3(() => querySelectorAll(root, '.ki16-kid')), 0.01);
    const tHas = bestOf3(() => querySelectorAll(root, ':has(~ .ki16-nope)'));
    assert.equal(querySelectorAll(root, ':has(~ .ki16-nope)').length, 0);
    const ratio = tHas / tPlain;
    assert.ok(
      ratio <= RATIO_BUDGET,
      `KI-16: ':has(~ .ki16-nope)' miss over ${WIDTH} siblings took ${tHas.toFixed(1)}ms vs ` +
        `${tPlain.toFixed(1)}ms for the equivalent plain class scan (${ratio.toFixed(0)}x > ${RATIO_BUDGET}x budget) — ` +
        `relational/sibling matching has no complexity budget (SYS-REQ-260822-ZQJT match_cost_bounded)`,
    );
  });
});
