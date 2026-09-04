/**
 * Reproducer for CRS-0005/C17, C18, C19, C20 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts fromFloat32Array / fromFloat64Array).
 *
 * All four fromFloat*Array overrides (DOMMatrixReadOnly and DOMMatrix) throw a
 * TypeError for 6-element arrays and transpose 16-element input before handing
 * it to a constructor that already stores the sequence in column-major order.
 * geometry-1 #dommatrix-create fromFloat32Array/fromFloat64Array: 6 elements
 * create a 2d matrix, 16 elements create a 3d matrix "taking the values in the
 * provided order" (m11..m44 column-major, m41 at index 12), otherwise
 * TypeError. Asserts the intended contract so this command FAILS while the
 * hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix, DOMMatrixReadOnly } from '../../src/DOMMatrix.ts';

const SIX = [1, 0, 0, 1, 10, 20];
const SIXTEEN = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1];

test('CRS-0005/C17: DOMMatrixReadOnly.fromFloat64Array accepts 6 elements', () => {
  const m = DOMMatrixReadOnly.fromFloat64Array(Float64Array.from(SIX));
  assert.equal(m.is2D, true, 'a 6-element array creates a 2d matrix');
  assert.equal(m.e, 10);
  assert.equal(m.f, 20);
});

test('CRS-0005/C18: DOMMatrixReadOnly.fromFloat32Array accepts 6 elements', () => {
  const m = DOMMatrixReadOnly.fromFloat32Array(Float32Array.from(SIX));
  assert.equal(m.is2D, true, 'a 6-element array creates a 2d matrix');
  assert.equal(m.e, 10);
});

test('CRS-0005/C17b/C19: 16-element input keeps the given order', () => {
  const ro = DOMMatrixReadOnly.fromFloat64Array(Float64Array.from(SIXTEEN));
  assert.equal(ro.m41, 10, 'm41 comes from index 12 in the provided order');
  assert.equal(ro.m42, 20);
  assert.equal(ro.m43, 30);
  assert.equal(ro.m14, 0);

  const mutable = DOMMatrix.fromFloat64Array(Float64Array.from(SIXTEEN));
  assert.equal(mutable.m41, 10, 'DOMMatrix.fromFloat64Array must not transpose either');
  assert.equal(mutable.m14, 0);
});

test('CRS-0005/C20: DOMMatrix.fromFloat32Array accepts 6 elements', () => {
  const m = DOMMatrix.fromFloat32Array(Float32Array.from(SIX));
  assert.equal(m.is2D, true);
  assert.equal(m.e, 10);
});
