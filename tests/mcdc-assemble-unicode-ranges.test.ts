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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SW-REQ-260821-HHVE
// MC/DC unique-cause rows for src/parser.ts assembleUnicodeRanges (css-syntax-3
// #urange / #consume-unicode-range-token, css-fonts-4 #unicode-range-desc).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assembleUnicodeRanges,
  isValidUnicodeRangeValue,
  parse,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { serialize } from '../src/serializer.ts';
import { CSSFontFaceRule } from '../src/CSSOM.ts';
import type { ComponentValue, Token } from '../src/types.ts';

function toks(css: string, unicodeRanges = true): ComponentValue[] {
  return tokenize(css, unicodeRanges).filter((t) => t.type !== 'EOF');
}

function assembled(css: string, unicodeRanges = true): string | null {
  const result = assembleUnicodeRanges(toks(css, unicodeRanges));
  return result === null ? null : serialize(result);
}

function assembledFrom(values: ComponentValue[]): string | null {
  const result = assembleUnicodeRanges(values);
  return result === null ? null : serialize(result);
}

function faceRange(value: string): string {
  const sheet = parse(`@font-face { unicode-range: ${value}; font-family: X; src: url(x); }`);
  assert.ok(sheet.cssRules[0] instanceof CSSFontFaceRule);
  return (sheet.cssRules[0] as CSSFontFaceRule).style.getPropertyValue('unicode-range');
}

function setFaceRange(value: string): string {
  const sheet = parse('@font-face { font-family: X; src: url(x); }');
  const face = sheet.cssRules[0] as CSSFontFaceRule;
  face.style.setProperty('unicode-range', value);
  return face.style.getPropertyValue('unicode-range');
}

function ident(value: string): Token {
  return { type: 'ident', value };
}

function delim(value: string): Token {
  return { type: 'delim', value };
}

function comma(): Token {
  return { type: 'comma', value: ',' };
}

function ws(value = ' '): Token {
  return { type: 'whitespace', value };
}

function comment(value = 'x'): Token {
  return { type: 'comment', value };
}

function num(value: number, sign: '+' | '-' | null = null): Token {
  return { type: 'number', value, numberType: 'integer', sign };
}

function dim(value: number, unit: string, sign: '+' | '-' | null = null): Token {
  return { type: 'dimension', value, unit, numberType: 'integer', sign };
}

function urangeTok(value: string, start: number, end = start): Token {
  return { type: 'unicode-range', value, unicodeRangeStart: start, unicodeRangeEnd: end };
}

describe('MC/DC assembleUnicodeRanges: @font-face / setProperty', () => {
  test('valid single U+ hex range is kept (unicode-range token path)', () => {
    assert.equal(faceRange('U+26').trim(), 'U+26');
    assert.equal(setFaceRange('U+26'), 'U+26');
    assert.equal(faceRange('u+a').trim(), 'U+A');
    assert.equal(setFaceRange('U+10FFFF'), 'U+10FFFF');
    assert.equal(isValidUnicodeRangeValue(toks('U+26')), true);
  });

  test('valid U+start-end range serializes trimmed hex', () => {
    assert.equal(faceRange('U+0025-00FF').trim(), 'U+25-FF');
    assert.equal(setFaceRange('U+0025-00FF'), 'U+25-FF');
    assert.equal(faceRange('U+0-7F').trim(), 'U+0-7F');
    assert.equal(setFaceRange('U+0-10FFFF'), 'U+0-10FFFF');
  });

  test('wildcard ? ranges expand to start-end', () => {
    assert.equal(faceRange('U+4??').trim(), 'U+400-4FF');
    assert.equal(setFaceRange('U+4??'), 'U+400-4FF');
    assert.equal(faceRange('U+??').trim(), 'U+0-FF');
    assert.equal(setFaceRange('U+?'), 'U+0-F');
    assert.equal(faceRange('U+10????').trim(), 'U+100000-10FFFF');
    assert.equal(setFaceRange('U+ABC??'), 'U+ABC00-ABCFF');
  });

  test('multiple comma-separated ranges and surrounding whitespace', () => {
    assert.equal(faceRange('U+26, U+27').trim(), 'U+26, U+27');
    assert.equal(setFaceRange('U+26, U+27'), 'U+26,U+27');
    assert.equal(setFaceRange('  U+A  '), 'U+A');
    assert.equal(setFaceRange('U+26,U+4??,U+0-7F'), 'U+26,U+400-4FF,U+0-7F');
    assert.equal(faceRange('U+26 , U+27').includes('U+26'), true);
    assert.equal(faceRange('U+26 , U+27').includes('U+27'), true);
  });

  test('invalid values are dropped; setProperty is a no-op on junk', () => {
    assert.equal(faceRange('not-a-range'), '');
    assert.equal(faceRange('U+26,'), '');
    assert.equal(faceRange('U+26 U+27'), '');
    assert.equal(faceRange('U+110000'), '');
    assert.equal(faceRange('U+2F-26'), '');
    assert.equal(faceRange('U+1?????'), '');
    assert.equal(faceRange('U+G'), '');
    const sheet = parse('@font-face { font-family: X; src: url(x); unicode-range: U+26; }');
    const face = sheet.cssRules[0] as CSSFontFaceRule;
    assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+26');
    face.style.setProperty('unicode-range', 'bogus');
    assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+26');
    face.style.setProperty('unicode-range', 'U+26,');
    assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+26');
    assert.equal(isValidUnicodeRangeValue(toks('not-a-range')), false);
  });
});

