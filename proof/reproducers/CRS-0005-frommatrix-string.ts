/**
 * Reproducer for CRS-0005/C27 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts fromMatrix).
 *
 * fromMatrix forwards its argument straight into the constructor, so a string
 * is parsed as a CSS transform list instead of being converted to a
 * DOMMatrixInit dictionary. geometry-1 #dommatrix-frommatrix says fromMatrix
 * creates the matrix "from the dictionary" other; WebIDL dictionary conversion
 * of a string primitive throws a TypeError, so browsers reject
 * DOMMatrix.fromMatrix('matrix(...)'). Asserts the intended contract so this
 * command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix, DOMMatrixReadOnly } from '../../src/DOMMatrix.ts';

test('CRS-0005/C27: fromMatrix requires a DOMMatrixInit dictionary', () => {
  assert.throws(() => DOMMatrixReadOnly.fromMatrix('matrix(1,0,0,1,10,0)'),
    TypeError, 'a string is not a DOMMatrixInit dictionary');
  assert.throws(() => DOMMatrix.fromMatrix('translate(10px)'),
    TypeError, 'DOMMatrix.fromMatrix must reject strings too');

  // Control: dictionary input keeps working.
  assert.equal(DOMMatrixReadOnly.fromMatrix({ m41: 10 }).m41, 10);
});
