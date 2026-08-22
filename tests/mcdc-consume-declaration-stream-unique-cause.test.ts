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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8, SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-HHVE, SYS-REQ-260821-9YM3, SW-REQ-260821-ARC1
// Leftover unique-cause for src/parser.ts consumeDeclarationFromStream
// (16/20 D, 28/32 C, incomplete 4) after tests/mcdc-branch-parser.test.ts,
// tests/mcdc-branch-parser-leftover.test.ts, and
// tests/mcdc-parser-still-hot-unique-cause.test.ts.
// Hottest seam L1107 t1; also L1110 t2, L1130 name === '--', L1077 while (true).
// Drive parseStyleSheet / CSSStyleDeclaration cssText / parseDeclaration.
// css-syntax-3 § 5.4.7 #parse-declaration / § 5.5.5 #consume-declaration
// / § 5.4.5 #consume-block-contents / § 5.5.8 #consume-a-simple-block,
// cssom-1 § 6.6.1 #dom-cssstyledeclaration-csstext,
// css-variables-1 #defining-variables / #syntax.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, parseStyleSheet } from '../src/parser.ts';
import {
  parseDeclaration as parseDeclarationListFirst,
  CSSParserDeclaration,
} from '../src/parser-api.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule, CSSFontFaceRule } from '../src/CSSOM.ts';
import type { ComponentValue, Declaration } from '../src/types.ts';

function firstStyle(css: string): CSSStyleRule {
  const rules = parseStyleSheet(css);
  assert.ok(rules[0] instanceof CSSStyleRule, `expected style rule for ${JSON.stringify(css)}`);
  return rules[0];
}

function fromCssText(css: string): CSSStyleDeclaration {
  const style = new CSSStyleDeclaration();
  style.cssText = css;
  return style;
}

function parseDecl(css: string): Declaration | null {
  return new Parser(tokenize(css)).parseDeclaration();
}

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function colon(): ComponentValue {
  return { type: 'colon', value: ':' };
}

function ws(): ComponentValue {
  return { type: 'whitespace', value: ' ' };
}

function isNumberSlot(v: ComponentValue): boolean {
  return typeof v === 'number';
}

/**
 * Stream that can yield a falsy slot. ArrayComponentValueStream.peek uses
 * `values[index] || EOF`, so 0/''/false become EOF and never enter declValue.
 * css-syntax-3 tokenize only emits objects. Unique-cause of defensive `t1 &&`
 * / `t2 &&` therefore cannot go through parseStyleSheet / cssText /
 * parseDeclaration; drive the shipped consumeDeclarationFromStream instead
 * (same pattern as consumeAtRuleFromStream L1228).
 */
class RawValueStream {
  private index = 0;
  private readonly values: Array<ComponentValue | 0>;
  constructor(values: Array<ComponentValue | 0>) {
    this.values = values;
  }
  peek(): ComponentValue | 0 {
    if (this.index >= this.values.length) return { type: 'EOF', value: '' };
    return this.values[this.index];
  }
  next(): ComponentValue | 0 {
    const val = this.peek();
    const type = val !== 0 ? val.type : undefined;
    if (type !== 'EOF') this.index++;
    return val;
  }
  get position(): number {
    return this.index;
  }
  set position(pos: number) {
    this.index = pos;
  }
  slice(start: number, end: number): Array<ComponentValue | 0> {
    return this.values.slice(start, end);
  }
}

function callFromStream(values: Array<ComponentValue | 0>): Declaration | null {
  const parser = new Parser([]);
  const fn = Reflect.get(Object.getPrototypeOf(parser), 'consumeDeclarationFromStream');
  assert.equal(typeof fn, 'function', 'consumeDeclarationFromStream');
  const call = fn as (stream: RawValueStream) => Declaration | null;
  return call.call(parser, new RawValueStream(values));
}

