/**
 * Reproducer for CRS-0005/C16 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts rotateAxisAngleSelf).
 *
 * rotateAxisAngleSelf clears is 2D whenever z !== 1, even for a pure z axis
 * like (0,0,-1) or (0,0,2). geometry-1 #mutable-transformation-methods
 * rotateAxisAngleSelf step 2 demotes is 2D only when x or y is not 0 or -0: a
 * rotation about a z-only axis stays a 2D rotation. Asserts the intended
 * contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

test('CRS-0005/C16: z-only axes keep the matrix 2D', () => {
  const negated = new DOMMatrix();
  negated.rotateAxisAngleSelf(0, 0, -1, 45);
  assert.equal(negated.is2D, true, 'axis (0,0,-1) is a z rotation and stays 2D');

  const scaled = new DOMMatrix();
  scaled.rotateAxisAngleSelf(0, 0, 2, 45);
  assert.equal(scaled.is2D, true, 'axis (0,0,2) normalizes to (0,0,1) and stays 2D');

  // Control: a non-zero x or y really is 3D.
  const real3d = new DOMMatrix();
  real3d.rotateAxisAngleSelf(1, 0, 0, 45);
  assert.equal(real3d.is2D, false);
});
