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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ
// Round-2 leftover unique-cause for src/typed-om/color/color-spaces.ts parseColorArgs
// after tests/mcdc-hotspot-parse-color-args.test.ts,
// tests/mcdc-color-leftover-unique-cause.test.ts, and
// tests/mcdc-math-ops-color-unique-cause.test.ts.
// Last recapture: 18/22 decisions, 27/33 conditions, 4 incomplete / 6 missing.
// Hottest seam: L583 / L591 instanceof CSSUnitValue | CSSKeywordValue (skipped
// when constructor.name already matches). Also L589 else-branch comma and
// L560 comment (tokenizer discards comments).
// Drive CSSColorValue.parse / CSSStyleValue.parse('color', ...).
// css-typed-om-2 § 2 #colorvalue-objects, css-color-4 #rgb-functions,
// css-syntax-3 § 4.3.2 #consume-comments / § 5.5.10 #consume-function.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSColorValue,
  CSSStyleValue,
  CSSRGB,
  CSSUnitValue,
  CSSKeywordValue,
} from '../src/typed-om.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import type {
  CommentToken,
  ComponentValue,
  CSSFunction,
  NumberToken,
  SimpleToken,
} from '../src/types.ts';

const origParseComponentValues = ParseHooks.parseComponentValues;
const origUnitName = Object.getOwnPropertyDescriptor(CSSUnitValue, 'name')!;
const origKeywordName = Object.getOwnPropertyDescriptor(CSSKeywordValue, 'name')!;

function restore(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
  Object.defineProperty(CSSUnitValue, 'name', origUnitName);
  Object.defineProperty(CSSKeywordValue, 'name', origKeywordName);
}

function withCtorName(ctor: Function, name: string, fn: () => void): void {
  const orig = Object.getOwnPropertyDescriptor(ctor, 'name')!;
  Object.defineProperty(ctor, 'name', { value: name, configurable: true });
  try {
    fn();
  } finally {
    Object.defineProperty(ctor, 'name', orig);
  }
}

function withFn(fn: CSSFunction, run: () => void): void {
  ParseHooks.parseComponentValues = () => [fn];
  try {
    run();
  } finally {
    ParseHooks.parseComponentValues = origParseComponentValues;
  }
}

function rgbFn(value: ComponentValue[]): CSSFunction {
  return { type: 'function', name: 'rgb', value };
}

function num(value: number): NumberToken {
  return { type: 'number', value, numberType: 'integer', sign: null };
}

function comment(value = 'c'): CommentToken {
  return { type: 'comment', value };
}

function ws(): SimpleToken {
  return { type: 'whitespace', value: ' ' };
}

function comma(): SimpleToken {
  return { type: 'comma', value: ',' };
}

/**
 * Probe-verified type-access order on the first rgb() argument:
 * CSSColorValue.parse: 1 L560 ws, 2 L560 comment, 3 L561 delim,
 * 4 L571 hasCommas, 5 L589 else comma.
 * CSSStyleValue.parse('color') adds 6 pre-parseColorArgs reads
 * (validateMathFunctions / hasVarFunction), so L589 is access 11.
 */
function typeFlipCommaAt(keep: number): NumberToken {
  let n = 0;
  return {
    get type() {
      n += 1;
      return n === keep ? 'comma' : 'number';
    },
    value: 1,
    numberType: 'integer',
    sign: null,
  } as NumberToken;
}

function unit(v: unknown, value: number, unitName: string): CSSUnitValue {
  assert.ok(v instanceof CSSUnitValue, `expected CSSUnitValue, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value, value);
  assert.equal(v.unit, unitName);
  return v;
}

function none(v: unknown): CSSKeywordValue {
  assert.ok(v instanceof CSSKeywordValue, `expected none keyword, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value.toLowerCase(), 'none');
  return v;
}

function assertParseArgsNull(css: string): void {
  assert.throws(
    () => CSSColorValue.parse(css),
    (err: unknown) =>
      err instanceof DOMException &&
      err.name === 'SyntaxError' &&
      err.message.startsWith('Invalid color value:'),
    css,
  );
}

