/**
 * Reproducer for CRS-0005/C23 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts DOMMatrixReadOnly.toString).
 *
 * The stringifier interpolates non-finite components into matrix()/matrix3d()
 * output instead of throwing. geometry-1 #dommatrix-readonly stringification
 * behavior step 1: "If one or more of m11 element through m44 element are a
 * non-finite value, then throw an InvalidStateError DOMException" (the CSS
 * syntax cannot represent NaN or Infinity). Asserts the intended contract so
 * this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

function assertInvalidStateError(label: string, fn: () => unknown): void {
  try {
    fn();
  } catch (err) {
    assert.equal((err as { name?: string }).name, 'InvalidStateError',
      `${label} must throw InvalidStateError`);
    return;
  }
  assert.fail(`${label} must throw InvalidStateError but stringified successfully`);
}

test('CRS-0005/C23: NaN components throw InvalidStateError on stringification', () => {
  assertInvalidStateError('new DOMMatrix([NaN,0,0,1,0,0]).toString()',
    () => new DOMMatrix([NaN, 0, 0, 1, 0, 0]).toString());
});

test('CRS-0005/C23: singular invertSelf then toString throws InvalidStateError', () => {
  const m = new DOMMatrix([0, 0, 0, 0, 0, 0]);
  m.invertSelf();
  assertInvalidStateError('singular matrix toString()', () => m.toString());
});
