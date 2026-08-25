/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// MC/DC audit round 3, Typed OM numeric/math/transform unique-cause legs:
//   - CSSMathClamp constructor type-incompatibility throws and keyword-free
//     upper arms (css-typed-om-1 § 4.4 #cssmathclamp).
//   - CSSMathFunction log arity validation (css-values-4 § 10.6 #log-func).
//   - CSSNumericType percent-hint resolution across operand orders
//     (css-typed-om-1 § 5 #cssnumerictype).
//   - min()/clamp() unit-map equality and standard-value validation
//     (css-typed-om-1 § 4.4 #create-a-sum-value).
//   - numericTo arity guard (css-typed-om-1 § 4.2 #dom-cssnumericvalue-to).
//   - CSSTransformValue matrix3d dispatch and index proxy guards
//     (css-typed-om-1 § 7.1 #transformvalue).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSSMathClamp,
  CSSMathFunction,
} from '../src/typed-om/numeric/math/CSSMathOperations.ts';
import { CSSUnitValue } from '../src/typed-om/numeric/CSSUnitValue.ts';
import {
  numericTo,
  parseNumericValue,
} from '../src/typed-om/numeric/numeric-methods.ts';
import { addTypesForSum } from '../src/typed-om/numeric/CSSNumericType.ts';
import { CSSTransformValue } from '../src/typed-om/transform/CSSTransformValue.ts';
import { CSSUnparsedValue } from '../src/typed-om/values/CSSUnparsedValue.ts';

const px = (n: number) => new CSSUnitValue(n, 'px');
const em = (n: number) => new CSSUnitValue(n, 'em');
const num = (n: number) => new CSSUnitValue(n, 'number');
const pct = (n: number) => new CSSUnitValue(n, 'percent');

function throwsTypeError(fn: () => unknown, fragment: string): void {
  assert.throws(fn, (err: unknown) => err instanceof TypeError && String((err as Error).message).includes(fragment));
}

describe('MC/DC round 3: Typed OM numeric/math legs', () => {

  // css-typed-om-1 § 4.4: clamp() rejects an upper bound whose base differs
  // from the value even when the number lower bound is universally compatible.
  test('CSSMathClamp upper/value incompatibility throw', () => {
    throwsTypeError(
      () => new CSSMathClamp(num(0), px(5), new CSSUnitValue(1, 's')),
      'Incompatible types in clamp'
    );
    // px lower/value pass the first check so the upper arm is isolated.
    throwsTypeError(
      () => new CSSMathClamp(px(1), px(2), new CSSUnitValue(1, 's')),
      'Incompatible types in clamp'
    );
    const ok = new CSSMathClamp(px(1), px(2), px(3));
    assert.equal((ok.upper as CSSUnitValue).value, 3);
    assert.equal((ok.upper as CSSUnitValue).unit, 'px');
    assert.ok(ok.type() !== null);
    // Explicit undefined third argument keeps arguments.length at 3 while
    // leaving this.upper unset for the type() walk.
    const openUpper = new CSSMathClamp(px(1), px(2), undefined as never);
    assert.deepEqual(openUpper.type(), px(1).type());
  });

  // css-values-4 § 10.6: log() takes at most two arguments.
  test('CSSMathFunction log arity arms', () => {
    throwsTypeError(
      () => new CSSMathFunction('log', num(2), num(4), num(8)).type(),
      'log requires 1 or 2 arguments'
    );
    assert.ok(new CSSMathFunction('log', num(8)).type() !== null);
    assert.ok(new CSSMathFunction('log', num(2), num(8)).type() !== null);
  });

  // css-typed-om-1 § 5: percent-hint search resolves mixed percent sums in
  // either operand order and fails on incompatible bases.
  test('addTypesForSum percent-hint operand orders', () => {
    const lenPct = addTypesForSum(px(1).type(), pct(1).type());
    assert.ok(lenPct);
    assert.equal(lenPct.percentHint, 'length');
    const pctLen = addTypesForSum(pct(1).type(), px(1).type());
    assert.ok(pctLen);
    assert.equal(pctLen.percentHint, 'length');
    assert.equal(addTypesForSum(px(1).type(), new CSSUnitValue(1, 's').type()), null);
    assert.deepEqual(addTypesForSum(px(1).type(), em(1).type()), { length: 1 });
    assert.equal(addTypesForSum(num(1).type(), num(1).type()) !== null, true);
  });

  // css-typed-om-1 § 4.2: conversion validates argument count before use.
  test('numericTo arity guard', () => {
    // @ts-expect-error arity guard is exercised with a single argument
    assert.throws(() => numericTo(px(1)), TypeError);
    assert.equal(numericTo(px(1), 'cm').value > 0, true);
    assert.equal(parseNumericValue('min(1px, calc(1% + 1px))').toString(), 'min(1px, 1% + 1px)');
  });
});

describe('MC/DC round 3: transform value legs', () => {

  // css-transforms-1 § 16.1: matrix3d dispatches through the same arm as
  // matrix with its sixteen components.
  test('CSSTransformValue.parse matrix3d dispatch', () => {
    const tv = CSSTransformValue.parse(
      'matrix3d(1,0,0,0, 0,1,0,0, 0,0,1,0, 10,20,30,1)'
    );
    assert.equal(tv.length, 1);
    assert.equal(tv[0]!.constructor.name, 'CSSMatrixComponent');
    assert.equal(tv.is2D, false);
  });

  // css-typed-om-1 § 7.1: indexed assignment beyond length throws; the
  // numeric-key regex only admits non-negative indices.
  test('CSSTransformValue index guards', () => {
    const tv = CSSTransformValue.parse('translateX(4px) scale(2)');
    assert.throws(
      () => { (tv as unknown as Record<number, unknown>)[99] = tv[0]; },
      RangeError
    );
    assert.doesNotThrow(() => { (tv as unknown as Record<number, unknown>)[1] = tv[0]; });
  });

  // css-typed-om-1 § 7.2: CSSUnparsedValue indexed assignment bounds and
  // member type validation.
  test('CSSUnparsedValue index guards', () => {
    const uv = new CSSUnparsedValue(['a']);
    assert.throws(
      () => { (uv as unknown as Record<number, unknown>)[9] = uv[0]; },
      RangeError
    );
    assert.throws(
      () => { (uv as unknown as Record<number, unknown>)[0] = 42 as never; },
      TypeError
    );
    assert.doesNotThrow(() => { (uv as unknown as Record<number, unknown>)[0] = 'b'; });
  });
});
