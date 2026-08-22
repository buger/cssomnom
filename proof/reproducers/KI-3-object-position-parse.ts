/**
 * Overlay reproducer for KI-3. Not a product-suite test.
 * Import parser first so ParseHooks inject. Asserts the intended contract
 * (invalid object-position throws TypeError) so this command FAILS while
 * the hole is present.
 *
 * Reproduces: KI-3
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleValue } from '../../src/typed-om.ts';

function ki3Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const valid = CSSStyleValue.parse('object-position', 'left');
  if (!valid || valid.toString().length === 0) {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: valid object-position 'left' did not parse, got ${String(valid)}`,
    };
  }

  try {
    const parsed = CSSStyleValue.parse('object-position', 'not-a-position');
    return {
      setupOk: true,
      holds: false,
      message: `KI-3: invalid object-position did not throw; got ${parsed?.constructor?.name} ${JSON.stringify(parsed?.toString())}`,
    };
  } catch (err) {
    if (err instanceof TypeError) {
      return { setupOk: true, holds: true, message: 'KI-3 contract holds: invalid object-position threw TypeError' };
    }
    return {
      setupOk: true,
      holds: false,
      message: `KI-3: invalid object-position threw ${err instanceof Error ? err.name : typeof err} instead of TypeError`,
    };
  }
}

// Reproduces: KI-3
// Verifies: SW-REQ-260821-7AKJ
// MCDC SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=T, parse_throws=F => FALSE [known-issue] [ki: KI-3]
// Verifies: SYS-REQ-260821-HGFK
// MCDC SYS-REQ-260821-HGFK: invalid_typed_input=T, parse_throws=F => FALSE [known-issue] [ki: KI-3]
test('KI-3: invalid object-position throws TypeError', () => {
  const outcome = ki3Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
