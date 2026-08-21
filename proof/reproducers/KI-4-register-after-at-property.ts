/**
 * Spec test for withdrawn KI-4 (false hole).
 * css-properties-values-api-1 § 4.1 throws InvalidModificationError only when
 * the name is already in [[registeredPropertySet]]. @property does not fill
 * that slot; a later CSS.registerProperty succeeds and JS wins (§ 3).
 *
 * Residual: L-KI4
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/typed-om.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

function ki4SpecContract(): { setupOk: boolean; holds: boolean; message: string } {
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
      syntax: '<color>',
      inherits: true,
      initialValue: 'red',
    });
  } catch (err) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-4: CSS.registerProperty after @property threw ${err instanceof Error ? err.name : typeof err}; spec requires succeed+JS-wins`,
    };
  }

  const after = PropertyRegistry.get('--mcdc-ki4');
  if (!after || after.syntax !== '<color>' || after.inherits !== true || after.initialValue !== 'red') {
    return {
      setupOk: true,
      holds: false,
      message: `KI-4: JS register after @property did not overwrite; after=${JSON.stringify(after)}`,
    };
  }

  try {
    CSS.registerProperty({
      name: '--mcdc-ki4',
      syntax: '*',
      inherits: false,
    });
    return {
      setupOk: true,
      holds: false,
      message: 'KI-4: second JS registerProperty did not throw InvalidModificationError',
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'InvalidModificationError') {
      return {
        setupOk: true,
        holds: true,
        message: 'KI-4 spec holds: CSS-then-JS succeeds and JS wins; JS-then-JS throws InvalidModificationError',
      };
    }
    return {
      setupOk: true,
      holds: false,
      message: `KI-4: second JS register threw ${err instanceof Error ? err.name : typeof err} instead of InvalidModificationError`,
    };
  }
}

// Verifies: SW-REQ-260821-V5GA
// MCDC SW-REQ-260821-V5GA: duplicate_js_register=F, invalid_modification_error=F => TRUE
// Verifies: SYS-REQ-260821-EGCP
// MCDC SYS-REQ-260821-EGCP: bad_dictionary=F, duplicate_js_register=F, register_throws=F => TRUE
test('KI-4 residual: CSS.registerProperty after @property succeeds and JS wins', () => {
  const outcome = ki4SpecContract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