describe('MC/DC leftover unique-cause: consumeDeclarationFromStream L1107 t1', () => {
  test('t1 F: falsy slot after colon (unpairable via tokenize / ArrayComponentValueStream)', () => {
    // i1 >= 0 T, t1 F: declValue[i1] is 0. lastNonWsIndex does not throw
    // (`0.type` is undefined, not whitespace). css-syntax-3 § 5.5.5.
    const falsy = callFromStream([ident('color'), colon(), 0]);
    assert.ok(falsy);
    assert.equal(falsy.name, 'color');
    assert.equal(falsy.important, false);
    assert.equal(isNumberSlot(falsy.value[0]), true);
    assert.equal(Number(falsy.value[0]), 0);

    const trailingWs = callFromStream([ident('color'), colon(), 0, ws()]);
    assert.ok(trailingWs);
    assert.equal(trailingWs.important, false);
    assert.equal(isNumberSlot(trailingWs.value[0]), true);
    assert.equal(Number(trailingWs.value[0]), 0);
  });

  test('t1 T unique-cause of ident / important via parseStyleSheet, cssText, parseDeclaration', () => {
    // TTTT: last non-ws is ident `important`.
    const sheet = firstStyle('.a { color: red !important; }');
    assert.equal(sheet.style.getPropertyValue('color'), 'red');
    assert.equal(sheet.style.getPropertyPriority('color'), 'important');

    const cssText = fromCssText('color: red !important');
    assert.equal(cssText.getPropertyValue('color'), 'red');
    assert.equal(cssText.getPropertyPriority('color'), 'important');

    const decl = parseDecl('color: red !important');
    assert.ok(decl);
    assert.equal(decl.important, true);
    assert.equal(decl.value[0]?.type, 'ident');

    const api = parseDeclarationListFirst('color: red !important');
    assert.ok(api instanceof CSSParserDeclaration);
    assert.equal(api.name, 'color');
    assert.equal(api.body.length, 1);

    const mixed = parseDecl('display: none !IMPORTANT');
    assert.equal(mixed?.important, true);

    // i1 >= 0 F: empty value (lastNonWsIndex returns -1, t1 skipped).
    const empty = parseDecl('color:');
    assert.ok(empty);
    assert.equal(empty.value.length, 0);
    assert.equal(empty.important, false);
    const emptySheet = firstStyle('.a { color:; background: blue; }');
    assert.equal(emptySheet.style.getPropertyValue('background'), 'blue');
    const emptyCss = fromCssText('color:; background: blue');
    assert.equal(emptyCss.getPropertyValue('background'), 'blue');

    // t1 T, type ident F: last non-ws is number / delim.
    assert.equal(parseDecl('color: 1')?.important, false);
    assert.equal(parseDecl('color: red!')?.important, false);
    const bangSheet = firstStyle('.a { color: red!; }');
    assert.equal(bangSheet.style.getPropertyPriority('color'), '');
    const bangCss = fromCssText('color: red!');
    assert.equal(bangCss.getPropertyPriority('color'), '');

    // t1 T, ident, important F (toLowerCase miss / other ident).
    assert.equal(parseDecl('color: red ! importance')?.important, false);
    assert.equal(parseDecl('color: red')?.important, false);
    const notImp = firstStyle('.a { color: red; }');
    assert.equal(notImp.style.getPropertyPriority('color'), '');
  });
});

