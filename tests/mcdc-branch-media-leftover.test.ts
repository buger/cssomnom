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
// Leftover unique-cause for src/MediaParser.ts not already in
// tests/mcdc-branch-media.test.ts. Drive MediaParser.parse / evaluate /
// canonicalSerialize, serializeMediaQuery, evaluateMediaFeature,
// evaluateMediaCondition, evaluateMediaQuery, evaluateMediaQueries,
// hasUnknownFeature, MediaQueryValidator. No //mcdc:ignore.
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

function feature(name: string, extra: Partial<MediaFeature> = {}): MediaFeature {
  return { type: 'media-feature', name, tokens: extra.tokens ?? [], ...extra };
}

function query(over: Partial<MediaQuery> = {}): MediaQuery {
  return { type: 'media-query', tokens: [], ...over };
}

describe('MC/DC leftover unique-cause: parse list / unclosed / reserved types (mediaqueries-4 § 2.1 #mq-syntax, § 3.2 #error-handling)', () => {
  test('hasUnclosedConstruct unique-cause of simple-block vs function vs nested', () => {
    // simple-block.unclosed T
    assert.deepEqual(ser('(color'), ['not all']);
    assert.deepEqual(ser('(('), ['not all']);
    // outer unclosed, inner closed
    assert.deepEqual(ser('((color)'), ['not all']);
    // function.unclosed T
    assert.deepEqual(ser('foo('), ['not all']);
    assert.deepEqual(ser('unknown-func(val'), ['not all']);
    // function containing a closed inner block, function still unclosed
    assert.deepEqual(ser('foo((color)'), ['not all']);
    // unclosed function nested in an unclosed paren block
    assert.deepEqual(ser('(foo('), ['not all']);
    // both closed → general-enclosed, not invalid
    assert.equal(ser('(foo())')[0], 'foo()');
    assert.equal(MediaParser.parse('(foo())')[0].invalid, undefined);
  });

  test('reserved media-type unique-cause of not/only/and/or/layer vs ident', () => {
    // parseMediaType: v === 'not'|'only'|'and'|'or'|'layer' each T, others F
    assert.deepEqual(ser('not'), ['not all']);
    assert.deepEqual(ser('only'), ['not all']);
    assert.deepEqual(ser('and'), ['not all']);
    assert.deepEqual(ser('or'), ['not all']);
    assert.deepEqual(ser('layer'), ['not all']);
    assert.deepEqual(ser('layer and (color)'), ['not all']);
    assert.deepEqual(ser('or and (color)'), ['not all']);
    // non-reserved ident
    assert.deepEqual(ser('screen'), ['screen']);
    assert.deepEqual(ser('print'), ['print']);
    assert.deepEqual(ser('--narrow'), ['--narrow']);
  });

  test('modifier only vs not unique-cause, and trailing-and / mixed-or invalid', () => {
    // isIdent('not') T vs isIdent('only') T vs neither
    assert.deepEqual(ser('only SCREEN'), ['only screen']);
    assert.deepEqual(ser('not SCREEN'), ['not screen']);
    assert.deepEqual(ser('ONLY screen'), ['only screen']);
    assert.deepEqual(ser('NOT screen'), ['not screen']);
    assert.equal(MediaParser.evaluate('only screen'), true);
    assert.equal(MediaParser.evaluate('not screen'), false);
    assert.equal(MediaParser.evaluate('not print'), true);
    assert.equal(MediaParser.evaluate('only print'), false);
    assert.equal(MediaParser.evaluate('only all'), true);
    // not only is not a valid modifier pair
    assert.deepEqual(ser('not only screen'), ['not all']);
    // mediaType T, isIdent('and') T, condResult null
    assert.deepEqual(ser('screen and'), ['not all']);
    assert.deepEqual(ser('screen and foo'), ['not all']);
    // type + or is not <media-query> (or only in a condition)
    assert.deepEqual(ser('screen or (color)'), ['not all']);
    assert.deepEqual(ser('screen and (color) or (width)'), ['not all']);
  });

  test('comma-list leftover unique-cause of empty query vs comments vs non-paren block', () => {
    // currentQuery.length===0 && seenComma T (leading comma) — not in mcdc-branch-media
    assert.deepEqual(ser(', all'), ['not all', 'all']);
    assert.deepEqual(ser('all,'), ['all', 'not all']);
    // comments filtered before validate
    assert.deepEqual(ser('/*x*/screen/*y*/'), ['screen']);
    // isSimpleBlock associatedToken === '(' F: [] / {} are not <media-in-parens>
    assert.deepEqual(ser('[]'), ['not all']);
    assert.deepEqual(ser('{}'), ['not all']);
    // empty parens: tokens.length === 0 → null → invalid
    assert.deepEqual(ser('()'), ['not all']);
  });
});

