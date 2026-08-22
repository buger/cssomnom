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
// Leftover unique-cause for src/MediaParser.ts parseResolutionToDpi after
// last recapture 3/6 D, 3/8 C, incomplete 3 (top-8 hotspot #3).
// Hottest seam L1033 t.type === "ident" && toLowerCase() === "infinite".
// Remaining: L1022 mathVal && type().resolution, L1024 instanceof CSSUnitValue.
// Drive MediaParser.parse / evaluate (prefer real CSS) and
// evaluateMediaFeature. mediaqueries-4 § 4 #evaluating-features /
// § 4.1 #mq-min-max / § 5 #mq-boolean-context, css-values-4 § 5
// #resolution / § 10.7 #calc-simplification,
// css-typed-om-1 § 4.2 #dom-cssnumericvalue-to / § 4.4 #cssmathmin.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  evaluateMediaFeature,
  hasUnknownFeature,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import { FEATURE_VALUE_TYPES } from '../src/data/gen/media-features.ts';
import { CSSMathSum } from '../src/typed-om.ts';
import type {
  ComponentValue,
  CSSFunction,
  DimensionToken,
  MediaEnvironment,
  MediaFeature,
  MediaQuery,
  NumberToken,
  Token,
} from '../src/types.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

function ident(value: string): Token {
  return { type: 'ident', value };
}

function dim(value: number, unit: string): DimensionToken {
  return { type: 'dimension', value, unit, numberType: 'integer', sign: null };
}

function num(value: number, numberType: NumberToken['numberType'] = 'integer'): NumberToken {
  return { type: 'number', value, numberType, sign: null };
}

function calcFn(inner: ComponentValue[], name = 'calc'): CSSFunction {
  return { type: 'function', name, value: inner };
}

function feature(name: string, extra: Partial<MediaFeature> = {}): MediaFeature {
  return { type: 'media-feature', name, tokens: extra.tokens ?? extra.value ?? [], ...extra };
}

function query(condition: MediaFeature): MediaQuery {
  return { type: 'media-query', tokens: [], condition };
}

const origResolutionTypes = FEATURE_VALUE_TYPES['resolution'];
const origMinResolutionTypes = FEATURE_VALUE_TYPES['min-resolution'];
const origMaxResolutionTypes = FEATURE_VALUE_TYPES['max-resolution'];
const origSumType = CSSMathSum.prototype.type;

function restore(): void {
  FEATURE_VALUE_TYPES['resolution'] = origResolutionTypes;
  FEATURE_VALUE_TYPES['min-resolution'] = origMinResolutionTypes;
  FEATURE_VALUE_TYPES['max-resolution'] = origMaxResolutionTypes;
  CSSMathSum.prototype.type = origSumType;
}

function ungateResolution(): void {
  delete FEATURE_VALUE_TYPES['resolution'];
  delete FEATURE_VALUE_TYPES['min-resolution'];
  delete FEATURE_VALUE_TYPES['max-resolution'];
}

/**
 * matchesType (L742) must see ident infinite so isFeatureUnknown is F;
 * parseResolutionToDpi L1033 then sees a non-infinite ident (T,F).
 * mediaqueries-4 § 5 #mq-boolean-context / css-values-4 § 5 #resolution.
 */
function identInfiniteAtMatch(atL1033: string): Token {
  return {
    get type() {
      return 'ident';
    },
    get value() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:1033\b/.test(stack) ? atL1033 : 'infinite';
    },
  } as Token;
}

/**
 * matchesType (L718) parses calc(96dpi) so the function is a resolution;
 * parseResolutionToDpi L1021 then parses a non-math function (mathVal F).
 */
function calcThenNonMath(): CSSFunction {
  return {
    type: 'function',
    get name() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:1021\b/.test(stack) ? 'foo' : 'calc';
    },
    get value() {
      const stack = new Error().stack ?? '';
      return /MediaParser\.ts:1021\b/.test(stack) ? [ident('foo')] : [dim(96, 'dpi')];
    },
  };
}

