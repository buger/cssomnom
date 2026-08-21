/**
 * Overlay reproducer for KI-4. Not a product-suite test.
 * Asserts the intended contract (JS registerProperty after @property throws
 * InvalidModificationError) so this command FAILS while the bug is present.
 *
 * Reproduces: KI-4
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/typed-om.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

function ki4Contract(): { setupOk: boolean; holds: boolean; message: string } {
  PropertyRegistry.clear();
  const sheet = parse('@property --mcdc-ki4 { syntax: "*"; inherits: false; }');
  const stored = PropertyRegistry.get('--mcdc-ki4');
  if (sheet.cssRules.length !== 1 || !stored) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected @property --mcdc-ki4 registered, cssRules=${sheet.cssRules.length} stored=${JSON.stringify(stored)}`,
    };
  }

  try {
    CSS.registerProperty({
      name: '--mcdc-ki4',
      syntax: '*',
      inherits: false,
    });
    const after = PropertyRegistry.get('--mcdc-ki4');
    return {
      setupOk: true,
      holds: false,
      message: `KI-4: CSS.registerProperty after @property did not throw; origin=${JSON.stringify(after && 'origin' in after ? (after as { origin?: string }).origin : undefined)}`,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'InvalidModificationError') {
      return {
        setupOk: true,
        holds: true,
        message: 'KI-4 contract holds: JS register after @property threw InvalidModificationError',
      };
    }
    return {
      setupOk: true,
      holds: false,
      message: `KI-4: JS register after @property threw ${err instanceof Error ? err.name : typeof err} instead of InvalidModificationError`,
    };
  }
}

// Reproduces: KI-4
// Verifies: SW-REQ-260821-V5GA
// MCDC SW-REQ-260821-V5GA: duplicate_js_register=T, invalid_modification_error=T => TRUE
// Verifies: SYS-REQ-260821-EGCP
// MCDC SYS-REQ-260821-EGCP: bad_dictionary=F, duplicate_js_register=T, register_throws=T => TRUE
test('KI-4: JS register after @property throws InvalidModificationError', () => {
  const outcome = ki4Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
