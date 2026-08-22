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
// Public-API unique-cause for CSSStyleValue.parse / parseAll property-name
// checks (parseAllStyleValues L141; css-typed-om-1 § 6.6
// #parse-a-cssstylevalue, css-variables-1 #defining-variables dashed-ident).
// Drive `'--'`, `'-'`, `'--x'`, `'--xy'`. _parseAll L159 is a duplicate of
// L141 and never runs after that throw — UNREACHABLE via public parse/parseAll.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleValue, CSSUnparsedValue, CSSKeywordValue } from '../src/typed-om.ts';

describe('MC/DC public unique-cause: CSSStyleValue.parse / parseAll custom names', () => {
  test('invalid custom name `--` throws TypeError on parse and parseAll', () => {
    assert.throws(() => CSSStyleValue.parse('--', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('--', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('--', 'hello'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('--', 'hello'), TypeError);
  });

  test('too-short / non-custom `-` throws (not a dashed-ident, not a supported property)', () => {
    assert.throws(() => CSSStyleValue.parse('-', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('-', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('-x', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('-x', 'auto'), TypeError);
  });

  test('valid custom `--x` / `--xy` parse as CSSUnparsedValue', () => {
    const x = CSSStyleValue.parse('--x', 'hello');
    assert.ok(x instanceof CSSUnparsedValue);
    assert.equal(x.toString(), 'hello');
    const xAll = CSSStyleValue.parseAll('--x', 'hello');
    assert.equal(xAll.length, 1);
    assert.ok(xAll[0] instanceof CSSUnparsedValue);
    assert.equal(xAll[0].toString(), 'hello');

    const xy = CSSStyleValue.parse('--xy', 'world');
    assert.ok(xy instanceof CSSUnparsedValue);
    assert.equal(xy.toString(), 'world');
    const xyAll = CSSStyleValue.parseAll('--xy', '10px');
    assert.equal(xyAll.length, 1);
    assert.ok(xyAll[0] instanceof CSSUnparsedValue);

    // length === 3 with startsWith('--') T (independent length<3 F vs `--`)
    const triple = CSSStyleValue.parse('---', 'hello');
    assert.ok(triple instanceof CSSUnparsedValue);
    const tripleAll = CSSStyleValue.parseAll('---', 'hello');
    assert.ok(tripleAll[0] instanceof CSSUnparsedValue);
  });

  test('supported regular property still parses; empty name still throws', () => {
    const color = CSSStyleValue.parse('color', 'red');
    assert.ok(color instanceof CSSKeywordValue);
    assert.equal(color.value.toLowerCase(), 'red');
    const colorAll = CSSStyleValue.parseAll('color', 'red');
    assert.equal(colorAll.length, 1);
    assert.ok(colorAll[0] instanceof CSSKeywordValue);

    assert.throws(() => CSSStyleValue.parse('', 'red'), TypeError);
    assert.throws(() => CSSStyleValue.parseAll('', 'red'), TypeError);
  });
});
