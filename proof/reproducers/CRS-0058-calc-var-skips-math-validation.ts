/**
 * Reproducer for CRS-0058/C16 (src/typed-om/values/style-value-parser.ts validateMathFunctions).
 * validateMathFunctions skips parseMathFunction whenever a calc/min/max/clamp
 * argument contains var(): `if (!hasVarFunction(t.value)) { parseMathFunction... }`.
 * 'calc(var(--x) + )' ends with a dangling operator, so no substitution can ever
 * satisfy the css-values-4 #calc-syntax grammar — the value is statically invalid.
 * css-typed-om-1 § 6.6 #parse-a-cssstylevalue step 3 must throw TypeError, the
 * same way the var()-free twin 'calc(1px + )' already does. The parse instead
 * returns a CSSUnparsedValue.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0058/C16: calc() with var() still enforces the calc grammar', () => {
  assert.throws(
    () => CSSStyleValue.parse('width', 'calc(var(--x) + )'),
    TypeError,
    'a dangling operator is invalid for every substitution and must throw',
  );
});

test('CRS-0058/C16: min() with var() still enforces the math grammar', () => {
  assert.throws(
    () => CSSStyleValue.parse('width', 'min(var(--x) *)'),
    TypeError,
    'a trailing binary operator is invalid for every substitution and must throw',
  );
});

test('CRS-0058/C16: clamp() with var() still enforces the math grammar', () => {
  assert.throws(() => CSSStyleValue.parse('width', 'clamp(var(--x) 1px, 2px)'), TypeError);
});

test('control: the var()-free twin already throws', () => {
  assert.throws(() => CSSStyleValue.parse('width', 'calc(1px + )'), TypeError);
});

test('control: structurally valid var()-bearing math still parses as pending', () => {
  const v = CSSStyleValue.parse('width', 'calc(var(--x) + 1px)');
  assert.ok(v, 'a well-formed calc(var()) stays parseable as a pending value');
});
