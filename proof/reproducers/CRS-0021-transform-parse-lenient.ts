/**
 * Reproducer for CRS-0021/C01, C02, C08, C13, C14, C19, C25
 * (requirement SW-REQ-260821-7AKJ, src/typed-om/transform/transform-parser.ts
 * and CSSTransformValue.parse dispatch). css-typed-om-1 #parse-a-cssstylevalue
 * step 3 throws TypeError when the value fails the property grammar, and the
 * transform grammar only accepts valid <transform-function>s. The parseNumeric
 * helper substitutes unitless 0 for unparseable arguments (idents, failed math
 * functions), parseMatrix zeroes non-number arguments, and parseSkew /
 * parsePerspective never check argument count. Invalid transform functions
 * therefore reify instead of throwing TypeError.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSTransformValue } from '../../src/typed-om/transform/CSSTransformValue.ts';
import { CSSStyleValue } from '../../src/typed-om/values/CSSStyleValue.ts';

test('CRS-0021/C01: scale(foo) throws instead of reifying scale(0)', () => {
  assert.throws(
    () => CSSTransformValue.parse('scale(foo)'),
    TypeError,
    'an ident argument is not a <number>, so scale(foo) must throw',
  );
});

test('CRS-0021/C01: CSSStyleValue.parse("transform", "scale(foo)") throws', () => {
  assert.throws(() => CSSStyleValue.parse('transform', 'scale(foo)'), TypeError);
});

test('CRS-0021/C08+CRS-0021/C19: invalid nested math sin(foo) throws', () => {
  assert.throws(
    () => CSSTransformValue.parse('scale(sin(foo))'),
    TypeError,
    'sin(foo) is not a valid math function value, so scale(sin(foo)) must throw',
  );
});

test('CRS-0021/C02: matrix() with ident arguments throws', () => {
  assert.throws(
    () => CSSTransformValue.parse('matrix(foo, bar, baz, qux, 1, 2)'),
    TypeError,
    'matrix() requires six <number>s; idents must not become 0',
  );
});

test('CRS-0021/C02: matrix3d() with sixteen ident arguments throws', () => {
  const css = `matrix3d(${Array.from({ length: 16 }, () => 'foo').join(', ')})`;
  assert.throws(() => CSSTransformValue.parse(css), TypeError);
});

test('CRS-0021/C13: skew() with a third argument throws', () => {
  assert.throws(
    () => CSSTransformValue.parse('skew(1deg, 2deg, 3deg)'),
    TypeError,
    'skew() accepts at most two angles; the surplus must not be dropped',
  );
});

test('CRS-0021/C14: perspective() with a second argument throws', () => {
  assert.throws(
    () => CSSTransformValue.parse('perspective(10px, foo)'),
    TypeError,
    'perspective() takes one argument; the surplus must not be dropped',
  );
});

test('controls: valid transform functions still parse', () => {
  assert.ok(CSSTransformValue.parse('scale(2)'));
  assert.ok(CSSTransformValue.parse('matrix(1, 0, 0, 1, 0, 0)'));
  assert.ok(CSSTransformValue.parse('skew(1deg, 2deg)'));
  assert.ok(CSSTransformValue.parse('perspective(10px)'));
  assert.ok(CSSTransformValue.parse('scale(sin(30deg))'));
});
