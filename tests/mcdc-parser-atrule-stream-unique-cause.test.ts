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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8, SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-HHVE
// Leftover unique-cause for src/parser.ts consumeAtRuleFromStream (L1228
// token.type !== 'at-keyword' and remaining terminator/handler/nested AND/ORs)
// and #resolveVarFunction L1751 custom-property IACVT
// (resolved.length === 1 && type === 'ident' && value === '\0guaranteed-invalid').
// tests/mcdc-branch-parser-leftover.test.ts and
// tests/mcdc-parser-still-hot-unique-cause.test.ts do not isolate these.
// Drive parse() / parseStyleSheet / CSSStyleSheet.replaceSync / Parser.parseBlockContents
// / parseStyleAttribute / parseRuleInBlock / Parser(StreamingTokenizerStream).
// css-syntax-3 § 5.5.2 #consume-at-rule / § 5.4.5 #consume-block-contents,
// css-nesting-1 § 3.3 #conditionals, css-variables-1 § 3.1 #guaranteed-invalid
// / #replace-a-var. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseStyleSheet,
  parseRuleInBlock,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ArrayComponentValueStream, StreamingTokenizerStream } from '../src/TokenStream.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { ComponentValue, Rule } from '../src/types.ts';
import {
  CSSAtRule,
  CSSStyleRule,
  CSSNestedDeclarations,
  CSSMediaRule,
  CSSSupportsRule,
  CSSLayerStatementRule,
  CSSLayerBlockRule,
  CSSImportRule,
  CSSNamespaceRule,
  CSSCustomMediaRule,
  CSSKeyframesRule,
  CSSFontFaceRule,
  CSSMarginRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';

function firstStyle(css: string): CSSStyleRule {
  const sheet = parse(css);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule, `expected style rule for ${JSON.stringify(css)}`);
  return sheet.cssRules[0];
}

function blockContents(css: string): Rule[] {
  return new Parser(tokenize(css)).parseBlockContents();
}

function replaceSyncSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

function parseStreaming(chunks: string[]): CSSStyleSheet {
  const tokenizer = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tokenizer);
  const parser = new Parser(stream);
  for (const chunk of chunks) tokenizer.appendChunk(chunk);
  tokenizer.close();
  return parser.parseStyleSheet();
}

function ctorNames(rules: Iterable<Rule>): string[] {
  return [...rules].map((r) => r.constructor.name);
}

function callFromStream(values: ComponentValue[], nested?: boolean): unknown {
  const parser = new Parser([]);
  const fn = Reflect.get(Object.getPrototypeOf(parser), 'consumeAtRuleFromStream');
  assert.equal(typeof fn, 'function', 'consumeAtRuleFromStream');
  const stream = new ArrayComponentValueStream(values);
  const call = fn as (stream: ArrayComponentValueStream, nested?: boolean) => unknown;
  return nested === undefined ? call.call(parser, stream) : call.call(parser, stream, nested);
}

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function semi(): ComponentValue {
  return { type: 'semicolon', value: ';' };
}

function numberTok(value: number): ComponentValue {
  return { type: 'number', value, numberType: 'integer', sign: null };
}

describe('MC/DC leftover unique-cause: consumeAtRuleFromStream L1228 token.type !== at-keyword', () => {
  test('T: non-at token (callers always peek at-keyword; defensive spec arm)', () => {
    // css-syntax-3 § 5.5.2 #consume-at-rule assumes the next token is an
    // <at-keyword-token>. consumeBlockContents / consumeDeclarationsFromBlockContents
    // peek at-keyword before calling, so T is unpairable via parse()/replaceSync.
    assert.equal(callFromStream([ident('color')]), null);
    assert.equal(callFromStream([numberTok(1)]), null);
    assert.equal(callFromStream([semi()]), null);
    assert.equal(callFromStream([]), null);
    assert.equal(callFromStream([{ type: 'hash', value: 'id', hashType: 'id' }]), null);
    assert.equal(callFromStream([{ type: 'string', value: 'x' }]), null);
  });

  test('F: @media / @import / @unknown via parse, parseStyleSheet, replaceSync, streaming', () => {
    const media = parse('@media all { .a { color: red; } }');
    assert.ok(media.cssRules[0] instanceof CSSMediaRule);

    const unknown = parseStyleSheet('@unknown; .ok { color: green; }');
    assert.equal(unknown.length, 2);
    assert.ok(unknown[0] instanceof CSSAtRule);
    assert.equal((unknown[0] as CSSAtRule).name, 'unknown');

    const imported = parse('@import "x.css";');
    assert.ok(imported.cssRules[0] instanceof CSSImportRule);

    const replaced = replaceSyncSheet('.a { @media all { color: navy; } }');
    assert.ok(replaced.cssRules[0] instanceof CSSStyleRule);
    assert.ok((replaced.cssRules[0] as CSSStyleRule).cssRules[0] instanceof CSSMediaRule);

    const streamed = parseStreaming(['.a { @med', 'ia all { color: teal; } }']);
    assert.ok(streamed.cssRules[0] instanceof CSSStyleRule);
    assert.ok((streamed.cssRules[0] as CSSStyleRule).cssRules[0] instanceof CSSMediaRule);
  });
});

