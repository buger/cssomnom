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
// Leftover unique-cause for src/MediaParser.ts canonicalSerialize after
// round4 (23/29 D, 46/57 C, incomplete 6). Drive MediaParser.parse /
// canonicalSerialize. mediaqueries-4 § 3.1 #serializing-media-queries,
// css-values-4 § 10.7 #calc-simplification. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';
import type {
  ComponentValue,
  CSSFunction,
  DimensionToken,
  NumberToken,
  SimpleBlock,
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

function num(value: number, numberType: NumberToken['numberType'] = 'integer'): NumberToken {
  return { type: 'number', value, numberType, sign: null };
}

function parenBlock(value: ComponentValue[]): SimpleBlock {
  return { type: 'simple-block', associatedToken: { type: '(', value: '(' }, value };
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

describe('MC/DC leftover unique-cause: canonicalSerialize (mediaqueries-4 § 3.1 #serializing-media-queries)', () => {
  test('L180 dpcm|dppx|x unique-cause via product/abs/min/unary-minus (sum/lone dim already dpi)', () => {
    // parseMathFunction('calc') wraps a lone CSSUnitValue in CSSMathSum;
    // simplify of Sum canonicalizes every resolution unit to dpi (L180 dpi T,
    // dpcm/dppx/x skipped). leftover/still-hot used lone dims; round4 used
    // same-unit sums. Product / abs / min / unary-minus return a CSSUnitValue
    // that still has the source unit, so L180 can unique-cause each OR arm.
    // dpcm T, dpi F:
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(96, 'dpcm')])]), 'calc(2.54dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpcm'), delim('*'), num(1)])]), 'calc(2.54dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(96, 'dpcm')])])]), 'calc(2.54dppx)');
    assert.equal(
      MediaParser.canonicalSerialize([calcFn([mathFn('min', [dim(96, 'dpcm'), { type: 'comma', value: ',' }, dim(192, 'dpcm')])])]),
      'calc(2.54dppx)',
    );
    assert.equal(MediaParser.canonicalSerialize([calcFn([delim('-'), dim(96, 'dpcm')])]), 'calc(-2.54dppx)');
    // dppx T, dpi F, dpcm F:
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(1, 'dppx')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'dppx')])])]), 'calc(1dppx)');
    assert.equal(
      MediaParser.canonicalSerialize([calcFn([mathFn('max', [dim(1, 'dppx'), { type: 'comma', value: ',' }, dim(2, 'dppx')])])]),
      'calc(2dppx)',
    );
    // x T, dpi/dpcm/dppx F:
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(1, 'x')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(1, 'x')])])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([delim('-'), dim(1, 'x')])]), 'calc(-1dppx)');
    // dpi T via product (pair with leftover/still-hot/round4 lone+sum dpi):
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(96, 'dpi')])]), 'calc(1dppx)');
    // hypot canonicalizes to dpi (toCanonical), not a dpcm unique-cause
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('hypot', [dim(96, 'dpcm')])])]), 'calc(2.54dppx)');
    // all four F: length product / abs / sign(resolution) → number
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(1), delim('*'), dim(10, 'px')])]), 'calc(10px)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('abs', [dim(10, 'px')])])]), 'calc(10px)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([mathFn('sign', [dim(96, 'dpcm')])])]), 'calc(1)');
    // parse / serializeMediaQuery public surface (css-values-4 calc-simplification)
    assert.equal(ser('(resolution: calc(1 * 96dpcm))')[0], '(resolution: calc(2.54dppx))');
    assert.equal(ser('(resolution: calc(96dpcm * 1))')[0], '(resolution: calc(2.54dppx))');
    assert.equal(ser('(resolution: calc(1 * 1dppx))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(resolution: calc(1 * 1x))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(resolution: calc(abs(96dpcm)))')[0], '(resolution: calc(2.54dppx))');
    assert.equal(ser('(resolution: calc(abs(1x)))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(resolution: calc(min(96dpcm, 192dpcm)))')[0], '(resolution: calc(2.54dppx))');
    assert.equal(ser('(resolution: calc(max(1dppx, 2dppx)))')[0], '(resolution: calc(2dppx))');
    // spaced unary minus is CSSMathNegate (keeps dpcm); glued -96dpcm is a signed dim → Sum → dpi
    assert.equal(ser('(resolution: calc(- 96dpcm))')[0], '(resolution: calc(-2.54dppx))');
    assert.equal(ser('(resolution: calc(-96dpcm))')[0], '(resolution: calc(-2.54dppx))');
    assert.equal(ser('(resolution: calc(- 1x))')[0], '(resolution: calc(-1dppx))');
    assert.equal(ser('(width: calc(1 * 10px))')[0], '(width: calc(10px))');
  });

  test('L228 lastWasOperator × ident unique-cause via multi-char delim serialize', () => {
    // lastWasOperator requires result.endsWith('>'|'<'|'='|'+'|'-'). An isOperator
    // delim always writes a trailing space unless nextIsOperator (next is ><=),
    // so the next token is never ident. leftover/still-hot `+ width` therefore
    // sees lastWasOperator F (result is '+ '). A constructed delim whose value
    // is not exactly those single chars, but whose serialize() suffix is, skips
    // the after-op space and unique-causes L228 T,T,T / L229 !endsWith-space T.
    assert.equal(MediaParser.canonicalSerialize([delim('++'), ident('width')]), '++ width');
    assert.equal(MediaParser.canonicalSerialize([delim('--'), ident('x')]), '-- x');
    assert.equal(MediaParser.canonicalSerialize([delim('=='), ident('and')]), '== and');
    assert.equal(MediaParser.canonicalSerialize([delim('>>'), ident('color')]), '>> color');
    assert.equal(MediaParser.canonicalSerialize([delim('<<'), ident('foo')]), '<< foo');
    assert.equal(MediaParser.canonicalSerialize([delim('>+'), ident('width')]), '>+ width');
    assert.equal(MediaParser.canonicalSerialize([delim('-->'), ident('width')]), '--> width');
    // lastWasOperator F, ident T (non-operator suffix) — still-hot had `*width`
    assert.equal(MediaParser.canonicalSerialize([delim('/'), ident('x')]), '/x');
    assert.equal(MediaParser.canonicalSerialize([delim('*'), ident('width')]), '*width');
    assert.equal(MediaParser.canonicalSerialize([delim('.'), ident('class')]), '.class');
    // lastWasOperator T, ident F
    assert.equal(MediaParser.canonicalSerialize([delim('++'), num(1)]), '++1');
    assert.equal(MediaParser.canonicalSerialize([delim('++'), dim(1, 'px')]), '++1px');
    assert.equal(MediaParser.canonicalSerialize([delim('++'), parenBlock([ident('color')])]), '++(color)');
    assert.equal(MediaParser.canonicalSerialize([delim('++'), calcFn([num(1)])]), '++calc(1)');
    assert.equal(MediaParser.canonicalSerialize([delim('=='), delim('*')]), '==*');
    // lastType === 'delim' F, ident T (L228 first conjunct F; space not from L228)
    assert.equal(MediaParser.canonicalSerialize([{ type: 'at-keyword', value: 'Media' }, ident('and')]), '@mediaand');
    assert.equal(MediaParser.canonicalSerialize([{ type: 'hash', value: 'fff', hashType: 'unrestricted' }, ident('and')]), '#fffand');
    // isOperator `+` then ident still lastWasOperator F because of the after-op space
    assert.equal(MediaParser.canonicalSerialize([delim('+'), ident('width')]), '+ width');
    // parse cannot emit a multi-char delim; adjacent `+` tokens stay isOperator
    assert.equal(MediaParser.canonicalSerialize([delim('+'), delim('+'), ident('width')]), '+ + width');
  });
});