describe('MC/DC assembleUnicodeRanges: leading skip / empty', () => {
  // D1 i<length && (ws || comment); D2 i>=length
  test('empty and whitespace/comment-only values return null', () => {
    assert.equal(assembleUnicodeRanges([]), null);
    assert.equal(assembled('   '), null);
    assert.equal(assembledFrom([ws(), ws('\t')]), null);
    assert.equal(assembledFrom([comment()]), null);
    assert.equal(assembledFrom([ws(), comment(' leading '), ws()]), null);
  });

  test('leading whitespace and comments are skipped before a valid range', () => {
    assert.equal(assembled('  U+26  '), 'U+26');
    assert.equal(assembledFrom([comment(), urangeTok('U+26', 0x26)]), 'U+26');
    assert.equal(assembledFrom([ws(), comment(), ws(), urangeTok('U+A', 0xa), comment()]), 'U+A');
  });
});

describe('MC/DC assembleUnicodeRanges: token kind dispatch', () => {
  // D4 unicode-range vs D5 ident&&(u||u+) vs else
  test('unicode-range tokens pass through unchanged', () => {
    assert.equal(assembled('U+26', true), 'U+26');
    assert.equal(assembledFrom([urangeTok('U+25-FF', 0x25, 0xff)]), 'U+25-FF');
  });

  test('bare ident u / U starts reconstruction; ident U+hex uses the u+ branch', () => {
    assert.equal(assembledFrom([ident('u'), delim('+'), ident('A')]), 'U+A');
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('ABC')]), 'U+ABC');
    assert.equal(assembledFrom([ident('U+26')]), 'U+26');
    assert.equal(assembledFrom([ident('u+4')]), 'U+4');
    assert.equal(assembledFrom([ident('U+26-FF')]), 'U+26-FF');
  });

  test('non-ident and non-u idents are invalid', () => {
    assert.equal(assembledFrom([ident('foo')]), null);
    assert.equal(assembledFrom([ident('urange')]), null);
    assert.equal(assembledFrom([ident('u-')]), null);
    assert.equal(assembledFrom([delim('U')]), null);
    assert.equal(assembledFrom([{ type: 'function', value: 'u' }]), null);
    assert.equal(assembledFrom([num(26, '+')]), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), { type: 'EOF', value: '' }]), null);
  });
});

