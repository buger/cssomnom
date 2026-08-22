/**
 * Overlay reproducer for KI-11. Not a product-suite test.
 * css-values-4 § 10.1 #position: generic <position> is 1-/2-/4-value, not 3-value.
 * css-transforms-2 #perspective-origin-property uses <position> (3-value invalid).
 * css-transforms-1 #transform-origin-property is not 4-value <position>.
 * css-values-4 && grammar: center is in both x and y groups, so "center left" is valid.
 * Asserts those contracts. PASSES after the KI-11 product fix.
 *
 * Reproduces: KI-11
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleValue } from '../../src/typed-om.ts';

function ki11Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const left = CSSStyleValue.parse('object-position', 'left');
  if (!left || left.constructor.name !== 'CSSPositionValue') {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: valid object-position 'left' did not reify CSSPositionValue, got ${left?.constructor?.name}`,
    };
  }

  try {
    const three = CSSStyleValue.parse('perspective-origin', 'left 10px top');
    return {
      setupOk: true,
      holds: false,
      message: `KI-11: 3-value perspective-origin parsed as ${three?.constructor?.name} ${JSON.stringify(three?.toString())}; intended TypeError`,
    };
  } catch (err) {
    if (!(err instanceof TypeError)) {
      return {
        setupOk: true,
        holds: false,
        message: `KI-11: 3-value perspective-origin threw ${err instanceof Error ? err.name : typeof err} instead of TypeError`,
      };
    }
  }

  try {
    const four = CSSStyleValue.parse('transform-origin', 'left 10px top 20px');
    return {
      setupOk: true,
      holds: false,
      message: `KI-11: 4-value transform-origin parsed as ${four?.constructor?.name} ${JSON.stringify(four?.toString())}; intended TypeError`,
    };
  } catch (err) {
    if (!(err instanceof TypeError)) {
      return {
        setupOk: true,
        holds: false,
        message: `KI-11: 4-value transform-origin threw ${err instanceof Error ? err.name : typeof err} instead of TypeError`,
      };
    }
  }

  try {
    const centerLeft = CSSStyleValue.parse('object-position', 'center left');
    if (centerLeft?.constructor?.name !== 'CSSPositionValue') {
      return {
        setupOk: true,
        holds: false,
        message: `KI-11: object-position 'center left' reified ${centerLeft?.constructor?.name} ${JSON.stringify(centerLeft?.toString())}; intended CSSPositionValue`,
      };
    }
  } catch (err) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-11: object-position 'center left' threw ${err instanceof Error ? err.name : typeof err}; intended CSSPositionValue`,
    };
  }

  return { setupOk: true, holds: true, message: 'KI-11 contract holds: 3-value perspective-origin and 4-value transform-origin throw; center left reifies' };
}

// Reproduces: KI-11
// Verifies: SW-REQ-260821-7AKJ
// MCDC SW-REQ-260821-7AKJ: invalid_typed_input=T, parse_style_value=T, parse_throws=T => TRUE
// Verifies: SYS-REQ-260821-HGFK
// MCDC SYS-REQ-260821-HGFK: invalid_typed_input=T, parse_throws=T => TRUE
test('position grammar: 3-value perspective-origin throws; center left reifies; transform-origin 4-value throws', () => {
  const outcome = ki11Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
