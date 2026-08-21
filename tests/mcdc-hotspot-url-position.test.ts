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
// Verifies: SYS-REQ-260821-KV30, SW-REQ-260821-YTV6, SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { serialize, serializeUrlToken, serializeUrl } from '../src/serializer.ts';
import { tryParsePosition, toPositionCoord } from '../src/typed-om/position/position-parser.ts';
import {
  CSSStyleValue,
  CSSPositionValue,
  CSSUnitValue,
  CSSKeywordValue,
} from '../src/typed-om.ts';
import type { ComponentValue, Token } from '../src/types.ts';

function urlToken(css: string): Token {
  const token = tokenize(css).find((t) => t.type === 'url');
  assert.ok(token, `expected url token in ${css}`);
  return token;
}

describe('MC/DC hotspot: serializeUrlToken', () => {
  test('preserveCase reuses originalText when it is a complete url() without U+FFFD', () => {
    const token = urlToken('url(http://example.com/path)');
    assert.equal(serialize([token], true), token.originalText);
    assert.ok(token.originalText?.endsWith(')'));
  });

  test('preserveCase=false always quotes via serializeUrl', () => {
    const token = urlToken('url(http://example.com/path)');
    assert.equal(serialize([token], false), serializeUrl('http://example.com/path'));
    assert.equal(serializeUrl('http://example.com/path'), 'url("http://example.com/path")');
  });

  test('missing originalText or originalText not ending with ) rebuilds url()', () => {
    assert.equal(serializeUrlToken('foo'), 'url(foo)');
    assert.equal(serializeUrlToken('foo', 'url(foo'), 'url(foo)');
    assert.equal(
      serialize([{ type: 'url', value: 'bar' } as Token], true),
      'url(bar)',
    );
    assert.equal(
      serialize([{ type: 'url', value: 'bar', originalText: 'url(bar' } as Token], true),
      'url(bar)',
    );
  });

  test('U+FFFD in the url value forces rebuild even when originalText is complete', () => {
    const rebuilt = serializeUrlToken('foo\uFFFD', 'url(foo\uFFFD)');
    assert.equal(rebuilt, 'url(foo\uFFFD)');
    assert.equal(
      serialize([{ type: 'url', value: 'x\uFFFD', originalText: 'url(x\uFFFD)' } as Token], true),
      'url(x\uFFFD)',
    );
  });

  test('escapes quotes, parens, backslash, whitespace, and DEL', () => {
    assert.equal(serializeUrlToken('a"b'), 'url(a\\"b)');
    assert.equal(serializeUrlToken("a'b"), "url(a\\'b)");
    assert.equal(serializeUrlToken('a(b'), 'url(a\\(b)');
    assert.equal(serializeUrlToken('a)b'), 'url(a\\)b)');
    assert.equal(serializeUrlToken('a\\b'), 'url(a\\\\b)');
    assert.equal(serializeUrlToken('a b'), 'url(a\\ b)');
    assert.equal(serializeUrlToken('a\tb'), 'url(a\\\tb)');
    assert.equal(serializeUrlToken('a\nb'), 'url(a\\\nb)');
    assert.equal(serializeUrlToken('a\u0000b'), 'url(a\\\u0000b)');
    assert.equal(serializeUrlToken('a\u007Fb'), 'url(a\\\u007Fb)');
    assert.equal(serializeUrlToken('safe-path_1'), 'url(safe-path_1)');
  });

  test('mixed specials and ordinary characters', () => {
    assert.equal(
      serializeUrlToken(`x"y'z(w)u\\v w\u007F`),
      'url(x\\"y\\\'z\\(w\\)u\\\\v\\ w\\\u007F)',
    );
  });
});

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function dim(value: number, unit: string): ComponentValue {
  return { type: 'dimension', value, unit };
}

function pct(value: number): ComponentValue {
  return { type: 'percentage', value };
}

function unit(v: CSSStyleValue, expected: number, unitName: string): void {
  assert.ok(v instanceof CSSUnitValue);
  const u = v as CSSUnitValue;
  assert.equal(u.value, expected);
  assert.equal(u.unit, unitName);
}

