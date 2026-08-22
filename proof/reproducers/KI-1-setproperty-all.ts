/**
 * Overlay reproducer for KI-1. Not a product-suite test.
 * Import parser first so ParseHooks inject. Asserts the intended contract
 * (invalid `all` is a no-op) so this command FAILS while the hole is present.
 *
 * Reproduces: KI-1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function ki1Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const style = new CSSStyleDeclaration();
  // A successful all:unset expands to longhands and does not keep an `all`
  // declaration, so a later failed expand is observably a no-op. The live hole
  // is when `all` itself is stored (var/env): delete-before-expand then drops it.
  style.setProperty('all', 'var(--x)');
  const before = style.getPropertyValue('all');
  const beforeText = style.cssText;
  style.setProperty('all', 'not-a-css-wide-keyword');
  const after = style.getPropertyValue('all');
  const afterText = style.cssText;

  if (before !== 'var(--x)' || beforeText.trim() !== 'all: var(--x);') {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected stored all: var(--x), got value=${JSON.stringify(before)} cssText=${JSON.stringify(beforeText)}`,
    };
  }
  if (after !== 'var(--x)' || afterText.trim() !== 'all: var(--x);') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-1: invalid all was not a no-op; prior all dropped (value ${JSON.stringify(before)} -> ${JSON.stringify(after)}; cssText ${JSON.stringify(beforeText)} -> ${JSON.stringify(afterText)})`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-1 contract holds: invalid all left prior all in place' };
}

// Reproduces: KI-1
// Verifies: SW-REQ-260821-HNRG
// MCDC SW-REQ-260821-HNRG: declaration_unchanged=F, set_property_ignored=F, value_validation_fails=T => FALSE [known-issue] [ki: KI-1]
// Verifies: SYS-REQ-260821-8TGB
// MCDC SYS-REQ-260821-8TGB: invalid_value=T, set_property_called=T, set_property_ignored=F => FALSE [known-issue] [ki: KI-1]
test('KI-1: invalid all is a no-op', () => {
  const outcome = ki1Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
