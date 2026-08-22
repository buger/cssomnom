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
// Public-API unique-cause for src/tokenizer.ts reconsume (L93). Drive
// tokenize() / parse() so consume-token reconsumes after peek (css-syntax-3
// § 4.3.1 #consume-token ident / url / numeric). No AbstractTokenizer
// poking, no private pos writes.
// Pairable: pos > 0 T; trail 0xDC00–0xDFFF with matching lead 0xD800–0xDBFF
// (valid UTF-16 pair); trail F via BMP; >= DC00 T && <= DFFF F via U+FFFD /
// U+E000. Unreachable F rows (pos === 0, lone trail) are css-syntax-3 § 3.3
// #input-preprocessing (lone surrogates → U+FFFD) plus reconsume-after-consume.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import { parse } from '../src/parser.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import type { DimensionToken, HashToken, Token } from '../src/types.ts';

function first(css: string): Token {
  const tokens = tokenize(css);
  assert.ok(tokens.length >= 1, `expected a token for ${JSON.stringify(css)}`);
  return tokens[0];
}

function nonEof(css: string): Token[] {
  return tokenize(css).filter((t) => t.type !== 'EOF');
}

function identOf(css: string): Token {
  const t = first(css);
  assert.equal(t.type, 'ident', `expected ident for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

const CP_10000 = String.fromCodePoint(0x10000); // U+D800 U+DC00
const CP_10FFFF = String.fromCodePoint(0x10ffff); // U+DBFF U+DFFF
const CP_D7FF = String.fromCodePoint(0xd7ff);
const CP_E000 = String.fromCodePoint(0xe000);

describe('MC/DC public unique-cause: reconsume trail/lead ANDs via tokenize (css-syntax-3 § 4.3.1)', () => {
  test('ident-start reconsume of a valid surrogate pair (trail T, lead T, pos > 0 T)', () => {
    // consume() of an astral ident-start advances 2 UTF-16 units; reconsume
    // steps onto the trail (0xDC00–0xDFFF) then the lead (0xD800–0xDBFF).
    const minPair = identOf(CP_10000);
    assert.equal(minPair.value, CP_10000);
    assert.equal(minPair.endIndex, 2);

    const maxPair = identOf(CP_10FFFF);
    assert.equal(maxPair.value, CP_10FFFF);
    assert.equal(maxPair.endIndex, 2);

    const emoji = identOf('😀');
    assert.equal(emoji.value, '😀');
    assert.equal(emoji.endIndex, 2);
    assert.equal(identOf('😀x').value, '😀x');

    // pos > 0 T after leading whitespace, not only at the start of input
    const spaced = nonEof(` ${CP_10000}`);
    assert.equal(spaced[0].type, 'whitespace');
    assert.equal(spaced[1].type, 'ident');
    assert.equal(spaced[1].value, CP_10000);
    assert.equal(spaced[1].startIndex, 1);
    assert.equal(spaced[1].endIndex, 3);
  });

  test('ident-start reconsume of BMP: trail F (>= 0xDC00 F), pos > 0 T', () => {
    const ascii = identOf('foo');
    assert.equal(ascii.endIndex, 3);
    assert.equal(ascii.value, 'foo');

    // U+D7FF is ident-start and just below the trail range
    const d7ff = identOf(CP_D7FF);
    assert.equal(d7ff.value, CP_D7FF);
    assert.equal(d7ff.endIndex, 1);
  });

  test('reconsume of U+FFFD / U+E000: >= DC00 T, <= DFFF F', () => {
    // U+FFFD is ident-start (css-syntax-3 § 4.2 #ident-code-point). charCode
    // 0xFFFD > 0xDFFF, so the trail AND's second conjunct is F.
    const fffd = identOf('\uFFFD');
    assert.equal(fffd.type, 'ident');
    assert.equal(fffd.endIndex, 1);
    assert.equal(fffd.value, '\uFFFD');

    // U+E000 is not ident-start. consumeIdentSequence reconsumes it as the
    // first non-ident after `a` (still a BMP code unit > 0xDFFF).
    const e000 = nonEof(`a${CP_E000}`);
    assert.equal(e000[0].type, 'ident');
    assert.equal(e000[0].value, 'a');
    assert.equal(e000[1].type, 'delim');
    assert.equal(e000[1].value, CP_E000);
  });

  test('numeric and ident-like reconsume next to astral vs BMP (css-syntax-3 § 4.3.3 / § 4.3.4)', () => {
    const plus = tokenize(`+12${CP_10000}`);
    assert.equal(plus[0].type, 'dimension');
    assert.equal((plus[0] as DimensionToken).value, 12);
    assert.equal((plus[0] as DimensionToken).unit, CP_10000);

    const minus = tokenize(`-3.5 ${CP_10FFFF}`);
    assert.equal(minus[0].type, 'number');
    assert.equal(minus[0].value, -3.5);
    assert.equal(minus[2].type, 'ident');
    assert.equal(minus[2].value, CP_10FFFF);

    const dot = tokenize(`.25${CP_D7FF}`);
    assert.equal(dot[0].type, 'dimension');
    assert.equal((dot[0] as DimensionToken).unit, CP_D7FF);

    const digit = tokenize(`9${CP_10000}`);
    assert.equal(digit[0].type, 'dimension');
    assert.equal((digit[0] as DimensionToken).unit, CP_10000);

    // `+` then astral is not a number; the `+` branch does not reconsume
    const plusAstral = nonEof(`+${CP_10000}`);
    assert.equal(plusAstral[0].type, 'delim');
    assert.equal(plusAstral[1].type, 'ident');

    assert.equal(identOf('\\61').value, 'a');
    assert.equal(identOf(`\\${CP_10000}`).value, CP_10000);

    const urlAstral = first(`url(${CP_10000})`);
    assert.equal(urlAstral.type, 'url');
    assert.equal(urlAstral.value, CP_10000);

    const hashAstral = first(`#${CP_10000}`);
    assert.equal(hashAstral.type, 'hash');
    assert.equal((hashAstral as HashToken).hashType, 'id');
  });

  test('lone surrogates are preprocessed to U+FFFD so trail-without-lead is unreachable', () => {
    // css-syntax-3 § 3.3: unpaired U+D800–U+DFFF become U+FFFD before tokenize.
    // reconsume therefore never sees a trail unit that is not paired with a lead.
    assert.equal(identOf('\uDC00').value, '\uFFFD');
    assert.equal(identOf('\uDC00').endIndex, 1);
    assert.equal(identOf('\uDFFF').value, '\uFFFD');
    assert.equal(identOf('\uD800').value, '\uFFFD');
    assert.equal(identOf('\uDBFF').value, '\uFFFD');
    assert.equal(identOf('a\uDC00').value, 'a\uFFFD');
    assert.equal(identOf('\uDC00\uD800').value, '\uFFFD\uFFFD');
  });
});

describe('MC/DC public unique-cause: reconsume via parse() of real CSS', () => {
  test('astral type selector / ident declaration / numeric dimension', () => {
    const emoji = parse(`${CP_10000} { color: red; }`);
    assert.equal(emoji.cssRules.length, 1);
    assert.ok(emoji.cssRules[0] instanceof CSSStyleRule);
    assert.equal(emoji.cssRules[0].selectorText, CP_10000);
    assert.equal(emoji.cssRules[0].style.getPropertyValue('color'), 'red');

    const decl = parse(`.a { margin: +10px; width: 9${CP_D7FF}; }`);
    assert.ok(decl.cssRules[0] instanceof CSSStyleRule);
    assert.equal(decl.cssRules[0].style.getPropertyValue('margin'), '10px');

    const hyphenIdent = parse(`.-${CP_10000} { color: navy; }`);
    assert.ok(hyphenIdent.cssRules[0] instanceof CSSStyleRule);
    assert.equal(hyphenIdent.cssRules[0].style.getPropertyValue('color'), 'navy');
  });
});
