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
// Still-hot unique-cause for src/tokenizer.ts leftovers that
// tests/mcdc-branch-tokenizer.test.ts, tests/mcdc-branch-tokenizer-serializer.test.ts,
// and tests/mcdc-branch-tokenizer-leftover.test.ts do not isolate:
// Tokenizer.reconsume trail/high surrogate ANDs, peek offset/astral/EOF,
// consume BMP vs astral vs EOF, preprocess CR vs CRLF vs surrogate-regex
// leftovers, tokenize() errors optional. Drive public tokenize().
// css-syntax-3 § 3.3 #input-preprocessing / § 4.3.1 #consume-token /
// § 4.3.2 #consume-comments / § 4.3.3 #consume-numeric-token /
// § 4.3.11 #consume-an-ident-sequence.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import type { HashToken, ParseError, Token } from '../src/types.ts';

function first(css: string, unicodeRanges = false): Token {
  const tokens = tokenize(css, unicodeRanges);
  assert.ok(tokens.length >= 1, `expected a token for ${JSON.stringify(css)}`);
  return tokens[0];
}

function nonEof(css: string, unicodeRanges = false): Token[] {
  return tokenize(css, unicodeRanges).filter((t) => t.type !== 'EOF');
}

function silentErrors(css: string, unicodeRanges = false): { tokens: Token[]; errors: ParseError[] } {
  const errors: ParseError[] = [];
  const warn = console.warn;
  console.warn = () => {};
  try {
    const tokens = tokenize(css, unicodeRanges, errors);
    return { tokens, errors };
  } finally {
    console.warn = warn;
  }
}