describe('MC/DC assembleUnicodeRanges: U + plus reconstruction', () => {
  // D7 comments after U; D8 delim '+'; D10 number/dimension with sign '+'; D11 hasPlus
  test('missing plus after U is invalid', () => {
    assert.equal(assembledFrom([ident('U')]), null);
    assert.equal(assembledFrom([ident('u')]), null);
    assert.equal(assembledFrom([ident('U'), delim('-')]), null);
    assert.equal(assembledFrom([ident('U'), ident('A')]), null);
    assert.equal(assembledFrom([ident('U'), num(26, null)]), null);
    assert.equal(assembledFrom([ident('U'), dim(10, 'px', null)]), null);
    assert.equal(assembled('U +26', false), null);
    assert.equal(assembled('U+ 26', false), null);
  });

  test('delim plus after U, including comments around plus', () => {
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('A')]), 'U+A');
    assert.equal(assembledFrom([ident('U'), comment(), delim('+'), ident('A')]), 'U+A');
    assert.equal(assembledFrom([ident('U'), delim('+'), comment(), ident('A')]), 'U+A');
    assert.equal(assembledFrom([ident('U'), comment(), delim('+'), comment(), ident('FF')]), 'U+FF');
    assert.equal(assembledFrom([ident('U'), delim('+')]), null);
  });

  test('number or dimension with sign + supplies the plus without a delim', () => {
    assert.equal(assembledFrom([ident('U'), num(0x26, '+')]), 'U+26');
    assert.equal(assembledFrom([ident('u'), dim(10, 'A', '+')]), 'U+AA');
    assert.equal(assembled('U+A', false), 'U+A');
    assert.equal(assembledFrom([ident('U'), dim(10, 'FFFF', '+')]), 'U+AFFFF');
  });
});

describe('MC/DC assembleUnicodeRanges: hex-part consume loop', () => {
  // D13 dimension; D14 minus sign; D15 number; D16 minus sign; D17 ident/delim ?/-; D18 comment; else break
  test('dimension, number, ident, question, hyphen, and comment hex pieces', () => {
    assert.equal(assembledFrom([ident('U'), delim('+'), dim(10, 'A', null)]), 'U+AA');
    assert.equal(assembledFrom([ident('U'), delim('+'), dim(10, '', '+')]), 'U+A');
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('A'), dim(0, 'F', '-')]), 'U+A-F');
    assert.equal(assembledFrom([ident('U'), delim('+'), num(38, null)]), 'U+26');
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('A'), num(15, '-')]), 'U+A-F');
    assert.equal(assembledFrom([ident('U'), delim('+'), delim('?')]), 'U+0-F');
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('A'), delim('-'), ident('F')]), 'U+A-F');
    assert.equal(assembledFrom([ident('U'), delim('+'), ident('A'), comment(), ident('B')]), 'U+AB');
    assert.equal(assembledFrom([ident('U'), delim('+'), comment(), delim('?'), comment(), delim('?')]), 'U+0-FF');
  });

  test('hex loop breaks on whitespace, other delim, and non-hex tokens', () => {
    assert.equal(assembledFrom([ident('U'), delim('+'), ws(), ident('A')]), null);
    assert.equal(assembledFrom([ident('U'), delim('+'), delim('#')]), null);
    assert.equal(assembledFrom([ident('U'), delim('+'), delim('+')]), null);
    assert.equal(assembledFrom([ident('U'), delim('+'), { type: 'percentage', value: 10, sign: null }]), null);
    assert.equal(assembledFrom([ident('U'), delim('+'), comma()]), null);
    assert.equal(assembled('U+26-7F', false), 'U+1A-7F');
    assert.equal(assembled('U+0-7F', false), 'U+0-7F');
  });
});

describe('MC/DC assembleUnicodeRanges: ident U+ with trailing question marks', () => {
  // D6 else; D19 i<length && delim '?'
  test('question marks after a U+ ident are appended; other tokens are not', () => {
    assert.equal(assembledFrom([ident('U+4'), delim('?'), delim('?')]), 'U+400-4FF');
    assert.equal(assembledFrom([ident('U+4')]), 'U+4');
    assert.equal(assembledFrom([ident('u+'), delim('?')]), 'U+0-F');
    assert.equal(assembledFrom([ident('U+4'), delim('-')]), null);
    assert.equal(assembledFrom([ident('U+4'), ident('A')]), null);
    assert.equal(assembledFrom([ident('U+4'), ws()]), 'U+4');
  });
});

describe('MC/DC assembleUnicodeRanges: match1 hex / hex-hex bounds', () => {
  // D20 match1; D21 start>10FFFF; D22 endHex; D23 end>10FFFF || end<start
  test('single hex and hyphen range, including 10FFFF bounds', () => {
    assert.equal(assembledFrom([ident('U+10FFFF')]), 'U+10FFFF');
    assert.equal(assembledFrom([ident('U+0')]), 'U+0');
    assert.equal(assembledFrom([ident('U+0-10FFFF')]), 'U+0-10FFFF');
    assert.equal(assembledFrom([ident('U+26-2F')]), 'U+26-2F');
    assert.equal(assembled('U+10FFFF', true), 'U+10FFFF');
  });

  test('start above 10FFFF, reversed range, and end above 10FFFF are invalid', () => {
    assert.equal(assembledFrom([ident('U+110000')]), null);
    assert.equal(assembledFrom([ident('U+110001')]), null);
    assert.equal(assembled('U+110000', true), null);
    assert.equal(assembledFrom([ident('U+2F-26')]), null);
    assert.equal(assembledFrom([ident('U+10FFFF-10FFFE')]), null);
    assert.equal(assembledFrom([ident('U+0-110000')]), null);
    assert.equal(assembledFrom([ident('U+10FFFF-110000')]), null);
    assert.equal(faceRange('U+2F-26'), '');
    assert.equal(faceRange('U+110000'), '');
  });
});

