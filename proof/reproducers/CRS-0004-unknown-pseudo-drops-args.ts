/**
 * Reproducer for CRS-0004/C03 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts normalizePseudoElement).
 *
 * Unknown functional pseudo-elements are reported valid but their normalized
 * form discards the argument list: '::unknown(foo)' normalizes to '::unknown()'.
 * Selectors 4 requires unknown pseudo-elements to be preserved for forward
 * compatibility, and a normalizer must stay faithful to its input. Asserts the
 * intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePseudoElement } from '../../src/cascade/index.ts';

test('CRS-0004/C03: unknown functional pseudo-element keeps its arguments', () => {
  const res = normalizePseudoElement('::unknown(foo)');
  assert.equal(res?.valid, true, 'unknown pseudo-elements parse as valid');
  assert.equal(res?.isKnown, false);
  assert.equal(res?.normalized, '::unknown(foo)', 'normalized form must retain the arguments');
});
