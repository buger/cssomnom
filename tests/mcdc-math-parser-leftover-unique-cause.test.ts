/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5
// Leftover unique-cause for src/math-parser.ts parseMathFunction (and the
// parse-time helpers it calls: parseMathExpressionTokens / consumeArg /
// consumeValue / consumeSum / consumeProduct / combineProductTerms /
// isSameType / toCanonical / fromCanonical) not already unique-caused by
// tests/mcdc-hotspot-math-walk.test.ts, tests/mcdc-hotspot-math-simplify-leftover.test.ts,
// or tests/mcdc-simplify-unique-cause.test.ts. Does not drive simplify().
// css-values-4 § 10 #math / § 10.1 #funcdef-calc / § 10.2 #comp-func /
// § 10.3 #trig-funcs / § 10.4 #exponent-funcs / § 10.5 #sign-funcs /
// § 10.6 #round-func / § 10.8 #calc-error-constants.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { parseMathFunction } from '../src/math-parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import {
  CSSNumericValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathNegate,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathRound,
  CSSMathFunction,
  CSSKeywordValue,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { IdentToken } from '../src/types.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function syntaxError(css: string): void {
  assert.throws(
    () => CSSNumericValue.parse(css),
    (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    css,
  );
}

function direct(name: string, css: string): CSSNumericValue | null {
  return parseMathFunction(name, tokenize(css));
}