describe('MC/DC leftover unique-cause: consumeDeclarationFromStream L1110 t2', () => {
  test('t2 F: falsy slot before ident important (unpairable via tokenize)', () => {
    // i1 TTTT (last is ident important), i2 >= 0 T, t2 F.
    const falsyBang = callFromStream([ident('color'), colon(), 0, ident('important')]);
    assert.ok(falsyBang);
    assert.equal(falsyBang.important, false);
    assert.equal(isNumberSlot(falsyBang.value[0]), true);
    assert.equal(Number(falsyBang.value[0]), 0);
    assert.equal(
      falsyBang.value.some((v) => typeof v === 'object' && v.type === 'ident' && v.value === 'important'),
      true,
    );

    const withWs = callFromStream([ident('color'), colon(), ident('red'), ws(), 0, ident('important')]);
    assert.ok(withWs);
    assert.equal(withWs.important, false);
  });

  test('t2 T unique-cause of delim / "!" via parseStyleSheet, cssText, parseDeclaration', () => {
    // TTTT: `!important`.
    assert.equal(parseDecl('color: red !important')?.important, true);
    assert.equal(firstStyle('.a { z-index: 1 !important; }').style.getPropertyPriority('z-index'), 'important');
    assert.equal(fromCssText('z-index: 1 !important').getPropertyPriority('z-index'), 'important');

    // whitespace between `!` and `important` (lastNonWsIndex skip).
    assert.equal(parseDecl('color: red ! important')?.important, true);
    assert.equal(firstStyle('.a { color: red ! important; }').style.getPropertyPriority('color'), 'important');
    assert.equal(fromCssText('color: red ! important').getPropertyPriority('color'), 'important');

    // comments discarded (css-syntax-3 § 4.3.2), still `!important`.
    assert.equal(parseDecl('color: red /*c*/ !important')?.important, true);
    assert.equal(firstStyle('.a { color: red /*c*/ !important; }').style.getPropertyPriority('color'), 'important');

    // i2 >= 0 F: value is only `important` (no `!`).
    const onlyIdent = parseDecl('color: important');
    assert.ok(onlyIdent);
    assert.equal(onlyIdent.important, false);
    assert.equal(firstStyle('.a { color: important; }').style.getPropertyPriority('color'), '');
    assert.equal(fromCssText('color: important').getPropertyPriority('color'), '');

    // i2 T, t2 T, type delim F: ident before `important`.
    assert.equal(parseDecl('color: red important')?.important, false);
    assert.equal(fromCssText('color: red important').getPropertyPriority('color'), '');

    // delim T, value `!` F: `?important`.
    assert.equal(parseDecl('color: red ?important')?.important, false);
    assert.equal(firstStyle('.a { color: red ?important; }').style.getPropertyValue('color').includes('red'), true);
    assert.equal(firstStyle('.a { color: red ?important; }').style.getPropertyPriority('color'), '');
    assert.equal(fromCssText('color: red ?important').getPropertyPriority('color'), '');

    // bang-only value: splice empties declValue (L1114 length > 0 F).
    const bangOnly = parseDecl('color: !important');
    assert.ok(bangOnly);
    assert.equal(bangOnly.important, true);
    assert.equal(bangOnly.value.length, 0);
    assert.equal(firstStyle('.a { color: !important; }').style.getPropertyPriority('color'), 'important');
    assert.equal(fromCssText('color: !important').getPropertyPriority('color'), 'important');

    // trailing whitespace after `!important` (L1114 pop T then F).
    const trailed = parseDecl('color: red !important  ');
    assert.ok(trailed);
    assert.equal(trailed.important, true);
    assert.equal(trailed.value.length, 1);
    assert.equal(trailed.value[0]?.type, 'ident');
  });
});