function assertInvalidStyleColor(css: string): void {
  assert.throws(() => CSSStyleValue.parse('color', css), TypeError, css);
}

describe('MC/DC round2 unique-cause: parseColorArgs L583/L591 instanceof (css-typed-om-2 § 2 #colorvalue-objects)', { concurrency: false }, () => {
  afterEach(restore);

  test('instanceof CSSUnitValue T via renamed constructor.name; calc is F (comma and space)', () => {
    // Unique-cause: constructor.name !== 'CSSUnitValue' T so instanceof is
    // evaluated. Real units keep (instanceof T). calc still null (instanceof F).
    withCtorName(CSSUnitValue, 'RenamedUnit', () => {
      const commaRgb = CSSColorValue.parse('rgb(1, 2, 3)') as CSSRGB;
      unit(commaRgb.r, 1, 'number');
      unit(commaRgb.g, 2, 'number');
      unit(commaRgb.b, 3, 'number');

      const spaceRgb = CSSColorValue.parse('rgb(10 20 30)') as CSSRGB;
      unit(spaceRgb.r, 10, 'number');

      const viaStyle = CSSStyleValue.parse('color', 'rgb(4, 5, 6)');
      assert.ok(viaStyle instanceof CSSRGB);
      unit((viaStyle as CSSRGB).r, 4, 'number');

      const viaSpaceStyle = CSSStyleValue.parse('color', 'rgb(7 8 9)');
      assert.ok(viaSpaceStyle instanceof CSSRGB);

      assertParseArgsNull('rgb(1, calc(1), 3)');
      assertParseArgsNull('rgb(calc(1) 2 3)');
      assertInvalidStyleColor('rgb(1, min(1, 2), 3)');
    });
  });

  test('instanceof CSSKeywordValue T via renamed constructor.name; calc is F (comma and space)', () => {
    // Unique-cause: name !== Unit T, name !== Keyword T, instanceof Unit F,
    // instanceof Keyword T → keep none. calc is instanceof Keyword F → null.
    withCtorName(CSSKeywordValue, 'RenamedKeyword', () => {
      const commaNone = CSSColorValue.parse('rgb(none, none, none)') as CSSRGB;
      none(commaNone.r);
      none(commaNone.g);
      none(commaNone.b);

      const spaceNone = CSSColorValue.parse('rgb(none none none)') as CSSRGB;
      none(spaceNone.r);

      const viaStyle = CSSStyleValue.parse('color', 'rgb(none, none, none)');
      assert.ok(viaStyle instanceof CSSRGB);
      none((viaStyle as CSSRGB).r);

      const viaSpaceStyle = CSSStyleValue.parse('color', 'rgb(none none none / none)');
      assert.ok(viaSpaceStyle instanceof CSSRGB);
      none((viaSpaceStyle as CSSRGB).alpha);

      assertParseArgsNull('rgb(1, calc(1), 3)');
      assertParseArgsNull('rgb(url(x) 2 3)');
      assertInvalidStyleColor('rgb(1, max(1, 2), 3)');
    });
  });

  test('both names renamed: mixed none+number evaluates both instanceof (comma and space)', () => {
    withCtorName(CSSUnitValue, 'RenamedUnit', () => {
      withCtorName(CSSKeywordValue, 'RenamedKeyword', () => {
        const commaMix = CSSColorValue.parse('rgb(none, 1, 2)') as CSSRGB;
        none(commaMix.r);
        unit(commaMix.g, 1, 'number');
        unit(commaMix.b, 2, 'number');

        const spaceMix = CSSColorValue.parse('rgb(none 1 2 / none)') as CSSRGB;
        none(spaceMix.r);
        unit(spaceMix.g, 1, 'number');
        none(spaceMix.alpha);

        const viaStyle = CSSStyleValue.parse('color', 'rgb(none, 3, 4)');
        assert.ok(viaStyle instanceof CSSRGB);
        none((viaStyle as CSSRGB).r);
        unit((viaStyle as CSSRGB).g, 3, 'number');
      });
    });
  });
});

