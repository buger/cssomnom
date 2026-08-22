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
// Verifies: SYS-REQ-260821-5283, SW-REQ-260821-W8S1, INT-REQ-260821-MZW3
// Round-2 leftover unique-cause for src/MediaParser.ts canonicalSerialize
// after tests/mcdc-branch-media.test.ts,
// tests/mcdc-branch-media-leftover.test.ts,
// tests/mcdc-media-still-hot-unique-cause.test.ts,
// tests/mcdc-media-round4-unique-cause.test.ts, and
// tests/mcdc-media-canonical-serialize-unique-cause.test.ts.
// Last recapture: 25/29 decisions, 52/57 conditions, 4 incomplete.
// Hottest seam: L234 lastType === "number" && v.type === "number"
// (shadowed by L223; T,T only via type getter after L223's OR is F).
// Also L186 unit === "x" after to("dppx"), L217 isRatioSlash already-space.
// Drive MediaParser.parse / canonicalSerialize.
// mediaqueries-4 § 3.1 #serializing-media-queries,
// css-values-4 § 10.7 #calc-simplification / css-typed-om-1 § 4.2 #dom-cssnumericvalue-to.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';
import { CSSUnitValue } from '../src/typed-om.ts';
import type {
  ComponentValue,
  CSSFunction,
  DimensionToken,
  NumberToken,
  Token,
} from '../src/types.ts';

function ident(value: string): Token {
  return { type: 'ident', value };
}

function delim(value: string): Token {
  return { type: 'delim', value };
}

function dim(value: number, unit: string): DimensionToken {
  return { type: 'dimension', value, unit, numberType: 'integer', sign: null };
}

function num(value: number): NumberToken {
  return { type: 'number', value, numberType: 'integer', sign: null };
}

function calcFn(inner: ComponentValue[], name = 'calc'): CSSFunction {
  return { type: 'function', name, value: inner };
}

function mathFn(name: string, inner: ComponentValue[]): CSSFunction {
  return { type: 'function', name, value: inner };
}

function ser(text: string): string[] {
  return MediaParser.parse(text).map(serializeMediaQuery);
}

function hashToken(value: string): Token {
  return { type: 'hash', value, hashType: 'unrestricted' };
}

/**
 * L223's v.type === "number" is MediaParser.ts:224; L234 is the shadowed
 * else-if. A stack-discriminated getter unique-causes L234 T without taking
 * L223 (css-syntax-3 § 4.3.3 #number-token / mediaqueries-4 § 3.1).
 */
function hashUntilL234Number(): ComponentValue {
  return {
    get type() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:234\b/.test(stack) ? 'number' : 'hash';
    },
    value: 'fff',
    hashType: 'unrestricted',
  } as unknown as ComponentValue;
}

/** Probe-verified: second-token type read 25 is L234 (filter 2 + dispatch + serialize + L223). */
function typeAt(keep: number, rest: string, atKeep: string): ComponentValue {
  let n = 0;
  return {
    get type() {
      n += 1;
      return n === keep ? atKeep : rest;
    },
    value: 'fff',
    hashType: 'unrestricted',
    numberType: 'integer',
    sign: null,
  } as unknown as ComponentValue;
}

/**
 * isOperator is MediaParser.ts:212. Serializing as a number then flipping to
 * delim "+" adds the after-op space so lastType stays number|function and
 * result.endsWith(" ") is T at the isRatioSlash arm (L217).
 */
function numberThenOperatorSpace(): ComponentValue {
  return {
    get type() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:212\b/.test(stack) ? 'delim' : 'number';
    },
    get value() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:212\b/.test(stack) ? '+' : 16;
    },
    numberType: 'integer',
    sign: null,
  } as unknown as ComponentValue;
}

function calcThenOperatorSpace(): ComponentValue {
  const inner: ComponentValue[] = [num(16)];
  return {
    name: 'calc',
    get type() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:212\b/.test(stack) ? 'delim' : 'function';
    },
    get value() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:212\b/.test(stack) ? '+' : inner;
    },
  } as unknown as ComponentValue;
}

