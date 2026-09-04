/**
 * Reproducer for CRS-0005/C07..C15 (requirement INT-REQ-260821-JTY2,
 * src/DOMMatrix.ts mutable transformation methods).
 *
 * Every mutable transformation method applies its transform by pre-multiplying
 * it (transform · this) instead of post-multiplying (this · transform).
 * geometry-1 #mutable-transformation-methods requires post-multiplication for
 * translateSelf, scaleSelf, rotateSelf, rotateAxisAngleSelf, skewXSelf,
 * skewYSelf, and multiplySelf ("the otherObject matrix gets post-multiplied to
 * the current matrix"); preMultiplySelf must pre-multiply; flipX()/flipY()
 * post-multiply [-1,0,0,1,0,0] / [1,0,0,-1,0,0]. The spec's own example
 * (geometry-1 Overview.bs:1479-1485) pins scaleSelf(2); translateSelf(20,20) to
 * matrix(2, 0, 0, 2, 40, 40). Asserts the intended contract so this command
 * FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DOMMatrix } from '../../src/DOMMatrix.ts';

test('CRS-0005/C09: spec example scaleSelf(2); translateSelf(20,20)', () => {
  const m = new DOMMatrix();
  m.scaleSelf(2);
  m.translateSelf(20, 20);
  assert.equal(m.toString(), 'matrix(2, 0, 0, 2, 40, 40)');
});

test('CRS-0005/C07: multiplySelf post-multiplies other', () => {
  const m = new DOMMatrix();
  m.translateSelf(10, 0);
  m.multiplySelf(new DOMMatrix([2, 0, 0, 1, 0, 0]));
  // this . other keeps the translation: e stays 10, point (1,0) maps to 12.
  assert.equal(m.e, 10);
  assert.equal(m.transformPoint({ x: 1 }).x, 12);
});

test('CRS-0005/C08: preMultiplySelf pre-multiplies other', () => {
  const m = new DOMMatrix();
  m.translateSelf(10, 0);
  m.preMultiplySelf(new DOMMatrix([2, 0, 0, 1, 0, 0]));
  // other . this scales the translation: e becomes 20, point (1,0) maps to 22.
  assert.equal(m.e, 20);
  assert.equal(m.transformPoint({ x: 1 }).x, 22);
});

test('CRS-0005/C10: scaleSelf post-multiply leaves the translation alone', () => {
  const m = new DOMMatrix([1, 0, 0, 1, 10, 0]);
  m.scaleSelf(2);
  assert.equal(m.toString(), 'matrix(2, 0, 0, 2, 10, 0)');
});

test('CRS-0005/C11: rotateSelf post-multiply does not rotate the translation', () => {
  const m = new DOMMatrix();
  m.translateSelf(10, 0);
  m.rotateSelf(90);
  assert.equal(m.e, 10);
  assert.equal(m.f, 0);
});

test('CRS-0005/C12: skewXSelf post-multiply changes c, keeps e', () => {
  const m = new DOMMatrix([2, 3, 0, 1, 10, 20]);
  m.skewXSelf(45);
  assert.equal(m.c, 2);
  assert.equal(m.e, 10);
});

test('CRS-0005/C13: skewYSelf post-multiply changes a and b, keeps f', () => {
  const m = new DOMMatrix([2, 3, 0, 1, 10, 20]);
  m.skewYSelf(45);
  assert.equal(m.b, 4);
  assert.equal(m.f, 20);
});

test('CRS-0005/C14: flipX post-multiplies [-1,0,0,1,0,0] and negates m11,m12', () => {
  const m = new DOMMatrix([1, 2, 3, 4, 5, 6]).flipX();
  assert.equal(m.m11, -1);
  assert.equal(m.m12, -2);
  assert.equal(m.m21, 3);
  assert.equal(m.m41, 5);
});

test('CRS-0005/C15: flipY post-multiplies [1,0,0,-1,0,0] and negates m21,m22', () => {
  const m = new DOMMatrix([1, 2, 3, 4, 5, 6]).flipY();
  assert.equal(m.m12, 2);
  assert.equal(m.m21, -3);
  assert.equal(m.m22, -4);
  assert.equal(m.m42, 6);
});