describe('MC/DC leftover unique-cause: consumeAtRuleFromStream semicolon vs EOF vs } vs prelude', () => {
  test('terminator unique-cause: semicolon T vs EOF T } F vs } T EOF F vs both F', () => {
    // parseBlockContents → consumeBlockContents(..., true, false) → FromStream nested F.
    const semiBlock = blockContents('@unknown; color: blue;');
    assert.ok(semiBlock[0] instanceof CSSAtRule);
    assert.equal((semiBlock[0] as CSSAtRule).name, 'unknown');
    assert.ok(semiBlock[1] instanceof CSSNestedDeclarations);
    assert.equal((semiBlock[1] as CSSNestedDeclarations).style.getPropertyValue('color'), 'blue');

    const eof = blockContents('@unknown');
    assert.equal(eof.length, 1);
    assert.ok(eof[0] instanceof CSSAtRule);

    // } is a component value here (ArrayComponentValueStream), unlike Lazy
    // style-rule blocks which map the mirror `}` to EOF.
    const rbrace = blockContents('@unknown }');
    assert.equal(rbrace.length, 1);
    assert.ok(rbrace[0] instanceof CSSAtRule);
    assert.equal((rbrace[0] as CSSAtRule).name, 'unknown');

    const withBlock = blockContents('@unknown { color: red; }');
    assert.ok(withBlock[0] instanceof CSSAtRule);
    assert.equal((withBlock[0] as CSSAtRule).cssText.includes('{'), true);
  });

  test('simple-block AND associatedToken `{` unique-cause', () => {
    // T T: `{` block.
    const curly = blockContents('@foo { color: red; }');
    assert.ok(curly[0] instanceof CSSAtRule);
    assert.equal((curly[0] as CSSAtRule).cssText.includes('{'), true);

    // T F: `[` / `(` simple-blocks are prelude, not the `{` arm.
    const square = blockContents('@foo [x];');
    assert.ok(square[0] instanceof CSSAtRule);
    assert.equal((square[0] as CSSAtRule).cssText.includes('[x]'), true);

    const paren = blockContents('@foo (x);');
    assert.ok(paren[0] instanceof CSSAtRule);
    assert.equal((paren[0] as CSSAtRule).cssText.includes('(x)'), true);

    // prelude then `{`: `[x]` stays prelude; `{` unique-causes the block arm.
    const squareThenBlock = blockContents('@foo [x] { color: red; }');
    assert.ok(squareThenBlock[0] instanceof CSSAtRule);
    assert.equal((squareThenBlock[0] as CSSAtRule).cssText.includes('[x]'), true);
    assert.equal((squareThenBlock[0] as CSSAtRule).cssText.includes('{'), true);

    // simple-block F: ident / url-token / string / number / function.
    const identPrelude = blockContents('@foo bar;');
    assert.ok(identPrelude[0] instanceof CSSAtRule);
    assert.equal((identPrelude[0] as CSSAtRule).cssText.includes('bar'), true);

    const urlPrelude = blockContents('@foo url(x);');
    assert.ok(urlPrelude[0] instanceof CSSAtRule);
    assert.equal((urlPrelude[0] as CSSAtRule).cssText.includes('url'), true);

    const strPrelude = blockContents('@foo "bar";');
    assert.ok(strPrelude[0] instanceof CSSAtRule);

    const fnPrelude = blockContents('@foo var(--x);');
    assert.ok(fnPrelude[0] instanceof CSSAtRule);
  });
});

