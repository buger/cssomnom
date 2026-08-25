/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// MC/DC audit round 3, MediaParser unique-cause legs:
//   - x resolution units, empty/blank feature values, spaced and trailing
//     range operators, boolean features with missing environment values,
//     integer-typed features, aspect-ratio ident operands, and 'and' chains
//     ending in garbage (mediaqueries-4 § 3 #media-types, § 5 #mq-syntax,
//     § 6 #features).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  evaluateMediaQueries,
  serializeMediaQuery,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import type { MediaEnvironment } from '../src/types.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

function evalMedia(query: string, e: MediaEnvironment = env()): boolean | 'unknown' {
  return evaluateMediaQueries(MediaParser.parse(query), e);
}

function canon(query: string): string {
  return serializeMediaQuery(MediaParser.parse(query)[0]);
}

describe('MC/DC round 3: MediaParser unique-cause legs', () => {

  // mediaqueries-4 § 6: 'x' is a valid resolution unit distinct from the
  // unitToBase table entries; 1x equals the CSS reference pixel.
  test('resolution accepts x units', () => {
    assert.equal(evalMedia('(resolution: 3x)'), false);
    assert.equal(evalMedia('(resolution: 1x)'), true);
    assert.equal(evalMedia('(min-resolution: 2x)', env({ resolution: 300 })), true);
    assert.equal(evalMedia('(resolution: infinite)'), false);
    assert.equal(evalMedia('(min-resolution: infinite)'), false);
  });

  // mediaqueries-4 § 5: an empty feature value is invalid at parse time, so
  // the query degrades to unknown rather than matching.
  test('empty and malformed feature values stay unknown', () => {
    assert.equal(evalMedia('(width:)'), 'unknown');
    assert.equal(evalMedia('(width >=)'), 'unknown');
    assert.equal(evalMedia('(aspect-ratio: auto)'), 'unknown');
  });

  // mediaqueries-4 § 5: canonical serialization keeps range operators and
  // ratio slashes spaced without doubling whitespace.
  test('canonical serialization operator spacing arms', () => {
    assert.equal(canon('(width >= 100px)'), '(width >= 100px)');
    assert.equal(canon('(width > medium)'), '(width > medium)');
    assert.equal(canon('(width = 100px)'), '(width = 100px)');
    assert.equal(canon('(aspect-ratio: 16/9)'), '(aspect-ratio: 16 / 9)');
    assert.equal(canon('(width: calc(1px + var(--x)))'), '(width: calc(1px + var(--x)))');
    assert.equal(canon('screen and (monochrome)'), 'screen and (monochrome)');
  });

  // mediaqueries-4 § 5: a trailing operator runs off the token list.
  test('range operator end-of-token arm', () => {
    assert.equal(evalMedia('(width > 100px and )'), 'unknown');
  });

  // mediaqueries-4 § 6: boolean context over a feature whose environment
  // entry is absent evaluates the not-all-false rule as false.
  test('missing environment value yields null actual', () => {
    const sparse: MediaEnvironment = { ...DEFAULT_MEDIA_ENV };
    delete (sparse as { monochrome?: number }).monochrome;
    delete (sparse as { color?: number }).color;
    assert.equal(evalMedia('(monochrome)', sparse), false);
    assert.equal(evalMedia('(min-color: 3)', sparse), false);
    assert.equal(evalMedia('(color: 8)', sparse), false);
  });

  // mediaqueries-4 § 6: integer-typed features accept only integral numbers;
  // non-matching operand kinds fall through every type arm.
  test('integer feature values and wrong-type ratio operands', () => {
    assert.equal(evalMedia('(grid: 1)', env({ grid: 1 })), true);
    assert.equal(evalMedia('(grid: 1)'), false);
    assert.equal(evalMedia('(grid: 0)'), true);
    assert.equal(evalMedia('(grid: 1.5)'), 'unknown');
    assert.equal(evalMedia('(grid: wide)'), 'unknown');
  });

  // mediaqueries-4 § 5: an 'and' chain whose tail cannot parse as a
  // condition in parens rejects the whole query list.
  test('and-chain garbage tail leg', () => {
    assert.equal(evalMedia('(width > 100px) and <'), false);
    assert.equal(evalMedia('(width > 100px) and (height > 50px)'), true);
  });

  // mediaqueries-4 § 5: unclosed constructs nested inside balanced wrappers
  // keep queries out of the all-false bucket.
  test('nested unclosed construct guard', () => {
    assert.equal(evalMedia('screen and ((min-width: calc(100px))'), false);
    assert.equal(evalMedia('screen and (min-width: calc(100px + 10px))'), true);
  });
});