describe('MC/DC leftover unique-cause: canonicalSerialize (mediaqueries-4 § 3.1 #serializing-media-queries)', () => {
  test('all-and strip unique-cause of length, ident all, and and', () => {
    // length>=2 T, ident all T, ident and T — already in mcdc-branch-media as 'all and (color)'
    // leftover: ALL case, and unique-cause F rows
    assert.equal(MediaParser.canonicalSerialize([ident('ALL'), ident('AND'), parenBlock([ident('COLOR')])]).toLowerCase().includes('color'), true);
    assert.equal(ser('ALL AND (COLOR)')[0], '(color)');
    // length>=2 T, first ident T, 'all' F
    assert.equal(ser('screen and (color)')[0], 'screen and (color)');
    // first ident 'all' T, second ident T, 'and' F
    assert.equal(MediaParser.canonicalSerialize([ident('all'), ident('or'), parenBlock([ident('color')])]), 'all or (color)');
    // first ident 'all' T, second ident F
    assert.equal(MediaParser.canonicalSerialize([ident('all'), parenBlock([ident('color')])]), 'all (color)');
    // length>=2 F
    assert.equal(MediaParser.canonicalSerialize([ident('all')]), 'all');
  });

  test('ident -- vs lowercase, at-keyword, dimension unit, else-arm serialize', () => {
    assert.equal(ser('(--Foo)')[0], '(--Foo)');
    assert.equal(ser('SCREEN')[0], 'screen');
    assert.equal(MediaParser.canonicalSerialize([{ type: 'at-keyword', value: 'Media' }]), '@media');
    assert.equal(MediaParser.canonicalSerialize([dim(100, 'PX')]), '100px');
    // unit F → empty suffix
    assert.equal(MediaParser.canonicalSerialize([dim(1, '')]), '1');
    // else-arm: hash / string / comma
    assert.equal(MediaParser.canonicalSerialize([{ type: 'hash', value: 'fff', hashType: 'unrestricted' }]).includes('fff'), true);
    assert.equal(MediaParser.canonicalSerialize([{ type: 'comma', value: ',' }, ident('b')]), ', b');
    assert.equal(MediaParser.canonicalSerialize([ident('width'), { type: 'colon', value: ':' }, dim(100, 'px')]), 'width: 100px');
  });

  test('calc unique-cause of mathVal && name===calc, resolution units, number, and non-calc math', () => {
    // mathVal T && calc T && CSSUnitValue T, resolution unit unique-cause
    assert.equal(MediaParser.canonicalSerialize([{
      type: 'function', name: 'calc', value: [dim(10, 'px')],
    } as CSSFunction]), 'calc(10px)');
    assert.ok(ser('(resolution: calc(1x))')[0].includes('dppx') || ser('(resolution: calc(1x))')[0].includes('calc'));
    assert.ok(ser('(width: calc(800px))')[0].includes('calc'));
    // unit number → empty
    assert.equal(ser('(color: calc(8))')[0], '(color: calc(8))');
    // mathVal T, name==='calc' F: min/max/clamp stay as themselves
    assert.equal(ser('(width: min(100px, 200px))')[0], '(width: min(100px, 200px))');
    assert.equal(ser('(width: max(100px, 50px))')[0], '(width: max(100px, 50px))');
    assert.equal(ser('(width: clamp(50px, 100px, 150px))')[0], '(width: clamp(50px, 100px, 150px))');
    // calc that does not simplify to CSSUnitValue
    assert.equal(ser('(width: calc(1px + 1em))')[0], '(width: calc(1px + 1em))');
    // mathVal F, calc T
    assert.equal(ser('(width: calc(foo))')[0], '(width: calc(foo))');
  });

  test('isRatioSlash / isOperator / lastWasOperator leftover spacing unique-cause', () => {
    // delim '/' T, lastType number T, next number T
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('/'), num(9)]), '16 / 9');
    // lastType function T, next function T
    const calc16: CSSFunction = { type: 'function', name: 'calc', value: [num(16)] };
    const calc9: CSSFunction = { type: 'function', name: 'calc', value: [num(9)] };
    assert.equal(MediaParser.canonicalSerialize([calc16, delim('/'), calc9]), 'calc(16) / calc(9)');
    // '/' T, lastType number T, next not number/function
    assert.equal(MediaParser.canonicalSerialize([num(16), delim('/'), ident('x')]).includes('/'), true);
    // lastType not number/function before '/'
    assert.equal(MediaParser.canonicalSerialize([ident('a'), delim('/'), num(9)]).includes('/'), true);
    // two numbers
    assert.equal(MediaParser.canonicalSerialize([num(1), num(2)]), '1 2');
    // lastType simple-block && ident
    assert.equal(MediaParser.canonicalSerialize([parenBlock([ident('color')]), ident('and')]), '(color) and');
    // isOperator + / - leftover vs < > =
    assert.equal(MediaParser.canonicalSerialize([num(1), delim('+'), num(2)]), '1 + 2');
    assert.equal(MediaParser.canonicalSerialize([num(1), delim('-'), num(2)]), '1 - 2');
    // lastWasOperator && ident
    assert.equal(MediaParser.canonicalSerialize([delim('+'), ident('width')]), '+ width');
    assert.equal(MediaParser.canonicalSerialize([delim('>'), ident('width')]), '> width');
  });

  test('parseOperator / serialize combined <= unique-cause of adjacent indices vs gap vs missing', () => {
    // adjacent endIndex===startIndex → combined <= (no extra space)
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<', 0, 1), delim('=', 1, 2), dim(800, 'px')]),
      'width <= 800px',
    );
    // both defined, not equal → space
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<', 0, 1), delim('=', 2, 3), dim(800, 'px')]),
      'width < = 800px',
    );
    // endIndex undefined
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<'), delim('=', 1, 2), dim(800, 'px')]),
      'width < = 800px',
    );
    // startIndex undefined
    assert.equal(
      MediaParser.canonicalSerialize([ident('width'), delim('<', 0, 1), delim('='), dim(800, 'px')]),
      'width < = 800px',
    );
    // via parse: adjacent vs spaced (mediaqueries-4 comparison operators)
    assert.equal(ser('(width<=800px)')[0], '(width <= 800px)');
    assert.equal(ser('(width>=800px)')[0], '(width >= 800px)');
    assert.equal(MediaParser.parse('(width < = 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width > = 800px)')[0].condition?.type, 'general-enclosed');
  });
});

