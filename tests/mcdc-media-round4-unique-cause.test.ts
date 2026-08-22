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
// Round-4 unique-cause leftovers for src/MediaParser.ts canonicalSerialize
// (22/29 D) and evaluateMediaFeature (27/36 D) after
// tests/mcdc-branch-media.test.ts, tests/mcdc-branch-media-leftover.test.ts,
// and tests/mcdc-media-still-hot-unique-cause.test.ts.
// Drive MediaParser.parse / evaluate / canonicalSerialize and
// evaluateMediaFeature. mediaqueries-4 § 3.1 #serializing-media-queries /
// § 4 #evaluating-features / § 4.2 #mq-boolean-context. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  evaluateMediaFeature,
  serializeMediaQuery,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import { KNOWN_FEATURES, FEATURE_ALLOWED_IDENTS } from '../src/data/gen/media-features.ts';
import type {
  ComponentValue,
  CSSFunction,
  DimensionToken,
  MediaEnvironment,
  MediaFeature,
  NumberToken,
  SimpleBlock,
  Token,
} from '../src/types.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

function ident(value: string): Token {
  return { type: 'ident', value };
}

function delim(value: string, startIndex?: number, endIndex?: number): Token {
  const t: Token = { type: 'delim', value };
  if (startIndex !== undefined) t.startIndex = startIndex;
  if (endIndex !== undefined) t.endIndex = endIndex;
  return t;
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

function feature(name: string, extra: Partial<MediaFeature> = {}): MediaFeature {
  return { type: 'media-feature', name, tokens: extra.tokens ?? [], ...extra };
}

function ser(text: string): string[] {
  return MediaParser.parse(text).map(serializeMediaQuery);
}

const origColorGamut = FEATURE_ALLOWED_IDENTS['color-gamut'];
const origVideoColorGamut = FEATURE_ALLOWED_IDENTS['video-color-gamut'];
const knownFeatures: Set<string> = KNOWN_FEATURES;
const allowedIdents: Record<string, readonly string[]> = FEATURE_ALLOWED_IDENTS;

function restoreTables(): void {
  knownFeatures.delete('min-zzz');
  knownFeatures.delete('max-zzz');
  allowedIdents['color-gamut'] = origColorGamut;
  allowedIdents['video-color-gamut'] = origVideoColorGamut;
}

describe('MC/DC round4 unique-cause: canonicalSerialize (mediaqueries-4 § 3.1 #serializing-media-queries)', () => {
  test('calc catch / mixed-case name / simplify-sum unique-cause of dpi||dpcm||dppx||x', () => {
    // parseMathFunction throws (incompatible types) → catch mathVal null, not leftover calc(foo) return-null
    assert.equal(
      MediaParser.canonicalSerialize([calcFn([dim(1, 'px'), delim('+'), dim(1, 's')])]),
      'calc(1px + 1s)',
    );
    assert.equal(ser('(width: calc(1px + 1s))')[0], '(width: calc(1px + 1s))');
    // Invalid unit throw vs leftover calc(foo) ident
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(1, 'foo')])]), 'calc(1foo)');
    assert.equal(ser('(width: calc(1foo))')[0], '(width: calc(1foo))');
    // leftover calc(foo) still mathVal F without throw
    assert.equal(MediaParser.canonicalSerialize([calcFn([ident('foo')])]), 'calc(foo)');
    // name.toLowerCase() === 'calc' T via mixed case (leftover used 'calc')
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(10, 'px')], 'CaLc')]), 'calc(10px)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpi')], 'CALC')]), 'calc(1dppx)');
    // L180 unique-cause via simplify of a sum, not leftover/still-hot lone dimension
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpi'), delim('+'), dim(0, 'dpi')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpcm'), delim('+'), dim(0, 'dpcm')])]), 'calc(2.54dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(1, 'dppx'), delim('+'), dim(0, 'dppx')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(1, 'x'), delim('+'), dim(0, 'x')])]), 'calc(1dppx)');
    assert.equal(ser('(resolution: calc(96dpi + 0dpi))')[0], '(resolution: calc(1dppx))');
    assert.equal(ser('(resolution: calc(1x + 0x))')[0], '(resolution: calc(1dppx))');
    // all four F via length sum that still folds
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(10, 'px'), delim('+'), dim(0, 'px')])]), 'calc(10px)');
  });

  test('L236 isOperator space unique-cause of lastType outside ident/dimension/function/number', () => {
    // still-hot unique-caused L223 (lastType ident|dimension|function|number × operator).
    // L236 is the else-if: lastType not in that set, isOperator T, lastWasOperator F.
    // TTT for !endsWith(' ') && length>0 && !endsWith('('):
    assert.equal(MediaParser.canonicalSerialize([parenBlock([ident('color')]), delim('<')]), '(color) <');
    assert.equal(MediaParser.canonicalSerialize([parenBlock([ident('color')]), delim('>')]), '(color) >');
    assert.equal(MediaParser.canonicalSerialize([{ type: 'at-keyword', value: 'Media' }, delim('<')]), '@media <');
    assert.equal(
      MediaParser.canonicalSerialize([{ type: 'hash', value: 'fff', hashType: 'unrestricted' }, delim('<')]),
      '#fff <',
    );
    assert.equal(MediaParser.canonicalSerialize([{ type: 'string', value: 'a' }, delim('<')]), '"a" <');
    // lastType delim, lastWasOperator F (`*` is not ><=+-) then operator
    assert.equal(MediaParser.canonicalSerialize([delim('*'), delim('<')]), '* <');
    // lastType colon takes L230, not L236
    assert.equal(MediaParser.canonicalSerialize([ident('width'), { type: 'colon', value: ':' }, delim('<')]), 'width: <');
    // lastType comma takes L232
    assert.equal(MediaParser.canonicalSerialize([{ type: 'comma', value: ',' }, delim('<')]), ', <');
    // square / curly simple-block (associatedToken !== '(' leftover used paren)
    assert.equal(
      MediaParser.canonicalSerialize([{
        type: 'simple-block',
        associatedToken: { type: '[', value: '[' },
        value: [ident('color')],
      }]),
      '[color]',
    );
    assert.equal(
      MediaParser.canonicalSerialize([{
        type: 'simple-block',
        associatedToken: { type: '{', value: '{' },
        value: [ident('color')],
      }]),
      '{color}',
    );
  });

  test('nextIsOperator / combined >= unique-cause of next missing, non-delim, + vs >', () => {
    // leftover/still-hot unique-caused adjacent <= and next value ><=. Remaining:
    // next falsy (operator is last token)
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('<')]), 'width <');
    // next type === 'delim' F
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('<'), ident('x')]), 'width < x');
    // next delim T, value in ><= F (`+` is isOperator for the current token, not nextIsOperator)
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<'), delim('+'), dim(800, 'px')]),
      'width < + 800px',
    );
    // L249 v.value === '>' T, '<' F, next '=' (leftover only constructed adjacent <=)
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('>', 0, 1), delim('=', 1, 2), dim(800, 'px')]),
      'width >= 800px',
    );
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('>', 0, 1), delim('=', 2, 3), dim(800, 'px')]),
      'width > = 800px',
    );
    assert.equal(ser('(width>=800px)')[0], '(width >= 800px)');
    // ident × isOperator F (non-operator delim) — leftover had number*
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('*')]), 'width*');
  });

  test('whitespace/comment filter unique-cause of all-and strip and empty serialize', () => {
    // length>=2 after filter: constructed whitespace/comment between all and and
    assert.equal(
      MediaParser.canonicalSerialize([
        ident('all'),
        { type: 'whitespace', value: ' ' },
        ident('and'),
        parenBlock([ident('color')]),
      ]),
      '(color)',
    );
    assert.equal(
      MediaParser.canonicalSerialize([
        ident('all'),
        { type: 'comment', value: 'x' },
        ident('and'),
        parenBlock([ident('color')]),
      ]),
      '(color)',
    );
    assert.equal(MediaParser.canonicalSerialize([]), '');
    assert.equal(MediaParser.canonicalSerialize([{ type: 'whitespace', value: '  ' }]), '');
  });
});

