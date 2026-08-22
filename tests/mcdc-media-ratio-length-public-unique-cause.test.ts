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
// Public-API unique-cause for src/MediaParser.ts parseRatio (L1040) and
// parseLengthToPx (L955 / L989 mathVal && type().length). Drive only
// MediaParser.parse / evaluate / serializeMediaQuery / hasUnknownFeature.
// No constructed MediaFeature tokens, no ParseHooks, no Reflect.
// mediaqueries-4 § 2.1 #mq-syntax / § 3.2 #error-handling / § 4
// #evaluating-features / § 4.1 #mq-min-max / § 6.1 #aspect-ratio /
// § 7.1 #width, css-values-4 § 6 #lengths / § 10.7 #calc-simplification /
// css-typed-om-1 § 4.2 #dom-cssnumericvalue-to.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  hasUnknownFeature,
  serializeMediaQuery,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';

function ser(text: string): string {
  const queries = MediaParser.parse(text);
  assert.equal(queries.length, 1, `expected one query for ${text}`);
  return serializeMediaQuery(queries[0]);
}

function unknown(text: string): boolean {
  return hasUnknownFeature(MediaParser.parse(text)[0]);
}

describe('MC/DC public unique-cause: parseRatio via MediaParser.parse / evaluate', () => {
  test('length-1 number is rewritten to n / 1 then parseRatio TTT (mediaqueries-4 § 6.1 #aspect-ratio)', () => {
    // Colon `2` is rewritten to `2 / 1` before evaluate, so parseRatio sees
    // filtered.length === 3, delim `/`, both numbers — not length === 1.
    assert.equal(ser('(aspect-ratio: 2)'), '(aspect-ratio: 2 / 1)');
    assert.equal(unknown('(aspect-ratio: 2)'), false);
    // DEFAULT 800/600 !== 2/1
    assert.equal(MediaParser.evaluate('(aspect-ratio: 2)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 2)', { aspectRatio: [2, 1] }), true);

    assert.equal(ser('(min-aspect-ratio: 1)'), '(min-aspect-ratio: 1 / 1)');
    assert.equal(unknown('(min-aspect-ratio: 1)'), false);
    // 800/600 >= 1/1
    assert.equal(MediaParser.evaluate('(min-aspect-ratio: 1)'), true);
    assert.equal(MediaParser.evaluate('(min-aspect-ratio: 2)'), false);
  });

  test('length-3 delim `/` both numbers, with and without whitespace', () => {
    // TTT of parseRatio L1047: length === 3 && delim && value === '/'
    assert.equal(unknown('(aspect-ratio: 4/3)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 4/3)'), true);
    assert.equal(unknown('(aspect-ratio: 16/9)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16/9)'), false);
    assert.equal(unknown('(aspect-ratio: 16 / 9)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 / 9)'), false);
    assert.equal(ser('(aspect-ratio: 16 / 9)'), '(aspect-ratio: 16 / 9)');
    // comments are filtered before length/delim checks
    assert.equal(unknown('(aspect-ratio: 16 /*x*/ / 9)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 4 / 3)'), true);

    assert.equal(unknown('(device-aspect-ratio: 4/3)'), false);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio: 4/3)'), true);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio: 16/9)'), false);
    assert.equal(MediaParser.evaluate('(min-aspect-ratio: 4/3)'), true);
    assert.equal(MediaParser.evaluate('(max-aspect-ratio: 4/3)'), true);
  });

  test('right.value === 0 unique-cause: matchesType T, parseRatio returns null → not-all', () => {
    // 0 is a valid ratio operand (mediaqueries-4 § 6.1), so isFeatureUnknown is
    // F and parseRatio runs. right.value === 0 then returns null.
    assert.equal(unknown('(aspect-ratio: 16/0)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16/0)'), false);
    assert.equal(unknown('(aspect-ratio: 16 / 0)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 / 0)'), false);
    assert.equal(unknown('(min-aspect-ratio: 1/0)'), false);
    assert.equal(MediaParser.evaluate('(min-aspect-ratio: 1/0)'), false);
    // non-zero denominator unique-cause F of right.value === 0
    assert.equal(MediaParser.evaluate('(aspect-ratio: 4/3)'), true);
  });

  test('calc operands: matchesType T, left/right type === number F in parseRatio', () => {
    // calc() is a valid ratio operand (number type) so unknown is F, then
    // parseRatio sees function tokens and returns null.
    assert.equal(unknown('(aspect-ratio: calc(16) / calc(9))'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: calc(16) / calc(9))'), false);
    assert.equal(unknown('(aspect-ratio: calc(16) / 9)'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: calc(16) / 9)'), false);
    assert.equal(unknown('(aspect-ratio: 16 / calc(9))'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 / calc(9))'), false);
    // length-1 calc is rewritten to calc / 1, still not a number token
    assert.equal(unknown('(aspect-ratio: calc(16))'), false);
    assert.equal(MediaParser.evaluate('(aspect-ratio: calc(16))'), false);
  });

  test('non-delim middle and length !== 1 and !== 3: matchesType F, parseRatio not entered', () => {
    // These unique-cause matchesType's ratio grammar, not parseRatio L1047 F.
    // isFeatureUnknown returns T first, so parseRatio's length===3 F / delim F
    // / '/' F rows stay unreachable through evaluate().
    assert.equal(unknown('(aspect-ratio: 16 9)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 9)'), false);
    assert.equal(unknown('(aspect-ratio: 16 9 4)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 9 4)'), false);
    assert.equal(unknown('(aspect-ratio: 16 * 9)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio: 16 * 9)'), false);
    assert.equal(unknown('(aspect-ratio: 16 + 9)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio: auto / 9)'), false);
    assert.equal(unknown('(aspect-ratio: auto / 9)'), true);
    assert.equal(unknown('(aspect-ratio: 16 / auto)'), true);
    assert.equal(unknown('(aspect-ratio: 16 / 9 / 1)'), true);
  });
});

describe('MC/DC public unique-cause: parseLengthToPx via MediaParser.parse / evaluate', () => {
  test('dimension px / in / cm unique-cause of the unit switch (mediaqueries-4 § 7.1 #width)', () => {
    assert.equal(unknown('(width: 800px)'), false);
    assert.equal(MediaParser.evaluate('(width: 800px)'), true);
    assert.equal(MediaParser.evaluate('(width: 10px)'), false);

    // 1in = 96px; 1cm = 96/2.54 px. Both are lengths, env width 800 >= both.
    assert.equal(unknown('(min-width: 1in)'), false);
    assert.equal(MediaParser.evaluate('(min-width: 1in)'), true);
    assert.equal(unknown('(min-width: 1cm)'), false);
    assert.equal(MediaParser.evaluate('(min-width: 1cm)'), true);
    assert.equal(MediaParser.evaluate('(width: 1in)'), false);
    assert.equal(MediaParser.evaluate('(width: 1cm)'), false);
    // 800px / 96 = 8.333...in
    assert.equal(MediaParser.evaluate('(width: 8.333333333in)'), true);
  });

  test('number 0 is a length; non-zero number is not (css-values-4 § 6 #lengths)', () => {
    assert.equal(unknown('(width: 0)'), false);
    assert.equal(MediaParser.evaluate('(width: 0)'), false);
    assert.equal(MediaParser.evaluate('(width: 0)', { width: 0 }), true);
    assert.equal(MediaParser.evaluate('(min-width: 0)'), true);
    // non-zero unitless number fails matchesType → parseLengthToPx not entered
    assert.equal(unknown('(width: 1)'), true);
    assert.equal(MediaParser.evaluate('(width: 1)'), false);
  });

  test('calc length T vs calc that is not a length (L989 mathVal && type().length)', () => {
    // mathVal T, type().length T, CSSUnitValue T, to('px') T
    assert.equal(unknown('(width: calc(800px))'), false);
    assert.equal(MediaParser.evaluate('(width: calc(800px))'), true);
    assert.equal(unknown('(width: calc(10px))'), false);
    assert.equal(MediaParser.evaluate('(width: calc(10px))'), false);

    // mathVal T, type().length T, to('px') throws (em does not convert in Typed OM)
    assert.equal(unknown('(width: calc(50em))'), false);
    assert.equal(MediaParser.evaluate('(width: calc(50em))'), false);
    // same unit as dimension *does* convert
    assert.equal(MediaParser.evaluate('(width: 50em)'), true);

    // mathVal T, type().length T, instanceof CSSUnitValue F (mixed units stay a sum)
    assert.equal(unknown('(width: calc(1px + 1em))'), false);
    assert.equal(MediaParser.evaluate('(width: calc(1px + 1em))'), false);
    assert.equal(unknown('(width: min(100px, 1em))'), false);
    assert.equal(MediaParser.evaluate('(width: min(100px, 1em))'), false);

    // calc that is not a length: matchesType F, L989 unique-cause F not entered
    assert.equal(unknown('(width: calc(1deg))'), true);
    assert.equal(MediaParser.evaluate('(width: calc(1deg))'), false);
    assert.equal(unknown('(width: calc(1))'), true);
    assert.equal(MediaParser.evaluate('(width: calc(1))'), false);
    assert.equal(unknown('(width: calc())'), true);
    assert.equal(MediaParser.evaluate('(width: calc())'), false);
  });

  test('ident and unknown function: matchesType F, parseLengthToPx not entered', () => {
    assert.equal(unknown('(width: auto)'), true);
    assert.equal(MediaParser.evaluate('(width: auto)'), false);
    assert.equal(unknown('(width: foo)'), true);
    assert.equal(MediaParser.evaluate('(width: foo)'), false);
    assert.equal(unknown('(min-width: auto)'), true);
  });

  test('default env vs explicit width unique-cause of compare after a parsed length', () => {
    assert.equal(
      MediaParser.evaluate('(width: 400px)', { ...DEFAULT_MEDIA_ENV, width: 400 }),
      true,
    );
    assert.equal(MediaParser.evaluate('(width: 400px)'), false);
    assert.equal(MediaParser.evaluate('(min-width: 10px)'), true);
    assert.equal(MediaParser.evaluate('(max-width: 800px)'), true);
  });
});
