/**
 * Overlay reproducer for KI-22: math expression parse/simplify unbounded
 * recursion.
 *
 * css-values-4 § #calc-syntax admits arbitrarily nested calc() and
 * parentheses grammatically; a consumer must fail closed with a structured
 * error rather than overflow the host call stack. The Typed OM value
 * factory (createCSSStyleValue -> parseMathFunction -> simplify) recurses
 * per parenthesis / nested calc() with no depth counter, so a few thousand
 * nesting levels surface a raw RangeError: Maximum call stack size
 * exceeded on the public tokenize -> Parser.parseComponentValues ->
 * createCSSStyleValue path.
 *
 * Asserts the SAFE contract via that fully public path: deep-but-shaped
 * calc() input must either reify or fail with a structured (non-RangeError)
 * parse error — never an engine stack overflow.
 *
 * Reproduces: KI-22
 * Verifies: SYS-REQ-260822-JD78
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { createCSSStyleValue } from '../../src/typed-om.ts';

function nestParens(depth: number): string {
  let s = '1px';
  for (let i = 0; i < depth; i++) s = '(' + s + ')';
  return 'calc(' + s + ')';
}

function nestCalc(depth: number): string {
  let s = '1px';
  for (let i = 0; i < depth; i++) s = 'calc(' + s + ')';
  return s;
}

/** Public pipeline: string -> tokens -> component values -> Typed OM value. */
function parseMathValue(css: string): unknown {
  const values = new Parser(tokenize(css)).parseComponentValues();
  const fn = values.find((v) => v.type === 'function');
  assert.ok(fn, 'setup: expected a calc() function component value');
  return createCSSStyleValue(fn);
}

function assertNotRangeError(css: string, label: string): void {
  let threw: unknown;
  try {
    parseMathValue(css);
  } catch (e) {
    threw = e;
  }
  if (threw === undefined) return;
  assert.ok(
    !(threw instanceof RangeError),
    `KI-22: ${label} escaped as ${(threw as Error).name}: ${(threw as Error).message} — ` +
      'math expression consumption is not depth-bounded (SYS-REQ-260822-JD78 math_depth_bounded)',
  );
}

describe('KI-22 e2e math expression depth budget', () => {
  test('positive control: shallow nested calc simplifies', () => {
    const value = parseMathValue(nestCalc(200)) as { serialize?: () => string };
    assert.match(value.serialize?.() ?? '', /1px/);
  });

  // Reproduces: KI-22
  // Verifies: SYS-REQ-260822-JD78
  test('deeply parenthesized calc does not overflow the JS stack', () => {
    assertNotRangeError(nestParens(4000), 'nestParens(4000)');
  });

  // Reproduces: KI-22
  // Verifies: SYS-REQ-260822-JD78
  test('deeply nested calc(calc(calc(...))) does not overflow the JS stack', () => {
    assertNotRangeError(nestCalc(3000), 'nestCalc(3000)');
  });
});
