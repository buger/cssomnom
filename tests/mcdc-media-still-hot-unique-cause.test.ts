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
// Still-hot unique-cause for src/MediaParser.ts leftovers that
// tests/mcdc-branch-media.test.ts and tests/mcdc-branch-media-leftover.test.ts
// do not isolate. Drive MediaParser.parse / evaluate / canonicalSerialize,
// serializeMediaQuery, evaluateMediaFeature / evaluateMediaCondition /
// evaluateMediaQuery / evaluateMediaQueries, hasUnknownFeature,
// MediaQueryValidator. mediaqueries-4 § 2.1 #mq-syntax / § 3.2
// #error-handling / § 3.1 #serializing-media-queries / § 4
// #evaluating-features / § 4.2 #mq-boolean-context. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  MediaQueryValidator,
  evaluateMediaFeature,
  evaluateMediaCondition,
  evaluateMediaQuery,
  evaluateMediaQueries,
  serializeMediaQuery,
  hasUnknownFeature,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import type {
  ComponentValue,
  CSSFunction,
  DimensionToken,
  GeneralEnclosed,
  MediaCondition,
  MediaEnvironment,
  MediaFeature,
  MediaQuery,
  NumberToken,
  SimpleBlock,
  Token,
} from '../src/types.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

function ser(text: string): string[] {
  return MediaParser.parse(text).map(serializeMediaQuery);
}

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

function calcFn(inner: ComponentValue[]): CSSFunction {
  return { type: 'function', name: 'calc', value: inner };
}

function feature(name: string, extra: Partial<MediaFeature> = {}): MediaFeature {
  return { type: 'media-feature', name, tokens: extra.tokens ?? [], ...extra };
}

function query(over: Partial<MediaQuery> = {}): MediaQuery {
  return { type: 'media-query', tokens: [], ...over };
}

function cond(
  operator: MediaCondition['operator'],
  ...children: MediaCondition['children']
): MediaCondition {
  return { type: 'media-condition', operator, children };
}