function identOf(css: string): Token {
  const t = first(css);
  assert.equal(t.type, 'ident', `expected ident for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

function hashOf(css: string): HashToken {
  const t = first(css);
  assert.ok(t.type === 'hash', `expected hash for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

function wsOriginal(css: string): string {
  const ws = tokenize(css).find((t) => t.type === 'whitespace');
  assert.ok(ws, `expected whitespace in ${JSON.stringify(css)}`);
  return ws.originalText ?? '';
}

const CP_10000 = String.fromCodePoint(0x10000); // U+D800 U+DC00
const CP_10FFFF = String.fromCodePoint(0x10ffff); // U+DBFF U+DFFF
const CP_D7FF = String.fromCodePoint(0xd7ff);
const CP_E000 = String.fromCodePoint(0xe000);

describe('MC/DC still-hot unique-cause: preprocess CR/CRLF/FF/NUL (css-syntax-3 § 3.3 #input-preprocessing)', () => {
  test('CR vs CRLF vs LF vs FF unique-cause of the first two replace steps', () => {
    // CRLF T (consumed as one newline). CR-not-LF and LF-not-CR stay independent.
    assert.equal(wsOriginal('a\r\nb'), '\n');
    assert.deepEqual(nonEof('a\r\nb').map((t) => t.type), ['ident', 'whitespace', 'ident']);

    // CR T, LF F: remaining-CR replace. originalText is still one LF.
    assert.equal(wsOriginal('a\rb'), '\n');
    assert.equal(first('a\rb').value, 'a');
    assert.equal(nonEof('a\rb')[2].value, 'b');

    // LF T, CR F: neither CR replace fires.
    assert.equal(wsOriginal('a\nb'), '\n');

    // two CRs (no CRLF pair) collapse into one whitespace token whose originalText is two LFs
    assert.equal(wsOriginal('a\r\rb'), '\n\n');
    // CRLF then leftover CR: first replace eats the pair, second replace eats the extra CR
    assert.equal(wsOriginal('a\r\n\rb'), '\n\n');
    // LF then CR (not a CRLF pair)
    assert.equal(wsOriginal('a\n\rb'), '\n\n');
    // trailing / leading CR
    assert.equal(wsOriginal('a\r').length, 1);
    assert.equal(wsOriginal('\rb'), '\n');

    // FF T independently of CR (third replace)
    assert.equal(wsOriginal('a\fb'), '\n');
    assert.equal(wsOriginal('a\f\rb'), '\n\n');
    assert.equal(wsOriginal('a\r\fb'), '\n\n');
    // neither CR nor FF: tab is already CSS whitespace (not rewritten)
    assert.equal(wsOriginal('a\tb'), '\t');
  });

  test('NUL unique-cause of start / middle / end / consecutive vs no-NUL', () => {
    assert.equal(identOf('\0').value, '\uFFFD');
    assert.equal(identOf('\0').originalText, '\uFFFD');
    assert.equal(identOf('a\0b').value, 'a\uFFFDb');
    assert.equal(identOf('a\0').value, 'a\uFFFD');
    assert.equal(identOf('\0\0').value, '\uFFFD\uFFFD');
    assert.equal(identOf('ab').value, 'ab');
  });
});

describe('MC/DC still-hot unique-cause: preprocess surrogate regex (css-syntax-3 § 3.3 #input-preprocessing)', () => {
  test('lone high / lone low inclusive bounds vs valid pair vs just-outside', () => {
    // First alternative T: lone high U+D800 / U+DBFF inclusive → U+FFFD ident
    assert.equal(identOf('\uD800').value, '\uFFFD');
    assert.equal(identOf('\uDBFF').value, '\uFFFD');
    assert.equal(identOf('a\uD800b').value, 'a\uFFFDb');
    assert.equal(identOf('\uD800z').value, '\uFFFDz');
    assert.equal(identOf('z\uDBFF').value, 'z\uFFFD');

    // First alternative F just-outside: U+D7FF is an ident code point (kept)
    assert.equal(identOf(CP_D7FF).value, CP_D7FF);
    assert.equal(identOf(`a${CP_D7FF}b`).value, `a${CP_D7FF}b`);

    // Second alternative T: lone low U+DC00 / U+DFFF inclusive → U+FFFD ident
    assert.equal(identOf('\uDC00').value, '\uFFFD');
    assert.equal(identOf('\uDFFF').value, '\uFFFD');
    assert.equal(identOf('a\uDC00b').value, 'a\uFFFDb');
    assert.equal(identOf('\uDFFFz').value, '\uFFFDz');

    // Second alternative F just-outside: U+E000 is a delim (not ident)
    assert.equal(first(CP_E000).type, 'delim');
    assert.equal(first(CP_E000).value, CP_E000);
    const around = nonEof(`a${CP_E000}b`);
    assert.equal(around[0].value, 'a');
    assert.equal(around[1].type, 'delim');
    assert.equal(around[2].value, 'b');

    // Both alternatives F: valid pair at inclusive UTF-16 ends
    assert.equal(identOf(CP_10000).value, CP_10000);
    assert.equal(identOf(CP_10FFFF).value, CP_10FFFF);
    assert.equal(identOf(`a${CP_10000}b`).value, `a${CP_10000}b`);
    assert.equal(identOf('😀').value, '😀');

    // Adjacent lone surrogates (low-then-high / high-high / low-low)
    assert.equal(identOf('\uDC00\uD800').value, '\uFFFD\uFFFD');
    assert.equal(identOf('\uD800\uD800').value, '\uFFFD\uFFFD');
    assert.equal(identOf('\uDC00\uDC00').value, '\uFFFD\uFFFD');

    // Valid pair then lone high; lone high then valid pair
    assert.equal(identOf(`${CP_10000}\uD800`).value, `${CP_10000}\uFFFD`);
    assert.equal(identOf(`\uD800${CP_10000}`).value, `\uFFFD${CP_10000}`);
  });
});

describe('MC/DC still-hot unique-cause: consume BMP vs astral vs EOF (src/tokenizer.ts consume / cp)', () => {
  test('endIndex unique-cause of cp > 0xFFFF vs BMP vs EOF no-advance', () => {
    // BMP: advance 1. Empty: consume EOF does not move pos (startIndex === endIndex).
    const empty = tokenize('');
    assert.equal(empty.length, 1);
    assert.equal(empty[0].type, 'EOF');
    assert.equal(empty[0].startIndex, 0);
    assert.equal(empty[0].endIndex, 0);

    const bmp = identOf('a');
    assert.equal(bmp.startIndex, 0);
    assert.equal(bmp.endIndex, 1);
    assert.equal(bmp.originalText, 'a');
    assert.equal(tokenize('a')[1].type, 'EOF');
    assert.equal(tokenize('a')[1].startIndex, 1);
    assert.equal(tokenize('a')[1].endIndex, 1);

    // Astral ident-start: consume advances 2 UTF-16 units.
    const astral = identOf(CP_10000);
    assert.equal(astral.startIndex, 0);
    assert.equal(astral.endIndex, 2);
    assert.equal(astral.originalText, CP_10000);

    const maxAstral = identOf(CP_10FFFF);
    assert.equal(maxAstral.endIndex, 2);
    assert.equal(maxAstral.originalText, CP_10FFFF);

    const emoji = identOf('😀');
    assert.equal(emoji.endIndex, 2);

    // Mixed: BMP then astral then BMP in one ident
    const mixed = identOf(`a${CP_10000}b`);
    assert.equal(mixed.endIndex, 4);
    assert.equal(mixed.value, `a${CP_10000}b`);

    // Two astrals
    const two = identOf(`${CP_10000}${CP_10FFFF}`);
    assert.equal(two.endIndex, 4);

    // Lone high becomes BMP U+FFFD (advance 1, not 2)
    const lone = identOf('\uD800');
    assert.equal(lone.endIndex, 1);
    assert.equal(lone.originalText, '\uFFFD');
  });
});

describe('MC/DC still-hot unique-cause: peek offset / astral skip / EOF (src/tokenizer.ts peek)', () => {
  test('hash peek(1)/peek(2) unique-cause of astral skip vs BMP skip vs EOF', () => {
    // After `#`, consume-token always evaluates peek(1) and peek(2)
    // (wouldStartIdentSequence args). css-syntax-3 § 4.3.1 hash branch.

    // peek(1) skips an astral at pos (cp > 0xFFFF T), then a following BMP
    const astralBmp = hashOf(`#${CP_10000}x`);
    assert.equal(astralBmp.hashType, 'id');
    assert.equal(astralBmp.value, `${CP_10000}x`);
    assert.equal(astralBmp.endIndex, 4);

    // peek(1) skips a BMP (cp > 0xFFFF F), peek(2) then skips an astral
    const bmpAstral = hashOf(`#a${CP_10000}`);
    assert.equal(bmpAstral.hashType, 'id');
    assert.equal(bmpAstral.value, `a${CP_10000}`);
    assert.equal(bmpAstral.endIndex, 4);

    // peek(2) skips two BMPs
    const twoBmp = hashOf('#ab');
    assert.equal(twoBmp.value, 'ab');
    assert.equal(twoBmp.endIndex, 3);

    // peek(2) skips two astrals
    const twoAstral = hashOf(`#${CP_10000}${CP_10FFFF}`);
    assert.equal(twoAstral.value, `${CP_10000}${CP_10FFFF}`);
    assert.equal(twoAstral.endIndex, 5);

    // peek(2) after skipping an astral hits EOF (index >= length T on 2nd iter)
    const astralEof = hashOf(`#${CP_10000}`);
    assert.equal(astralEof.value, CP_10000);
    assert.equal(astralEof.endIndex, 3);
    assert.equal(tokenize(`#${CP_10000}`)[1].type, 'EOF');

    // peek(2) after skipping a BMP hits EOF
    const bmpEof = hashOf('#a');
    assert.equal(bmpEof.value, 'a');
    assert.equal(bmpEof.endIndex, 2);

    // peek(1) at EOF: bare `#` (index >= length T on 1st iter) is delim
    const bare = nonEof('#');
    assert.equal(bare[0].type, 'delim');
    assert.equal(bare[0].value, '#');
    assert.equal(bare[0].endIndex, 1);

    // inclusive high/low of a valid pair after `#`
    assert.equal(hashOf(`#${CP_10FFFF}`).value, CP_10FFFF);
    assert.equal(hashOf(`#${CP_D7FF}`).hashType, 'id');
    assert.equal(first(`#${CP_E000}`).type, 'delim');
  });

  test('@ / + / comment peek unique-cause of astral vs BMP vs EOF', () => {
    // @-keyword: same peek(1)/peek(2) argument evaluation after `@`
    assert.equal(first(`@${CP_10000}`).type, 'at-keyword');
    assert.equal(first(`@${CP_10000}`).value, CP_10000);
    assert.equal(first(`@${CP_10000}x`).value, `${CP_10000}x`);
    assert.equal(first('@').type, 'delim');
    assert.equal(first('@a').type, 'at-keyword');

    // `+` then peek(1): digit T vs astral F vs EOF F
    assert.equal(first('+1').type, 'number');
    assert.equal(first(`+${CP_10000}`).type, 'delim');
    assert.equal(first(`+${CP_10000}`).value, '+');
    assert.equal(nonEof(`+${CP_10000}`)[1].type, 'ident');
    assert.equal(first('+').type, 'delim');

    // comment: `/` && peek(1) === `*` unique-cause
    assert.equal(tokenize('/**/')[0].type, 'EOF');
    assert.equal(first('/').type, 'delim');
    assert.equal(first('/a').type, 'delim');
    const slashAstral = nonEof(`/${CP_10000}`);
    assert.equal(slashAstral[0].type, 'delim');
    assert.equal(slashAstral[0].value, '/');
    assert.equal(slashAstral[1].type, 'ident');
    assert.equal(slashAstral[1].value, CP_10000);

    // consecutive comments: outer while T then F. Inner `*` not `/` continues.
    assert.equal(tokenize('/**//**/a')[0].type, 'ident');
    assert.equal(tokenize('/**//**/a')[0].value, 'a');
    assert.equal(tokenize('/* *x */a')[0].value, 'a');
    assert.equal(tokenize(`/*${CP_10000}*/a`)[0].value, 'a');
  });

  test('CDO peek(2) unique-cause of BMP skips vs astral in the looked-ahead slots', () => {
    // css-syntax-3 § 4.3.1: after `<`, cp === '!' && peek(1) === '-' && peek(2) === '-'
    assert.equal(first('<!--').type, 'CDO');
    assert.equal(first('<!--').endIndex, 4);

    // peek(1) F (not `-`): `<!😀.` stays delims. peek(2) is short-circuit skipped.
    // Use `.` not `-` so the astral is not an ident-continuation of `-`.
    const bangAstral = nonEof(`<!${CP_10000}.`);
    assert.deepEqual(bangAstral.map((t) => t.type), ['delim', 'delim', 'ident', 'delim']);
    assert.equal(bangAstral[2].value, CP_10000);

    // peek(1) T, peek(2) F: third code point is astral, so not CDO. `-` + ident-start
    // then reconsumes as an ident (css-syntax-3 § 4.3.1 hyphen branch).
    const dashAstral = nonEof(`<!-${CP_10000}.`);
    assert.deepEqual(dashAstral.map((t) => t.type), ['delim', 'delim', 'ident', 'delim']);
    assert.equal(dashAstral[2].value, `-${CP_10000}`);

    // peek(2) F with a non-ident after `-` (four delims, still not CDO)
    assert.deepEqual(nonEof('<!-.').map((t) => t.value), ['<', '!', '-', '.']);

    // peek(2) at EOF after `<!-`
    const almost = nonEof('<!-');
    assert.deepEqual(almost.map((t) => t.value), ['<', '!', '-']);
  });
});

describe('MC/DC still-hot unique-cause: reconsume trail/high surrogate ANDs (src/tokenizer.ts reconsume)', () => {
  test('ident-start reconsume unique-cause of trail surrogate inclusive bounds vs BMP', () => {
    // css-syntax-3 § 4.3.1: ident-start is consumed then reconsumed.
    // Trail-surrogate AND T,T,T: valid pair at inclusive UTF-16 ends.
    // prevCodeUnit is then the matching high (D800 / DBFF inclusive).
    const minPair = identOf(CP_10000);
    assert.equal(minPair.value, CP_10000);
    assert.equal(minPair.endIndex, 2);
    const maxPair = identOf(CP_10FFFF);
    assert.equal(maxPair.value, CP_10FFFF);
    assert.equal(maxPair.endIndex, 2);
    assert.equal(identOf('😀x').value, '😀x');

    // codeUnit >= DC00 F: BMP ident-start (U+D7FF just-outside the trail range)
    const d7ff = identOf(CP_D7FF);
    assert.equal(d7ff.value, CP_D7FF);
    assert.equal(d7ff.endIndex, 1);

    // ASCII BMP reconsume
    const ascii = identOf('foo');
    assert.equal(ascii.endIndex, 3);

    // codeUnit >= DC00 T, <= DFFF F: reconsume of U+E000 is not ident-start
    // (consume-token default delim; no ident reconsume). Ident then U+E000
    // reconsumes the delim via consumeIdentSequence (still a BMP, not a trail).
    const e000 = nonEof(`a${CP_E000}`);
    assert.equal(e000[0].type, 'ident');
    assert.equal(e000[0].value, 'a');
    assert.equal(e000[1].type, 'delim');
    assert.equal(e000[1].value, CP_E000);

    // U+FFFD (replacement, 0xFFFD > DFFF) reconsume as ident-start
    const fffd = identOf('\uFFFD');
    assert.equal(fffd.type, 'ident');
    assert.equal(fffd.endIndex, 1);

    // pos > 0 T after leading whitespace (not only at the start of input)
    const spaced = nonEof(` ${CP_10000}`);
    assert.equal(spaced[0].type, 'whitespace');
    assert.equal(spaced[1].type, 'ident');
    assert.equal(spaced[1].value, CP_10000);
    assert.equal(spaced[1].startIndex, 1);
    assert.equal(spaced[1].endIndex, 3);

    // pos > 0 F and prevCodeUnit F rows are unreachable through tokenize():
    // reconsume always follows consume of a non-EOF code point, and § 3.3
    // preprocess replaces lone surrogates so a trail is only ever preceded
    // by its high pair. Left mute. No //mcdc:ignore.
  });

  test('numeric and ident-like reconsume unique-cause next to astral vs BMP', () => {
    // `+` / `-` / `.` / digit consume then reconsume before consumeNumericToken
    const plus = tokenize(`+12${CP_10000}`);
    assert.equal(plus[0].type, 'dimension');
    assert.equal(plus[0].value, 12);
    assert.equal(plus[0].unit, CP_10000);
    assert.equal(plus[0].endIndex, 5);

    const minus = tokenize(`-3.5 ${CP_10FFFF}`);
    assert.equal(minus[0].type, 'number');
    assert.equal(minus[0].value, -3.5);
    assert.equal(minus[2].type, 'ident');
    assert.equal(minus[2].value, CP_10FFFF);

    const dot = tokenize(`.25${CP_D7FF}`);
    assert.equal(dot[0].type, 'dimension');
    assert.equal(dot[0].unit, CP_D7FF);

    const digit = tokenize(`9${CP_10000}`);
    assert.equal(digit[0].type, 'dimension');
    assert.equal(digit[0].unit, CP_10000);

    // `+` then astral is not a number (peek(1) astral); reconsume is not taken
    const plusAstral = nonEof(`+${CP_10000}`);
    assert.equal(plusAstral[0].type, 'delim');
    assert.equal(plusAstral[1].type, 'ident');

    // backslash ident: consume `\`, reconsume, consumeIdentLikeToken
    assert.equal(identOf('\\61').value, 'a');
    assert.equal(identOf(`\\${CP_10000}`).value, CP_10000);

    // string newline reconsume after an astral (bad-string); newline is BMP
    const bad = silentErrors(`"${CP_10000}\nident`);
    assert.equal(bad.tokens[0].type, 'bad-string');
    assert.equal(bad.tokens[0].value, CP_10000);
    assert.equal(bad.tokens[1].type, 'whitespace');
    assert.equal(bad.tokens[2].type, 'ident');
    assert.equal(bad.tokens[2].value, 'ident');
  });
});

describe('MC/DC still-hot unique-cause: tokenize() errors optional and consume loop', () => {
  test('errors omitted vs provided unique-cause of the exported tokenize push', () => {
    // F: no errors array. Still tokenizes; parseError only console.warns.
    const warn = console.warn;
    const warned: string[] = [];
    console.warn = (msg: string) => {
      warned.push(String(msg));
    };
    try {
      const tokens = tokenize('/*');
      assert.equal(tokens[tokens.length - 1].type, 'EOF');
      assert.ok(warned.some((m) => m.includes('EOF reached before comment was closed')));
    } finally {
      console.warn = warn;
    }

    // T: errors array is mutated. Prefilled entries stay (push, not assign).
    const prefilled: ParseError[] = [{ message: 'keep' }];
    const withErr = silentErrors('/*');
    assert.ok(withErr.errors.some((e) => e.message.includes('EOF reached before comment was closed')));
    const warn2 = console.warn;
    console.warn = () => {};
    try {
      const reused = tokenize('\\', false, prefilled);
      assert.equal(reused[0].type, 'ident');
    } finally {
      console.warn = warn2;
    }
    assert.equal(prefilled[0].message, 'keep');
    assert.ok(prefilled.some((e) => e.message.includes('EOF reached in escape sequence')));

    // unicodeRangesAllowed default (second arg omitted) vs explicit
    assert.equal(tokenize('U+26')[0].type, 'ident');
    assert.equal(tokenize('U+26', false)[0].type, 'ident');
    assert.equal(tokenize('U+26', true)[0].type, 'unicode-range');
  });

  test('consume-token loop unique-cause of empty / one / many before EOF', () => {
    assert.equal(tokenize('').length, 1);
    assert.equal(tokenize('a').length, 2);
    const many = tokenize('#id + 1');
    assert.ok(many.length > 2);
    assert.equal(many[many.length - 1].type, 'EOF');
    // whitespace-only still emits a token then EOF (loop continue then break)
    const ws = tokenize('\t');
    assert.equal(ws[0].type, 'whitespace');
    assert.equal(ws[1].type, 'EOF');
  });
});
