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
// Public-API unique-cause for CSSMathClamp.type `this.upper && typeof
// this.upper.type === 'function'` (css-typed-om-1 § 4.4 #cssmathclamp,
// css-values-4 § 10.8 #funcdef-clamp). Drive CSSNumericValue.parse and
// the CSSMathClamp constructor. this.upper F is UNREACHABLE from parse:
// clamp always stores a numeric or keyword bound.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathClamp,
  CSSKeywordValue,
} from '../src/typed-om.ts';

function parseClamp(css: string): CSSMathClamp {
  const node = CSSNumericValue.parse(css);
  assert.ok(node instanceof CSSMathClamp, css);
  return node;
}

describe('MC/DC public unique-cause: CSSMathClamp.type this.upper', { concurrency: false }, () => {
  test('parse clamp numeric upper unique-cause this.upper T and type() T', () => {
    const numeric = parseClamp('clamp(1px, 2px, 3px)');
    assert.ok(numeric.upper instanceof CSSUnitValue);
    assert.equal(typeof numeric.upper.type, 'function');
    assert.equal(numeric.type().length, 1);

    const mixed = parseClamp('clamp(1px, 2em, 3px)');
    assert.equal(mixed.type().length, 1);

    const constructed = new CSSMathClamp(CSS.px(1), CSS.px(2), CSS.px(3));
    assert.equal(constructed.type().length, 1);
  });

  test('parse clamp none upper unique-cause this.upper T and type() F', () => {
    // Unique-cause: this.upper T (keyword is truthy) and typeof type === 'function' F.
    const noneUpper = parseClamp('clamp(1px, 2px, none)');
    assert.ok(noneUpper.upper instanceof CSSKeywordValue);
    assert.equal(noneUpper.upper.value.toLowerCase(), 'none');
    assert.equal('type' in noneUpper.upper, false);
    assert.equal(noneUpper.type().length, 1);

    const noneUpperCase = parseClamp('clamp(1px, 2px, NONE)');
    assert.ok(noneUpperCase.upper instanceof CSSKeywordValue);
    assert.equal(noneUpperCase.type().length, 1);

    const bothNone = parseClamp('clamp(none, 2px, none)');
    assert.ok(bothNone.upper instanceof CSSKeywordValue);
    assert.equal(bothNone.type().length, 1);

    const ctorNone = new CSSMathClamp(CSS.px(1), CSS.px(2), new CSSKeywordValue('none'));
    assert.ok(ctorNone.upper instanceof CSSKeywordValue);
    assert.equal(ctorNone.type().length, 1);
  });

  test('parse clamp none lower still types through numeric upper', () => {
    const noneLower = parseClamp('clamp(none, 2px, 3px)');
    assert.ok(noneLower.lower instanceof CSSKeywordValue);
    assert.ok(noneLower.upper instanceof CSSUnitValue);
    assert.equal(noneLower.type().length, 1);
  });
});
