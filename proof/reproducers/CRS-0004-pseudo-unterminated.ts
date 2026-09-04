/**
 * Reproducer for CRS-0004/C04 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts normalizePseudoElement).
 *
 * A known functional pseudo-element without its closing ')' is accepted as
 * valid and known, and the normalizer synthesizes the missing paren. CSS Syntax
 * cannot produce a complete <pseudo-element-selector> from `::highlight(foo`:
 * the unmatched function block makes the selector invalid, so getCascadedStyle
 * would match rules for a selector CSSOM parsing rejects. Asserts the intended
 * contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePseudoElement } from '../../src/cascade/index.ts';

test('CRS-0004/C04: unterminated functional pseudo-element is invalid', () => {
  const unterminated = normalizePseudoElement('::highlight(foo');
  assert.equal(unterminated?.valid, false, 'missing ) must not parse as a pseudo-element');
  assert.equal(unterminated?.isKnown, false, 'unterminated pseudo must not be treated as known');

  // Control: the terminated form stays valid and known.
  const terminated = normalizePseudoElement('::highlight(foo)');
  assert.equal(terminated?.valid, true);
  assert.equal(terminated?.isKnown, true);
});
