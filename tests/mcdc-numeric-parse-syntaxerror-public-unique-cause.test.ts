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
// Verifies: SW-REQ-260821-E5D5, SW-REQ-260821-7AKJ
// Public-API unique-cause for parseNumericValue catch
// `e instanceof DOMException && e.name === "SyntaxError"`
// (css-typed-om-1 § 4.1 #dom-cssnumericvalue-parse). Drive
// CSSNumericValue.parse of invalid CSS. e.name F (DOMException that is not
// SyntaxError) is UNREACHABLE: every inner DOMException is SyntaxError.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSNumericValue, CSSUnitValue, CSSMathSum } from '../src/typed-om.ts';

function syntaxError(fn: () => unknown): DOMException {
  let thrown: unknown;
  assert.throws(fn, (e: unknown) => {
    thrown = e;
    return e instanceof DOMException && e.name === 'SyntaxError';
  });
  assert.ok(thrown instanceof DOMException);
  return thrown;
}

describe('MC/DC public unique-cause: CSSNumericValue.parse SyntaxError catch', { concurrency: false }, () => {
  test('inner SyntaxError DOMException is rethrown without Details wrap', () => {
    // Unique-cause: instanceof DOMException T and name === 'SyntaxError' T → rethrow.
    const ident = syntaxError(() => CSSNumericValue.parse('auto'));
    assert.equal(ident.message, 'Invalid numeric value: auto');
    assert.equal(ident.message.includes('Details:'), false);

    const empty = syntaxError(() => CSSNumericValue.parse(''));
    assert.equal(empty.message, 'Invalid numeric value: ');
    assert.equal(empty.message.includes('Details:'), false);

    const multi = syntaxError(() => CSSNumericValue.parse('1px 2px'));
    assert.equal(multi.message, 'Invalid numeric value: 1px 2px');

    const unit = syntaxError(() => CSSNumericValue.parse('1foo'));
    assert.equal(unit.message, 'Invalid unit: foo');
    assert.equal(unit.message.includes('Details:'), false);

    const rgb = syntaxError(() => CSSNumericValue.parse('rgb(1, 2, 3)'));
    assert.equal(rgb.message.includes('Details:'), false);

    // Inner type() catch throws a SyntaxError DOMException; outer catch rethrows.
    const sin = syntaxError(() => CSSNumericValue.parse('sin(1px)'));
    assert.equal(sin.message, 'Invalid types in mathematical function: sin(1px)');
    assert.equal(sin.message.includes('Details:'), false);
  });

  test('constructor TypeError from parse is wrapped with Details', () => {
    // Unique-cause: instanceof DOMException F (TypeError from CSSMathMin)
    // so e.name === 'SyntaxError' is not evaluated; wrap includes Details.
    const min = syntaxError(() => CSSNumericValue.parse('min(1px, 1s)'));
    assert.equal(min.message.includes('Details:'), true);
    assert.equal(min.message.includes('Incompatible types in min'), true);
    assert.equal(min.message.startsWith('Invalid numeric value: min(1px, 1s)'), true);

    const max = syntaxError(() => CSSNumericValue.parse('max(1px, 1deg)'));
    assert.equal(max.message.includes('Details:'), true);
    assert.equal(max.message.includes('Incompatible types in max'), true);
  });

  test('valid parse does not enter the catch', () => {
    const px = CSSNumericValue.parse('10px');
    assert.ok(px instanceof CSSUnitValue);
    assert.equal(px.value, 10);
    assert.equal(px.unit, 'px');

    const sum = CSSNumericValue.parse('calc(1px + 2em)');
    assert.ok(sum instanceof CSSMathSum);
  });
});