describe('MC/DC leftover unique-cause: consumeDeclarationFromStream L1130 name === "--"', () => {
  test('L1059 name === "--" T drops the declaration; following decls kept', () => {
    // L1130 `name === '--'` T is dead after the L1059 early return (mute; no ignore).
    // Unique-cause of the live `--` arm is L1059 via public APIs.
    assert.equal(parseDecl('--: red'), null);
    assert.equal(parseDeclarationListFirst('--: red'), null);

    const sheet = firstStyle('.a { --: red; --foo: green; }');
    assert.equal(sheet.style.getPropertyValue('--'), '');
    assert.equal(sheet.style.getPropertyValue('--foo'), 'green');

    const cssText = fromCssText('--: red; --foo: green');
    assert.equal(cssText.getPropertyValue('--'), '');
    assert.equal(cssText.getPropertyValue('--foo'), 'green');

    // `--foo` is not `--` (L1059 F, L1130 F, validate T).
    const custom = parseDecl('--foo: green');
    assert.ok(custom);
    assert.equal(custom.name, '--foo');
    assert.equal(custom.raw, 'green');
    assert.equal(firstStyle('.a { --foo: green; }').style.getPropertyValue('--foo'), 'green');
    assert.equal(fromCssText('--foo: green').getPropertyValue('--foo'), 'green');

    // L1130 F, validate F: leftover top-level `!` that is not `!important`.
    assert.equal(parseDecl('--foo: green ! bar'), null);
    const recovered = firstStyle('.a { --foo: green ! bar; color: blue; }');
    assert.equal(recovered.style.getPropertyValue('--foo'), '');
    assert.equal(recovered.style.getPropertyValue('color'), 'blue');
    const recoveredCss = fromCssText('--foo: green ! bar; color: blue');
    assert.equal(recoveredCss.getPropertyValue('--foo'), '');
    assert.equal(recoveredCss.getPropertyValue('color'), 'blue');

    // custom `!important` is stripped before validateCustomPropertyValue.
    const customImp = parseDecl('--foo: green !important');
    assert.ok(customImp);
    assert.equal(customImp.important, true);
    assert.equal(customImp.raw, 'green');
    assert.equal(firstStyle('.a { --foo: green !important; }').style.getPropertyPriority('--foo'), 'important');
    assert.equal(fromCssText('--foo: green !important').getPropertyPriority('--foo'), 'important');
  });
});

describe('MC/DC leftover unique-cause: consumeDeclarationFromStream L1077 while(true) stop', () => {
  test('loop body T: EOF vs semicolon vs neither (`}`); literal true F mute', () => {
    // while (true) F is a literal and unpairable (mute; no ignore).
    // Unique-cause of the stop OR inside the body (L1079) via public APIs.

    // EOF T, semicolon F: parseDeclaration (LazyComponentValueStream).
    const eof = parseDecl('color: red');
    assert.ok(eof);
    assert.equal(eof.value[0]?.type, 'ident');

    // semicolon T, EOF F.
    const semi = parseDecl('color: red;');
    assert.ok(semi);
    assert.equal(semi.value[0]?.type, 'ident');
    const semiSheet = firstStyle('.a { color: red; background: blue; }');
    assert.equal(semiSheet.style.getPropertyValue('background'), 'blue');
    const semiCss = fromCssText('color: red; background: blue');
    assert.equal(semiCss.getPropertyValue('background'), 'blue');

    // both F: `}` is not a terminator of consumeDeclarationFromStream
    // (css-syntax-3 § 5.5.5; leftover vs consumeDeclarationsFromBlockContents).
    const rbrace = parseDecl('color: red } background: blue');
    assert.ok(rbrace);
    assert.equal(rbrace.value.some((v) => v.type === '}'), true);
    const rbraceCss = fromCssText('color: red } background: navy');
    assert.equal(rbraceCss.getPropertyValue('color').includes('red'), true);
    // consumeDeclarationsFromBlockContents then stops the *list* on `}`.
    assert.equal(rbraceCss.getPropertyValue('background'), '');
    const listStop = fromCssText('color: red; } background: navy');
    assert.equal(listStop.getPropertyValue('color'), 'red');
    assert.equal(listStop.getPropertyValue('background'), '');
  });
});

