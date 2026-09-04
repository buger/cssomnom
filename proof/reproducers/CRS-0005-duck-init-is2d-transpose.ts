/**
 * Reproducer for CRS-0005/C24 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts parseMatrixInit duck-typed toFloat64Array path).
 *
 * parseMatrixInit short-circuits on any object exposing toFloat64Array() and
 * returns { is2D: dict.is2D ?? true, values: transpose(arr) } before
 * has3DComponents can classify the components. A spec-layout column-major
 * 16-element array (m11..m44, m43 at index 14) therefore comes back flagged
 * is2D: true with transposed components, and toString() reports a 2D matrix
 * that hides the 3D part. Asserts the intended contract so this command FAILS
 * while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

test('CRS-0005/C24: duck-typed toFloat64Array init keeps 3D components', () => {
  const init = {
    toFloat64Array: () => Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1]),
  };
  const m = new DOMMatrix(init);
  assert.equal(m.m43, 5, 'index 14 of a column-major array is m43');
  assert.equal(m.is2D, false, 'a non-zero m43 makes the matrix 3D');
  assert.equal(m.m34, 0, 'components must not be transposed');
});