describe('MC/DC leftover unique-cause: parseMathFunction calc (css-values-4 § 10.1 #funcdef-calc)', { concurrency: false }, () => {
  test('calc empty / leftover tokens / unit wrap vs mixed sum, mixed-case name', () => {
    // Unique-cause: parseMathExpressionTokens result null vs CSSUnitValue wrap vs leftover tree.
    syntaxError('calc()');
    syntaxError('calc( )');
    syntaxError('calc(foo)');
    syntaxError('calc(1px +)');
    syntaxError('calc(1px *)');
    syntaxError('calc(auto)');
    assert.equal(direct('calc', ''), null);
    assert.equal(direct('calc', 'foo'), null);

    const unitWrap = parse('calc(1px)');
    assert.ok(unitWrap instanceof CSSMathSum);
    assert.equal(unitWrap.values.length, 1);
    assert.ok(unitWrap.values[0] instanceof CSSUnitValue);
    assert.equal((unitWrap.values[0] as CSSUnitValue).value, 1);
    assert.equal((unitWrap.values[0] as CSSUnitValue).unit, 'px');

    const mixed = parse('calc(1px + 2em)');
    assert.ok(mixed instanceof CSSMathSum);
    assert.equal(mixed.values.length, 2);

    const upper = parse('CALC(10px)');
    assert.ok(upper instanceof CSSMathSum);
    assert.equal(upper.toString(), 'calc(10px)');

    const width = CSSStyleValue.parse('width', 'calc(1px + 2em)');
    assert.ok(width instanceof CSSMathSum);
  });

  test('consumeValue unique-cause: paren simple-block vs square/curly, unary +/-, ident constants', () => {
    // Unique-cause: simple-block associatedToken.type === '(' T vs F ([ / {).
    const paren = parse('calc((1px + 2em))');
    assert.ok(paren instanceof CSSMathSum);
    assert.equal(paren.values.length, 2);
    syntaxError('calc([1px])');
    syntaxError('calc({1px})');
    assert.equal(direct('calc', '[1px]'), null);
    assert.equal(direct('calc', '{1px}'), null);

    // Unique-cause: unary '+' returns the value; unary '-' negates / distributes over sum.
    const plus = parse('calc(+10px)');
    assert.ok(plus instanceof CSSMathSum);
    assert.equal((plus.values[0] as CSSUnitValue).value, 10);
    const minusUnit = parse('calc(- 10px)');
    assert.ok(minusUnit instanceof CSSMathNegate);
    assert.ok(minusUnit.value instanceof CSSUnitValue);
    assert.equal((minusUnit.value as CSSUnitValue).value, 10);
    const minusSum = parse('calc(- (1px + 2em))');
    assert.ok(minusSum instanceof CSSMathSum);
    assert.equal(minusSum.values.length, 2);
    syntaxError('calc(+)');
    syntaxError('calc(-)');

    // css-values-4 § 10.8 #calc-error-constants — ident constants vs unknown ident.
    const inf = parse('calc(infinity)');
    assert.ok(inf instanceof CSSMathSum);
    assert.equal((inf.values[0] as CSSUnitValue).value, Infinity);
    const nan = parse('calc(nan)');
    assert.ok(Number.isNaN((nan as CSSMathSum).values[0] instanceof CSSUnitValue
      ? ((nan as CSSMathSum).values[0] as CSSUnitValue).value
      : NaN));
    const e = parse('calc(e)');
    assert.ok(e instanceof CSSMathSum);
    assert.ok(Math.abs((e.values[0] as CSSUnitValue).value - Math.E) < 1e-9);
    const pi = parse('calc(pi)');
    assert.ok(pi instanceof CSSMathSum);
    assert.ok(Math.abs((pi.values[0] as CSSUnitValue).value - Math.PI) < 1e-9);

    // Unique-cause: ident value === '-infinity' (tokenizer splits "-infinity" into delim+ident).
    const negInfIdent = parseMathFunction('calc', [{ type: 'ident', value: '-infinity' } satisfies IdentToken]);
    assert.ok(negInfIdent instanceof CSSMathSum);
    assert.equal((negInfIdent.values[0] as CSSUnitValue).value, -Infinity);

    syntaxError('calc(1foo)');
  });

  test('consumeSum/Product unique-cause: + vs - vs other delim, * vs /, leftover product mix', () => {
    // Unique-cause: delim '+' with '-' F, delim '-' with '+' F, delim neither (break + leftover).
    const sumPlus = parse('calc(1 + 2)');
    assert.ok(sumPlus instanceof CSSMathSum);
    assert.equal((sumPlus.values[0] as CSSUnitValue).value, 3);
    const sumMinus = parse('calc(1 - 2)');
    assert.ok(sumMinus instanceof CSSMathSum);
    assert.equal((sumMinus.values[0] as CSSUnitValue).value, -1);
    syntaxError('calc(1px . 2px)');

    const times = parse('calc(2 * 3)');
    assert.ok(times instanceof CSSMathSum);
    assert.equal((times.values[0] as CSSUnitValue).value, 6);
    const div = parse('calc(1 / 2px)');
    assert.ok(div instanceof CSSMathProduct);

    // Unique-cause: combineProductTerms otherChildren.length === 0 F (numeric mix + leftover min).
    const numTimesMin = parse('calc(2 * 3 * min(1px, 2em))');
    assert.ok(numTimesMin instanceof CSSMathProduct);
    assert.equal(numTimesMin.toString(), 'calc(6 * min(1px, 2em))');
    const pxTimesMin = parse('calc(2px * 3 * min(1px, 2em))');
    assert.ok(pxTimesMin instanceof CSSMathProduct);
    assert.equal(pxTimesMin.toString(), 'calc(min(1px, 2em) * 6px)');

    // Unique-cause: otherChildren.length === 1 F (two leftover functions).
    const fnProduct = parse('calc(min(1px, 2em) / max(1px, 2em))');
    assert.ok(fnProduct instanceof CSSMathProduct);
    assert.equal(fnProduct.values.length, 2);

    // Unique-cause: toCanonical/fromCanonical dppx T / x F vs dppx F / x T (math-walk mixed both).
    const dppx = parse('calc(2dppx + 96dpi)');
    assert.ok(dppx instanceof CSSMathSum);
    assert.equal((dppx.values[0] as CSSUnitValue).unit, 'dppx');
    assert.equal((dppx.values[0] as CSSUnitValue).value, 3);
    const x = parse('calc(2x + 96dpi)');
    assert.ok(x instanceof CSSMathSum);
    assert.equal((x.values[0] as CSSUnitValue).unit, 'x');
    assert.equal((x.values[0] as CSSUnitValue).value, 3);
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction min/max (css-values-4 § 10.2 #funcdef-min)', { concurrency: false }, () => {
  test('min/max unique-cause of name OR, firstArg null, trailing comma, nested function/paren args', () => {
    syntaxError('min()');
    syntaxError('max()');
    syntaxError('min(1px,)');
    syntaxError('max(1px, 2px,)');
    syntaxError('min(1px 2px)');
    assert.equal(direct('min', ''), null);
    assert.equal(direct('max', '1px,'), null);

    const one = parse('min(1px)');
    assert.ok(one instanceof CSSMathMin);
    assert.equal(one.values.length, 1);

    const two = parse('min(1px, 2px)');
    assert.ok(two instanceof CSSMathMin);
    assert.equal(two.values.length, 2);

    const upper = parse('MIN(1px, 2em)');
    assert.ok(upper instanceof CSSMathMin);
    assert.equal(upper.values.length, 2);

    const maxThree = parse('max(1px, 2em, 3%)');
    assert.ok(maxThree instanceof CSSMathMax);
    assert.equal(maxThree.values.length, 3);

    // Unique-cause: consumeArg function vs simple-block (comma inside nested args is not top-level).
    const nestedFn = parse('min(max(1px, 2em), 3px)');
    assert.ok(nestedFn instanceof CSSMathMin);
    assert.ok(nestedFn.values[0] instanceof CSSMathMax);
    const nestedParen = parse('min((1px + 2em), 3px)');
    assert.ok(nestedParen instanceof CSSMathMin);
    assert.ok(nestedParen.values[0] instanceof CSSMathSum);
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction clamp (css-values-4 § 10.2 #funcdef-clamp)', { concurrency: false }, () => {
  test('clamp lower none AND unique-cause: token missing / ident none / ident not-none / not-ident', () => {
    // token F (empty args).
    syntaxError('clamp()');
    assert.equal(direct('clamp', ''), null);
    // token T, type ident F (dimension).
    syntaxError('clamp(10px)');
    // token T, ident, === 'none' T, then no comma (index >= length T).
    syntaxError('clamp(none)');
    // === 'none' T then type !== comma T (space, not comma).
    syntaxError('clamp(none 10px, 20px)');
    assert.equal(direct('clamp', 'none 10px, 20px'), null);
    // === 'none' F: ident that consumeArg accepts (e / infinity).
    const eLower = parse('clamp(e, 1, 2)');
    assert.ok(eLower instanceof CSSMathClamp);
    assert.ok(eLower.lower instanceof CSSUnitValue);
    assert.ok(Math.abs((eLower.lower as CSSUnitValue).value - Math.E) < 1e-9);
    syntaxError('clamp(auto, 1px, 2px)');
    syntaxError('clamp(, 1px, 2px)');

    const none = parse('clamp(none, 10px, 20px)');
    assert.ok(none instanceof CSSMathClamp);
    assert.ok(none.lower instanceof CSSKeywordValue);
    assert.equal((none.lower as CSSKeywordValue).value, 'none');
    const mixed = parse('clamp(NONE, 10px, 20px)');
    assert.ok(mixed instanceof CSSMathClamp);
    assert.ok(mixed.lower instanceof CSSKeywordValue);
  });

  test('clamp value/upper comma OR unique-cause and upper none AND unique-cause', () => {
    // After lower, index >= length T: clamp(10px). After none already covered.
    syntaxError('clamp(10px)');
    // After value, index >= length T (missing third comma).
    syntaxError('clamp(10px, 20px)');
    // After third comma, token F (empty upper).
    syntaxError('clamp(10px, 20px, )');
    assert.equal(direct('clamp', '10px, 20px,'), null);
    syntaxError('clamp(1px, , 2px)');
    syntaxError('clamp(10px, 20px, 30px, 40px)');

    const numeric = parse('clamp(10px, 20px, 30px)');
    assert.ok(numeric instanceof CSSMathClamp);
    assert.ok(numeric.lower instanceof CSSUnitValue);
    assert.ok(numeric.upper instanceof CSSUnitValue);

    const upperNone = parse('clamp(1px, 2px, none)');
    assert.ok(upperNone instanceof CSSMathClamp);
    assert.ok(upperNone.upper instanceof CSSKeywordValue);
    assert.equal((upperNone.upper as CSSKeywordValue).value, 'none');
    const upperNoneCase = parse('clamp(1px, 2px, NONE)');
    assert.ok(upperNoneCase instanceof CSSMathClamp);
    assert.ok(upperNoneCase.upper instanceof CSSKeywordValue);

    // Unique-cause: upper ident === 'none' F (pi) vs invalid auto.
    const piUpper = parse('clamp(1, 2, pi)');
    assert.ok(piUpper instanceof CSSMathClamp);
    assert.ok(piUpper.upper instanceof CSSUnitValue);
    assert.ok(Math.abs((piUpper.upper as CSSUnitValue).value - Math.PI) < 1e-9);
    syntaxError('clamp(1, 2, auto)');

    const bothNone = parse('clamp(none, 10px, none)');
    assert.ok(bothNone instanceof CSSMathClamp);
    assert.ok(bothNone.lower instanceof CSSKeywordValue);
    assert.ok(bothNone.upper instanceof CSSKeywordValue);

    const width = CSSStyleValue.parse('width', 'clamp(none, 10px, 20px)');
    assert.ok(width instanceof CSSMathClamp);
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction round (css-values-4 § 10.6 #funcdef-round)', { concurrency: false }, () => {
  test('round strategy ident unique-cause, comma after strategy, precision omitted vs present vs leftover', () => {
    // firstToken F.
    syntaxError('round()');
    assert.equal(direct('round', ''), null);
    // firstToken T, type ident F — value, precision omitted.
    const omitted = parse('round(15px)');
    assert.ok(omitted instanceof CSSMathRound);
    assert.equal(omitted.strategy, 'nearest');
    assert.equal(omitted.precisionOmitted, true);

    // ident in strategy list, then index >= length T.
    syntaxError('round(up)');
    // ident in strategy list, type !== comma T.
    syntaxError('round(up 15px)');
    assert.equal(direct('round', 'up 15px'), null);
    // strategy then empty value.
    syntaxError('round(up,)');
    // trailing comma after value → precision consumeArg null.
    syntaxError('round(15px,)');
    syntaxError('round(nearest, 15px,)');
    syntaxError('round(15px, 10px, 5px)');
    syntaxError('round(up, 15px, 10px, 1px)');

    const up = parse('round(up, 15px)');
    assert.ok(up instanceof CSSMathRound);
    assert.equal(up.strategy, 'up');
    assert.equal(up.precisionOmitted, true);

    const nearest = parse('round(nearest, 15px, 10px)');
    assert.ok(nearest instanceof CSSMathRound);
    assert.equal(nearest.strategy, 'nearest');
    assert.equal(nearest.precisionOmitted, false);

    const down = parse('round(down, 19px, 10px)');
    assert.ok(down instanceof CSSMathRound);
    assert.equal(down.strategy, 'down');
    const toZero = parse('round(to-zero, -19px, 10px)');
    assert.ok(toZero instanceof CSSMathRound);
    assert.equal(toZero.strategy, 'to-zero');
    const lineWidth = parse('round(line-width, 15px, 10px)');
    assert.ok(lineWidth instanceof CSSMathRound);
    assert.equal(lineWidth.strategy, 'line-width');

    // Unique-cause: ident that is not a strategy (pi) is the value.
    const piValue = parse('round(pi, 2)');
    assert.ok(piValue instanceof CSSMathRound);
    assert.equal(piValue.strategy, 'nearest');
    assert.equal(piValue.precisionOmitted, false);

    const mixed = parse('ROUND(15px)');
    assert.ok(mixed instanceof CSSMathRound);
    assert.equal(mixed.strategy, 'nearest');

    const upCase = parse('round(UP, 15px)');
    assert.ok(upCase instanceof CSSMathRound);
    assert.equal(upCase.strategy, 'up');
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction math functions (css-values-4 § 10.3–10.6)', { concurrency: false }, () => {
  test('MATH_FUNCTIONS arity unique-cause and mixed-case names; unknown name returns null', () => {
    syntaxError('sin()');
    syntaxError('sin(0deg, 1deg)');
    syntaxError('sin(0,)');
    syntaxError('mod(10px,)');
    syntaxError('atan2(1px)');
    syntaxError('atan2(1px, 2px, 3px)');
    syntaxError('pow(2)');
    syntaxError('pow(2, 3, 4)');
    syntaxError('log(1, 2, 3)');
    syntaxError('hypot()');
    syntaxError('abs()');
    syntaxError('foo(1)');
    syntaxError('bar()');
    assert.equal(direct('foo', '1'), null);
    assert.equal(direct('sin', ''), null);

    const sin = parse('SIN(0deg)');
    assert.ok(sin instanceof CSSMathFunction);
    assert.equal(sin.name, 'sin');
    const log1 = parse('log(10)');
    assert.ok(log1 instanceof CSSMathFunction);
    assert.equal(log1.values.length, 1);
    const log2 = parse('log(8, 2)');
    assert.ok(log2 instanceof CSSMathFunction);
    assert.equal(log2.values.length, 2);
    const hypot3 = parse('hypot(1px, 2px, 2px)');
    assert.ok(hypot3 instanceof CSSMathFunction);
    assert.equal(hypot3.values.length, 3);
    const atan2 = parse('atan2(10px, 20px)');
    assert.ok(atan2 instanceof CSSMathFunction);
    const pow = parse('pow(2, 3)');
    assert.ok(pow instanceof CSSMathFunction);

    parse('abs(-10px)');
    parse('exp(0)');
    parse('sqrt(4)');
    parse('acos(1)');
    parse('asin(0)');
    parse('atan(0)');
    parse('tan(0deg)');
    parse('cos(0)');

    // CSSNumericValue.parse rejects sign() as unsupported; parseMathFunction still accepts it.
    const sign = direct('sign', '-2px');
    assert.ok(sign instanceof CSSMathFunction);
    assert.equal(sign.name, 'sign');
    syntaxError('sign(-2px)');
  });

  test('mod/rem isSameType unique-cause: same type, percentHint mismatch, percentHint skip, incompatible', () => {
    const same = parse('mod(10px, 3px)');
    assert.ok(same instanceof CSSMathFunction);
    assert.equal(same.name, 'mod');
    const mixedMod = parse('MOD(10px, 3px)');
    assert.ok(mixedMod instanceof CSSMathFunction);
    assert.equal(mixedMod.name, 'mod');

    const remRel = parse('rem(10px, 3em)');
    assert.ok(remRel instanceof CSSMathFunction);
    assert.equal(remRel.name, 'rem');

    assert.throws(
      () => parse('mod(10px, 3s)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError' && (err as DOMException).message.includes('Incompatible types in mod'),
    );
    assert.throws(
      () => parse('rem(10px, 3s)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError' && (err as DOMException).message.includes('Incompatible types in rem'),
    );

    // Unique-cause: percentHint key present and equal (skip in isSameType loop).
    const hintedSame = parse('mod(calc(10px + 5%), calc(20px + 10%))');
    assert.ok(hintedSame instanceof CSSMathFunction);
    assert.equal(hintedSame.name, 'mod');
    assert.equal(hintedSame.type().percentHint, 'length');

    // Unique-cause: percentHint !== T (length vs angle).
    assert.throws(
      () => parse('mod(calc(10px + 5%), calc(10deg + 5%))'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError' && (err as DOMException).message.includes('Incompatible types in mod'),
    );
    // Unique-cause: percentHint present vs absent.
    assert.throws(
      () => parse('mod(calc(10px + 5%), 3px)'),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError' && (err as DOMException).message.includes('Incompatible types in mod'),
    );
  });
});
