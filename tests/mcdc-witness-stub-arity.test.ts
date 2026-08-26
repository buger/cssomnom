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
// MC/DC witness: base-class arity guards on the CSSStyleValue.parse /
// CSSStyleValue.parseAll / CSSColorValue.parse IDL stubs (css-typed-om-1
// § 6.6 #parse-a-cssstylevalue, css-typed-om-2 § 2 #colorvalue-objects).
// WebIDL requires the "N arguments required" TypeError to be raised by the
// operation itself; the wired implementations live in style-value-parser.ts,
// so this file deliberately imports ONLY the base-class modules (never
// '../src/parser.ts' or '../src/typed-om.ts', which would wire the statics
// in this test process) to exercise both arity rows of each stub:
//   CSSStyleValue.parse     arguments.length < 2  T (1 arg) / F (2 args)
//   CSSStyleValue.parseAll  arguments.length < 2  T (1 arg) / F (2 args)
//   CSSColorValue.parse     arguments.length < 1  T (0 args) / F (1 arg)
// node:test runs each file in its own process, keeping the stubs unwired here.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../src/typed-om/values/CSSStyleValue.ts';
import { CSSColorValue } from '../src/typed-om/color/CSSColorValue.ts';

describe('MC/DC witness: unwired IDL stub arity guards', () => {
  test('CSSStyleValue.parse arity rows (arguments.length < 2 T and F)', () => {
    // MC/DC row arguments.length < 2 = T: one argument throws the WebIDL
    // arity TypeError from the stub.
    assert.throws(
      () => (CSSStyleValue.parse as (...a: unknown[]) => unknown)('width'),
      (err: unknown) =>
        err instanceof TypeError &&
        err.message.includes("2 arguments required, but only 1 present.")
    );
    // MC/DC row arguments.length < 2 = F: two arguments skip the guard and
    // hit the not-initialized stub error (this file never wires the static).
    assert.throws(
      () => (CSSStyleValue.parse as (...a: unknown[]) => unknown)('width', '10px'),
      (err: unknown) =>
        err instanceof Error && err.message.includes('not initialized')
    );
  });

  test('CSSStyleValue.parseAll arity rows (arguments.length < 2 T and F)', () => {
    // MC/DC row arguments.length < 2 = T.
    assert.throws(
      () => (CSSStyleValue.parseAll as (...a: unknown[]) => unknown)('width'),
      (err: unknown) =>
        err instanceof TypeError &&
        err.message.includes("2 arguments required, but only 1 present.")
    );
    // MC/DC row arguments.length < 2 = F.
    assert.throws(
      () => (CSSStyleValue.parseAll as (...a: unknown[]) => unknown)('width', '10px'),
      (err: unknown) =>
        err instanceof Error && err.message.includes('not initialized')
    );
  });

  test('CSSColorValue.parse arity rows (arguments.length < 1 T and F)', () => {
    // MC/DC row arguments.length < 1 = T: zero arguments throw the arity
    // TypeError before the abstract-stub error.
    assert.throws(
      () => (CSSColorValue.parse as (...a: unknown[]) => unknown)(),
      (err: unknown) =>
        err instanceof TypeError &&
        err.message.includes("1 argument required, but only 0 present.")
    );
    // MC/DC row arguments.length < 1 = F: one argument skips the guard.
    assert.throws(
      () => (CSSColorValue.parse as (...a: unknown[]) => unknown)('red'),
      (err: unknown) =>
        err instanceof Error && err.message.includes('not initialized')
    );
  });
});