describe('MC/DC leftover unique-cause: consumeAtRuleFromStream isSupported / handler / nested', () => {
  test('semicolon path: isSupported F vs handler T handledRule F/T vs handler F nested T/F', () => {
    // isSupported F: @charset / @mediaall / @--foo (css-syntax-3 § 3.2, css-nesting-1 § 3.3).
    const charset = blockContents('@charset "x"; color: red;');
    assert.equal(charset.some((r) => r instanceof CSSAtRule), false);
    assert.equal((charset[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');

    const mediaAll = blockContents('@mediaall; color: red;');
    assert.equal(mediaAll.some((r) => r instanceof CSSMediaRule || r instanceof CSSAtRule), false);

    const dashed = blockContents('@--foo; color: red;');
    assert.equal(dashed.some((r) => r instanceof CSSAtRule), false);

    // handler T, handledRule F (block-required at-rules as statements).
    const mediaStmt = blockContents('@media; color: red;');
    assert.equal(mediaStmt.some((r) => r instanceof CSSMediaRule), false);
    assert.equal((mediaStmt[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');

    const fontStmt = blockContents('@font-face; color: red;');
    assert.equal(fontStmt.some((r) => r instanceof CSSFontFaceRule), false);

    const customBad = blockContents('@custom-media; color: red;');
    assert.equal(customBad.some((r) => r instanceof CSSCustomMediaRule), false);

    // handler T, handledRule T (statement form).
    const layerStmt = blockContents('@layer foo;');
    assert.ok(layerStmt[0] instanceof CSSLayerStatementRule);

    const imported = blockContents('@import "x.css";');
    assert.ok(imported[0] instanceof CSSImportRule);

    const ns = blockContents('@namespace "http://a";');
    assert.ok(ns[0] instanceof CSSNamespaceRule);

    const customOk = blockContents('@custom-media --x true;');
    assert.ok(customOk[0] instanceof CSSCustomMediaRule);

    // handler F, nested F → CSSAtRule; mixed-case folds.
    const unknown = blockContents('@UNKNOWN;');
    assert.ok(unknown[0] instanceof CSSAtRule);
    assert.equal((unknown[0] as CSSAtRule).name.toLowerCase(), 'unknown');

    // handler F, nested T (style-rule FromStream): dropped, no flushDecls.
    const host = firstStyle('.a { color: red; @unknown; margin: 1px; }');
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('margin'), '1px');
    assert.equal(host.cssRules.length, 0);
  });

  test('EOF / } path: isSupported / handler / nested unique-cause of the same arms', () => {
    const charsetEof = blockContents('@charset "x"');
    assert.equal(charsetEof.length, 0);

    const charsetBrace = blockContents('@charset "x" }');
    assert.equal(charsetBrace.length, 0);

    const layerEof = blockContents('@layer foo');
    assert.ok(layerEof[0] instanceof CSSLayerStatementRule);

    const layerBrace = blockContents('@layer foo }');
    assert.ok(layerBrace[0] instanceof CSSLayerStatementRule);

    const mediaEof = blockContents('@media');
    assert.equal(mediaEof.some((r) => r instanceof CSSMediaRule), false);

    const unknownEof = blockContents('@unknown');
    assert.ok(unknownEof[0] instanceof CSSAtRule);

    const unknownBrace = blockContents('@unknown }');
    assert.ok(unknownBrace[0] instanceof CSSAtRule);

    // nested T + EOF (Lazy style-rule mirror): unclosed host.
    const unclosedLayer = firstStyle('.a { color: red; @layer foo');
    assert.equal(unclosedLayer.style.getPropertyValue('color'), 'red');
    assert.ok(unclosedLayer.cssRules[0] instanceof CSSLayerStatementRule);

    const unclosedUnknown = firstStyle('.a { color: red; @unknown');
    assert.equal(unclosedUnknown.style.getPropertyValue('color'), 'red');
    assert.equal(unclosedUnknown.cssRules.length, 0);
  });

  test('`{` block path: isSupported F vs handler T handledRule F/T vs handler F nested T/F', () => {
    const charsetBlock = blockContents('@charset "x" { color: red; }');
    assert.equal(charsetBlock.some((r) => r instanceof CSSAtRule), false);

    const dashedBlock = blockContents('@--foo { color: red; }');
    assert.equal(dashedBlock.some((r) => r instanceof CSSAtRule), false);

    // handler T, handledRule F: @keyframes without a name; @property invalid prelude.
    const keyframes = blockContents('@keyframes { from { color: red; } }');
    assert.equal(keyframes.some((r) => r instanceof CSSKeyframesRule), false);

    const property = blockContents('@property foo { syntax: "*"; inherits: false; }');
    assert.equal(property.length, 0);

    // handler T, handledRule T.
    const media = blockContents('@media all { color: navy; }');
    assert.ok(media[0] instanceof CSSMediaRule);

    const layerBlock = blockContents('@layer nest { color: olive; }');
    assert.ok(layerBlock[0] instanceof CSSLayerBlockRule);

    const font = blockContents('@font-face { font-family: X; src: url(x); }');
    assert.ok(font[0] instanceof CSSFontFaceRule);

    const supports = blockContents('@supports (color: red) { color: teal; }');
    assert.ok(supports[0] instanceof CSSSupportsRule);

    const margin = blockContents('@top-left { content: "x"; }');
    assert.ok(margin[0] instanceof CSSMarginRule);

    // handler F, nested F → CSSAtRule with children.
    const unknown = blockContents('@unknown { color: red; }');
    assert.ok(unknown[0] instanceof CSSAtRule);

    // handler F, nested T: dropped inside a style rule.
    const host = firstStyle('.a { color: red; @unknown { color: navy; } padding: 2px; }');
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('padding'), '2px');
    assert.equal(host.cssRules.length, 0);

    // nested T + handler T + handledRule T.
    const nestedMedia = firstStyle('.a { color: red; @media (min-width: 1px) { color: navy; } }');
    assert.ok(nestedMedia.cssRules[0] instanceof CSSMediaRule);

    const nestedLayerStmt = firstStyle('.a { color: red; @layer foo; margin: 1px; }');
    assert.ok(nestedLayerStmt.cssRules[0] instanceof CSSLayerStatementRule);
    assert.ok(nestedLayerStmt.cssRules[1] instanceof CSSNestedDeclarations);

    // nested T + handler T + handledRule F (statement @media inside style rule).
    const nestedMediaStmt = firstStyle('.a { color: red; @media; margin: 1px; }');
    assert.equal([...nestedMediaStmt.cssRules].some((r) => r instanceof CSSMediaRule), false);
    assert.equal(nestedMediaStmt.style.getPropertyValue('color'), 'red');
    assert.equal(nestedMediaStmt.style.getPropertyValue('margin'), '1px');
  });

  test('FromStream nested T vs F unique-cause of unknown at-rules inside grouping vs style rules', () => {
    // Top-level @media uses consumeAtRule; its *body* uses FromStream nested F.
    const topMedia = parse('@media all { @unknown; .ok { color: red; } }');
    const media = topMedia.cssRules[0] as CSSMediaRule;
    assert.ok(media instanceof CSSMediaRule);
    assert.ok([...media.cssRules].some((r) => r instanceof CSSAtRule));
    assert.ok([...media.cssRules].some((r) => r instanceof CSSStyleRule));

    // Style-rule @media uses FromStream nested T, then grouping body nested T:
    // unknown is not a nested-group at-rule (css-nesting-1 § 3.3) → dropped.
    const styleMedia = firstStyle('.a { @media all { @unknown; color: red; } }');
    const inner = styleMedia.cssRules[0] as CSSMediaRule;
    assert.ok(inner instanceof CSSMediaRule);
    assert.equal([...inner.cssRules].some((r) => r instanceof CSSAtRule), false);
    assert.ok(inner.cssRules[0] instanceof CSSNestedDeclarations);
    assert.equal((inner.cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');
  });

  test('parseRuleInBlock nested T vs F unique-cause of FromStream isNestedStyleRule', () => {
    const layerNested = parseRuleInBlock('@layer foo;', true);
    assert.ok(layerNested instanceof CSSLayerStatementRule);

    const unknownTop = parseRuleInBlock('@unknown;', false);
    assert.ok(unknownTop instanceof CSSAtRule);

    assert.throws(() => parseRuleInBlock('@unknown;', true), { name: 'SyntaxError' });

    const media = parseRuleInBlock('@media all { color: red; }', true);
    assert.ok(media instanceof CSSMediaRule);
  });

  test('parseStyleAttribute consumes at-rules via FromStream (nested default F) without returning them', () => {
    const layer = new Parser(tokenize('@layer foo; color: red')).parseStyleAttribute();
    assert.equal(layer.getPropertyValue('color'), 'red');

    const unknown = new Parser(tokenize('@unknown; color: blue')).parseStyleAttribute();
    assert.equal(unknown.getPropertyValue('color'), 'blue');

    const charset = new Parser(tokenize('@charset "x"; color: teal')).parseStyleAttribute();
    assert.equal(charset.getPropertyValue('color'), 'teal');

    const mediaStmt = new Parser(tokenize('@media; color: navy')).parseStyleAttribute();
    assert.equal(mediaStmt.getPropertyValue('color'), 'navy');

    const unknownBlock = new Parser(tokenize('@unknown { color: orange; }; color: purple')).parseStyleAttribute();
    assert.equal(unknownBlock.getPropertyValue('color'), 'purple');
  });
});

describe('MC/DC leftover unique-cause: replaceSync / parseStyleSheet / streaming FromStream', () => {
  test('replaceSync style-rule body drives FromStream nested T', () => {
    const sheet = replaceSyncSheet('.a { color: red; @media all { color: navy; } @unknown; @layer foo; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    assert.ok(host.cssRules[1] instanceof CSSLayerStatementRule);
    assert.equal([...host.cssRules].some((r) => r instanceof CSSAtRule && (r as CSSAtRule).name === 'unknown'), false);
  });

  test('parseStyleSheet list vs parse() sheet unique-cause of nested FromStream', () => {
    const rules = parseStyleSheet('.a { @supports (color: red) { color: blue; } @--foo; }');
    assert.equal(rules.length, 1);
    const host = rules[0] as CSSStyleRule;
    assert.ok(host.cssRules[0] instanceof CSSSupportsRule);
    assert.equal(host.cssRules.length, 1);
  });

  test('streaming chunks across at-keyword / prelude / `{` unique-cause', () => {
    const sheet = parseStreaming([
      '.a { @',
      'media (min-width: 1px) { color: navy; } ',
      '@unknown; @layer ',
      'foo; }',
    ]);
    const host = sheet.cssRules[0] as CSSStyleRule;
    assert.ok(host instanceof CSSStyleRule);
    assert.deepEqual(ctorNames(host.cssRules), ['CSSMediaRule', 'CSSLayerStatementRule']);
  });
});

describe('MC/DC leftover unique-cause: #resolveVarFunction L1751 guaranteed-invalid IACVT', { concurrency: false }, () => {
  test('resolved.length === 1 ident guaranteed-invalid T vs other ident vs non-ident vs length !== 1', () => {
    // css-variables-1 § 3.1 #guaranteed-invalid / #replace-a-var.
    // Cycle path (L1737) is already in still-hot tests; this is IACVT of a
    // *set* custom property whose substituted value is the sentinel.
    const st = new CSSStyleDeclaration();

    // TTT: --a is var(--missing) → single \0guaranteed-invalid ident.
    st.setProperty('--a', 'var(--mcdc-par4-missing)');
    st.setProperty('color', 'var(--a)');
    assert.equal(Parser.resolveVariables(st, 'color'), '');
    // TTT + hasFallback T: IACVT uses the outer fallback (not empty).
    st.setProperty('color', 'var(--a, lime)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'lime');

    // chained IACVT: --b missing → --a guaranteed-invalid → color fallback.
    st.setProperty('--a', 'var(--b)');
    st.setProperty('color', 'var(--a, aqua)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'aqua');

    // TTF: length 1 ident whose value is not the sentinel.
    st.setProperty('--a', 'red');
    st.setProperty('color', 'var(--a)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'red');
    st.setProperty('--a', 'inherit');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'inherit');

    // TFT: length 1, type ident F (dimension / string / url / function / block).
    st.setProperty('--a', '1px');
    st.setProperty('width', 'var(--a)');
    assert.equal(Parser.resolveVariables(st, 'width').trim(), '1px');

    st.setProperty('--a', '"hi"');
    st.setProperty('--out', 'var(--a)');
    assert.equal(Parser.resolveVariables(st, '--out').includes('hi'), true);

    st.setProperty('--a', 'url(x)');
    assert.equal(Parser.resolveVariables(st, '--out').includes('url'), true);

    st.setProperty('--a', 'rgb(0, 0, 0)');
    assert.equal(Parser.resolveVariables(st, '--out').includes('rgb'), true);

    st.setProperty('--a', '(red)');
    assert.equal(Parser.resolveVariables(st, '--out').includes('red'), true);

    // FTT: length !== 1 (multiple tokens).
    st.setProperty('--a', 'red blue');
    assert.equal(Parser.resolveVariables(st, '--out').trim(), 'red blue');

    st.setProperty('--x', '1px');
    st.setProperty('--y', '2px');
    st.setProperty('--a', 'var(--x) var(--y)');
    assert.equal(Parser.resolveVariables(st, '--out').includes('1px'), true);
    assert.equal(Parser.resolveVariables(st, '--out').includes('2px'), true);

    // length 0 is also first-conjunct F: empty fallback is not the sentinel,
    // so outer fallback is *not* taken (distinct from TTT IACVT above).
    st.setProperty('--a', 'var(--mcdc-par4-missing,)');
    st.setProperty('color', 'var(--a, yellow)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), '');
  });
});