describe('MC/DC still-hot unique-cause: parse list / unclosed / validator (mediaqueries-4 § 2.1 #mq-syntax, § 3.2 #error-handling)', () => {
  test('parse leftover unique-cause of lone comma, later-list unclosed, and condResult eof F', () => {
    // currentQuery.length>0 F, seenComma T with no later ident (not `, all` / `all,`)
    assert.deepEqual(ser(','), ['not all', 'not all']);
    assert.deepEqual(ser(' , '), ['not all', 'not all']);
    // unclosed construct on a later comma item (first query closed)
    assert.deepEqual(ser('screen, (color'), ['screen', 'not all']);
    assert.deepEqual(ser('all, foo('), ['all', 'not all']);
    // validateMediaInParens: condResult T && validator.eof F
    assert.equal(MediaParser.parse('(not (color) extra)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('((color) and (width) extra)')[0].condition?.type, 'general-enclosed');
    // parseMediaConditionWithoutOr next === null after and
    assert.deepEqual(ser('screen and (color) and'), ['not all']);
    assert.deepEqual(ser('screen and (color) and foo'), ['not all']);
    // parseMediaCondition and next null (leftover only had or foo)
    assert.deepEqual(ser('(color) and foo'), ['not all']);
    assert.deepEqual(ser('(color) and'), ['not all']);
  });

  test('isValidMfValue / colon-feature unique-cause of < = independently and length/ident/colon', () => {
    // leftover colon value used `>` and comma; unique-cause of `<` and `=`
    assert.equal(MediaParser.parse('(width: 100px < 200px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width: 100px = 200px)')[0].condition?.type, 'general-enclosed');
    // tokens.length >= 3 T, tokens[0] ident F, colon T
    assert.equal(MediaParser.parse('(100px: 1)')[0].condition?.type, 'general-enclosed');
    // tokens.length >= 3 T, ident T, colon F
    assert.equal(MediaParser.parse('(foo bar baz)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width 800px extra)')[0].condition?.type, 'general-enclosed');
    // length >= 3 F with colon (ident + colon only)
    assert.equal(MediaParser.parse('(width:)')[0].condition?.type, 'general-enclosed');
  });

  test('parseRangeContext unique-cause of = mixed sides, greater/less mix, comma mf-value, middle length', () => {
    // op1 === '=' T, op2 === '=' F
    assert.equal(MediaParser.parse('(400px = width < 800px)')[0].condition?.type, 'general-enclosed');
    // op1 === '=' F, op2 === '=' T
    assert.equal(MediaParser.parse('(400px < width = 800px)')[0].condition?.type, 'general-enclosed');
    // isGreaterThanOp(op1) T && !isGreaterThanOp(op2): leftover had < then >
    assert.equal(MediaParser.parse('(400px > width < 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px >= width <= 800px)')[0].condition?.type, 'general-enclosed');
    // 1-op isValidMfValue left F vs right F (comma), both sides non-empty
    assert.equal(MediaParser.parse('(100px, 200px < width)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width < 100px, 200px)')[0].condition?.type, 'general-enclosed');
    // 2-op isValidMfValue left / middle / right F independently
    assert.equal(MediaParser.parse('(1px, 2px < width < 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px < foo, bar < 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px < width < 800px, 900px)')[0].condition?.type, 'general-enclosed');
    // middle.length === 1 F (ident present but not lone)
    assert.equal(MediaParser.parse('(400px < width extra < 800px)')[0].condition?.type, 'general-enclosed');
    // left.length === 1 F while left[0] is ident
    assert.equal(MediaParser.parse('(width 100px < 200px)')[0].condition?.type, 'general-enclosed');
    // parseOperator t2 delim T, t2.value === '=' F
    assert.equal(MediaParser.parse('(width < > 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width < < 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width > < 800px)')[0].condition?.type, 'general-enclosed');
  });
});

describe('MC/DC still-hot unique-cause: canonicalSerialize (mediaqueries-4 § 3.1 #serializing-media-queries)', () => {
  test('calc resolution-unit unique-cause of dpi/dpcm/dppx/x vs length, via constructed functions', () => {
    // val.unit === 'dpi'|'dpcm'|'dppx'|'x' each T, others F. Canonical form is dppx.
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpi')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(96, 'dpcm')])]), 'calc(2.54dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(1, 'dppx')])]), 'calc(1dppx)');
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(1, 'x')])]), 'calc(1dppx)');
    assert.ok(MediaParser.canonicalSerialize([calcFn([dim(1, 'dpi')])]).includes('dppx'));
    // all four F: length unit
    assert.equal(MediaParser.canonicalSerialize([calcFn([dim(10, 'px')])]), 'calc(10px)');
    // unit === 'number' after simplify
    assert.equal(MediaParser.canonicalSerialize([calcFn([num(8)])]), 'calc(8)');
  });

  test('isRatioSlash unique-cause of lastType number vs function crossed with next number vs function', () => {
    const c16 = calcFn([num(16)]);
    const c9 = calcFn([num(9)]);
    // leftover had number/number and function/function; unique-cause the mixed pairs
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('/'), c9]), '16 / calc(9)');
    assert.equal(MediaParser.canonicalSerialize([c16, delim('/'), num(9)]), 'calc(16) / 9');
    // delim '/' F and isOperator F (`*` is not > < = + -) → no spaces
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('*'), num(9)]), '16*9');
  });

  test('lastWasOperator / lastType delim unique-cause of = - < and ident F', () => {
    // leftover had + and > then ident; remaining operator chars for lastWasOperator
    assert.equal(MediaParser.canonicalSerialize([delim('='), ident('width')]), '= width');
    assert.equal(MediaParser.canonicalSerialize([delim('-'), ident('width')]), '- width');
    assert.equal(MediaParser.canonicalSerialize([delim('<'), ident('width')]), '< width');
    // lastType delim T, lastWasOperator T, v.type === 'ident' F
    assert.equal(MediaParser.canonicalSerialize([delim('+'), num(1)]), '+ 1');
    assert.equal(MediaParser.canonicalSerialize([delim('>'), dim(800, 'px')]), '> 800px');
    // lastType delim T, lastWasOperator F, ident T (non-operator delim)
    assert.equal(MediaParser.canonicalSerialize([delim('*'), ident('width')]), '*width');
  });

  test('space-before unique-cause of lastType dimension/function/number vs each v.type', () => {
    // lastType dimension × ident / number / dimension / operator / simple-block
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'px'), ident('width')]), '100px width');
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'px'), num(1)]), '100px 1');
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'px'), dim(200, 'px')]), '100px 200px');
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'px'), delim('<')]), '100px <');
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'px'), parenBlock([ident('color')])]), '100px (color)');
    // lastType function × ident / number / dimension / operator / simple-block
    const c = calcFn([num(1)]);
    assert.equal(MediaParser.canonicalSerialize([c, ident('and')]), 'calc(1) and');
    assert.equal(MediaParser.canonicalSerialize([c, num(2)]), 'calc(1) 2');
    assert.equal(MediaParser.canonicalSerialize([c, dim(1, 'px')]), 'calc(1) 1px');
    assert.equal(MediaParser.canonicalSerialize([c, delim('<')]), 'calc(1) <');
    assert.equal(MediaParser.canonicalSerialize([c, parenBlock([ident('color')])]), 'calc(1) (color)');
    // lastType number × ident / dimension / simple-block (leftover had number/number and number/op)
    assert.equal(MediaParser.canonicalSerialize([num(16), ident('x')]), '16 x');
    assert.equal(MediaParser.canonicalSerialize([num(16), dim(9, 'px')]), '16 9px');
    assert.equal(MediaParser.canonicalSerialize([num(16), parenBlock([ident('color')])]), '16 (color)');
    // lastType ident × number / dimension (leftover had ident/ident, ident/op, ident/block)
    assert.equal(MediaParser.canonicalSerialize([ident('width'), num(800)]), 'width 800');
    assert.equal(MediaParser.canonicalSerialize([ident('width'), dim(800, 'px')]), 'width 800px');
    // lastType simple-block × number (L236 lastType === 'number' F unique-cause)
    assert.equal(MediaParser.canonicalSerialize([parenBlock([ident('color')]), num(1)]), '(color)1');
  });

  test('isOperator space unique-cause of endsWith ( / next > < = independently', () => {
    // !endsWith(' ') T, length>0 T, endsWith('(') T → skip extra space; trim drops the after-op space
    const open: Token = { type: '(', value: '(' };
    assert.equal(MediaParser.canonicalSerialize([open, delim('<')]), '(<');
    // nextIsOperator unique-cause of next.value '>' / '<' (leftover only combined with '=')
    // adjacent comparison delims skip the after-op space (L249)
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('<'), delim('>')]), 'width <>');
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('>'), delim('<')]), 'width ><');
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('<'), delim('<')]), 'width <<');
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('>'), delim('>')]), 'width >>');
    // v.value '<' F and '>' F, next '=' (both operators)
    assert.equal(MediaParser.canonicalSerialize([ident('width'), delim('='), delim('=')]), 'width ==');
    // adjacent <= vs >= already leftover; combined << is not <=
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<', 0, 1), delim('<', 1, 2), dim(800, 'px')]),
      'width << 800px',
    );
  });
});