describe('MC/DC leftover unique-cause: consumeDeclarationFromStream curly-block AND / unicode-range', () => {
  test('non-custom `{` stop AND unique-cause via parseStyleSheet and cssText', () => {
    // all T: stop after `{`, hasCurlyBlock && nonWsCount > 1 → null.
    assert.equal(parseDecl('color: red { x }'), null);
    assert.equal(parseDeclarationListFirst('color: red { x }'), null);
    const rejected = firstStyle('.a { color: red { x }; background: blue; }');
    assert.equal(rejected.style.getPropertyValue('color'), '');
    assert.equal(rejected.style.getPropertyValue('background'), 'blue');
    const rejectedCss = fromCssText('color: red { x }; background: blue');
    assert.equal(rejectedCss.getPropertyValue('color'), '');
    assert.equal(rejectedCss.getPropertyValue('background'), 'blue');

    // some(non-ws) F: `{` is the first non-ws value → keep.
    const onlyBlock = parseDecl('color: { x }');
    assert.ok(onlyBlock);
    assert.equal(onlyBlock.value.some((v) => v.type === 'simple-block'), true);
    const onlySheet = firstStyle('.a { color: { x }; background: blue; }');
    assert.equal(onlySheet.style.getPropertyValue('color').includes('{'), true);
    assert.equal(onlySheet.style.getPropertyValue('background'), 'blue');
    const onlyCss = fromCssText('color: { x }; background: blue');
    assert.equal(onlyCss.getPropertyValue('color').includes('{'), true);

    // associatedToken `{` F: `[` / `(` kept (css-syntax-3 § 5.5.8).
    assert.equal(parseDecl('color: red [x]')?.value.some((v) => v.type === 'simple-block'), true);
    assert.equal(parseDecl('color: red (x)')?.value.some((v) => v.type === 'simple-block'), true);
    assert.equal(firstStyle('.a { color: red [x]; }').style.getPropertyValue('color').includes('['), true);
    assert.equal(fromCssText('color: red (x)').getPropertyValue('color').includes('('), true);

    // name.startsWith('--') T: custom does not stop at `{`.
    const custom = parseDecl('--x: red { x }');
    assert.ok(custom);
    assert.equal(custom.raw?.includes('{'), true);
    assert.equal(firstStyle('.a { --x: red { x }; }').style.getPropertyValue('--x').includes('{'), true);
    assert.equal(fromCssText('--x: red { x }').getPropertyValue('--x').includes('{'), true);
  });

  test('unicode-range name fold / junk; validateDeclarationValue var() via public APIs', () => {
    const mixed = parseDecl('UNICODE-RANGE: U+26');
    assert.ok(mixed);
    assert.equal(mixed.value[0]?.type, 'unicode-range');
    assert.equal(parseDecl('unicode-range: not-a-range'), null);

    const face = parseStyleSheet('@font-face { UNICODE-RANGE: U+26; font-family: X; }');
    assert.ok(face[0] instanceof CSSFontFaceRule);
    assert.equal((face[0] as CSSFontFaceRule).style.getPropertyValue('unicode-range'), 'U+26');

    const styleUr = firstStyle('.a { UNICODE-RANGE: U+26; color: red; }');
    assert.equal(styleUr.style.getPropertyValue('unicode-range'), 'U+26');
    assert.equal(styleUr.style.getPropertyValue('color'), 'red');

    // validateDeclarationValue F: empty var() dropped; following decl kept.
    assert.equal(parseDecl('color: var()'), null);
    assert.equal(parseDeclarationListFirst('color: var()'), null);
    const badVar = firstStyle('.a { color: var(); background: blue; }');
    assert.equal(badVar.style.getPropertyValue('color'), '');
    assert.equal(badVar.style.getPropertyValue('background'), 'blue');
    const badVarCss = fromCssText('color: var(); background: blue');
    assert.equal(badVarCss.getPropertyValue('color'), '');
    assert.equal(badVarCss.getPropertyValue('background'), 'blue');

    const okVar = firstStyle('.a { color: var(--x); }');
    assert.equal(okVar.style.getPropertyValue('color'), 'var(--x)');
    assert.equal(fromCssText('color: var(--x)').getPropertyValue('color'), 'var(--x)');
  });
});
