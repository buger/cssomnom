/**
 * Reproducer for CRS-0005/C21, C22 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts toFloat32Array / toFloat64Array).
 *
 * Both serializers return transpose(this._values) although _values already
 * stores m11..m44 in column-major order, so the serialized 16 elements come out
 * transposed: m41 lands at index 3 instead of index 12. geometry-1
 * #dommatrix-readonly says toFloat32Array()/toFloat64Array() "return the
 * serialized 16 elements m11 to m44 of the current matrix in column-major
 * order". Asserts the intended contract so this command FAILS while the hole
 * is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

// The 16-element constructor stores the sequence in the given (column-major) order.
const m = new DOMMatrix(Float64Array.from([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 10, 20, 30, 1]));

test('CRS-0005/C21: toFloat64Array serializes m11..m44 column-major', () => {
  const out = m.toFloat64Array();
  assert.equal(out[12], 10, 'm41 must serialize at index 12');
  assert.equal(out[13], 20, 'm42 must serialize at index 13');
  assert.equal(out[14], 30, 'm43 must serialize at index 14');
  assert.equal(out[3], 0, 'm14 must serialize at index 3');
});

test('CRS-0005/C22: toFloat32Array serializes m11..m44 column-major', () => {
  const out = m.toFloat32Array();
  assert.equal(out[12], 10, 'm41 must serialize at index 12');
  assert.equal(out[3], 0);
});