describe('MC/DC still-hot unique-cause: matchesType / ratio operand / expectedTypes (mediaqueries-4 § 4 #mq-ranges)', () => {
  test('isValidRatioOperand unique-cause of each typed dimension vs number calc', () => {
    // leftover had calc(16)/calc(9) (all F) and calc(1px) (length T). Remaining types:
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1deg) / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1s) / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1Hz) / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1dpi) / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1fr) / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1%) / 1)')[0]), true);
    // right operand unique-cause (leftover left calc(1px))
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 1 / calc(1px))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 1 / calc(1deg))')[0]), true);
    // mathVal F function
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: foo() / 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(foo) / 1)')[0]), true);
    // 3-token delim not '/' (matchesType ratio)
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 16 * 9)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 16 x 9)')[0]), true);
  });

  test('matchesType unique-cause of empty tokens, empty unit, integer calc types, ident allowed', () => {
    // tokens.length === 0 T (operator present so we reach matchesType)
    assert.equal(evaluateMediaFeature(feature('width', { operator: '>', value: [] }), env()), 'unknown');
    // unit F (empty) on a length dimension
    assert.equal(hasUnknownFeature(MediaParser.parse('(width: 10)')[0]), true);
    assert.equal(
      hasUnknownFeature(query({ condition: feature('width', { value: [dim(10, '')], operator: '=' }) })),
      true,
    );
    // unit F on resolution
    assert.equal(
      hasUnknownFeature(query({ condition: feature('resolution', { value: [dim(96, '')], operator: '=' }) })),
      true,
    );
    // integer feature: calc typed dimension unique-cause of isNumber F
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1px))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1deg))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1s))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1Hz))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1dpi))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1fr))')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(1%))')[0]), true);
    // ident allowed.includes F vs T
    assert.equal(hasUnknownFeature(MediaParser.parse('(shape: rect)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(shape: oval)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(ua-color-scheme: light)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(ua-color-scheme: none)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(orientation: square)')[0]), true);
    // remaining display-mode allowed idents
    assert.equal(MediaParser.evaluate('(display-mode: minimal-ui)', env({ displayMode: 'minimal-ui' })), true);
    assert.equal(MediaParser.evaluate('(display-mode: picture-in-picture)', env({ displayMode: 'picture-in-picture' })), true);
    assert.equal(MediaParser.evaluate('(display-mode: window-controls-overlay)', env({ displayMode: 'window-controls-overlay' })), true);
    assert.equal(MediaParser.evaluate('(display-mode: borderless)', env({ displayMode: 'borderless' })), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(display-mode: unframed)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(display-mode: tabbed)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(display-mode: nope)')[0]), true);
    // prefers-contrast custom leftover vs more/less
    assert.equal(MediaParser.evaluate('(prefers-contrast: custom)', env({ prefersContrast: 'custom' })), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(prefers-contrast: extra)')[0]), true);
  });

  test('isFeatureUnknown unique-cause of operator vs range, left/right matchesType, expectedTypes F', () => {
    // operator T, range F vs range T, operator F
    assert.equal(hasUnknownFeature(query({ condition: feature('width', { operator: '>', value: [dim(1, 'px')] }) })), false);
    assert.equal(
      hasUnknownFeature(query({
        condition: feature('width', {
          range: {
            leftValue: [dim(400, 'px')],
            leftOp: '<',
            rightOp: '<=',
            rightValue: [dim(800, 'px')],
          },
        }),
      })),
      false,
    );
    // range left mismatch vs right mismatch independently
    assert.equal(hasUnknownFeature(MediaParser.parse('(100deg < width < 800px)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(400px < width < 800deg)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(100deg < width < 800deg)')[0]), true);
    // RANGE_FEATURES.has F with operator (discrete)
    assert.equal(hasUnknownFeature(MediaParser.parse('(orientation = landscape)')[0]), true);
    // expectedTypes F: -webkit-device-pixel-ratio is RANGE + KNOWN but not in FEATURE_VALUE_TYPES
    assert.equal(hasUnknownFeature(MediaParser.parse('(-webkit-device-pixel-ratio: 2)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(-webkit-device-pixel-ratio: 2 extra)')[0]), false);
    assert.equal(evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { value: [num(2)] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { value: [num(2), ident('extra')] }), env()), 'unknown');
    // operator without value
    assert.equal(evaluateMediaFeature(feature('width', { operator: '>' }), env()), 'unknown');
  });
});