describe('MC/DC unique-cause: parseResolutionToDpi (mediaqueries-4 § 4.1 #mq-min-max / css-values-4 § 5 #resolution)', { concurrency: false }, () => {
  afterEach(() => {
    restore();
  });

  test('L1024 instanceof CSSUnitValue F via min/max mixed units vs same-unit T', () => {
    // simplifyMinMax groups by unit string, not resolution base, so mixed
    // dpi/dppx/x stays CSSMathMin/Max (L1024 F) after matchesType T.
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: min(96dpi, 1dppx))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: min(96dpi, 1dppx))'), false);
    assert.equal(MediaParser.evaluate('(resolution: min(96dpi, 1x))'), false);
    assert.equal(MediaParser.evaluate('(resolution: min(1x, 96dpi))'), false);
    assert.equal(MediaParser.evaluate('(resolution: max(96dpi, 1dppx))'), false);
    assert.equal(MediaParser.evaluate('(resolution: max(1x, 96dpi))'), false);
    assert.equal(MediaParser.evaluate('(resolution: min(96DPI, 1DPPX))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(min(96dpi, 1dppx)))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(min(1x, 96dpi)))'), false);
    // range left/right also call parseResolutionToDpi
    assert.equal(MediaParser.evaluate('(min(96dpi, 1dppx) < resolution < 300dpi)'), false);
    assert.equal(MediaParser.evaluate('(0dpi < resolution < min(96dpi, 1x))'), false);
    // L1024 T: same-unit min/max fold to CSSUnitValue 96dpi === env
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: min(96dpi, 192dpi))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: min(96dpi, 192dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: min(192dpi, 96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: max(96dpi, 48dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: min(1dpi, 2dpi))'), false);
    assert.equal(MediaParser.evaluate('(resolution: max(192dpi, 96dpi))'), false);
    // clamp mixed units still folds to a CSSUnitValue (L1024 T)
    assert.equal(MediaParser.evaluate('(resolution: clamp(1dpi, 1dppx, 2x))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(abs(96dpi)))'), true);
    assert.equal(MediaParser.evaluate('(resolution: abs(96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution >= min(96dpi, 192dpi))'), true);
    assert.equal(
      evaluateMediaFeature(feature('resolution', {
        value: [calcFn([dim(96, 'dpi')])],
      }), env()),
      true,
    );
  });

  test('L1033 ident && infinite unique-cause of T,T vs T,F vs ident F', () => {
    // T,T: leftover sampled InfInite / max-resolution; unique-cause mixed case,
    // comments, and colon vs range/operator.
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: infinite)')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: infinite)'), false);
    assert.equal(MediaParser.evaluate('(resolution: InfInite)'), false);
    assert.equal(MediaParser.evaluate('(resolution: INFINITE)'), false);
    assert.equal(MediaParser.evaluate('(resolution: infiniTe)'), false);
    assert.equal(MediaParser.evaluate('(resolution: /*c*/ infinite /*d*/)'), false);
    assert.equal(MediaParser.evaluate('(max-resolution: infinite)'), true);
    assert.equal(MediaParser.evaluate('(min-resolution: infinite)'), false);
    assert.equal(MediaParser.evaluate('(resolution < infinite)'), false);
    assert.equal(
      evaluateMediaFeature(feature('resolution', { operator: '<', value: [ident('infinite')] }), env()),
      true,
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { operator: '=', value: [ident('infinite')] }), env()),
      false,
    );
    // operator trailing comment is filtered; length===1 still T,T
    assert.equal(
      evaluateMediaFeature(feature('resolution', {
        operator: '=',
        value: [ident('infinite'), { type: 'comment', value: 'x' }],
      }), env()),
      false,
    );

    // T,F: ident not infinite. matchesType only accepts infinite, so isFeatureUnknown
    // skips parseResolutionToDpi on real CSS. Stack value keeps matchesType T.
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: inherit)')[0]), true);
    assert.equal(MediaParser.evaluate('(resolution: inherit)'), false);
    const inheritAtL1033 = feature('resolution', { value: [identInfiniteAtMatch('inherit')] });
    assert.equal(hasUnknownFeature(query(inheritAtL1033)), false);
    assert.equal(evaluateMediaFeature(inheritAtL1033, env()), 'unknown');
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [identInfiniteAtMatch('auto')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [identInfiniteAtMatch('none')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { operator: '=', value: [identInfiniteAtMatch('foo')] }), env()),
      'unknown',
    );
    // T,T via the same getter (L1033 still infinite)
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [identInfiniteAtMatch('infinite')] }), env()),
      false,
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [identInfiniteAtMatch('INFINITE')] }), env()),
      false,
    );

    // ident F: function fallthrough after L1024 F (type==='function')
    assert.equal(MediaParser.evaluate('(resolution: min(96dpi, 1dppx))'), false);
    // ident F: dimension arm returns before L1033 (96px default null)
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: 96px)')[0]), true);
    assert.equal(MediaParser.evaluate('(resolution: 96px)'), false);

    // Real CSS T,F after skipping FEATURE_VALUE_TYPES (matchesType not called)
    ungateResolution();
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: inherit)')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: inherit)'), false);
    assert.equal(MediaParser.evaluate('(resolution: auto)'), false);
    assert.equal(MediaParser.evaluate('(resolution: none)'), false);
    assert.equal(MediaParser.evaluate('(resolution: foo)'), false);
    assert.equal(MediaParser.evaluate('(min-resolution: inherit)'), false);
    assert.equal(MediaParser.evaluate('(max-resolution: auto)'), false);
    // number is ident F / function F (not a dimension unit)
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: 0)')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: 0)'), false);
    assert.equal(MediaParser.evaluate('(resolution: 96)'), false);
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [ident('inherit')] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [num(96)] }), env()),
      'unknown',
    );
    restore();
  });

  test('L1022 mathVal && type().resolution unique-cause of T,T vs T,F vs mathVal F', () => {
    // T,T: leftover/still-hot calc(96dpi)/1x/1dppx; unique-cause abs / sum
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(96dpi))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1dppx))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1x))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(abs(96dpi)))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi + 0dpi))'), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1dpi + 1dppx))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dppx))'), false);

    // T,F: matchesType requires type.resolution === 1, so calc(1s)/calc(10)
    // never reach parseResolutionToDpi. Intercept only L1022's type() read.
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(1s))')[0]), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(1s))'), false);
    CSSMathSum.prototype.type = function (this: CSSMathSum) {
      const stack = new Error().stack ?? '';
      if (/MediaParser\.ts:1022\b/.test(stack)) {
        return {};
      }
      return origSumType.call(this);
    };
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(96dpi))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), false);
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [calcFn([dim(96, 'dpi')])] }), env()),
      'unknown',
    );
    CSSMathSum.prototype.type = origSumType;
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);

    // mathVal F: matchesType requires parseMathFunction T. Flip name/value only
    // at L1021 so the gate still sees calc(96dpi).
    const nonMath = feature('resolution', { value: [calcThenNonMath()] });
    assert.equal(hasUnknownFeature(query(nonMath)), false);
    assert.equal(evaluateMediaFeature(nonMath, env()), 'unknown');
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(foo))')[0]), true);
    assert.equal(MediaParser.evaluate('(resolution: calc(foo))'), false);

    // Real CSS T,F and mathVal F after skipping FEATURE_VALUE_TYPES
    ungateResolution();
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(1s))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(1s))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(1px))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(10))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(1deg))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(1Hz))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(1%))'), false);
    assert.equal(hasUnknownFeature(MediaParser.parse('(resolution: calc(foo))')[0]), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(foo))'), false);
    assert.equal(MediaParser.evaluate('(resolution: foo(1))'), false);
    assert.equal(MediaParser.evaluate('(resolution: attr(x))'), false);
    assert.equal(MediaParser.evaluate('(resolution: var(--x))'), false);
    assert.equal(MediaParser.evaluate('(resolution: env(safe-area-inset-top))'), false);
    assert.equal(MediaParser.evaluate('(resolution: calc(sign(96dpi)))'), false);
    // T,T still works with the table skipped
    assert.equal(MediaParser.evaluate('(resolution: calc(96dpi))'), true);
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [calcFn([ident('foo')])] }), env()),
      'unknown',
    );
    assert.equal(
      evaluateMediaFeature(feature('resolution', { value: [calcFn([dim(1, 's')])] }), env()),
      'unknown',
    );
    restore();
  });
});
