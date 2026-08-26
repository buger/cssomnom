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
// MC/DC witness (media + parser round): unique-cause rows for
//   - MediaParser.parseMediaConditionWithoutOr res !== null = F
//     (mediaqueries-4 § 3.2 #evaluating-mq-list): a bare `not` at end of
//     input yields a null in-parens parse, degrading the query to not all.
//   - MediaParser.isValidMfValue tokens.length === 0 = T: an empty feature
//     value `(width:)` still parses and evaluates unknown.
//   - MediaParser.matchesType unit === 'x' = T with a non-resolution base
//     (mediaqueries-4 § 6.2 #resolution): the x unit arm.
//   - MediaParser.parseInteger numberType === 'integer' = F: `(color: 3.5)`.
//   - parser.ts handleImportRule urlArg = F (css-syntax-3 § 5.3.1
//     #consume-an-at-rule / css-values-4 #urls): an unquoted url() prelude
//     takes the raw-serialization arm.
//   - parser.ts assembleUnicodeRanges while i < values.length = F exit row:
//     a lone <urange> consumes the whole list and the loop ends by bounds.
//   - SelectorParser parseAnPlusB !t1 = T row (selectors-4 § 8.5
//     #the-anb-type): an empty :nth-child() argument has no leading token.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';
import { parse } from '../src/parser.ts';
import { parseAnPlusB } from '../src/SelectorParser.ts';

describe('MC/DC witness: media feature and import/urange rows', () => {
  // mediaqueries-4 § 3.2: `and not <junk>` returns null from
  // parseMediaInParens (res !== null F) and degrades the query to not all,
  // while `and not (width)` keeps the negated condition (res !== null T).
  test('type-and-not rows for the in-parens null guard', () => {
    const bad = MediaParser.parse('screen and not garbage');
    assert.equal(bad.length, 1);
    assert.equal(serializeMediaQuery(bad[0]), 'not all');
    const good = MediaParser.parse('screen and not (width)');
    assert.equal(good.length, 1);
    assert.notEqual(serializeMediaQuery(good[0]), 'not all');
  });

  // mediaqueries-4 § 6.1: an empty feature value keeps the query parseable
  // (isValidMfValue on the empty token list) and evaluates unknown.
  test('empty media feature value parses and evaluates unknown', () => {
    const queries = MediaParser.parse('(width:)');
    assert.equal(queries.length, 1);
    assert.notEqual(serializeMediaQuery(queries[0]), 'not all');
    assert.equal(MediaParser.evaluate('(width:)'), false);
  });

  // mediaqueries-4 § 6.2: the x unit is resolution-equivalent without a
  // resolution base entry (unit = 'x' = T, unitToBase hit = F).
  test('resolution x unit takes the unit arm', () => {
    assert.equal(MediaParser.evaluate('(min-resolution: 2x)'), false);
    assert.equal(MediaParser.evaluate('(min-resolution: 192dpi)'), false);
  });

  // A non-integer single number fails parseInteger (numberType row F) and
  // evaluates unknown instead of comparing.
  test('non-integer color value evaluates unknown', () => {
    const queries = MediaParser.parse('(color: 3.5)');
    assert.notEqual(serializeMediaQuery(queries[0]), 'not all');
    assert.equal(MediaParser.evaluate('(color: 3.5)'), false);
    assert.equal(MediaParser.evaluate('(color: 3)'), false);
  });

  // css-values-4 #urls: whitespace after `url(` produces a function token
  // whose value holds no string, taking the raw prelude arm (urlArg = F),
  // while the quoted form finds its string argument (urlArg = T).
  test('import url function rows for the string-argument guard', () => {
    const raw = parse('@import url( x.css );');
    assert.equal((raw.cssRules[0] as unknown as { href: string | null }).href, 'x.css');
    const quoted = parse('@import url("y.css");');
    assert.equal((quoted.cssRules[0] as unknown as { href: string | null }).href, 'y.css');
  });

  // css-fonts-4 § 5.1 #unicode-range: a single <urange> consumes the value
  // list and the assembler loop exits on the bounds check.
  test('single unicode-range exits the assembly loop by bounds', () => {
    const sheet = parse('@font-face { unicode-range: U+0-7F; }');
    const rule = sheet.cssRules[0] as unknown as { style: { getPropertyValue(p: string): string } };
    assert.equal(rule.style.getPropertyValue('unicode-range'), 'U+0-7F');
  });

  // selectors-4 § 8.5: a lone "+" prefix leaves no t1 token after the offset,
  // so parseAnPlusB returns null (the !t1 T row) against the odd row.
  test('lone plus prefix leaves no An+B token', () => {
    assert.equal(parseAnPlusB([{ type: 'delim', value: '+' } as never]), null);
    assert.deepEqual(parseAnPlusB([{ type: 'ident', value: 'odd' } as never]), { a: 2, b: 1 });
  });
});
