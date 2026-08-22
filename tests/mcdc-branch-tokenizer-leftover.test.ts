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
// Leftover unique-cause for src/tokenizer.ts + src/AbstractTokenizer.ts ident /
// hash / number / url / unicode-range / escape, not already in
// tests/mcdc-branch-tokenizer*.test.ts. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import type {
  DimensionToken,
  HashToken,
  NumberToken,
  ParseError,
  Token,
  UnicodeRangeToken,
} from '../src/types.ts';

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

function hashOf(css: string): HashToken {
  const t = first(css);
  assert.ok(t.type === 'hash', `expected hash for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

function numberOf(css: string): NumberToken {
  const t = first(css);
  assert.ok(t.type === 'number', `expected number for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

function dimensionOf(css: string): DimensionToken {
  const t = first(css);
  assert.ok(t.type === 'dimension', `expected dimension for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

function urangeOf(css: string): UnicodeRangeToken {
  const t = first(css, true);
  assert.ok(t.type === 'unicode-range', `expected unicode-range for ${JSON.stringify(css)}, got ${t.type}`);
  return t;
}

describe('MC/DC leftover unique-cause: ident (css-syntax-3 § 4.3.4 #consume-ident-like-token, § 4.3.9 #would-start-an-ident-sequence, § 4.3.11 #consume-an-ident-sequence)', () => {
  test('wouldStartIdentSequence unique-cause of dash + ident-start, dash-dash, and neither', () => {
    // cp1 === '-' T, isIdentStart(cp2) T
    assert.equal(first('-foo').type, 'ident');
    assert.equal(first('-foo').value, '-foo');
    assert.equal(first('-_').value, '-_');

    // cp1 === '-' T, cp2 === '-' T (isIdentStart F unique-cause of the OR)
    assert.equal(first('--').type, 'ident');
    assert.equal(first('--x').value, '--x');

    // cp1 === '-' T, both F → not an ident (number or delim)
    assert.equal(first('-1').type, 'number');
    assert.equal(first('-1').value, -1);
    assert.equal(first('-').type, 'delim');
    const dashDot = nonEof('-.');
    assert.deepEqual(dashDot.map((t) => t.type), ['delim', 'delim']);
    assert.deepEqual(dashDot.map((t) => t.value), ['-', '.']);

    // cp1 ident-start (not dash)
    assert.equal(first('foo').type, 'ident');
    assert.equal(first('_foo').type, 'ident');
    assert.equal(first('_').value, '_');

    // ident-code-point continuation unique-cause: digit and dash vs stop
    assert.equal(first('foo1').value, 'foo1');
    assert.equal(first('foo-bar').value, 'foo-bar');
    const dotted = nonEof('foo.bar');
    assert.equal(dotted[0].type, 'ident');
    assert.equal(dotted[0].value, 'foo');
    assert.equal(dotted[1].type, 'delim');
    assert.equal(dotted[1].value, '.');
  });

  test('consumeIdentLikeToken unique-cause of url vs function vs ident', () => {
    // name==='url' T && '(' T
    assert.equal(first('url(x)').type, 'url');
    assert.equal(first('URL(x)').type, 'url');
    assert.equal(first('Url(x)').type, 'url');
    assert.equal(first('uRl(x)').type, 'url');

    // name==='url' T && '(' F
    assert.equal(first('url').type, 'ident');
    assert.equal(first('url').value, 'url');
    const spaced = nonEof('url (x)');
    assert.equal(spaced[0].type, 'ident');
    assert.equal(spaced[0].value, 'url');
    assert.equal(spaced[1].type, 'whitespace');
    assert.equal(spaced[2].type, '(');

    // name==='url' F && '(' T → function
    assert.equal(first('foo(').type, 'function');
    assert.equal(first('foo(').value, 'foo');
    assert.equal(first('urls(').type, 'function');
    assert.equal(first('noturl(').type, 'function');

    // name F && '(' F → ident
    assert.equal(first('foo').type, 'ident');
  });

  test('ident-like extra-whitespace unique-cause before a quoted vs unquoted url', () => {
    // css-syntax-3 § 4.3.4: while whitespace && peek whitespace; then quote → function.
    assert.equal(first('url("x")').type, 'function');
    assert.equal(first("url('x')").type, 'function');
    assert.equal(first('url( "x")').type, 'function');
    assert.equal(first("url( 'x')").type, 'function');
    assert.equal(first('url(  "x")').type, 'function');
    assert.equal(first('url(\t"x")').type, 'function');
    assert.equal(first('url(\n"x")').type, 'function');

    // whitespace T, peek quote F → url token
    assert.equal(first('url( x)').type, 'url');
    assert.equal(first('url( x)').value, 'x');
    assert.equal(first('url(  x)').type, 'url');
    assert.equal(first('url(  x)').value, 'x');

    // whitespace F (no extra ws)
    assert.equal(first('url(x)').type, 'url');
    assert.equal(first('url("x")').type, 'function');
  });

  test('isNonAsciiIdentCodePoint unique-cause inclusive bounds vs just-outside', () => {
    // css-syntax-3 § 4.2 #non-ascii-ident-code-point
    const ident = [
      0x00b7, 0x00c0, 0x00d6, 0x00d8, 0x00f6, 0x00f8, 0x037d, 0x037f, 0x1fff, 0x200c, 0x200d,
      0x203f, 0x2040, 0x2070, 0x218f, 0x2c00, 0x2fef, 0x3001, 0xd7ff, 0xf900, 0xfdcf, 0xfdf0,
      0xfffd, 0x10000,
    ];
    const delim = [
      0x00b6, 0x00bf, 0x00d7, 0x00f7, 0x037e, 0x2000, 0x200e, 0x203e, 0x2041, 0x206f, 0x2190,
      0x2bff, 0x2ff0, 0x3000, 0xf8ff, 0xfdd0, 0xfdef, 0xfffe, 0xffff,
    ];
    for (const cp of ident) {
      const tok = first(String.fromCodePoint(cp));
      assert.equal(tok.type, 'ident', `U+${cp.toString(16).toUpperCase()} should start an ident`);
      assert.equal(tok.value, String.fromCodePoint(cp));
    }
    for (const cp of delim) {
      const tok = first(String.fromCodePoint(cp));
      assert.equal(tok.type, 'delim', `U+${cp.toString(16).toUpperCase()} should be a delim`);
      assert.equal(tok.value, String.fromCodePoint(cp));
    }
  });

  test('consumeIdentSequence escape-in-middle unique-cause of trailing hex whitespace vs continued hex', () => {
    // \20 + space consumes the whitespace; \20bar continues hex through A (0x20BA)
    assert.equal(first('foo\\20 bar').value, 'foo bar');
    assert.equal(first('foo\\20bar').value, `foo${String.fromCodePoint(0x20ba)}r`);
    assert.equal(first('foo\\20z').value, 'foo z');
    assert.equal(first('\\61g').value, 'ag');
    assert.equal(first('\\61g').type, 'ident');

    // reconsume of a following non-ident vs EOF after ident-code-points
    const paren = nonEof('foo(');
    assert.equal(paren[0].type, 'function');
    assert.equal(first('foo').type, 'ident');
  });
});

describe('MC/DC leftover unique-cause: hash (css-syntax-3 § 4.3.1 #consume-token)', () => {
  test('hashType id vs unrestricted leftover ident-start / ident-code-point unique-cause', () => {
    // ident-start after # → id (underscore / non-ascii / dash+ident-start / dash-dash)
    assert.equal(hashOf('#_').hashType, 'id');
    assert.equal(hashOf('#_id').hashType, 'id');
    assert.equal(hashOf('#-_').hashType, 'id');
    assert.equal(hashOf('#--1').hashType, 'id');
    assert.equal(hashOf('#😀').hashType, 'id');
    assert.equal(hashOf('#😀').value, '😀');

    // ident-code-point but not ident-sequence start → unrestricted
    const dashOnly = hashOf('#-');
    assert.equal(dashOnly.hashType, 'unrestricted');
    assert.equal(dashOnly.value, '-');
    assert.equal(hashOf('#0a').hashType, 'unrestricted');
    assert.equal(hashOf('#0a').value, '0a');
    assert.equal(hashOf('#-1a').hashType, 'unrestricted');
    assert.equal(hashOf('#1e2').hashType, 'unrestricted');

    // neither ident-code-point nor valid escape → delim
    const plus = nonEof('#+');
    assert.equal(plus[0].type, 'delim');
    assert.equal(plus[0].value, '#');
    assert.equal(plus[1].type, 'delim');
    const colon = nonEof('#:');
    assert.equal(colon[0].type, 'delim');
    assert.equal(colon[1].type, 'colon');

    // valid escape after # without trailing whitespace (serializer covers \\31 foo)
    const escaped = hashOf('#\\31');
    assert.equal(escaped.hashType, 'id');
    assert.equal(escaped.value, '1');
  });
});

describe('MC/DC leftover unique-cause: number (css-syntax-3 § 4.3.10 #starts-with-a-number, § 4.3.12 #consume-number, § 4.3.3 #consume-numeric-token)', () => {
  test('wouldStartNumber unique-cause leftover of sign+dot and sign+non-digit', () => {
    // serializer leftover file has +.; unique-cause the '-' twin and non-dot false rows
    const minusDot = nonEof('-.');
    assert.deepEqual(minusDot.map((t) => t.value), ['-', '.']);
    assert.ok(minusDot.every((t) => t.type === 'delim'));

    const plusE = nonEof('+e');
    assert.equal(plusE[0].type, 'delim');
    assert.equal(plusE[0].value, '+');
    assert.equal(plusE[1].type, 'ident');

    // '-' + ident-start is ident, not a number (wouldStartNumber F then ident T)
    assert.equal(first('-e').type, 'ident');
    assert.equal(first('-e').value, '-e');

    // sign + digit / sign + dot + digit / bare dot + digit still number
    assert.equal(numberOf('+1').sign, '+');
    assert.equal(numberOf('-1').sign, '-');
    assert.equal(numberOf('-.5').value, -0.5);
    assert.equal(numberOf('+.5').value, 0.5);
    assert.equal(numberOf('.5').value, 0.5);

    // '.' + non-digit already in serializer as .foo; leftover '.' at EOF
    assert.equal(first('.').type, 'delim');
  });

  test('consumeNumber unique-cause of sign, integer digits, decimal without digit, and leftover exponent', () => {
    assert.equal(numberOf('0').value, 0);
    assert.equal(numberOf('00').value, 0);
    assert.equal(numberOf('00').numberType, 'integer');
    assert.equal(numberOf('+0').sign, '+');
    assert.equal(numberOf('-0').sign, '-');
    assert.equal(numberOf('123').value, 123);

    // '.' not followed by a digit is not a decimal (cp==='.' T, isDigit F)
    const oneDot = nonEof('1.');
    assert.ok(oneDot[0].type === 'number');
    assert.equal(oneDot[0].value, 1);
    assert.equal(oneDot[0].numberType, 'integer');
    assert.equal(oneDot[1].type, 'delim');
    assert.equal(oneDot[1].value, '.');

    assert.equal(numberOf('1.0').numberType, 'number');
    assert.equal(numberOf('1.0').value, 1);

    // leftover exponent unique-cause: E+ (serializer has e+ and E-), 1e2e3 unit after exp
    assert.equal(numberOf('1E+2').value, 100);
    assert.equal(numberOf('1e0').value, 1);
    assert.equal(numberOf('1e00').value, 1);
    assert.equal(numberOf('1.5e2').value, 150);
    const eThenUnit = dimensionOf('1e2e3');
    assert.equal(eThenUnit.value, 100);
    assert.equal(eThenUnit.unit, 'e3');

    const eDot = nonEof('1e.');
    assert.ok(eDot[0].type === 'dimension');
    assert.equal(eDot[0].unit, 'e');
    assert.equal(eDot[1].type, 'delim');
  });

  test('consumeNumericToken unique-cause leftover of unit-start dash vs percent vs bare', () => {
    assert.equal(dimensionOf('12px').unit, 'px');
    assert.equal(dimensionOf('12PX').unit, 'PX');

    // wouldStartIdentSequence('-', letter) T → dimension unit
    assert.equal(dimensionOf('12-foo').unit, '-foo');
    assert.equal(dimensionOf('12--').unit, '--');

    // wouldStartIdentSequence('-', digit) F → number then signed number
    const split = nonEof('12-1');
    assert.ok(split[0].type === 'number');
    assert.equal(split[0].value, 12);
    assert.ok(split[1].type === 'number');
    assert.equal(split[1].value, -1);
    assert.equal(split[1].sign, '-');

    assert.equal(first('12%').type, 'percentage');
    assert.equal(first('+1%').type, 'percentage');
    assert.equal(first('.5%').type, 'percentage');
    assert.equal(first('12').type, 'number');

    // escape starts a unit; invalid escape does not
    assert.equal(dimensionOf('12\\25').unit, '%');
    const badEsc = silentErrors('12\\\npx');
    assert.equal(badEsc.tokens[0].type, 'number');
    assert.equal(badEsc.tokens[1].type, 'delim');
    assert.equal(badEsc.tokens[1].value, '\\');
  });
});

describe('MC/DC leftover unique-cause: url (css-syntax-3 § 4.3.6 #consume-url-token, § 4.3.14 #consume-remnants-of-a-bad-url)', () => {
  test('empty url, EOF, and leftover whitespace-then-close unique-cause', () => {
    assert.equal(first('url()').type, 'url');
    assert.equal(first('url()').value, '');
    assert.equal(first('url( )').type, 'url');
    assert.equal(first('url( )').value, '');
    assert.equal(first('url(\t)').type, 'url');
    assert.equal(first('url(\n)').type, 'url');

    const unclosed = silentErrors('url(');
    assert.equal(unclosed.tokens[0].type, 'url');
    assert.equal(unclosed.tokens[0].value, '');
    assert.ok(unclosed.errors.some((e) => e.message.includes('EOF reached before URL')));

    const unclosedWs = silentErrors('url(  ');
    assert.equal(unclosedWs.tokens[0].type, 'url');
    assert.equal(unclosedWs.tokens[0].value, '');
  });

  test('isNonPrintable unique-cause bounds vs whitespace / printable', () => {
    // css-syntax-3 § 4.2 #non-printable-code-point
    // serializer leftover file already hits U+0001 / BEL; leftover inclusive bounds:
    for (const cp of [0x0008, 0x000b, 0x000e, 0x001f, 0x007f]) {
      const { tokens } = silentErrors(`url(${String.fromCodePoint(cp)})`);
      assert.equal(tokens[0].type, 'bad-url', `U+${cp.toString(16)} in url should be bad-url`);
    }
    // unique-cause F: tab/newline/space are whitespace (keep url); '~' / U+0080 printable
    assert.equal(first('url(\tfoo)').type, 'url');
    assert.equal(first('url(\tfoo)').value, 'foo');
    assert.equal(first('url(\nfoo)').type, 'url');
    assert.equal(first('url( ~)').type, 'url');
    assert.equal(first('url( ~)').value, '~');
    assert.equal(first(`url(${String.fromCodePoint(0x80)})`).type, 'url');
  });

  test('url escape leftover unique-cause of hex, space, and remnants-with-EOF', () => {
    assert.equal(first('url(\\a )').type, 'url');
    assert.equal(first('url(\\a )').value, '\n');
    assert.equal(first('url(\\ )').type, 'url');
    assert.equal(first('url(\\ )').value, ' ');
    assert.equal(first('url(\\n)').value, 'n');
    assert.equal(first('url(\\0)').value, '\uFFFD');

    const remnantsEof = silentErrors('url(foo"');
    assert.equal(remnantsEof.tokens[0].type, 'bad-url');
    assert.equal(remnantsEof.tokens[0].value, 'foo');

    const remnantsEsc = silentErrors('url(foo"\\))');
    assert.equal(remnantsEsc.tokens[0].type, 'bad-url');
    assert.equal(remnantsEsc.tokens[0].value, 'foo');
  });
});

describe('MC/DC leftover unique-cause: unicode-range (css-syntax-3 § 4.3.13 #consume-unicode-range-token)', () => {
  test('wouldStartUnicodeRange unique-cause of U/u, plus, question vs hex vs neither', () => {
    // cp1 U vs u vs neither
    assert.equal(first('U+26', true).type, 'unicode-range');
    assert.equal(first('u+26', true).type, 'unicode-range');
    assert.equal(first('u+a', true).type, 'unicode-range');
    assert.equal(first('u+a', true).value, 'U+A');
    const vee = nonEof('V+26', true);
    assert.equal(vee[0].type, 'ident');
    assert.equal(vee[0].value, 'V');
    assert.equal(vee[1].type, 'number');

    // cp2 !== '+' T (L509 leftover: only F was witnessed)
    assert.equal(first('U26', true).type, 'ident');
    assert.equal(first('U26', true).value, 'U26');
    assert.equal(first('U-26', true).type, 'ident');
    assert.equal(first('U-26', true).value, 'U-26');
    const uPlusEof = nonEof('U+', true);
    assert.equal(uPlusEof[0].type, 'ident');
    assert.equal(uPlusEof[0].value, 'U');
    assert.equal(uPlusEof[1].type, 'delim');
    assert.equal(uPlusEof[1].value, '+');

    // cp3 === '?' T vs hex T vs both F
    assert.equal(first('U+?', true).type, 'unicode-range');
    assert.equal(first('U+?', true).value, 'U+0-F');
    assert.equal(first('U+A', true).type, 'unicode-range');
    assert.equal(first('u+0', true).value, 'U+0');
    const gee = nonEof('U+G', true);
    assert.equal(gee[0].type, 'ident');
    assert.equal(gee[1].type, 'delim');
    assert.equal(gee[2].type, 'ident');
    const plusPlus = nonEof('U++', true);
    assert.equal(plusPlus[0].type, 'ident');
    assert.equal(plusPlus[1].type, 'delim');
    assert.equal(plusPlus[2].type, 'delim');
  });

  test('consumeUnicodeRangeToken leftover unique-cause of hex length, questions, and overflow', () => {
    // hex.length < 6 T/F: 1 hex, 6 hex, leftover 7th digit
    assert.equal(urangeOf('U+A').value, 'U+A');
    assert.equal(urangeOf('U+10FFFF').unicodeRangeStart, 0x10ffff);
    const extra = nonEof('U+10FFFF0', true);
    assert.ok(extra[0].type === 'unicode-range');
    assert.equal(extra[0].unicodeRangeStart, 0x10ffff);
    assert.equal(extra[1].type, 'number');
    assert.equal(extra[1].value, 0);

    // 6 hex above U+10FFFF (non-question start overflow)
    assert.equal(first('U+110000', true).type, 'delim');
    assert.equal(first('U+110000', true).value, 'U');
    assert.equal(first('U+ABCDEF', true).type, 'delim');

    // question-mark start > 10FFFF unique-cause (L536 start T; end is also T)
    assert.equal(first('U+11????', true).type, 'delim');
    assert.equal(first('U+11????', true).value, 'U');
    // end > 10FFFF unique-cause with start F (`U+1?????`)
    assert.equal(first('U+1?????', true).type, 'delim');
    // both F
    assert.equal(urangeOf('U+10????').unicodeRangeStart, 0x100000);
    assert.equal(urangeOf('U+10????').unicodeRangeEnd, 0x10ffff);
    assert.equal(first('U+??????', true).type, 'delim');
    const sevenQ = nonEof('U+???????', true);
    assert.equal(sevenQ[0].type, 'delim');
    assert.equal(sevenQ[0].value, 'U');
    assert.equal(sevenQ[1].type, 'delim');
    assert.equal(sevenQ[1].value, '?');

    assert.equal(first('U+A?', true).value, 'U+A0-AF');
    assert.equal(first('U+??', true).value, 'U+0-FF');
    assert.equal(first('U+00000A', true).value, 'U+A');
  });

  test('hyphen range unique-cause of isHexDigit F, end overflow, and end < start', () => {
    // L560: '-' T && isHexDigit T already witnessed; leftover '-' T && isHexDigit F
    const notHex = nonEof('U+26-G', true);
    assert.equal(notHex[0].type, 'unicode-range');
    assert.equal(notHex[0].value, 'U+26');
    assert.equal(notHex[1].type, 'ident');
    assert.equal(notHex[1].value, '-G');

    const dashEof = nonEof('U+26-', true);
    assert.equal(dashEof[0].type, 'unicode-range');
    assert.equal(dashEof[1].type, 'delim');
    assert.equal(dashEof[1].value, '-');

    const dashQ = nonEof('U+26-?', true);
    assert.equal(dashQ[0].type, 'unicode-range');
    assert.equal(dashQ[1].type, 'delim');
    assert.equal(dashQ[2].type, 'delim');

    const dashDash = nonEof('U+26--', true);
    assert.equal(dashDash[0].type, 'unicode-range');
    assert.equal(dashDash[1].type, 'ident');
    assert.equal(dashDash[1].value, '--');

    // L567: end > 10FFFF unique-cause (end < start F)
    assert.equal(first('U+0-110000', true).type, 'delim');
    assert.equal(first('U+0-110000', true).value, 'U');
    assert.equal(first('U+0-ABCDEF', true).type, 'delim');
    // end < start unique-cause (end > 10FFFF F)
    assert.equal(first('U+2F-26', true).type, 'delim');
    // both F
    assert.equal(urangeOf('U+0-10FFFF').unicodeRangeEnd, 0x10ffff);
    assert.equal(urangeOf('U+10FFFF-10FFFF').type, 'unicode-range');
  });
});

describe('MC/DC leftover unique-cause: escape (css-syntax-3 § 4.3.7 #consume-escaped-code-point)', () => {
  test('hex length 3–5 and count<6 && isHexDigit unique-cause leftover', () => {
    // serializer leftover file covers 1-digit \\61 and 6-digit \\000061
    assert.equal(first('\\061').value, 'a');
    assert.equal(first('\\0061').value, 'a');
    assert.equal(first('\\00061').value, 'a');
    assert.equal(first('\\61g').value, 'ag');
    assert.equal(first('\\000061b').value, 'ab');

    // hex class leftover A–F / a–f / 9 vs G
    assert.equal(first('\\A').value, '\n');
    assert.equal(first('\\F').value, '\u000f');
    assert.equal(first('\\a').value, '\n');
    assert.equal(first('\\f').value, '\u000f');
    assert.equal(first('\\9').value, '\t');
    assert.equal(first('\\G').value, 'G');
  });

  test('hex 0 / surrogate / U+10FFFF unique-cause leftover inclusive bounds', () => {
    // serializer leftover file has \\0, \\d800, \\DFFF, \\110000
    // leftover unique-cause just-inside / just-outside those ranges:
    assert.equal(first('\\d7ff').value, String.fromCodePoint(0xd7ff));
    assert.equal(first('\\e000').value, String.fromCodePoint(0xe000));
    assert.equal(first('\\10ffff').value, String.fromCodePoint(0x10ffff));
    assert.equal(first('\\10FFFE').value, String.fromCodePoint(0x10fffe));
    assert.equal(first('\\ABCDEF').value, '\uFFFD');
    assert.equal(first('\\000000').value, '\uFFFD');

    // trailing whitespace leftover: tab (serializer has space and newline)
    assert.equal(first('\\61\tfoo').value, 'afoo');
  });

  test('tokenize errors unique-cause leftover of EOF-in-escape vs invalid-url-escape', () => {
    const eofEsc = silentErrors('12\\');
    assert.ok(eofEsc.tokens[0].type === 'dimension');
    assert.equal(eofEsc.tokens[0].unit, '\uFFFD');
    assert.ok(eofEsc.errors.some((e) => e.message.includes('EOF reached in escape sequence')));

    const badUrlEsc = silentErrors('url(foo\\\n)');
    assert.equal(badUrlEsc.tokens[0].type, 'bad-url');
    assert.ok(badUrlEsc.errors.some((e) => e.message.includes('Invalid escape sequence in URL')));
  });
});