describe('MC/DC leftover unique-cause: MediaQueryValidator range / mf-value / nested (mediaqueries-4 § 4 #media-features)', () => {
  test('validate empty stream, nested not/and/or, and parseMediaInParens arms', () => {
    assert.equal(new MediaQueryValidator([]).validate(), null);
    assert.equal(new MediaQueryValidator([ident('not')]).validate(), null);
    // nested condition in parens
    assert.equal(ser('((color) and (width))')[0], '(color) and (width)');
    assert.equal(MediaParser.evaluate('((color) and (width))'), true);
    // parseMediaConditionWithoutOr: screen and not (parens)
    assert.equal(ser('screen and not (color)')[0], 'screen and not (color)');
    assert.equal(MediaParser.evaluate('screen and not (color)'), false);
    // multiple and / or (while-loop leftover vs the single and/or in mcdc-branch-media)
    assert.equal(ser('(color) and (width) and (grid)')[0], '(color) and (width) and (grid)');
    assert.equal(ser('(color) or (width) or (grid)')[0], '(color) or (width) or (grid)');
    assert.equal(MediaParser.evaluate('(color) and (width) and (grid)'), false);
    assert.equal(MediaParser.evaluate('(color) or (width) or (grid)'), true);
    // not (in-parens) vs not-not invalid
    assert.equal(ser('not (color)')[0], 'not (color)');
    assert.deepEqual(ser('not not (color)'), ['not all']);
    // function general-enclosed vs paren general-enclosed
    assert.equal(ser('future-func(val)')[0], 'future-func(val)');
    assert.equal(ser('(100px)')[0], '(100px)');
    assert.equal(MediaParser.parse('future-func(val)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(100px)')[0].condition?.type, 'general-enclosed');
    // or next null
    assert.deepEqual(ser('(color) or foo'), ['not all']);
  });

  test('isValidMfValue unique-cause of empty / operator / comma vs valid colon feature', () => {
    assert.equal(MediaParser.parse('(width:)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width: 100px, 200px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width: 100px > 200px)')[0].condition?.type, 'general-enclosed');
    // colon feature leftover (no-space, mixed case)
    assert.equal(ser('(WIDTH: 800px)')[0], '(width: 800px)');
    assert.equal(MediaParser.evaluate('(WIDTH: 800px)'), true);
    // min-/max- boolean: known base → general-enclosed (max- leftover vs min-width in mcdc-branch-media)
    assert.equal(MediaParser.parse('(max-width)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(min-color)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.evaluate('(max-width)'), false);
    // min- of unknown base stays a feature
    assert.equal(MediaParser.parse('(min-unknown)')[0].condition?.type, 'media-feature');
    assert.equal(hasUnknownFeature(MediaParser.parse('(min-unknown)')[0]), true);
  });

  test('parseRangeContext unique-cause of 0/1/2/>2 ops, empty sides, mixed compare, neither-ident', () => {
    // ops.length === 0
    assert.equal(MediaParser.parse('(100px)')[0].condition?.type, 'general-enclosed');
    // ops.length === 1, left or right empty
    assert.equal(MediaParser.parse('(< 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(width >)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(= width)')[0].condition?.type, 'general-enclosed');
    // neither side a lone ident
    assert.equal(MediaParser.parse('(100px < 200px)')[0].condition?.type, 'general-enclosed');
    // leftIsIdent T takes precedence over right ident
    assert.equal(MediaParser.parse('(width < height)')[0].condition?.type, 'media-feature');
    assert.equal(MediaParser.evaluate('(width < height)'), false);
    // '=' one-sided leftover (mcdc-branch-media covers < > inverted)
    assert.equal(MediaParser.evaluate('(width = 800px)'), true);
    assert.equal(MediaParser.evaluate('(800px = width)'), true);
    // ops.length === 2 mixed compare / equals → null → general-enclosed
    assert.equal(MediaParser.parse('(400px = width = 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px < width > 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px <= width >= 800px)')[0].condition?.type, 'general-enclosed');
    // middle not ident
    assert.equal(MediaParser.parse('(100px < 200px < 300px)')[0].condition?.type, 'general-enclosed');
    // empty left/right of dual range
    assert.equal(MediaParser.parse('(< width < 800px)')[0].condition?.type, 'general-enclosed');
    assert.equal(MediaParser.parse('(400px < width <)')[0].condition?.type, 'general-enclosed');
    // ops.length > 2
    assert.equal(MediaParser.parse('(1px < width < 2px < 3px)')[0].condition?.type, 'general-enclosed');
    // other delim is not an operator
    const slash = new MediaQueryValidator([
      parenBlock([ident('width'), delim('/'), dim(800, 'px')]),
    ]).validate();
    assert.ok(slash);
    assert.equal(slash.condition?.type, 'general-enclosed');
  });

  test('adjacent vs gapped <= constructed tokens unique-cause of parseOperator index equality', () => {
    const adjacent = new MediaQueryValidator([
      parenBlock([ident('width'), delim('<', 0, 1), delim('=', 1, 2), dim(800, 'px')]),
    ]).validate();
    assert.ok(adjacent?.condition && adjacent.condition.type === 'media-feature');
    assert.equal((adjacent.condition as MediaFeature).operator, '<=');

    const gapped = new MediaQueryValidator([
      parenBlock([ident('width'), delim('<', 0, 1), delim('=', 2, 3), dim(800, 'px')]),
    ]).validate();
    assert.equal(gapped?.condition?.type, 'general-enclosed');

    const missingIdx = new MediaQueryValidator([
      parenBlock([ident('width'), delim('<'), delim('='), dim(800, 'px')]),
    ]).validate();
    assert.equal(missingIdx?.condition?.type, 'general-enclosed');
  });

  test('aspect-ratio n/1 leftover of colon vs dual-range sides already a ratio', () => {
    // leftover vs mcdc-branch-media (aspect-ratio > 1) / (1 < aspect-ratio < 2)
    assert.equal(ser('(aspect-ratio: 16)')[0], '(aspect-ratio: 16 / 1)');
    assert.equal(ser('(1/1 < aspect-ratio < 2)')[0], '(1 / 1 < aspect-ratio < 2 / 1)');
    assert.equal(ser('(1 < aspect-ratio < 2/1)')[0], '(1 / 1 < aspect-ratio < 2 / 1)');
    assert.equal(MediaParser.evaluate('(1/1 < aspect-ratio < 2/1)'), true);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio: 800/600)'), true);
  });
});

describe('MC/DC leftover unique-cause: serializeMediaQuery / hasUnknownFeature', () => {
  test('serializeMediaQuery leftover of invalid, -- media type, only, condition-only', () => {
    assert.equal(serializeMediaQuery(MediaParser.parse('&test')[0]), 'not all');
    assert.equal(serializeMediaQuery(MediaParser.parse('screen and')[0]), 'not all');
    assert.equal(ser('--narrow')[0], '--narrow');
    assert.equal(ser('only all and (color)')[0], 'only all and (color)');
    assert.equal(ser('not (color)')[0], 'not (color)');
    assert.equal(ser('(color)')[0], '(color)');
    const named: GeneralEnclosed = { type: 'general-enclosed', name: 'Foo', value: [ident('val')] };
    assert.equal(serializeMediaQuery(query({ condition: named })), 'foo(val)');
    const anon: GeneralEnclosed = { type: 'general-enclosed', value: [ident('x')] };
    assert.equal(serializeMediaQuery(query({ condition: anon })), '(x)');
  });

  test('hasUnknownFeature unique-cause of no-condition, custom, range-on-discrete, types, min-/max-', () => {
    assert.equal(hasUnknownFeature(MediaParser.parse('screen')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(--x)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(unknown-feature)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(unknown-feature) and (color)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('foo(x)')[0]), true);
    // discrete feature in range context
    assert.equal(hasUnknownFeature(MediaParser.parse('(pointer = fine)')[0]), true);
    assert.equal(MediaParser.evaluate('(pointer = fine)'), false);
    // type mismatch / trailing tokens
    assert.equal(hasUnknownFeature(MediaParser.parse('(width: 100deg)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(width: 1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(width: 100px foo)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: 8.5)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 16 9)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(min-width)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(max-width)')[0]), true);
    // known matching types
    assert.equal(hasUnknownFeature(MediaParser.parse('(width: 0)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: 8)')[0]), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: 16 / 9)')[0]), false);
    assert.equal(hasUnknownFeature(query({})), false);
  });
});

describe('MC/DC leftover unique-cause: evaluateMediaFeature boolean context', () => {
  test('boolean leftover of each range/discrete feature T vs F unique-cause', () => {
    // mcdc-branch-media covers width/hover/pointer/grid=1/resizable/min-width and
    // always-true color-gamut/video-color-gamut/orientation/display-mode/aspect-ratio.
    assert.equal(MediaParser.evaluate('(height)', env({ height: 0 })), false);
    assert.equal(MediaParser.evaluate('(height)', env({ height: 1 })), true);
    assert.equal(MediaParser.evaluate('(device-width)', env({ deviceWidth: 0 })), false);
    assert.equal(MediaParser.evaluate('(device-width)', env({ deviceWidth: 1 })), true);
    assert.equal(MediaParser.evaluate('(device-height)', env({ deviceHeight: 0 })), false);
    assert.equal(MediaParser.evaluate('(device-height)', env({ deviceHeight: 1 })), true);
    assert.equal(MediaParser.evaluate('(resolution)', env({ resolution: 0 })), false);
    assert.equal(MediaParser.evaluate('(resolution)', env({ resolution: 1 })), true);
    assert.equal(MediaParser.evaluate('(color)', env({ color: 0 })), false);
    assert.equal(MediaParser.evaluate('(color)', env({ color: 1 })), true);
    assert.equal(MediaParser.evaluate('(color-index)', env({ colorIndex: 0 })), false);
    assert.equal(MediaParser.evaluate('(color-index)', env({ colorIndex: 1 })), true);
    assert.equal(MediaParser.evaluate('(monochrome)', env({ monochrome: 0 })), false);
    assert.equal(MediaParser.evaluate('(monochrome)', env({ monochrome: 1 })), true);
    assert.equal(MediaParser.evaluate('(grid)', env({ grid: 0 })), false);
    assert.equal(MediaParser.evaluate('(any-hover)', env({ anyHover: 'none' })), false);
    assert.equal(MediaParser.evaluate('(any-hover)', env({ anyHover: 'hover' })), true);
    assert.equal(MediaParser.evaluate('(any-pointer)', env({ anyPointer: 'none' })), false);
    assert.equal(MediaParser.evaluate('(any-pointer)', env({ anyPointer: 'fine' })), true);
    assert.equal(MediaParser.evaluate('(prefers-contrast)', env({ prefersContrast: 'no-preference' })), false);
    assert.equal(MediaParser.evaluate('(prefers-contrast)', env({ prefersContrast: 'more' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-motion)', env({ prefersReducedMotion: 'no-preference' })), false);
    assert.equal(MediaParser.evaluate('(prefers-reduced-motion)', env({ prefersReducedMotion: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-transparency)', env({ prefersReducedTransparency: 'no-preference' })), false);
    assert.equal(MediaParser.evaluate('(prefers-reduced-transparency)', env({ prefersReducedTransparency: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-data)', env({ prefersReducedData: 'no-preference' })), false);
    assert.equal(MediaParser.evaluate('(prefers-reduced-data)', env({ prefersReducedData: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(forced-colors)', env({ forcedColors: 'none' })), false);
    assert.equal(MediaParser.evaluate('(forced-colors)', env({ forcedColors: 'active' })), true);
    assert.equal(MediaParser.evaluate('(inverted-colors)', env({ invertedColors: 'none' })), false);
    assert.equal(MediaParser.evaluate('(inverted-colors)', env({ invertedColors: 'inverted' })), true);
    assert.equal(MediaParser.evaluate('(scripting)', env({ scripting: 'none' })), false);
    assert.equal(MediaParser.evaluate('(scripting)', env({ scripting: 'enabled' })), true);
    assert.equal(MediaParser.evaluate('(dynamic-range)', env({ dynamicRange: 'standard' })), false);
    assert.equal(MediaParser.evaluate('(dynamic-range)', env({ dynamicRange: 'high' })), true);
    assert.equal(MediaParser.evaluate('(video-dynamic-range)', env({ videoDynamicRange: 'standard' })), false);
    assert.equal(MediaParser.evaluate('(video-dynamic-range)', env({ videoDynamicRange: 'high' })), true);
    assert.equal(MediaParser.evaluate('(overflow-block)', env({ overflowBlock: 'none' })), false);
    assert.equal(MediaParser.evaluate('(overflow-block)', env({ overflowBlock: 'scroll' })), true);
    assert.equal(MediaParser.evaluate('(overflow-inline)', env({ overflowInline: 'none' })), false);
    assert.equal(MediaParser.evaluate('(overflow-inline)', env({ overflowInline: 'scroll' })), true);
    assert.equal(MediaParser.evaluate('(nav-controls)', env({ navControls: 'none' })), false);
    assert.equal(MediaParser.evaluate('(nav-controls)', env({ navControls: 'back' })), true);
    assert.equal(MediaParser.evaluate('(navigation-controls)', env({ navControls: 'none' })), false);
    assert.equal(MediaParser.evaluate('(navigation-controls)', env({ navControls: 'back' })), true);
    // always-true leftover
    assert.equal(MediaParser.evaluate('(prefers-color-scheme)'), true);
    assert.equal(MediaParser.evaluate('(display-state)'), true);
    assert.equal(MediaParser.evaluate('(scan)'), true);
    assert.equal(MediaParser.evaluate('(update)'), true);
    assert.equal(MediaParser.evaluate('(environment-blending)'), true);
    // default arm of the boolean switch
    assert.equal(MediaParser.evaluate('(shape)'), true);
    assert.equal(MediaParser.evaluate('(ua-color-scheme)'), true);
    assert.equal(MediaParser.evaluate('(-webkit-transform-3d)'), true);
    assert.equal(MediaParser.evaluate('(horizontal-viewport-segments)'), true);
  });

  test('aspect-ratio / device-aspect-ratio boolean unique-cause of both dimensions > 0', () => {
    assert.equal(MediaParser.evaluate('(aspect-ratio)', env({ aspectRatio: [1, 1] })), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio)', env({ aspectRatio: [0, 1] })), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio)', env({ aspectRatio: [1, 0] })), false);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio)', env({ deviceAspectRatio: [1, 1] })), true);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio)', env({ deviceAspectRatio: [0, 1] })), false);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio)', env({ deviceAspectRatio: [1, 0] })), false);
  });
});

describe('MC/DC leftover unique-cause: length / resolution / ratio / integer compare', () => {
  test('parseLengthToPx unique-cause of each unit vs 0 vs calc vs default', () => {
    assert.equal(MediaParser.evaluate('(width > 0px)'), true);
    assert.equal(MediaParser.evaluate('(width: 50em)'), true);
    assert.equal(MediaParser.evaluate('(width: 50rem)'), true);
    assert.equal(MediaParser.evaluate('(width: 100ex)'), true);
    assert.equal(MediaParser.evaluate('(width: 100ch)'), true);
    assert.equal(MediaParser.evaluate('(width: 50ic)'), true);
    assert.equal(MediaParser.evaluate('(width > 0in)'), true);
    assert.equal(MediaParser.evaluate('(width > 0cm)'), true);
    assert.equal(MediaParser.evaluate('(width > 0mm)'), true);
    assert.equal(MediaParser.evaluate('(width > 0pt)'), true);
    assert.equal(MediaParser.evaluate('(width > 0pc)'), true);
    assert.equal(MediaParser.evaluate('(width: 100vw)'), true);
    assert.equal(MediaParser.evaluate('(height: 100vh)'), true);
    assert.equal(MediaParser.evaluate('(width: 100vi)'), true);
    assert.equal(MediaParser.evaluate('(height: 100vb)'), true);
    assert.equal(MediaParser.evaluate('(height: 100vmin)'), true);
    assert.equal(MediaParser.evaluate('(width: 100vmax)'), true);
    // default unit
    assert.equal(MediaParser.evaluate('(width > 0foo)'), false);
    assert.equal(MediaParser.evaluate('(width > 0deg)'), false);
    // number 0 is a length; non-zero number is not
    assert.equal(MediaParser.evaluate('(width: 0)', env({ width: 0 })), true);
    assert.equal(MediaParser.evaluate('(width: 1)'), false);
    // calc length T vs non-length / unsimplified
    assert.equal(MediaParser.evaluate('(width: calc(800px))'), true);
    assert.equal(MediaParser.evaluate('(width > calc(100px + 50px))'), true);
    assert.equal(MediaParser.evaluate('(width: calc(1px + 1em))'), false);
    assert.equal(MediaParser.evaluate('(width: calc(1deg))'), false);
    assert.equal(MediaParser.evaluate('(width: min(100px, 200px))'), false);
  });

  test('parseResolutionToDpi unique-cause of dpi/dpcm/dppx/x/infinite/calc vs default', () => {
    assert.equal(MediaParser.evaluate('(resolution: 96dpi)'), true);
    assert.equal(MediaParser.evaluate('(resolution: 1dppx)'), true);
    assert.equal(MediaParser.evaluate('(resolution: 1x)'), true);
    assert.equal(MediaParser.evaluate('(min-resolution: 1x)'), true);
    assert.equal(MediaParser.evaluate('(max-resolution: 2dppx)'), true);
    assert.equal(MediaParser.evaluate('(resolution: 37.79527559055118dpcm)'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1x))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1s))'), false);
    assert.equal(MediaParser.evaluate('(resolution: infinite)'), false);
    // ident infinite → Infinity; max is <= Inf (T), min is >= Inf (F).
    // `(resolution < infinite)` inverts because both sides are idents.
    assert.equal(MediaParser.evaluate('(max-resolution: infinite)'), true);
    assert.equal(MediaParser.evaluate('(min-resolution: infinite)'), false);
    assert.equal(
      evaluateMediaFeature(feature('resolution', { operator: '<', value: [ident('infinite')] }), env()),
      true,
    );
    assert.equal(MediaParser.evaluate('(resolution: InfInite)'), false);
    assert.equal(MediaParser.evaluate('(resolution: 96px)'), false);
  });

  test('parseRatio / parseInteger leftover of slash-zero, calc operands, integer vs number', () => {
    assert.equal(MediaParser.evaluate('(aspect-ratio: 4/3)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16/0)'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: -1/1)')[0]), true);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(16) / calc(9))')[0]), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: calc(16) / calc(9))'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(aspect-ratio: calc(1px))')[0]), true);
    assert.equal(MediaParser.evaluate('(color: 8)'), true);
    assert.equal(MediaParser.evaluate('(color: 8.5)'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(color: calc(8))')[0]), false);
    assert.equal(MediaParser.evaluate('(color: calc(8))'), false);
    assert.equal(MediaParser.evaluate('(color-index: 0)'), true);
    assert.equal(MediaParser.evaluate('(monochrome: 0)'), true);
    assert.equal(MediaParser.evaluate('(min-color: 8)'), true);
    assert.equal(MediaParser.evaluate('(max-color: 8)'), true);
    assert.equal(MediaParser.evaluate('(grid: 0)'), true);
  });

  test('compareOp leftover of negative-range unique-cause and default operator', () => {
    // isNegativeRangeFeature T, queried < 0 T vs F
    assert.equal(MediaParser.evaluate('(width = -10px)'), false);
    assert.equal(MediaParser.evaluate('(width < -10px)'), false);
    assert.equal(MediaParser.evaluate('(width <= -10px)'), false);
    assert.equal(MediaParser.evaluate('(width > -10px)'), true);
    assert.equal(MediaParser.evaluate('(width >= -10px)'), true);
    assert.equal(MediaParser.evaluate('(width = 800px)'), true);
    // other negative-range features
    assert.equal(MediaParser.evaluate('(color-index > -1)'), true);
    assert.equal(MediaParser.evaluate('(monochrome >= -1)'), true);
    assert.equal(MediaParser.evaluate('(color = -1)'), false);
    // isNegativeRangeFeature F, queried < 0 T (grid is not in NEGATIVE_RANGE_FEATURES)
    assert.equal(hasUnknownFeature(MediaParser.parse('(grid > -1)')[0]), true);
    assert.equal(MediaParser.evaluate('(grid: -1)'), false);
    // default compare op
    assert.equal(
      evaluateMediaFeature(feature('width', { operator: '?', value: [dim(800, 'px')] }), env()),
      false,
    );
    // eps leftover: width=800 vs queried just under/over
    assert.equal(MediaParser.evaluate('(width <= 799.999999px)'), true);
    assert.equal(MediaParser.evaluate('(width >= 800.0000005px)'), true);
  });

  test('two-operator range leftover leftOp unique-cause of <= / >= / <', () => {
    // mcdc-branch-media has 400px < width <= 800px and 1000px > width > 100px
    assert.equal(MediaParser.evaluate('(400px <= width <= 800px)'), true);
    assert.equal(MediaParser.evaluate('(1000px >= width >= 100px)'), true);
    assert.equal(MediaParser.evaluate('(400px < width < 900px)'), true);
    assert.equal(MediaParser.evaluate('(400px <= width < 900px)'), true);
    assert.equal(MediaParser.evaluate('(1000px >= width > 100px)'), true);
    assert.equal(MediaParser.evaluate('(device-width > 0px)'), true);
    assert.equal(MediaParser.evaluate('(device-height >= 0px)'), true);
    assert.equal(MediaParser.evaluate('(min-height: 600px)'), true);
    assert.equal(MediaParser.evaluate('(max-height: 600px)'), true);
    // getActualNumeric default → unknown
    assert.equal(MediaParser.evaluate('(horizontal-viewport-segments > 0)'), false);
    assert.equal(MediaParser.evaluate('(-webkit-device-pixel-ratio: 1)'), false);
    assert.equal(MediaParser.evaluate('(-webkit-transform-3d: 1)'), false);
    // constructed range with non-numeric leftOp
    assert.equal(
      evaluateMediaFeature(
        feature('width', {
          range: {
            leftValue: [dim(400, 'px')],
            leftOp: '=',
            rightOp: '<=',
            rightValue: [dim(800, 'px')],
          },
        }),
        env(),
      ),
      false,
    );
    // range on a discrete feature: actual === null
    assert.equal(
      evaluateMediaFeature(
        feature('orientation', {
          range: {
            leftValue: [dim(1, 'px')],
            leftOp: '<',
            rightOp: '<',
            rightValue: [dim(2, 'px')],
          },
        }),
        env(),
      ),
      'unknown',
    );
  });
});

describe('MC/DC leftover unique-cause: discrete ident switch / custom media / 3-valued eval', () => {
  test('discrete ident leftover unique-cause of each switch arm T vs F', () => {
    assert.equal(MediaParser.evaluate('(orientation: portrait)', env({ width: 400, height: 800 })), true);
    assert.equal(MediaParser.evaluate('(display-mode: fullscreen)', env({ displayMode: 'fullscreen' })), true);
    assert.equal(MediaParser.evaluate('(display-mode: standalone)', env({ displayMode: 'browser' })), false);
    assert.equal(MediaParser.evaluate('(display-state: minimized)', env({ displayState: 'minimized' })), true);
    assert.equal(MediaParser.evaluate('(display-state: maximized)', env({ displayState: 'normal' })), false);
    assert.equal(MediaParser.evaluate('(prefers-color-scheme: dark)', env({ prefersColorScheme: 'dark' })), true);
    assert.equal(MediaParser.evaluate('(prefers-color-scheme: light)', env({ prefersColorScheme: 'dark' })), false);
    assert.equal(MediaParser.evaluate('(prefers-contrast: less)', env({ prefersContrast: 'less' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-transparency: reduce)', env({ prefersReducedTransparency: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-data: reduce)', env({ prefersReducedData: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(forced-colors: none)'), true);
    assert.equal(MediaParser.evaluate('(inverted-colors: none)'), true);
    assert.equal(MediaParser.evaluate('(dynamic-range: standard)'), true);
    assert.equal(MediaParser.evaluate('(video-dynamic-range: standard)'), true);
    assert.equal(MediaParser.evaluate('(pointer: coarse)', env({ pointer: 'coarse' })), true);
    assert.equal(MediaParser.evaluate('(any-pointer: coarse)', env({ anyPointer: 'coarse' })), true);
    assert.equal(MediaParser.evaluate('(any-hover: none)', env({ anyHover: 'none' })), true);
    assert.equal(MediaParser.evaluate('(scan: interlace)', env({ scan: 'interlace' })), true);
    assert.equal(MediaParser.evaluate('(update: none)', env({ update: 'none' })), true);
    assert.equal(MediaParser.evaluate('(update: slow)', env({ update: 'slow' })), true);
    assert.equal(MediaParser.evaluate('(overflow-block: paged)', env({ overflowBlock: 'paged' })), true);
    assert.equal(MediaParser.evaluate('(scripting: initial-only)', env({ scripting: 'initial-only' })), true);
    assert.equal(MediaParser.evaluate('(environment-blending: additive)', env({ environmentBlending: 'additive' })), true);
    assert.equal(MediaParser.evaluate('(environment-blending: subtractive)', env({ environmentBlending: 'subtractive' })), true);
    assert.equal(MediaParser.evaluate('(nav-controls: back)', env({ navControls: 'back' })), true);
    assert.equal(MediaParser.evaluate('(navigation-controls: none)'), true);
    assert.equal(MediaParser.evaluate('(navigation-controls: back-button)', env({ navControls: 'back' })), false);
    assert.equal(MediaParser.evaluate('(resizable: true)', env({ resizable: undefined })), true);
    assert.equal(MediaParser.evaluate('(resizable: false)', env({ resizable: undefined })), false);
    // mixed-case ident
    assert.equal(MediaParser.evaluate('(orientation: Landscape)'), true);
    assert.equal(MediaParser.evaluate('(pointer: Fine)'), true);
    // default ident arm → unknown (shape / ua-color-scheme are known idents but not in the switch)
    assert.equal(MediaParser.evaluate('(shape: rect)'), false);
    assert.equal(MediaParser.evaluate('(ua-color-scheme: light)'), false);
    assert.equal(evaluateMediaFeature(feature('shape', { value: [ident('rect')] }), env()), 'unknown');
  });

  test('color-gamut leftover unique-cause of srgb-always vs video-gamut rec2020/p3', () => {
    // mcdc-branch-media covers color-gamut srgb/p3/rec2020 on matching env; leftover:
    // srgb is true regardless of env, and video-color-gamut p3-or-rec2020 unique-cause
    assert.equal(MediaParser.evaluate('(color-gamut: srgb)', env({ colorGamut: 'p3' })), true);
    assert.equal(MediaParser.evaluate('(color-gamut: srgb)', env({ colorGamut: 'rec2020' })), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut: srgb)', env({ videoColorGamut: 'p3' })), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut: p3)', env({ videoColorGamut: 'rec2020' })), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut: rec2020)', env({ videoColorGamut: 'p3' })), false);
    assert.equal(MediaParser.evaluate('(video-color-gamut: rec2020)', env({ videoColorGamut: 'srgb' })), false);
  });

  test('custom media leftover of missing map, non-boolean val, valid mediaText, prototype in', () => {
    // mcdc-branch-media covers Map T/F, object boolean/string/mediaText-not-all, missing, {nope}
    assert.equal(evaluateMediaFeature(feature('--x'), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: new Map() })), 'unknown');
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': 1 } })), 'unknown');
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': null } })), 'unknown');
    assert.equal(
      evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': { mediaText: 'screen' } } })),
      true,
    );
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: { '--x': '&test' } })), false);
    const proto = Object.create({ '--x': true }) as Record<string, unknown>;
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: proto })), true);
    assert.equal('--x' in proto, true);
    assert.equal(Object.hasOwn(proto, '--x'), false);
  });

  test('evalNot3 / evalAnd3 / evalOr3 leftover unique-cause of unknown vs bool', () => {
    const unk: GeneralEnclosed = { type: 'general-enclosed', value: [] };
    const tFeat = feature('color', { tokens: [ident('color')] });
    const fFeat = feature('monochrome', { tokens: [ident('monochrome')] });
    const not = (c: MediaCondition['children'][0]): MediaCondition => ({
      type: 'media-condition', operator: 'not', children: [c],
    });
    const and = (...children: MediaCondition['children']): MediaCondition => ({
      type: 'media-condition', operator: 'and', children,
    });
    const or = (...children: MediaCondition['children']): MediaCondition => ({
      type: 'media-condition', operator: 'or', children,
    });
    const e = env();
    // evalNot3: unknown / true / false
    assert.equal(evaluateMediaCondition(not(unk), e), 'unknown');
    assert.equal(evaluateMediaCondition(not(tFeat), e), false);
    assert.equal(evaluateMediaCondition(not(fFeat), e), true);
    // evalAnd3: some false / every true / else unknown
    assert.equal(evaluateMediaCondition(and(tFeat, fFeat), e), false);
    assert.equal(evaluateMediaCondition(and(tFeat, tFeat), e), true);
    assert.equal(evaluateMediaCondition(and(tFeat, unk), e), 'unknown');
    // evalOr3: some true / every false / else unknown
    assert.equal(evaluateMediaCondition(or(fFeat, tFeat), e), true);
    assert.equal(evaluateMediaCondition(or(fFeat, fFeat), e), false);
    assert.equal(evaluateMediaCondition(or(fFeat, unk), e), 'unknown');
    assert.equal(evaluateMediaCondition(or(unk, unk), e), 'unknown');
    // no operator → unknown
    assert.equal(evaluateMediaCondition({ type: 'media-condition', children: [] }, e), 'unknown');
    // via parse boolean context: unknown not/or leftover vs mcdc-branch-media or-true / and-false
    assert.equal(MediaParser.evaluate('not (unknown-feature)'), false);
    assert.equal(MediaParser.evaluate('not (monochrome)'), true);
    assert.equal(MediaParser.evaluate('(monochrome) or (grid)'), false);
    assert.equal(MediaParser.evaluate('(unknown-feature) or (monochrome)'), false);
    assert.equal(MediaParser.evaluate('(monochrome) and (color)'), false);
  });

  test('evaluateMediaQuery leftover of invalid, mediaType all vs env, modifier, comma OR', () => {
    assert.equal(evaluateMediaQuery(query({ invalid: true }), env()), false);
    assert.equal(MediaParser.evaluate('all'), true);
    assert.equal(MediaParser.evaluate('print'), false);
    assert.equal(MediaParser.evaluate('PRINT'), false);
    assert.equal(MediaParser.evaluate('SCREEN'), true);
    assert.equal(MediaParser.evaluate('print', env({ mediaType: 'print' })), true);
    assert.equal(MediaParser.evaluate('not all'), false);
    assert.equal(MediaParser.evaluate('print, screen'), true);
    assert.equal(MediaParser.evaluate('print, print'), false);
    assert.equal(MediaParser.evaluate('&test'), false);
    assert.equal(evaluateMediaQueries([], env()), true);
    assert.equal(
      evaluateMediaQueries([query({ mediaType: 'print' }), query({ mediaType: 'screen' })], env()),
      true,
    );
    assert.equal(evaluateMediaQuery(query({ modifier: 'only', mediaType: 'screen' }), env()), true);
    assert.equal(evaluateMediaQuery(query({ mediaType: 'all', condition: feature('color') }), env()), true);
  });
});
