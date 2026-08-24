/**
 * Overlay reproducer for KI-5. Not a product-suite test.
 * Asserts the intended contract (unbalanced (( serializes as not all)
 * so this command FAILS while the hole is present.
 *
 * Reproduces: KI-5
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, serializeMediaQuery } from '../../src/MediaParser.ts';

function ki5Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const control = MediaParser.parse('&test').map(serializeMediaQuery);
  if (control.length !== 1 || control[0] !== 'not all') {
    return {
      setupOk: false,
      holds: false,
      message: `setup failed: expected '&test' -> 'not all', got ${JSON.stringify(control)}`,
    };
  }

  const serialized = MediaParser.parse('((').map(serializeMediaQuery);
  if (serialized.length === 1 && serialized[0] === 'not all') {
    return { setupOk: true, holds: true, message: 'KI-5 contract holds: unbalanced (( serialized as not all' };
  }
  return {
    setupOk: true,
    holds: false,
    message: `KI-5: unbalanced (( was not serialized as not all; got ${JSON.stringify(serialized)}`,
  };
}

// Reproduces: KI-5
// Verifies: SW-REQ-260821-W8S1
// MCDC SW-REQ-260821-W8S1: media_query_invalid=T, serialize_media_query_runs=T, serialized_as_not_all=T => TRUE
// Verifies: SYS-REQ-260821-5283
// MCDC SYS-REQ-260821-5283: media_query_invalid=T, serialized_as_not_all=T => TRUE
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-5: unbalanced (( serializes as not all', () => {
  const outcome = ki5Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