describe('MC/DC hotspot: tryParsePosition / toPositionCoord', () => {
  test('empty, comment-only, and auto are invalid', () => {
    assert.equal(tryParsePosition([]), null);
    assert.equal(tryParsePosition([{ type: 'whitespace', value: ' ' }]), null);
    assert.equal(tryParsePosition([{ type: 'comment', value: '/*x*/' }]), null);
    assert.equal(tryParsePosition([ident('auto')]), null);
    assert.throws(() => CSSStyleValue.parse('object-position', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', ''), TypeError);
  });

  test('1-value keywords: left, right, top, bottom, center', () => {
    const left = tryParsePosition([ident('left')]);
    assert.ok(left);
    unit(left.x, 0, 'percent');
    unit(left.y, 50, 'percent');

    const right = tryParsePosition([ident('right')]);
    assert.ok(right);
    unit(right.x, 100, 'percent');
    unit(right.y, 50, 'percent');

    const top = tryParsePosition([ident('top')]);
    assert.ok(top);
    unit(top.x, 50, 'percent');
    unit(top.y, 0, 'percent');

    const bottom = tryParsePosition([ident('bottom')]);
    assert.ok(bottom);
    unit(bottom.x, 50, 'percent');
    unit(bottom.y, 100, 'percent');

    const center = tryParsePosition([ident('center')]);
    assert.ok(center);
    unit(center.x, 50, 'percent');
    unit(center.y, 50, 'percent');
  });

  test('1-value length-percentage defaults y to 50%', () => {
    const px = tryParsePosition([dim(10, 'px')]);
    assert.ok(px);
    unit(px.x, 10, 'px');
    unit(px.y, 50, 'percent');

    const p = tryParsePosition([pct(25)]);
    assert.ok(p);
    unit(p.x, 25, 'percent');
    unit(p.y, 50, 'percent');

    const parsed = CSSStyleValue.parse('object-position', '10px');
    assert.ok(parsed instanceof CSSPositionValue);
    unit(parsed.x, 10, 'px');
    unit(parsed.y, 50, 'percent');
  });

  test('2-value: vertical-then-horizontal keywords, horizontal-then-vertical, lengths', () => {
    const topRight = tryParsePosition([ident('top'), ident('right')]);
    assert.ok(topRight);
    unit(topRight.x, 100, 'percent');
    unit(topRight.y, 0, 'percent');

    const bottomLeft = tryParsePosition([ident('bottom'), ident('left')]);
    assert.ok(bottomLeft);
    unit(bottomLeft.x, 0, 'percent');
    unit(bottomLeft.y, 100, 'percent');

    const topCenter = tryParsePosition([ident('top'), ident('center')]);
    assert.ok(topCenter);
    unit(topCenter.x, 50, 'percent');
    unit(topCenter.y, 0, 'percent');

    const leftTop = tryParsePosition([ident('left'), ident('top')]);
    assert.ok(leftTop);
    unit(leftTop.x, 0, 'percent');
    unit(leftTop.y, 0, 'percent');

    const centerBottom = tryParsePosition([ident('center'), ident('bottom')]);
    assert.ok(centerBottom);
    unit(centerBottom.x, 50, 'percent');
    unit(centerBottom.y, 100, 'percent');

    const lengths = tryParsePosition([dim(10, 'px'), pct(20)]);
    assert.ok(lengths);
    unit(lengths.x, 10, 'px');
    unit(lengths.y, 20, 'percent');

    const centerPx = tryParsePosition([ident('center'), dim(8, 'em')]);
    assert.ok(centerPx);
    unit(centerPx.x, 50, 'percent');
    unit(centerPx.y, 8, 'em');
  });

  test('2-value invalid: top+length, length+left, unknown keyword', () => {
    assert.equal(tryParsePosition([ident('top'), dim(10, 'px')]), null);
    assert.equal(tryParsePosition([ident('bottom'), pct(10)]), null);
    assert.equal(tryParsePosition([dim(10, 'px'), ident('left')]), null);
    assert.equal(tryParsePosition([dim(10, 'px'), ident('right')]), null);
    assert.equal(tryParsePosition([ident('not-a-pos'), ident('left')]), null);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', '10px left'), TypeError);
  });

  test('3-value: [left|right] offset [top|bottom|center]', () => {
    const leftOffTop = tryParsePosition([ident('left'), dim(10, 'px'), ident('top')]);
    assert.ok(leftOffTop);
    unit(leftOffTop.x, 10, 'px');
    unit(leftOffTop.y, 0, 'percent');

    const rightOffBottom = tryParsePosition([ident('right'), dim(10, 'px'), ident('bottom')]);
    assert.ok(rightOffBottom);
    assert.ok(rightOffBottom.x);
    unit(rightOffBottom.y, 100, 'percent');

    const leftOffCenter = CSSStyleValue.parse('object-position', 'left 10px center');
    assert.ok(leftOffCenter instanceof CSSPositionValue);
    unit(leftOffCenter.x, 10, 'px');
    unit(leftOffCenter.y, 50, 'percent');
  });

  test('3-value: [left|right|center] [top|bottom] offset', () => {
    const leftTopOff = tryParsePosition([ident('left'), ident('top'), dim(5, 'px')]);
    assert.ok(leftTopOff);
    unit(leftTopOff.x, 0, 'percent');
    unit(leftTopOff.y, 5, 'px');

    const centerBottomOff = tryParsePosition([ident('center'), ident('bottom'), dim(8, 'px')]);
    assert.ok(centerBottomOff);
    unit(centerBottomOff.x, 50, 'percent');

    const parsed = CSSStyleValue.parse('background-position', 'right bottom 10px');
    assert.ok(parsed instanceof CSSPositionValue);
  });

  test('3-value: [top|bottom] offset [left|right|center]', () => {
    const topOffLeft = tryParsePosition([ident('top'), dim(10, 'px'), ident('left')]);
    assert.ok(topOffLeft);
    unit(topOffLeft.x, 0, 'percent');
    unit(topOffLeft.y, 10, 'px');

    const bottomOffCenter = tryParsePosition([ident('bottom'), dim(4, 'px'), ident('center')]);
    assert.ok(bottomOffCenter);
    unit(bottomOffCenter.x, 50, 'percent');

    const parsed = CSSStyleValue.parse('object-position', 'top 20px right');
    assert.ok(parsed instanceof CSSPositionValue);
  });

  test('3-value invalid offsets and unknown keywords', () => {
    assert.equal(tryParsePosition([ident('left'), ident('foo'), ident('top')]), null);
    assert.equal(tryParsePosition([ident('center'), ident('top'), ident('foo')]), null);
    assert.equal(tryParsePosition([ident('top'), ident('foo'), ident('left')]), null);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left foo top'), TypeError);
  });

  test('4-value: [left|right] offset [top|bottom] offset', () => {
    const leftTop = tryParsePosition([ident('left'), dim(10, 'px'), ident('top'), dim(20, 'px')]);
    assert.ok(leftTop);
    unit(leftTop.x, 10, 'px');
    unit(leftTop.y, 20, 'px');

    const rightBottom = tryParsePosition([ident('right'), dim(3, 'px'), ident('bottom'), dim(4, 'px')]);
    assert.ok(rightBottom);

    const parsed = CSSStyleValue.parse('object-position', 'left 10px top 20px');
    assert.ok(parsed instanceof CSSPositionValue);
    unit(parsed.x, 10, 'px');
    unit(parsed.y, 20, 'px');
  });

  test('4-value: [top|bottom] offset [left|right] offset', () => {
    const topLeft = tryParsePosition([ident('top'), dim(1, 'px'), ident('left'), dim(2, 'px')]);
    assert.ok(topLeft);
    unit(topLeft.x, 2, 'px');
    unit(topLeft.y, 1, 'px');

    const bottomRight = tryParsePosition([ident('bottom'), dim(5, 'px'), ident('right'), dim(6, 'px')]);
    assert.ok(bottomRight);

    const parsed = CSSStyleValue.parse('background-position', 'top 10px left 20px');
    assert.ok(parsed instanceof CSSPositionValue);
  });

  test('4-value invalid and more than four values', () => {
    assert.equal(tryParsePosition([ident('left'), ident('foo'), ident('top'), dim(1, 'px')]), null);
    assert.equal(tryParsePosition([ident('left'), dim(1, 'px'), ident('center'), dim(2, 'px')]), null);
    assert.equal(tryParsePosition([ident('left'), dim(1, 'px'), ident('top'), ident('foo')]), null);
    assert.equal(
      tryParsePosition([ident('left'), dim(1, 'px'), ident('top'), dim(2, 'px'), ident('center')]),
      null,
    );
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 1px top 2px extra'), TypeError);
  });

  test('toPositionCoord maps keywords, lengths, and rejects others', () => {
    unit(toPositionCoord(new CSSKeywordValue('left'))!, 0, 'percent');
    unit(toPositionCoord(new CSSKeywordValue('top'))!, 0, 'percent');
    unit(toPositionCoord(new CSSKeywordValue('center'))!, 50, 'percent');
    unit(toPositionCoord(new CSSKeywordValue('right'))!, 100, 'percent');
    unit(toPositionCoord(new CSSKeywordValue('bottom'))!, 100, 'percent');
    assert.equal(toPositionCoord(new CSSKeywordValue('auto')), null);
    assert.equal(toPositionCoord(null), null);
    const px = new CSSUnitValue(10, 'px');
    assert.equal(toPositionCoord(px), px);
    assert.equal(toPositionCoord(new CSSUnitValue(90, 'deg')), null);
    assert.equal(toPositionCoord(new CSSKeywordValue('not-a-side')), null);
  });
});