const origTo = CSSUnitValue.prototype.to;

function restoreTo(): void {
  CSSUnitValue.prototype.to = origTo;
}

function withCanonToX(fn: () => void): void {
  CSSUnitValue.prototype.to = function (this: CSSUnitValue, unit: string): CSSUnitValue {
    const stack = new Error().stack ?? '';
    if (stack.includes('canonicalSerialize') && this.unit === 'x' && unit === 'dppx') {
      return new CSSUnitValue(this.value, 'x');
    }
    return origTo.call(this, unit);
  };
  try {
    fn();
  } finally {
    restoreTo();
  }
}

function withCanonToThrow(fn: () => void): void {
  CSSUnitValue.prototype.to = function (this: CSSUnitValue, unit: string): CSSUnitValue {
    const stack = new Error().stack ?? '';
    if (stack.includes('canonicalSerialize') && this.unit === 'x' && unit === 'dppx') {
      throw new TypeError('mcdc-x-to-dppx');
    }
    return origTo.call(this, unit);
  };
  try {
    fn();
  } finally {
    restoreTo();
  }
}

describe('MC/DC round2 unique-cause: canonicalSerialize (mediaqueries-4 § 3.1 #serializing-media-queries)', { concurrency: false }, () => {
  afterEach(() => {
    restoreTo();
  });

  test('L234 lastType number && v.type number T via stack/keep (shadowed by L223)', () => {
    // T,T: L223's five v.type reads stay hash (not ident/number/dimension/delim/simple-block);
    // L234 then sees number and inserts the space L223 would have inserted.
    assert.equal(MediaParser.canonicalSerialize([num(1), hashUntilL234Number()]), '1 #fff');
    assert.equal(MediaParser.canonicalSerialize([num(16), hashUntilL234Number()]), '16 #fff');
    assert.equal(MediaParser.canonicalSerialize([num(1), typeAt(25, 'hash', 'number')]), '1 #fff');
    // T,F: lastType number, L234 v.type number F (plain hash, L223 also F)
    assert.equal(MediaParser.canonicalSerialize([num(1), hashToken('fff')]), '1#fff');
    assert.equal(MediaParser.canonicalSerialize([num(1), hashToken('2')]), '1#2');
    // L223 takes the space when keep hits its v.type === "number" conjunct (read 21), not L234
    assert.equal(MediaParser.canonicalSerialize([num(1), typeAt(21, 'hash', 'number')]), '1 #fff');
    assert.equal(MediaParser.canonicalSerialize([num(1), typeAt(20, 'hash', 'number')]), '1#fff');
    assert.equal(MediaParser.canonicalSerialize([num(1), typeAt(22, 'hash', 'number')]), '1#fff');
    assert.equal(MediaParser.canonicalSerialize([num(1), typeAt(24, 'hash', 'number')]), '1#fff');
    // lastType === "number" F: L234 short-circuits, v.type skipped (F-skip already sampled)
    assert.equal(MediaParser.canonicalSerialize([ident('a'), hashUntilL234Number()]), 'a#fff');
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1)]), hashUntilL234Number()]), 'calc(1)#fff');
    assert.equal(MediaParser.canonicalSerialize([dim(1, 'px'), hashUntilL234Number()]), '1px#fff');
    assert.equal(MediaParser.canonicalSerialize([{ type: 'at-keyword', value: 'Media' }, hashUntilL234Number()]), '@media#fff');
    // L223 T,T for two numbers (does not execute L234)
    assert.equal(MediaParser.canonicalSerialize([num(1), num(2)]), '1 2');
    // parse cannot emit a hash after a number; public surface still serializes
    // adjacent numbers with the L223 space (not the L234 else-if).
    assert.equal(ser('(aspect-ratio: 16 9)')[0], '(aspect-ratio: 16 9)');
    assert.equal(ser('screen')[0], 'screen');
  });

  test('L186 unit === "x" T after to("dppx") via stack-discriminated to()', () => {
    // leftover/still-hot/round4: to("dppx") always succeeds (x is resolution), so
    // unit is dppx and L186 is F. Product 1*1x canonicalizes to dpi before L180.
    // abs / unary-minus / min keep unit x; intercept only canonicalSerialize's to().
    // T: to returns a CSSUnitValue that still has unit "x" → L186 remaps to dppx.
    withCanonToX(() => {
      assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'x')])])]), 'calc(1dppx)');
      assert.equal(MediaParser.canonicalSerialize([calcFn([delim('-'), dim(1, 'x')])]), 'calc(-1dppx)');
      assert.equal(
        MediaParser.canonicalSerialize([calcFn([mathFn('min', [dim(1, 'x'), { type: 'comma', value: ',' }, dim(2, 'x')])])]),
        'calc(1dppx)',
      );
      assert.equal(ser('(resolution: calc(abs(1x)))')[0], '(resolution: calc(1dppx))');
      assert.equal(ser('(resolution: calc(- 1x))')[0], '(resolution: calc(-1dppx))');
      // 1*1x is already dpi at L180; stub does not fire (unit !== "x")
      assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(1, 'x')])]), 'calc(1dppx)');
    });
    // T via to() throw: catch leaves val.unit "x", L186 remaps (css-typed-om-1 #dom-cssnumericvalue-to)
    withCanonToThrow(() => {
      assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'x')])])]), 'calc(1dppx)');
      assert.equal(MediaParser.canonicalSerialize([calcFn([delim('-'), dim(2, 'x')])]), 'calc(-2dppx)');
      assert.equal(ser('(resolution: calc(abs(1x)))')[0], '(resolution: calc(1dppx))');
    });
    // F: conversion succeeds, unit is already dppx (leftover abs/product rows)
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'x')])])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'dppx')])])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(96, 'dpi')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(10, 'px')])]), 'calc(10px)');
    assert.equal(ser('(resolution: calc(abs(1x)))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(resolution: calc(1 * 1x))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(width: calc(1 * 10px))')[0], '(width: calc(10px))');
  });

  test('L217 isRatioSlash result.endsWith space T via isOperator trailing space', () => {
    // lastType number|function never leave a trailing space after serialize().trim()
    // / inner canonicalSerialize trim. leftover/still-hot therefore only sampled
    // endsWith F (add space, then "/ "). Flip the previous token to isOperator at
    // L212 after writing a number/calc so !nextIsOperator appends " ".
    assert.equal(
      MediaParser.canonicalSerialize([numberThenOperatorSpace(), delim('/'), num(9)]),
      '16 / 9',
    );
    assert.equal(
      MediaParser.canonicalSerialize([numberThenOperatorSpace(), delim('/'), calcFn([num(9)])]),
      '16 / calc(9)',
    );
    assert.equal(
      MediaParser.canonicalSerialize([calcThenOperatorSpace(), delim('/'), num(9)]),
      'calc(16) / 9',
    );
    assert.equal(
      MediaParser.canonicalSerialize([calcThenOperatorSpace(), delim('/'), calcFn([num(9)])]),
      'calc(16) / calc(9)',
    );
    // F: real number/function lastType, no trailing space (mediaqueries-4 ratio)
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('/'), num(9)]), '16 / 9');
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(16)]), delim('/'), num(9)]), 'calc(16) / 9');
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('/'), calcFn([num(9)])]), '16 / calc(9)');
    assert.equal(ser('(aspect-ratio: 16/9)')[0], '(aspect-ratio: 16 / 9)');
    assert.equal(ser('(aspect-ratio: 16 / 9)')[0], '(aspect-ratio: 16 / 9)');
    assert.equal(ser('(aspect-ratio: calc(16)/calc(9))')[0], '(aspect-ratio: calc(16) / calc(9))');
    assert.equal(ser('(aspect-ratio: 16/calc(9))')[0], '(aspect-ratio: 16 / calc(9))');
  });
});
