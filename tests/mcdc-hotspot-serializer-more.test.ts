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
// Verifies: SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { parse } from '../src/parser.ts';
import {
  serialize,
  serializeIdentifier,
  serializeString,
  serializeDeclarations,
  serializeSelectorList,
  serializeFontFamily,
  requiresTokenSeparator,
  getMirrorToken,
  getOriginalText,
} from '../src/serializer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import type { Token, ComponentValue, Declaration } from '../src/types.ts';

function ident(value: string): Token {
  return { type: 'ident', value };
}
function num(value: number): Token {
  return { type: 'number', value, numberType: 'number', sign: null };
}
function delim(value: string): Token {
  return { type: 'delim', value };
}
function dim(value: number, unit: string): Token {
  return { type: 'dimension', value, unit, numberType: 'number', sign: null };
}
function pct(value: number): Token {
  return { type: 'percentage', value, sign: null };
}

describe('MC/DC hotspot: requiresTokenSeparator', () => {
  test('ident, at-keyword, hash, dimension, #, - against group A and (', () => {
    assert.equal(requiresTokenSeparator(ident('foo'), ident('bar')), true);
    assert.equal(requiresTokenSeparator(ident('foo'), { type: 'function', value: 'calc' }), true);
    assert.equal(requiresTokenSeparator(ident('foo'), { type: 'url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator(ident('foo'), { type: 'bad-url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator(ident('foo'), delim('-')), true);
    assert.equal(requiresTokenSeparator(ident('foo'), num(1)), true);
    assert.equal(requiresTokenSeparator(ident('foo'), pct(1)), true);
    assert.equal(requiresTokenSeparator(ident('foo'), dim(1, 'px')), true);
    assert.equal(requiresTokenSeparator(ident('foo'), { type: 'CDC', value: '-->' }), true);
    assert.equal(requiresTokenSeparator(ident('foo'), { type: '(', value: '(' }), true);
    assert.equal(requiresTokenSeparator(ident('foo'), delim('(')), true);
    assert.equal(requiresTokenSeparator(ident('foo'), delim(',')), false);

    assert.equal(requiresTokenSeparator({ type: 'at-keyword', value: 'media' }, ident('screen')), true);
    assert.equal(requiresTokenSeparator({ type: 'hash', value: 'fff', hashType: 'id' }, ident('x')), true);
    assert.equal(requiresTokenSeparator(dim(1, 'em'), ident('x')), true);
    assert.equal(requiresTokenSeparator(delim('#'), ident('fff')), true);
    assert.equal(requiresTokenSeparator(delim('-'), ident('foo')), true);
    assert.equal(requiresTokenSeparator({ type: 'at-keyword', value: 'media' }, { type: '(', value: '(' }), false);
  });

  test('number, @, . +, / rows and tokens that never need a separator', () => {
    assert.equal(requiresTokenSeparator(num(1), ident('px')), true);
    assert.equal(requiresTokenSeparator(num(1), { type: 'function', value: 'calc' }), true);
    assert.equal(requiresTokenSeparator(num(1), { type: 'url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator(num(1), num(2)), true);
    assert.equal(requiresTokenSeparator(num(1), pct(2)), true);
    assert.equal(requiresTokenSeparator(num(1), dim(2, 'px')), true);
    assert.equal(requiresTokenSeparator(num(1), { type: 'CDC', value: '-->' }), true);
    assert.equal(requiresTokenSeparator(num(1), delim('%')), true);
    assert.equal(requiresTokenSeparator(num(1), delim('-')), false);

    assert.equal(requiresTokenSeparator(delim('@'), ident('media')), true);
    assert.equal(requiresTokenSeparator(delim('@'), { type: 'function', value: 'foo' }), true);
    assert.equal(requiresTokenSeparator(delim('@'), delim('-')), true);
    assert.equal(requiresTokenSeparator(delim('@'), { type: 'CDC', value: '-->' }), true);
    assert.equal(requiresTokenSeparator(delim('@'), num(1)), false);

    assert.equal(requiresTokenSeparator(delim('.'), num(5)), true);
    assert.equal(requiresTokenSeparator(delim('.'), pct(5)), true);
    assert.equal(requiresTokenSeparator(delim('.'), dim(5, 'px')), true);
    assert.equal(requiresTokenSeparator(delim('.'), ident('class')), false);
    assert.equal(requiresTokenSeparator(delim('+'), num(5)), true);
    assert.equal(requiresTokenSeparator(delim('+'), ident('x')), false);

    assert.equal(requiresTokenSeparator(delim('/'), delim('*')), true);
    assert.equal(requiresTokenSeparator(delim('/'), ident('x')), false);

    assert.equal(requiresTokenSeparator({ type: 'comma', value: ',' }, ident('x')), false);
    assert.equal(requiresTokenSeparator({ type: 'colon', value: ':' }, ident('x')), false);
    assert.equal(requiresTokenSeparator({ type: 'whitespace', value: ' ' }, ident('x')), false);
  });

  test('serialize inserts empty comments between coalescing tokens', () => {
    assert.equal(serialize([ident('foo'), ident('bar')]), 'foo/**/bar');
    assert.equal(serialize([num(1), ident('px')]), '1/**/px');
    assert.equal(serialize([delim('.'), num(5)]), './**/5');
    assert.equal(serialize([delim('/'), delim('*')]), '//**/*');
    assert.equal(serialize([ident('foo'), { type: 'whitespace', value: ' ' }, ident('bar')]), 'foo bar');
  });
});

describe('MC/DC hotspot: serializeIdentifier / serializeString / serializeToken', () => {
  test('serializeIdentifier NULL, controls, leading digits, lone dash, unicode, specials', () => {
    assert.equal(serializeIdentifier('\u0000'), '\uFFFD');
    assert.equal(serializeIdentifier('\u0001'), '\\1 ');
    assert.equal(serializeIdentifier('\u001f'), '\\1f ');
    assert.equal(serializeIdentifier('\u007f'), '\\7f ');
    assert.equal(serializeIdentifier('0abc'), '\\30 abc');
    assert.equal(serializeIdentifier('-0abc'), '-\\30 abc');
    assert.equal(serializeIdentifier('-'), '\\-');
    assert.equal(serializeIdentifier('-foo'), '-foo');
    assert.equal(serializeIdentifier('foo_bar'), 'foo_bar');
    assert.equal(serializeIdentifier('café'), 'café');
    assert.equal(serializeIdentifier('a.b'), 'a\\.b');
    assert.equal(serializeIdentifier('a b'), 'a\\ b');
  });

  test('serializeString NULL, controls, quote, backslash, ordinary', () => {
    assert.equal(serializeString('\u0000'), '"\uFFFD"');
    assert.equal(serializeString('\u0007'), '"\\7 "');
    assert.equal(serializeString('\u007f'), '"\\7f "');
    assert.equal(serializeString('a"b'), '"a\\"b"');
    assert.equal(serializeString('a\\b'), '"a\\\\b"');
    assert.equal(serializeString('hello'), '"hello"');
  });

  test('serializeToken ident, at-keyword, hash, string preserveCase, number, percent, dimension, CDO/CDC, brackets, function, unicode-range, EOF, comment', () => {
    assert.equal(serialize([ident('Foo')]), 'Foo');
    assert.equal(serialize([{ type: 'at-keyword', value: 'media' }]), '@media');
    assert.equal(serialize([{ type: 'hash', value: 'abc', hashType: 'id' }]), '#abc');
    assert.equal(
      serialize([{ type: 'string', value: 'hi', originalText: "'hi'" }], true),
      "'hi'",
    );
    assert.equal(
      serialize([{ type: 'string', value: 'hi', originalText: "'hi'\\" }], true),
      '"hi"',
    );
    assert.equal(serialize([{ type: 'string', value: 'hi' }], false), '"hi"');
    assert.equal(serialize([num(1.5)]), '1.5');
    assert.equal(serialize([pct(50)]), '50%');
    assert.equal(serialize([dim(10, 'px')]), '10px');
    assert.equal(serialize([{ type: 'CDO', value: '<!--' }]), '<!--');
    assert.equal(serialize([{ type: 'CDC', value: '-->' }]), '-->');
    assert.equal(serialize([{ type: 'colon', value: ':' }]), ':');
    assert.equal(serialize([{ type: 'semicolon', value: ';' }]), ';');
    assert.equal(serialize([{ type: 'comma', value: ',' }]), ',');
    assert.equal(serialize([{ type: '[', value: '[' }]), '[');
    assert.equal(serialize([{ type: ']', value: ']' }]), ']');
    assert.equal(serialize([{ type: '{', value: '{' }]), '{');
    assert.equal(serialize([{ type: '}', value: '}' }]), '}');
    assert.equal(serialize([{ type: '(', value: '(' }]), '(');
    assert.equal(serialize([{ type: ')', value: ')' }]), ')');
    assert.equal(serialize([{ type: 'function', value: 'Calc' }], false), 'calc(');
    assert.equal(serialize([{ type: 'function', value: 'Calc' }], true), 'Calc(');
    assert.equal(serialize([{ type: 'unicode-range', value: 'U+0-7F', unicodeRangeStart: 0, unicodeRangeEnd: 0x7f }]), 'U+0-7F');
    assert.equal(serialize([{ type: 'EOF', value: '' }]), '');
    assert.equal(serialize([{ type: 'comment', value: '/* x */' }]), '/* x */');
    assert.equal(serialize([{ type: 'comment' } as Token]), '/**/');
    assert.equal(
      serialize([{ type: 'whitespace', value: ' ', originalText: '\t' }], true),
      '\t',
    );
    assert.equal(serialize([{ type: 'whitespace', value: ' ' }], false), ' ');
  });
});

describe('MC/DC hotspot: serializeNode functions, blocks, font-family, original text', () => {
  test('counter() drops trailing decimal list-style; url() trims ws; attr() drops | and empty fallback', () => {
    const counter = ParseHooks.parseComponentValues(tokenize('counter(item, decimal)'));
    assert.equal(serialize(counter), 'counter(item)');

    const counterKeep = ParseHooks.parseComponentValues(tokenize('counter(item, disc)'));
    assert.equal(serialize(counterKeep).includes('disc'), true);

    const urlFn = ParseHooks.parseComponentValues(tokenize('url( "x" )'));
    const urlSer = serialize(urlFn);
    assert.equal(urlSer.startsWith('url('), true);
    assert.equal(urlSer.includes('"x"') || urlSer.includes('x'), true);

    const emptyUrl = ParseHooks.parseComponentValues(tokenize('url( )'));
    assert.equal(serialize(emptyUrl), 'url("")');

    const attrPipe = ParseHooks.parseComponentValues(tokenize('attr(|foo, "")'));
    const attrSer = serialize(attrPipe);
    assert.equal(attrSer.includes('|'), false);
    assert.equal(attrSer.includes('foo'), true);

    const attrNoPipe = ParseHooks.parseComponentValues(tokenize('attr(foo, "")'));
    assert.equal(serialize(attrNoPipe).includes('foo'), true);
  });

  test('simple-block serialization uses matching mirror tokens', () => {
    const block = ParseHooks.parseComponentValues(tokenize('(1px + 2px)'));
    const ser = serialize(block);
    assert.equal(ser.startsWith('('), true);
    assert.equal(ser.endsWith(')'), true);
    assert.equal(getMirrorToken('{'), '}');
    assert.equal(getMirrorToken('['), ']');
    assert.equal(getMirrorToken('('), ')');
    assert.equal(getMirrorToken('x'), '');
  });

  test('serializeFontFamily quoted generic, ident sequence, specials, empty groups', () => {
    assert.equal(serializeFontFamily(comps('"serif"')), '"serif"');
    assert.equal(serializeFontFamily(comps('"Helvetica Neue"')), 'Helvetica Neue');
    assert.equal(serializeFontFamily(comps('"  spaced  "')), '"  spaced  "');
    assert.equal(serializeFontFamily(comps('sans-serif')), 'sans-serif');
    assert.equal(serializeFontFamily(comps('"foo.bar"')), '"foo.bar"');
    assert.equal(serializeFontFamily(comps('My Font, serif')), 'My Font, serif');
    assert.equal(serializeFontFamily(comps('serif,')), 'serif');

    const style = new CSSStyleDeclaration();
    style.setProperty('font-family', '"Times New Roman", serif');
    const family = style.getPropertyValue('font-family');
    assert.equal(family.includes('serif'), true);
  });

  test('getOriginalText walks blocks and functions', () => {
    const values = ParseHooks.parseComponentValues(tokenize('calc(1px + 2px)'));
    const original = getOriginalText(values);
    assert.equal(original.includes('calc'), true);
    assert.equal(original.includes(')'), true);

    const block = ParseHooks.parseComponentValues(tokenize('[a=b]'));
    const blockText = getOriginalText(block);
    assert.equal(blockText.includes(']'), true);
  });
});

function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}

describe('MC/DC hotspot: serializeDeclarations combining', () => {
  test('margin, padding, overflow, and important combine; intervening blocks combine', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin-top', '1px');
    style.setProperty('margin-right', '2px');
    style.setProperty('margin-bottom', '1px');
    style.setProperty('margin-left', '2px');
    assert.equal(style.cssText.includes('margin:'), true);
    assert.equal(style.cssText.includes('1px 2px'), true);

    const important = new CSSStyleDeclaration();
    important.setProperty('padding-top', '1px', 'important');
    important.setProperty('padding-right', '1px', 'important');
    important.setProperty('padding-bottom', '1px', 'important');
    important.setProperty('padding-left', '1px', 'important');
    assert.equal(important.cssText.includes('padding: 1px !important'), true);

    const overflow = new CSSStyleDeclaration();
    overflow.setProperty('overflow-x', 'hidden');
    overflow.setProperty('overflow-y', 'scroll');
    assert.equal(overflow.cssText.includes('overflow: hidden scroll'), true);

    const intervening = new CSSStyleDeclaration();
    intervening.setProperty('margin-top', '1px');
    intervening.setProperty('color', 'red');
    intervening.setProperty('margin-right', '1px');
    intervening.setProperty('margin-bottom', '1px');
    intervening.setProperty('margin-left', '1px');
    assert.equal(intervening.cssText.includes('color: red'), true);
  });

  test('border sides combine to border-width/style/color; full border shorthand stays border', () => {
    const same = new CSSStyleDeclaration();
    same.setProperty('border-top', '1px solid red');
    same.setProperty('border-right', '1px solid red');
    same.setProperty('border-bottom', '1px solid red');
    same.setProperty('border-left', '1px solid red');
    assert.equal(same.cssText.includes('border-width: 1px'), true);
    assert.equal(same.cssText.includes('border-style: solid'), true);
    assert.equal(same.cssText.includes('border-color: red'), true);

    const mixed = new CSSStyleDeclaration();
    mixed.setProperty('border-top', '1px solid red');
    mixed.setProperty('border-right', '2px solid red');
    mixed.setProperty('border-bottom', '1px solid red');
    mixed.setProperty('border-left', '1px solid red');
    assert.equal(mixed.cssText.includes('border-width: 1px 2px 1px 1px'), true);

    const full = new CSSStyleDeclaration();
    full.setProperty('border', '1px solid red');
    assert.equal(full.cssText.includes('border: 1px solid red'), true);
  });

  test('font, font-variant, background, outline, flex, list-style, line-clamp combine', () => {
    const font = new CSSStyleDeclaration();
    font.setProperty('font', 'italic 16px / 1.2 serif');
    assert.equal(font.cssText.includes('font:'), true);

    const variant = new CSSStyleDeclaration();
    variant.setProperty('font-variant-ligatures', 'normal');
    variant.setProperty('font-variant-caps', 'small-caps');
    variant.setProperty('font-variant-alternates', 'normal');
    variant.setProperty('font-variant-numeric', 'normal');
    variant.setProperty('font-variant-east-asian', 'normal');
    variant.setProperty('font-variant-position', 'normal');
    variant.setProperty('font-variant-emoji', 'normal');
    assert.equal(variant.cssText.includes('font-variant:'), true);
    assert.equal(variant.cssText.includes('small-caps'), true);

    const bg = new CSSStyleDeclaration();
    bg.setProperty('background-image', 'none');
    bg.setProperty('background-position', '0% 0%');
    bg.setProperty('background-size', 'auto');
    bg.setProperty('background-repeat', 'repeat');
    bg.setProperty('background-attachment', 'scroll');
    bg.setProperty('background-origin', 'padding-box');
    bg.setProperty('background-clip', 'border-box');
    bg.setProperty('background-color', 'red');
    assert.equal(bg.cssText.includes('background:'), true);

    const outline = new CSSStyleDeclaration();
    outline.setProperty('outline-color', 'red');
    outline.setProperty('outline-style', 'solid');
    outline.setProperty('outline-width', '1px');
    assert.equal(outline.cssText.includes('outline:'), true);

    const flex = new CSSStyleDeclaration();
    flex.setProperty('flex-grow', '1');
    flex.setProperty('flex-shrink', '1');
    flex.setProperty('flex-basis', 'auto');
    assert.equal(flex.cssText.includes('flex:'), true);

    const list = new CSSStyleDeclaration();
    list.setProperty('list-style-type', 'square');
    list.setProperty('list-style-position', 'inside');
    list.setProperty('list-style-image', 'none');
    assert.equal(list.cssText.includes('list-style:'), true);

    const clamp = new CSSStyleDeclaration();
    clamp.setProperty('max-lines', '3');
    clamp.setProperty('block-ellipsis', 'auto');
    clamp.setProperty('continue', 'auto');
    assert.equal(clamp.cssText.includes('line-clamp:') || clamp.cssText.includes('max-lines:'), true);
  });

  test('border-block / border-inline / logical two-value combine; custom props keep case', () => {
    const block = new CSSStyleDeclaration();
    block.setProperty('border-block-start-width', '1px');
    block.setProperty('border-block-start-style', 'solid');
    block.setProperty('border-block-start-color', 'red');
    block.setProperty('border-block-end-width', '1px');
    block.setProperty('border-block-end-style', 'solid');
    block.setProperty('border-block-end-color', 'red');
    assert.equal(block.cssText.includes('border-block:'), true);

    const inline = new CSSStyleDeclaration();
    inline.setProperty('margin-inline-start', '1px');
    inline.setProperty('margin-inline-end', '2px');
    assert.equal(inline.cssText.includes('margin-inline: 1px 2px'), true);

    const custom = new CSSStyleDeclaration();
    custom.setProperty('--Foo', 'Bar');
    assert.equal(custom.cssText.includes('--Foo:'), true);

    const flexBasis0 = new CSSStyleDeclaration();
    flexBasis0.setProperty('flex-basis', '0');
    assert.equal(flexBasis0.cssText.includes('0px') || flexBasis0.cssText.includes('flex'), true);
  });

  test('serializeDeclarations empty, unmatched longhands, and raw without var', () => {
    assert.equal(serializeDeclarations([]), '');
    const decls: Declaration[] = [
      { type: 'declaration', name: 'color', value: comps('red'), important: false, raw: 'red' },
    ];
    assert.equal(serializeDeclarations(decls), 'color: red;');

    const withVar: Declaration[] = [
      { type: 'declaration', name: 'color', value: comps('var(--c)'), important: true, raw: 'var(--c)' },
    ];
    assert.equal(serializeDeclarations(withVar).includes('!important'), true);
  });
});

describe('MC/DC hotspot: serializeSelectorList', () => {
  function selectorText(css: string): string {
    const sheet = parse(css);
    const rule = sheet.cssRules[0] as CSSStyleRule;
    return rule.selectorText;
  }

  test('type, universal, id, class, attribute, combinators, nesting', () => {
    assert.equal(selectorText('div { color: red }'), 'div');
    assert.equal(selectorText('* { color: red }'), '*');
    assert.equal(selectorText('#id { color: red }'), '#id');
    assert.equal(selectorText('.cls { color: red }'), '.cls');
    assert.equal(selectorText('[attr] { color: red }'), '[attr]');
    assert.equal(selectorText('[attr=value] { color: red }').includes('attr'), true);
    assert.equal(selectorText('[attr=value i] { color: red }').toLowerCase().includes('i'), true);
    assert.equal(selectorText('div > span { color: red }'), 'div > span');
    assert.equal(selectorText('div + span { color: red }'), 'div + span');
    assert.equal(selectorText('div ~ span { color: red }'), 'div ~ span');
    assert.equal(selectorText('div span { color: red }'), 'div span');
  });

  test('nth-child An+B, of, pseudo-element, namespaces', () => {
    const nth = selectorText(':nth-child(2n+1) { color: red }');
    assert.equal(nth.includes('nth-child'), true);
    assert.equal(nth.includes('2n') || nth.includes('odd'), true);

    const of = selectorText(':nth-child(2n of .foo) { color: red }');
    assert.equal(of.includes('of'), true);

    const last = selectorText(':nth-last-child(-n+3) { color: red }');
    assert.equal(last.includes('nth-last-child'), true);

    const typeNth = selectorText('p:nth-of-type(n) { color: red }');
    assert.equal(typeNth.includes('nth-of-type'), true);

    const pe = selectorText('div::before { color: red }');
    assert.equal(pe.includes('::before'), true);

    const peArg = selectorText('::slotted(span) { color: red }');
    assert.equal(peArg.includes('slotted'), true);

    const isSel = selectorText(':is(.a, .b) { color: red }');
    assert.equal(isSel.includes(':is'), true);

    const ns = selectorText('|div { color: red }');
    assert.equal(ns.includes('|div') || ns.includes('div'), true);

    const starNs = selectorText('*|div { color: red }');
    assert.equal(starNs.includes('div'), true);

    const nsSheet = parse('@namespace svg url(http://www.w3.org/2000/svg); svg|rect { color: red }');
    const nsRule = [...nsSheet.cssRules].find((r) => r instanceof CSSStyleRule) as CSSStyleRule;
    assert.ok(nsRule);
    assert.equal(nsRule.selectorText.includes('rect'), true);
  });

  test('serializeSelectorList invalid-selector and boolean nsContext', () => {
    const list = {
      type: 'selector-list' as const,
      selectors: [
        { type: 'invalid-selector' as const, tokens: [ident('oops')] },
      ],
    };
    assert.equal(serializeSelectorList(list), 'oops');
    assert.equal(serializeSelectorList(list, true), 'oops');
    assert.equal(serializeSelectorList(list, { hasDefaultNamespace: true }), 'oops');
  });
});
