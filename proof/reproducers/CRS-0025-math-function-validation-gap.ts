/**
 * Reproducer for CRS-0025/C28 (src/typed-om/values/style-value-parser.ts
 * validateMathFunctions). css-typed-om-1 #parse-a-cssstylevalue step 3
 * rejects values that fail the property grammar. validateMathFunctions only
 * parses calc/min/max/clamp, so math functions like sin() or hypot() skip
 * argument validation entirely: width: sin(garbage) reifies as a
 * CSSMathFunction although sin() with a non-calculation argument is invalid
 * CSS in every property, while width: calc(garbage) throws.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0025/C28: width rejects sin() with invalid arguments', () => {
  assert.throws(
    () => CSSStyleValue.parse('width', 'sin(garbage)'),
    TypeError,
    'sin(garbage) fails the calculation grammar for any property',
  );
});

test('CRS-0025/C28: width rejects hypot() with one invalid argument', () => {
  assert.throws(
    () => CSSStyleValue.parse('width', 'hypot(1px, bogus)'),
    TypeError,
  );
});

test('control: calc with garbage already throws', () => {
  assert.throws(() => CSSStyleValue.parse('width', 'calc(garbage)'), TypeError);
});

test('control: valid math functions keep parsing', () => {
  assert.ok(CSSStyleValue.parse('width', 'calc(1px + 1px)'));
  assert.ok(CSSStyleValue.parse('width', 'min(1px, 2px)'));
  assert.ok(CSSStyleValue.parse('z-index', 'sign(1)'));
});