describe('MC/DC round2 unique-cause: parseColorArgs L589 else-comma (css-color-4 #rgb-functions)', { concurrency: false }, () => {
  afterEach(restore);

  test('token.type === comma T after hasCommas F via type getter; F is space rgb(1 2 3)', () => {
    // Unique-cause T: skip/hasCommas reads stay number so hasCommas is F, then
    // the else-loop comma check is T → parseColorArgs null.
    withFn(rgbFn([typeFlipCommaAt(5), num(2), num(3)]), () => {
      assertParseArgsNull('rgb(1 2 3)');
    });
    withFn(rgbFn([typeFlipCommaAt(11), num(2), num(3)]), () => {
      assertInvalidStyleColor('rgb(1 2 3)');
    });

    // Unique-cause F: space-separated numbers, else-loop comma is F, keep.
    const space = CSSColorValue.parse('rgb(1 2 3)') as CSSRGB;
    unit(space.r, 1, 'number');
    unit(space.g, 2, 'number');
    unit(space.b, 3, 'number');
    const viaStyle = CSSStyleValue.parse('color', 'rgb(1 2 3)');
    assert.ok(viaStyle instanceof CSSRGB);
    const parseAll = CSSStyleValue.parseAll('color', 'rgb(9 8 7)');
    assert.equal(parseAll.length, 1);
    assert.ok(parseAll[0] instanceof CSSRGB);
  });
});

describe('MC/DC round2 unique-cause: parseColorArgs L560 comment (css-syntax-3 § 4.3.2 #consume-comments)', { concurrency: false }, () => {
  afterEach(restore);

  test('comment T with whitespace F via injected comments; whitespace T skips comment; neither pushes', () => {
    // Tokenizer consumeComments discards comments, so public `rgb(/*c*/1 2 3)`
    // never reaches parseColorArgs as a comment token. Inject into fn.value.
    // Unique-cause: whitespace F, comment T → continue.
    withFn(rgbFn([comment(), num(1), num(2), num(3)]), () => {
      const leading = CSSColorValue.parse('rgb(1 2 3)') as CSSRGB;
      unit(leading.r, 1, 'number');
    });
    withFn(rgbFn([num(1), comment(), num(2), comment(), num(3)]), () => {
      const mid = CSSColorValue.parse('rgb(1 2 3)') as CSSRGB;
      unit(mid.g, 2, 'number');
      unit(mid.b, 3, 'number');
    });
    withFn(rgbFn([num(1), comment(), comma(), num(2), comma(), num(3)]), () => {
      const commaPath = CSSColorValue.parse('rgb(1, 2, 3)') as CSSRGB;
      unit(commaPath.r, 1, 'number');
    });
    withFn(rgbFn([comment(), num(1), ws(), num(2), ws(), num(3)]), () => {
      const viaStyle = CSSStyleValue.parse('color', 'rgb(1 2 3)');
      assert.ok(viaStyle instanceof CSSRGB);
      unit((viaStyle as CSSRGB).r, 1, 'number');
    });

    // Unique-cause: whitespace T, comment skipped.
    withFn(rgbFn([ws(), num(1), ws(), num(2), ws(), num(3)]), () => {
      const padded = CSSColorValue.parse('rgb(1 2 3)') as CSSRGB;
      unit(padded.r, 1, 'number');
    });
    const publicWs = CSSColorValue.parse('rgb( 1  2  3 )') as CSSRGB;
    unit(publicWs.b, 3, 'number');

    // Unique-cause: both F (number is pushed, not skipped).
    const neither = CSSColorValue.parse('rgb(1 2 3)') as CSSRGB;
    unit(neither.r, 1, 'number');
    const viaStyle = CSSStyleValue.parse('color', 'rgb(1 2 3)');
    assert.ok(viaStyle instanceof CSSRGB);

    // Comment-only still empty after skip (tokens.length === 0).
    withFn(rgbFn([comment(), comment()]), () => {
      assertParseArgsNull('rgb()');
    });
  });
});