describe('MC/DC assembleUnicodeRanges: match2 wildcards', () => {
  // D24 match2 && length<=6; D25 start>10FFFF || end>10FFFF
  test('valid wildcards of length 1..6', () => {
    assert.equal(assembledFrom([ident('U+?')]), 'U+0-F');
    assert.equal(assembledFrom([ident('U+??')]), 'U+0-FF');
    assert.equal(assembledFrom([ident('U+?????')]), 'U+0-FFFFF');
    assert.equal(assembledFrom([ident('U+4??')]), 'U+400-4FF');
    assert.equal(assembledFrom([ident('U+10????')]), 'U+100000-10FFFF');
    assert.equal(assembled('U+??', false), 'U+0-FF');
    assert.equal(assembled('U+4??', false), 'U+400-4FF');
  });

  test('wildcard too long, non-hex, empty, and code points past 10FFFF', () => {
    assert.equal(assembledFrom([ident('U+ABCDE??')]), null);
    assert.equal(assembledFrom([ident('U+1??????')]), null);
    assert.equal(assembledFrom([ident('U+ABCDEF?')]), null);
    assert.equal(assembledFrom([ident('U+')]), null);
    assert.equal(assembledFrom([ident('U+G')]), null);
    assert.equal(assembledFrom([ident('U+??????')]), null);
    assert.equal(assembledFrom([ident('U+1?????')]), null);
    assert.equal(assembledFrom([ident('U+FFFFF?')]), null);
    assert.equal(assembled('U+??????', false), null);
    assert.equal(faceRange('U+1?????'), '');
    assert.equal(faceRange('U+G'), '');
  });
});

describe('MC/DC assembleUnicodeRanges: comma separators and trailing junk', () => {
  // D26/D29 skip; D27 done; D28 comma || delim ','; D30 trailing comma
  test('comma token and delim-comma both separate ranges', () => {
    assert.equal(assembled('U+26, U+27', true), 'U+26,U+27');
    assert.equal(assembledFrom([
      urangeTok('U+26', 0x26),
      delim(','),
      urangeTok('U+27', 0x27),
    ]), 'U+26,U+27');
    assert.equal(assembledFrom([
      ident('U+A'),
      comma(),
      ident('U+B'),
    ]), 'U+A,U+B');
    assert.equal(assembledFrom([
      urangeTok('U+26', 0x26),
      comment(),
      comma(),
      comment(),
      urangeTok('U+27', 0x27),
    ]), 'U+26,U+27');
    assert.equal(assembledFrom([
      urangeTok('U+26', 0x26),
      ws(),
      comma(),
      ws(),
      urangeTok('U+27', 0x27),
      ws(),
    ]), 'U+26,U+27');
  });

  test('missing comma, non-comma delim, and trailing comma are invalid', () => {
    assert.equal(assembled('U+26 U+27', true), null);
    assert.equal(assembled('U+26,', true), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), delim(',')]), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), comma(), ws()]), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), comma(), comment()]), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), delim(';')]), null);
    assert.equal(assembledFrom([urangeTok('U+26', 0x26), ident('U+27')]), null);
    assert.equal(faceRange('U+26, U+27,'), '');
    assert.equal(setFaceRange('U+26 U+27'), '');
  });

  test('three ranges mixed unicode-range tokens and reconstructed idents', () => {
    assert.equal(assembledFrom([
      urangeTok('U+26', 0x26),
      comma(),
      ident('U+4'),
      delim('?'),
      delim('?'),
      ws(),
      comma(),
      ident('U'),
      delim('+'),
      ident('A'),
      delim('-'),
      ident('F'),
    ]), 'U+26,U+400-4FF,U+A-F');
  });
});
