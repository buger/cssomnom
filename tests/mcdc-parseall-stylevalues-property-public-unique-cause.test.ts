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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ,
// SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
// Public-API unique-cause for parseAllStyleValues L138 typeof property and
// L141 dashed-ident (css-typed-om-1 § 6.6 #parse-a-cssstylevalue,
// css-variables-1 #defining-variables). Distinct from _parseAll L159: public
// CSSStyleValue.parse / parseAll throw at L141 for `'--'` and never enter
// _parseAll. L141 `startsWith('--') && length < 3` T with `=== '--'` F is
// structurally empty (only `'--'` has both).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleValue, CSSUnparsedValue, CSSKeywordValue } from '../src/typed-om.ts';

function parseAll(property: unknown, css: unknown): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property as string, css as string);
}

function parseOne(property: unknown, css: unknown): CSSStyleValue {
  return CSSStyleValue.parse(property as string, css as string);
}

describe('MC/DC public unique-cause: parseAllStyleValues property vs _parseAll', () => {
  test('typeof property !== string unique-cause at L138 via parse / parseAll', () => {
    const nonStrings: unknown[] = [
      1,
      0,
      true,
      false,
      null,
      undefined,
      {},
      [],
      Object('color'),
      Object('--'),
      Object(''),
    ];
    for (const property of nonStrings) {
      assert.throws(() => parseAll(property, 'red'), {
        name: 'TypeError',
        message: "Invalid property name: property must be a non-empty string",
      });
      assert.throws(() => parseOne(property, 'red'), {
        name: 'TypeError',
        message: "Invalid property name: property must be a non-empty string",
      });
    }
    assert.throws(() => parseAll('', 'red'), {
      name: 'TypeError',
      message: "Invalid property name: property must be a non-empty string",
    });
    const color = parseAll('color', 'red');
    assert.equal(color.length, 1);
    assert.ok(color[0] instanceof CSSKeywordValue);
  });

  test('L141 `--` throws before _parseAll; `--x` enters _parseAll', () => {
    assert.throws(() => parseAll('--', 'auto'), {
      name: 'TypeError',
      message: "Invalid property name: '--'",
    });
    assert.throws(() => parseOne('--', 'hello'), {
      name: 'TypeError',
      message: "Invalid property name: '--'",
    });
    assert.throws(() => parseAll('--', ''), {
      name: 'TypeError',
      message: "Invalid property name: '--'",
    });

    const x = parseAll('--x', 'hello');
    assert.equal(x.length, 1);
    assert.ok(x[0] instanceof CSSUnparsedValue);
    assert.equal(x[0].toString(), 'hello');
    assert.throws(() => parseAll('--x', ''), TypeError);
    const triple = parseAll('---', 'hello');
    assert.ok(triple[0] instanceof CSSUnparsedValue);
    const xy = parseOne('--xy', 'world');
    assert.ok(xy instanceof CSSUnparsedValue);
  });

  test('startsWith `--` F with length < 3 does not take the L141 `--` arm', () => {
    assert.throws(() => parseAll('-', 'auto'), {
      name: 'TypeError',
      message: "Invalid or unsupported property name: '-'",
    });
    assert.throws(() => parseAll('-x', 'auto'), {
      name: 'TypeError',
      message: "Invalid or unsupported property name: '-x'",
    });
    assert.throws(() => parseAll(' ', 'auto'), {
      name: 'TypeError',
      message: "Invalid or unsupported property name: ' '",
    });
    assert.throws(() => parseAll('ab', 'auto'), {
      name: 'TypeError',
      message: "Invalid or unsupported property name: 'ab'",
    });
    assert.throws(() => parseOne('x', 'auto'), TypeError);
  });
});