describe('MC/DC still-hot unique-cause: parseLength / resolution / ratio / integer (mediaqueries-4 § 4.1 #mq-min-max)', () => {
  test('parseLengthToPx / parseResolutionToDpi unique-cause of filtered.length !== 1 via range extra token', () => {
    // matchesType only inspects tokens[0], so extra ident keeps isFeatureUnknown F
    assert.equal(MediaParser.evaluate('(100px extra < width < 900px)'), false);
    assert.equal(MediaParser.evaluate('(96dpi extra < resolution < 200dpi)'), false);
    // calc(em) has length type so matchesType T, but to('px') throws → unknown/false
    assert.equal(MediaParser.evaluate('(width: calc(50em))'), false);
    assert.equal(MediaParser.evaluate('(width: 50em)'), true);
    assert.equal(MediaParser.evaluate('(width: calc(800px))'), true);
    // resolution calc that simplifies to env 96dpi vs a non-matching dppx
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1dppx))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dppx))'), false);
  });

  test('parseRatio unique-cause of length-1 number, delim not slash, left/right not number', () => {
    // colon `16` is rewritten to 16/1 before evaluate; constructed length-1 number hits parseRatio
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(16)] }), env()), false);
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(4, 'number')] }), env()), false);
    // length-1 type === 'number' F
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [ident('wide')] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [dim(16, 'px')] }), env()), 'unknown');
    // length === 3, delim F / value '/' F
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(16), ident('x'), num(9)] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(16), delim('*'), num(9)] }), env()), 'unknown');
    // left number F, right number T
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [ident('a'), delim('/'), num(9)] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [calcFn([num(16)]), delim('/'), num(9)] }), env()), 'unknown');
    // left number T, right number F
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(16), delim('/'), ident('b')] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('aspect-ratio', { value: [num(16), delim('/'), calcFn([num(9)])] }), env()), 'unknown');
    // device-aspect-ratio parseRatio: env 800/600 === 4/3
    assert.equal(evaluateMediaFeature(feature('device-aspect-ratio', { value: [num(4), delim('/'), num(3)] }), env()), true);
    assert.equal(evaluateMediaFeature(feature('device-aspect-ratio', { value: [num(16), delim('/'), num(9)] }), env()), false);
  });

  test('parseInteger / parseIdent unique-cause of length and numberType via range extra / constructed', () => {
    // extra token after integer: matchesType sees first number, parseInteger length !== 1
    assert.equal(MediaParser.evaluate('(8 extra < color < 24)'), false);
    assert.equal(MediaParser.evaluate('(0 extra < grid < 2)'), false);
    // numberType === 'integer' F with type number T (colon 8.5 leftover; range)
    assert.equal(MediaParser.evaluate('(8.5 < color < 24)'), false);
    // parseIdent length === 1 T vs F via expectedTypes-missing feature
    assert.equal(evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { value: [ident('fine')] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('-webkit-device-pixel-ratio', { value: [ident('a'), ident('b')] }), env()), 'unknown');
    // parseIdent type ident F
    assert.equal(evaluateMediaFeature(feature('orientation', { value: [num(1)] }), env()), 'unknown');
  });
});

