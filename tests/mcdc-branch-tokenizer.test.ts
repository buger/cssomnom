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
// Verifies: SYS-REQ-260821-SBJ7, SW-REQ-260821-7M07
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import type { Token } from '../src/types.ts';

function types(css: string, unicodeRanges = false): string[] {
  return tokenize(css, unicodeRanges).map((t) => t.type);
}

function first(css: string, unicodeRanges = false): Token {
  const tokens = tokenize(css, unicodeRanges);
  assert.ok(tokens.length >= 1);
  return tokens[0];
}

describe('MC/DC branch: tokenizer preprocess', () => {
  test('CR, CRLF, and FF become newlines before tokenization', () => {
    const cr = tokenize('a\rb');
    assert.equal(cr[0].type, 'ident');
    assert.equal(cr[0].value, 'a');
    assert.equal(cr[1].type, 'whitespace');
    assert.equal(cr[2].type, 'ident');
    assert.equal(cr[2].value, 'b');

    const crlf = tokenize('a\r\nb');
    assert.equal(crlf.filter((t) => t.type === 'whitespace').length, 1);
    assert.equal(crlf[2].value, 'b');

    const ff = tokenize('a\fb');
    assert.equal(ff[1].type, 'whitespace');
    assert.equal(ff[2].value, 'b');
  });

  test('NUL and lone surrogates are replaced with U+FFFD', () => {
    const nul = first('a\0b');
    assert.equal(nul.type, 'ident');
    assert.equal(nul.value, 'a\uFFFDb');

    const loneHigh = first('a\uD800b');
    assert.equal(loneHigh.type, 'ident');
    assert.equal(loneHigh.value, 'a\uFFFDb');

    const loneLow = first('a\uDC00b');
    assert.equal(loneLow.type, 'ident');
    assert.equal(loneLow.value, 'a\uFFFDb');
  });

  test('valid surrogate pairs are preserved as one ident code point', () => {
    const ident = first('😀foo');
    assert.equal(ident.type, 'ident');
    assert.equal(ident.value, '😀foo');
    assert.equal(ident.startIndex, 0);
    assert.ok((ident.endIndex ?? 0) > 1);
  });
});

describe('MC/DC branch: tokenizer peek and reconsume of astral code points', () => {
  test('peek skips a 2-unit code point when looking past an emoji ident start', () => {
    // css-syntax-3 § 4.3.11: ident start reconsumes the first code point, which is
    // U+1F600 here, so peek(1) must advance two UTF-16 units.
    const tokens = tokenize('😀x + 1');
    assert.equal(tokens[0].type, 'ident');
    assert.equal(tokens[0].value, '😀x');
    assert.equal(tokens[2].type, 'delim');
    assert.equal(tokens[2].value, '+');
    assert.equal(tokens[4].type, 'number');
    assert.equal(tokens[4].value, 1);
  });

  test('reconsume of an ident-start emoji then consumes the rest of the ident', () => {
    const tokens = tokenize('.😀bar { color: red; }');
    assert.equal(tokens[0].type, 'delim');
    assert.equal(tokens[0].value, '.');
    assert.equal(tokens[1].type, 'ident');
    assert.equal(tokens[1].value, '😀bar');
  });

  test('numeric reconsume after + / - / . still works next to astral idents', () => {
    const plus = tokenize('+12 😀');
    assert.equal(plus[0].type, 'number');
    assert.equal(plus[0].value, 12);
    assert.equal(plus[2].type, 'ident');
    assert.equal(plus[2].value, '😀');

    const minus = tokenize('-3.5 😀x');
    assert.equal(minus[0].type, 'number');
    assert.equal(minus[0].value, -3.5);
    assert.equal(minus[2].type, 'ident');
    assert.equal(minus[2].value, '😀x');

    const dot = tokenize('.25 😀');
    assert.equal(dot[0].type, 'number');
    assert.equal(dot[0].value, 0.25);
    assert.equal(dot[2].type, 'ident');
    assert.equal(dot[2].value, '😀');

    const dim = tokenize('+12😀');
    assert.equal(dim[0].type, 'dimension');
    assert.equal(dim[0].value, 12);
    assert.equal(dim[0].unit, '😀');
  });

  test('string containing an astral character then a newline is a bad-string and reconsumes the newline', () => {
    const tokens = tokenize('"😀\nident');
    assert.equal(tokens[0].type, 'bad-string');
    assert.equal(tokens[1].type, 'whitespace');
    assert.equal(tokens[2].type, 'ident');
    assert.equal(tokens[2].value, 'ident');
  });

  test('ident-like reconsume after a BMP letter still peeks across a following emoji', () => {
    const tokens = tokenize('foo😀bar');
    assert.equal(tokens[0].type, 'ident');
    assert.equal(tokens[0].value, 'foo😀bar');
    assert.equal(tokens[1].type, 'EOF');
  });
});

describe('MC/DC branch: tokenizer consume loop and unicode-range', () => {
  test('empty input yields a single EOF token', () => {
    const tokens = tokenize('');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'EOF');
    assert.equal(tokens[0].startIndex, 0);
    assert.equal(tokens[0].endIndex, 0);
  });

  test('whitespace-only input still terminates at EOF', () => {
    const tokens = tokenize(' \t\n');
    assert.equal(tokens[tokens.length - 1].type, 'EOF');
    assert.ok(tokens.some((t) => t.type === 'whitespace'));
  });

  test('unicode-range mode consumes U+ ranges and does not when disabled', () => {
    const allowed = tokenize('U+26', true);
    assert.equal(allowed[0].type, 'unicode-range');
    assert.equal(String(allowed[0].value).toUpperCase().includes('26'), true);

    const disabled = tokenize('U+26', false);
    assert.equal(disabled[0].type, 'ident');
    assert.equal(disabled[0].value, 'U');
    assert.equal(disabled[1].type, 'number');
  });

  test('hash, CDC, CDO, and function tokens still round-trip through the consume loop', () => {
    assert.deepEqual(types('#id <!-- --> url(x)'), [
      'hash',
      'whitespace',
      'CDO',
      'whitespace',
      'CDC',
      'whitespace',
      'url',
      'EOF',
    ]);
  });
});