describe('MC/DC round4 unique-cause: evaluateMediaFeature (mediaqueries-4 § 4 #evaluating-features / § 4.2 #mq-boolean-context)', { concurrency: false }, () => {
  afterEach(() => {
    restoreTables();
  });

  test('boolean prefix !== null unique-cause via known min-/max- with unknown base', () => {
    // isFeatureUnknown already returns true for every generated min-/max- boolean
    // whose base is in KNOWN_FEATURES, so L1141 T is skipped. A known min-zzz
    // whose base `zzz` is unknown is the unique-cause of prefix !== null T.
    knownFeatures.add('min-zzz');
    assert.equal(evaluateMediaFeature(feature('min-zzz'), env()), 'unknown');
    assert.equal(MediaParser.evaluate('(min-zzz)'), false);
    knownFeatures.delete('min-zzz');
    knownFeatures.add('max-zzz');
    assert.equal(evaluateMediaFeature(feature('max-zzz'), env()), 'unknown');
    assert.equal(MediaParser.evaluate('(max-zzz)'), false);
    knownFeatures.delete('max-zzz');
    // prefix !== null F (boolean width) vs generated min-width (unknown at isFeatureUnknown, never L1141)
    assert.equal(evaluateMediaFeature(feature('width'), env()), true);
    assert.equal(evaluateMediaFeature(feature('min-width'), env()), 'unknown');
    assert.equal(MediaParser.evaluate('(width)'), true);
    assert.equal(MediaParser.evaluate('(min-width)'), false);
  });

  test('two-op range actual === null unique-cause of getActualNumeric default', () => {
    // leftover used orientation+range (isFeatureUnknown T at L1123). still-hot used
    // value-context viewport-segments (L1260). L1231 needs RANGE_FEATURES + range.
    assert.equal(MediaParser.evaluate('(0 < horizontal-viewport-segments < 2)'), false);
    assert.equal(MediaParser.evaluate('(0 < vertical-viewport-segments < 2)'), false);
    assert.equal(MediaParser.evaluate('(1 < -webkit-device-pixel-ratio < 3)'), false);
    assert.equal(
      evaluateMediaFeature(feature('horizontal-viewport-segments', {
        range: { leftValue: [num(0)], leftOp: '<', rightOp: '<', rightValue: [num(2)] },
      }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('vertical-viewport-segments', {
        range: { leftValue: [num(0)], leftOp: '<=', rightOp: '>=', rightValue: [num(2)] },
      }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', {
        range: { leftValue: [num(1)], leftOp: '<', rightOp: '<', rightValue: [num(3)] },
      }), env()),
      'unknown',
    );
    // actual === null F (width two-op)
    assert.equal(MediaParser.evaluate('(400px < width <= 800px)'), true);
  });

  test('two-op typeof leftVal/rightVal !== number unique-cause via non-length number', () => {
    // still-hot used ident. Unique-cause remaining: number 1 is not a length (only 0 is).
    // left number T, right not number
    assert.equal(MediaParser.evaluate('(400px < width < 1)'), false);
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [dim(400, 'px')], leftOp: '<', rightOp: '<', rightValue: [num(1)] },
      }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [dim(400, 'px')], leftOp: '<', rightOp: '<', rightValue: [] },
      }), env()),
      'unknown',
    );
    // left not number, right number
    assert.equal(MediaParser.evaluate('(1 < width < 900px)'), false);
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [], leftOp: '<', rightOp: '<', rightValue: [dim(900, 'px')] },
      }), env()),
      'unknown',
    );
    // both number
    assert.equal(MediaParser.evaluate('(0px < width < 900px)'), true);
  });

  test('discrete op !== "=" unique-cause via range feature with ident value', () => {
    // leftover/still-hot used pointer `<` (not RANGE_FEATURES → unknown at L1123).
    // -webkit-device-pixel-ratio is RANGE without FEATURE_VALUE_TYPES → parseIdent.
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { operator: '<', value: [ident('fine')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { operator: '>', value: [ident('fine')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { operator: '<=', value: [ident('fine')] }), env()),
      'unknown',
    );
    assert.equal(MediaParser.evaluate('(-webkit-device-pixel-ratio < fine)'), false);
    // op !== '=' F (explicit '=' and colon rewrite)
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { operator: '=', value: [ident('fine')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { value: [ident('fine')] }), env()),
      'unknown',
    );
    assert.equal(MediaParser.evaluate('(-webkit-device-pixel-ratio: fine)'), false);
  });

  test('color-gamut / video-color-gamut rec2020 F unique-cause via extra allowed ident', () => {
    // allowed idents are only srgb/p3/rec2020, so parsedVal === 'rec2020' F after
    // those two returns is unpairable unless an extra ident is allowed.
    allowedIdents['color-gamut'] = ['srgb', 'p3', 'rec2020', 'xyz'];
    assert.equal(evaluateMediaFeature(feature('color-gamut', { value: [ident('xyz')] }), env()), false);
    assert.equal(MediaParser.evaluate('(color-gamut: xyz)'), false);
    assert.equal(MediaParser.evaluate('(color-gamut: rec2020)', env({ colorGamut: 'rec2020' })), true);
    allowedIdents['color-gamut'] = origColorGamut;

    allowedIdents['video-color-gamut'] = ['srgb', 'p3', 'rec2020', 'xyz'];
    assert.equal(evaluateMediaFeature(feature('video-color-gamut', { value: [ident('xyz')] }), env()), false);
    assert.equal(MediaParser.evaluate('(video-color-gamut: xyz)'), false);
    allowedIdents['video-color-gamut'] = origVideoColorGamut;
  });

  test('actualIdent !== null unique-cause of null env field vs assigned string', () => {
    // T: default env.displayMode is a string
    assert.equal(evaluateMediaFeature(feature('display-mode', { value: [ident('browser')] }), env()), true);
    // F: null skips toLowerCase (undefined throws; structurally not a unique-cause pair)
    assert.equal(
      evaluateMediaFeature(
        feature('display-mode', { value: [ident('browser')] }),
        env({ displayMode: null as unknown as MediaEnvironment['displayMode'] }),
      ),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(
        feature('hover', { value: [ident('hover')] }),
        env({ hover: null as unknown as MediaEnvironment['hover'] }),
      ),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(
        feature('scan', { value: [ident('progressive')] }),
        env({ scan: null as unknown as MediaEnvironment['scan'] }),
      ),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(
        feature('pointer', { value: [ident('fine')] }),
        env({ pointer: null as unknown as MediaEnvironment['pointer'] }),
      ),
      'unknown',
    );
    // resizable maps null !== false to 'true' — never leaves actualIdent null
    assert.equal(
      evaluateMediaFeature(
        feature('resizable', { value: [ident('true')] }),
        env({ resizable: null as unknown as boolean }),
      ),
      true,
    );
  });
});