describe('MC/DC still-hot unique-cause: evaluateMediaFeature discrete / range / custom (mediaqueries-4 § 4 #evaluating)', () => {
  test('boolean unique-cause of !value / !range / !operator independently and remaining numeric names', () => {
    // leftover boolean is all-F; unique-cause each T independently
    assert.equal(evaluateMediaFeature(feature('width', { value: [dim(800, 'px')] }), env()), true);
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [dim(400, 'px')], leftOp: '<', rightOp: '<=', rightValue: [dim(800, 'px')] },
      }), env()),
      true,
    );
    assert.equal(evaluateMediaFeature(feature('width', { operator: '>=', value: [dim(800, 'px')] }), env()), true);
    // operator T, value F, range F
    assert.equal(evaluateMediaFeature(feature('width', { operator: '>=' }), env()), 'unknown');
    // vertical-viewport-segments is in NEGATIVE_RANGE_FEATURES (leftover never named it)
    assert.equal(MediaParser.evaluate('(vertical-viewport-segments)'), true);
    assert.equal(MediaParser.evaluate('(vertical-viewport-segments: 1)'), false);
    assert.equal(MediaParser.evaluate('(vertical-viewport-segments > -1)'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(min-vertical-viewport-segments)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(max-horizontal-viewport-segments)')[0]), true);
  });

  test('two-op range unique-cause of leftVal/rightVal not number and leftMatches vs rightMatches', () => {
    // typeof leftVal !== 'number' T, right number T
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [ident('wide')], leftOp: '<', rightOp: '<', rightValue: [dim(900, 'px')] },
      }), env()),
      'unknown',
    );
    // left number T, right not number
    assert.equal(
      evaluateMediaFeature(feature('width', {
        range: { leftValue: [dim(400, 'px')], leftOp: '<', rightOp: '<', rightValue: [ident('wide')] },
      }), env()),
      'unknown',
    );
    // leftMatches F, rightMatches T (width=800)
    assert.equal(MediaParser.evaluate('(900px < width <= 2000px)'), false);
    // leftMatches T, rightMatches F
    assert.equal(MediaParser.evaluate('(0px < width <= 100px)'), false);
    // both F
    assert.equal(MediaParser.evaluate('(900px < width <= 100px)'), false);
    // actual === null with numeric parsedVal (getActualNumeric default)
    assert.equal(evaluateMediaFeature(feature('horizontal-viewport-segments', { value: [num(1)] }), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('vertical-viewport-segments', { value: [num(1)] }), env()), 'unknown');
  });

  test('custom media unique-cause of typeof object F, mediaText in, and non-Map object', () => {
    // typeof env.customMedia === 'object' F (number is not Map and not object-in)
    assert.equal(
      evaluateMediaFeature(feature('--x'), env({ customMedia: 1 as unknown as MediaEnvironment['customMedia'] })),
      'unknown',
    );
    // string customMedia container
    assert.equal(
      evaluateMediaFeature(feature('--x'), env({ customMedia: 'nope' as unknown as MediaEnvironment['customMedia'] })),
      'unknown',
    );
    // val truthy object without mediaText already leftover {nope}; empty object
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': {} } })), 'unknown');
    // val array (object, no mediaText)
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': [] } })), 'unknown');
    // mediaText in T with empty string
    assert.equal(
      evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': { mediaText: '' } } })),
      true,
    );
    // Map with undefined value vs missing key leftover
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: new Map([['--x', undefined]]) })), 'unknown');
  });

  test('discrete ident unique-cause of orientation equal dimensions, color-gamut leftover idents, op !== =', () => {
    // env.width > env.height F via equality (not leftover 400×800)
    assert.equal(MediaParser.evaluate('(orientation: portrait)', env({ width: 800, height: 800 })), true);
    assert.equal(MediaParser.evaluate('(orientation: landscape)', env({ width: 800, height: 800 })), false);
    // color-gamut p3 OR rec2020 unique-cause already in branch-media; leftover ident
    assert.equal(MediaParser.evaluate('(color-gamut: foo)'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color-gamut: foo)')[0]), true);
    // constructed ident equality with op !== '=' (RANGE_FEATURES misses orientation → unknown earlier)
    assert.equal(evaluateMediaFeature(feature('pointer', { operator: '<', value: [ident('fine')] }), env()), 'unknown');
    // remaining overflow-block / display-state / update idents
    assert.equal(MediaParser.evaluate('(overflow-block: none)', env({ overflowBlock: 'none' })), true);
    assert.equal(MediaParser.evaluate('(display-state: fullscreen)', env({ displayState: 'fullscreen' })), true);
    assert.equal(MediaParser.evaluate('(update: fast)'), true);
    assert.equal(MediaParser.evaluate('(nav-controls: back-button)', env({ navControls: 'back' })), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(nav-controls: back-button)')[0]), false);
    // resizable !== false unique-cause of true vs undefined leftover; explicit true ident
    assert.equal(MediaParser.evaluate('(resizable: true)', env({ resizable: true })), true);
    assert.equal(evaluateMediaFeature(feature('resizable', { value: [ident('true')] }), env({ resizable: false })), false);
  });
});

describe('MC/DC still-hot unique-cause: serialize / 3-valued eval / mediaType (mediaqueries-4 § 3.2 #evaluating-mq-list)', () => {
  test('serializeMediaCondition unique-cause of unknown type and general-enclosed F', () => {
    // fallthrough return '' for a condition type the serializer does not switch on
    const weird = { type: 'nope' } as unknown as MediaFeature;
    assert.equal(serializeMediaQuery(query({ condition: weird })), '');
    // general-enclosed F via media-feature (leftover named/anon T)
    assert.equal(serializeMediaQuery(query({ condition: feature('color', { tokens: [ident('color')] }) })), '(color)');
    // media-condition and/or with empty operator string join
    assert.equal(serializeMediaQuery(query({ condition: cond('and', feature('color', { tokens: [ident('color')] })) })), '(color)');
    assert.equal(
      serializeMediaQuery(query({
        condition: cond('or', feature('color', { tokens: [ident('color')] }), feature('width', { tokens: [ident('width')] })),
      })),
      '(color) or (width)',
    );
  });

  test('checkConditionForUnknown unique-cause of general-enclosed F and unknown node type', () => {
    const weird = { type: 'nope' } as unknown as MediaFeature;
    assert.equal(hasUnknownFeature(query({ condition: weird })), false);
    // media-condition children.some F (empty) vs T (unknown child)
    assert.equal(hasUnknownFeature(query({ condition: cond('and') })), false);
    assert.equal(hasUnknownFeature(query({ condition: cond('and', feature('color', { tokens: [ident('color')] })) })), false);
    assert.equal(hasUnknownFeature(query({ condition: cond('and', { type: 'general-enclosed', value: [] }) })), true);
    assert.equal(hasUnknownFeature(query({ condition: feature('color', { tokens: [ident('color')] }) })), false);
  });

  test('evaluateMediaCondition unique-cause of media-condition F and operator fallthrough', () => {
    const e = env();
    const weird = { type: 'nope' } as unknown as MediaFeature;
    assert.equal(evaluateMediaCondition(weird, e), 'unknown');
    assert.equal(evaluateMediaCondition(feature('color', { tokens: [ident('color')] }), e), true);
    assert.equal(evaluateMediaCondition({ type: 'general-enclosed', value: [] }, e), 'unknown');
    // operator neither not/and/or
    assert.equal(evaluateMediaCondition({ type: 'media-condition', children: [feature('color')] }, e), 'unknown');
  });

  test('evaluateMediaQuery unique-cause of mediaType all vs env and modifier not F', () => {
    // t !== 'all' T, t !== env.mediaType T vs F
    assert.equal(evaluateMediaQuery(query({ mediaType: 'print' }), env()), false);
    assert.equal(evaluateMediaQuery(query({ mediaType: 'screen' }), env()), true);
    assert.equal(evaluateMediaQuery(query({ mediaType: 'SCREEN' }), env({ mediaType: 'screen' })), true);
    // t !== 'all' F (short-circuit)
    assert.equal(evaluateMediaQuery(query({ mediaType: 'all' }), env({ mediaType: 'print' })), true);
    assert.equal(evaluateMediaQuery(query({ mediaType: 'ALL' }), env({ mediaType: 'print' })), true);
    // mediaType T, condition T (evalAnd3)
    assert.equal(evaluateMediaQuery(query({ mediaType: 'screen', condition: feature('color', { tokens: [ident('color')] }) }), env()), true);
    assert.equal(evaluateMediaQuery(query({ mediaType: 'print', condition: feature('color', { tokens: [ident('color')] }) }), env()), false);
    // modifier === 'not' F with only leftover
    assert.equal(evaluateMediaQuery(query({ modifier: 'only', mediaType: 'print' }), env()), false);
    assert.equal(evaluateMediaQuery(query({ modifier: 'only', mediaType: 'all' }), env()), true);
    // empty queries leftover; single false vs mix
    assert.equal(evaluateMediaQueries([query({ invalid: true })], env()), false);
    assert.equal(evaluateMediaQueries([query({ invalid: true }), query({ mediaType: 'screen' })], env()), true);
  });

  test('MediaQueryValidator constructed function Array.isArray F and isSimpleBlock associatedToken F', () => {
    // parseMediaInParens: type === 'function' T, Array.isArray F
    const notArray = { type: 'function', name: 'foo' } as unknown as CSSFunction;
    assert.equal(new MediaQueryValidator([notArray]).validate(), null);
    // type === 'function' T, Array.isArray T (value undefined coerced? real array)
    const emptyFn: CSSFunction = { type: 'function', name: 'foo', value: [] };
    const named = new MediaQueryValidator([emptyFn]).validate();
    assert.ok(named?.condition && named.condition.type === 'general-enclosed');
    assert.equal((named.condition as GeneralEnclosed).name, 'foo');
    // isSimpleBlock associatedToken !== '(' already leftover []/{}; constructed ']'
    const square: SimpleBlock = { type: 'simple-block', associatedToken: { type: '[', value: '[' }, value: [ident('color')] };
    assert.equal(new MediaQueryValidator([square]).validate(), null);
  });
});
