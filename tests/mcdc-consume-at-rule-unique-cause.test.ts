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
// Leftover unique-cause for src/parser.ts consumeAtRule (10/14 D, 11/15 C,
// incomplete 4). Hottest seam L353 token.type !== 'at-keyword'. Remaining
// incomplete: L371 nested after handler F on semicolon/EOF, L386 nested after
// handler F on `{`, L362 while (true) F.
// tests/mcdc-branch-parser*.test.ts, tests/mcdc-branch-parser-leftover.test.ts,
// tests/mcdc-parser-still-hot-unique-cause.test.ts, and
// tests/mcdc-parser-atrule-stream-unique-cause.test.ts (FromStream twin) do
// not isolate L353 T: consumeRule peeks at-keyword before calling.
// Drive parse() / parseStyleSheet / CSSStyleSheet.replaceSync. Prefer real CSS.
// consumeRule(true) is the only public nested=T seam (style-rule bodies use
// consumeAtRuleFromStream). css-syntax-3 § 5.5.2 #consume-at-rule /
// § 5.4.4 / § 3.2, css-nesting-1 § 3.3 #conditionals, css-values-4 § 4.1
// #keywords. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseStyleSheet,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import type { Rule, Token } from '../src/types.ts';
import {
  CSSAtRule,
  CSSStyleRule,
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
  CSSPropertyRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';

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

function callConsumeAtRule(tokens: Token[], nested?: boolean): unknown {
  const parser = new Parser(tokens);
  const fn = Reflect.get(Object.getPrototypeOf(parser), 'consumeAtRule');
  assert.equal(typeof fn, 'function', 'consumeAtRule');
  const call = fn as (this: Parser, nested?: boolean) => unknown;
  return nested === undefined ? call.call(parser) : call.call(parser, nested);
}

function astAtRule(rule: unknown): { type: string; name: string; childRules?: unknown[] } {
  assert.ok(rule !== null && typeof rule === 'object');
  const rec = rule as { type?: unknown; name?: unknown; childRules?: unknown[] };
  assert.equal(rec.type, 'at-rule');
  assert.equal(typeof rec.name, 'string');
  return rec as { type: string; name: string; childRules?: unknown[] };
}

describe('MC/DC leftover unique-cause: consumeAtRule L353 token.type !== at-keyword', () => {
  test('T: non-at token (consumeRule peeks at-keyword; defensive spec arm)', () => {
    // css-syntax-3 § 5.5.2 #consume-at-rule assumes the next token is an
    // <at-keyword-token>. consumeRule / consumeListOfRules peek at-keyword
    // before calling, so T is unpairable via parse() / parseStyleSheet /
    // replaceSync / streaming.
    assert.equal(callConsumeAtRule(tokenize('color')), null);
    assert.equal(callConsumeAtRule(tokenize('1')), null);
    assert.equal(callConsumeAtRule(tokenize(';')), null);
    assert.equal(callConsumeAtRule([]), null);
    assert.equal(callConsumeAtRule(tokenize('')), null);
    assert.equal(callConsumeAtRule(tokenize('#id')), null);
    assert.equal(callConsumeAtRule(tokenize('"x"')), null);
    assert.equal(callConsumeAtRule(tokenize('}')), null);
    assert.equal(callConsumeAtRule(tokenize('{ color: red; }')), null);
    assert.equal(callConsumeAtRule(tokenize('url(x)')), null);
    // nested default vs explicit does not change the L353 T return.
    assert.equal(callConsumeAtRule(tokenize('color'), true), null);
    assert.equal(callConsumeAtRule(tokenize('color'), false), null);
  });

  test('F: @media / @import / @unknown via parse, parseStyleSheet, replaceSync, streaming', () => {
    const media = parse('@media all { .a { color: red; } }');
    assert.ok(media.cssRules[0] instanceof CSSMediaRule);

    const unknown = parseStyleSheet('@unknown; .ok { color: green; }');
    assert.equal(unknown.length, 2);
    assert.ok(unknown[0] instanceof CSSAtRule);
    assert.equal((unknown[0] as CSSAtRule).name, 'unknown');
    assert.ok(unknown[1] instanceof CSSStyleRule);

    const imported = parse('@import "x.css";');
    assert.ok(imported.cssRules[0] instanceof CSSImportRule);

    const replaced = replaceSyncSheet('@media all { .a { color: navy; } } @layer foo;');
    assert.ok(replaced.cssRules[0] instanceof CSSMediaRule);
    assert.ok(replaced.cssRules[1] instanceof CSSLayerStatementRule);

    const streamed = parseStreaming(['@med', 'ia all { .a { color: teal; } }']);
    assert.ok(streamed.cssRules[0] instanceof CSSMediaRule);
  });
});

describe('MC/DC leftover unique-cause: consumeAtRule semicolon vs EOF vs } vs prelude', () => {
  test('terminator unique-cause: semicolon T vs EOF T vs both F `{` via parse/parseStyleSheet/replaceSync', () => {
    // semicolon T, EOF F. Following qualified rule is not swallowed.
    const semi = parse('@unknown; .ok { color: green; }');
    assert.equal(semi.cssRules.length, 2);
    assert.ok(semi.cssRules[0] instanceof CSSAtRule);
    assert.equal((semi.cssRules[0] as CSSAtRule).name, 'unknown');
    assert.ok(semi.cssRules[1] instanceof CSSStyleRule);

    const semiList = parseStyleSheet('@unknown; .ok { color: green; }');
    assert.equal(semiList.length, 2);
    assert.ok(semiList[0] instanceof CSSAtRule);

    const semiRepl = replaceSyncSheet('@unknown; .ok { color: green; }');
    assert.equal(semiRepl.cssRules.length, 2);
    assert.ok(semiRepl.cssRules[0] instanceof CSSAtRule);

    // semicolon F, EOF T.
    const eof = parse('@unknown');
    assert.equal(eof.cssRules.length, 1);
    assert.ok(eof.cssRules[0] instanceof CSSAtRule);
    assert.equal((eof.cssRules[0] as CSSAtRule).name, 'unknown');

    const eofList = parseStyleSheet('@unknown');
    assert.equal(eofList.length, 1);
    assert.ok(eofList[0] instanceof CSSAtRule);

    const eofRepl = replaceSyncSheet('@unknown');
    assert.equal(eofRepl.cssRules.length, 1);
    assert.ok(eofRepl.cssRules[0] instanceof CSSAtRule);

    // both F → `{` block path.
    const block = parse('@unknown { color: red; }');
    assert.ok(block.cssRules[0] instanceof CSSAtRule);
    assert.equal((block.cssRules[0] as CSSAtRule).cssText.includes('{'), true);

    const blockList = parseStyleSheet('@unknown { color: red; }');
    assert.ok(blockList[0] instanceof CSSAtRule);
    assert.equal((blockList[0] as CSSAtRule).cssText.includes('{'), true);

    const blockRepl = replaceSyncSheet('@unknown { color: red; }');
    assert.ok(blockRepl.cssRules[0] instanceof CSSAtRule);
  });

  test('} unique-cause of nested T vs F (prelude-append vs return-null)', () => {
    // nested T: consumeAtRule returns null without treating `}` as a statement.
    // parse() / parseStyleSheet / replaceSync always pass nested=false
    // (consumeListOfRules → consumeRule()); style-rule bodies use FromStream.
    assert.equal(new Parser(tokenize('@foo }')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@layer }')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@unknown }')).consumeRule(true), null);

    // nested F: `}` is appended to the prelude and parsing continues
    // (css-syntax-3 § 5.5.2: unexpected } in a non-nested at-rule).
    const top = parse('@foo }');
    assert.ok(top.cssRules[0] instanceof CSSAtRule);
    assert.equal((top.cssRules[0] as CSSAtRule).name, 'foo');

    const swallowed = parse('@foo } .ok { color: red; }');
    assert.equal(swallowed.cssRules.length, 1);
    assert.ok(swallowed.cssRules[0] instanceof CSSAtRule);
    assert.equal((swallowed.cssRules[0] as CSSAtRule).name, 'foo');

    const swallowedList = parseStyleSheet('@foo } .ok { color: red; }');
    assert.equal(swallowedList.length, 1);
    assert.ok(swallowedList[0] instanceof CSSAtRule);

    const swallowedRepl = replaceSyncSheet('@foo } .ok { color: red; }');
    assert.equal(swallowedRepl.cssRules.length, 1);
    assert.ok(swallowedRepl.cssRules[0] instanceof CSSAtRule);
  });

  test('prelude unique-cause of non-`{` component values vs `{` block arm', () => {
    // simple-block `[` / `(` are prelude, not the `{` arm.
    const square = parse('@foo [x];');
    assert.ok(square.cssRules[0] instanceof CSSAtRule);
    assert.equal((square.cssRules[0] as CSSAtRule).cssText.includes('[x]'), true);

    const paren = parse('@foo (x);');
    assert.ok(paren.cssRules[0] instanceof CSSAtRule);
    assert.equal((paren.cssRules[0] as CSSAtRule).cssText.includes('(x)'), true);

    // prelude then `{`: `[x]` stays prelude; `{` unique-causes the block arm.
    const squareThenBlock = parseStyleSheet('@foo [x] { color: red; }');
    assert.ok(squareThenBlock[0] instanceof CSSAtRule);
    assert.equal((squareThenBlock[0] as CSSAtRule).cssText.includes('[x]'), true);
    assert.equal((squareThenBlock[0] as CSSAtRule).cssText.includes('{'), true);

    const identPrelude = parse('@foo bar;');
    assert.ok(identPrelude.cssRules[0] instanceof CSSAtRule);
    assert.equal((identPrelude.cssRules[0] as CSSAtRule).cssText.includes('bar'), true);

    const urlPrelude = replaceSyncSheet('@foo url(x);');
    assert.ok(urlPrelude.cssRules[0] instanceof CSSAtRule);
    assert.equal((urlPrelude.cssRules[0] as CSSAtRule).cssText.includes('url'), true);

    const strPrelude = parse('@foo "bar";');
    assert.ok(strPrelude.cssRules[0] instanceof CSSAtRule);

    const fnPrelude = parse('@foo var(--x);');
    assert.ok(fnPrelude.cssRules[0] instanceof CSSAtRule);

    const mixed = parse('@foo url(x) [y] ident;');
    assert.ok(mixed.cssRules[0] instanceof CSSAtRule);
    assert.equal((mixed.cssRules[0] as CSSAtRule).cssText.includes('url'), true);
    assert.equal((mixed.cssRules[0] as CSSAtRule).cssText.includes('[y]'), true);
  });
});

describe('MC/DC leftover unique-cause: consumeAtRule isSupported / handler / nested', () => {
  test('semicolon / EOF / `{` path: isSupported F vs handler T handledRule F/T vs handler F nested F', () => {
    // isSupported F: @charset / @mediaall / @--foo (css-syntax-3 § 3.2, css-nesting-1 § 3.3).
    const charset = parse('@charset "utf-8"; .ok { color: green; }');
    assert.equal(charset.cssRules.length, 1);
    assert.ok(charset.cssRules[0] instanceof CSSStyleRule);

    const charsetEof = parseStyleSheet('@charset "utf-8"');
    assert.equal(charsetEof.length, 0);

    const charsetBlock = parse('@charset "x" { color: red; } .ok { color: green; }');
    assert.equal(charsetBlock.cssRules.length, 1);
    assert.ok(charsetBlock.cssRules[0] instanceof CSSStyleRule);

    const mediaAll = parse('@mediaall; @mediaall { p { color: red; } } .ok { color: green; }');
    assert.equal(mediaAll.cssRules.length, 1);
    assert.equal((mediaAll.cssRules[0] as CSSStyleRule).selectorText, '.ok');

    const dashed = parse('@--foo; @--foo { color: red; } @--keyframes x { from { color: red; } } .ok { color: green; }');
    assert.equal(dashed.cssRules.length, 1);
    assert.equal((dashed.cssRules[0] as CSSStyleRule).selectorText, '.ok');

    const mixedCase = parse('@CHARSET "utf-8"; @MediaAll { p { color: red; } } .ok { color: green; }');
    assert.equal(mixedCase.cssRules.length, 1);
    assert.ok(mixedCase.cssRules[0] instanceof CSSStyleRule);

    // handler T, handledRule F (block-required at-rules as statements / invalid prelude).
    const mediaStmt = parse('@media; .ok { color: green; }');
    assert.equal(mediaStmt.cssRules.length, 1);
    assert.ok(mediaStmt.cssRules[0] instanceof CSSStyleRule);

    const fontStmt = parse('@font-face; .ok { color: green; }');
    assert.equal([...fontStmt.cssRules].some((r) => r instanceof CSSFontFaceRule), false);

    const keyframes = parse('@keyframes { from { color: red; } } .ok { color: green; }');
    assert.equal([...keyframes.cssRules].some((r) => r instanceof CSSKeyframesRule), false);

    const property = parse('@property foo { syntax: "*"; inherits: false; } .ok { color: green; }');
    assert.equal([...property.cssRules].some((r) => r instanceof CSSPropertyRule), false);

    // handler T, handledRule T (statement + block).
    const layerStmt = parse('@layer foo;');
    assert.ok(layerStmt.cssRules[0] instanceof CSSLayerStatementRule);

    const layerEof = parseStyleSheet('@layer foo');
    assert.ok(layerEof[0] instanceof CSSLayerStatementRule);

    const imported = parse('@import "x.css";');
    assert.ok(imported.cssRules[0] instanceof CSSImportRule);

    const ns = parse('@namespace "http://a";');
    assert.ok(ns.cssRules[0] instanceof CSSNamespaceRule);

    const customOk = parse('@custom-media --x true;');
    assert.ok(customOk.cssRules[0] instanceof CSSCustomMediaRule);

    const media = parse('@media all { .a { color: navy; } }');
    assert.ok(media.cssRules[0] instanceof CSSMediaRule);

    const layerBlock = parse('@layer nest { .a { color: olive; } }');
    assert.ok(layerBlock.cssRules[0] instanceof CSSLayerBlockRule);

    const font = parse('@font-face { font-family: X; src: url(x); }');
    assert.ok(font.cssRules[0] instanceof CSSFontFaceRule);

    const supports = parse('@supports (color: red) { .a { color: teal; } }');
    assert.ok(supports.cssRules[0] instanceof CSSSupportsRule);

    const margin = parse('@top-left { content: "x"; }');
    assert.ok(margin.cssRules[0] instanceof CSSMarginRule);

    const vendor = parse('@-webkit-keyframes spin { from { opacity: 0; } }');
    assert.ok(vendor.cssRules[0] instanceof CSSKeyframesRule);

    // handler F, nested F → CSSAtRule. Mixed-case folds on support/handler lookup
    // but CSSAtRule.name keeps the source spelling.
    const unknown = parse('@UNKNOWN;');
    assert.ok(unknown.cssRules[0] instanceof CSSAtRule);
    assert.equal((unknown.cssRules[0] as CSSAtRule).name.toLowerCase(), 'unknown');

    const unknownBlock = parse('@unknown { color: red; }');
    assert.ok(unknownBlock.cssRules[0] instanceof CSSAtRule);
    assert.equal((unknownBlock.cssRules[0] as CSSAtRule).cssText.includes('{'), true);

    const unknownRepl = replaceSyncSheet('@UNKNOWN; @unknown { color: red; }');
    assert.equal(unknownRepl.cssRules.length, 2);
    assert.ok(unknownRepl.cssRules[0] instanceof CSSAtRule);
    assert.ok(unknownRepl.cssRules[1] instanceof CSSAtRule);
  });

  test('nested T handler T vs isSupported F (L371/L386 nested T unpairable after handler F)', () => {
    // handler T, nested T, handledRule T: @layer statement / @media block.
    const layerNested = new Parser(tokenize('@layer;')).consumeRule(true);
    assert.ok(layerNested instanceof CSSLayerStatementRule);

    const mediaNested = new Parser(tokenize('@media (min-width: 1px) { color: red; }')).consumeRule(true);
    assert.ok(mediaNested instanceof CSSMediaRule);

    // handler T, nested T, handledRule F (@media requires a block).
    assert.equal(new Parser(tokenize('@media;')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@supports;')).consumeRule(true), null);

    // handler F, nested T: isSupportedAtRule(name, true) is false for
    // non-group/non-margin names (css-nesting-1 § 3.3), so consumeAtRule
    // returns at the isSupported check and never reaches L371 / L386.
    assert.equal(new Parser(tokenize('@unknown;')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@unknown { color: red; }')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@keyframes x { from { color: red; } }')).consumeRule(true), null);
  });

  test('options.atRules leftover unique-cause of declaration vs rule vs neither on the `{` path', () => {
    // css-values-4 § 4.1 #keywords: lookup is ASCII-case-insensitive.
    const other = new Parser(tokenize('@foo { color: red; }'), { atRules: { foo: 'other' } }).parseStyleSheet();
    assert.ok(other.cssRules[0] instanceof CSSAtRule);

    const missing = new Parser(tokenize('@foo { color: red; }'), { atRules: {} }).parseStyleSheet();
    assert.ok(missing.cssRules[0] instanceof CSSAtRule);

    // statement form does not consult atRules (only the `{` arm does).
    const stmt = new Parser(tokenize('@foo;'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
    assert.ok(stmt.cssRules[0] instanceof CSSAtRule);

    const declType = new Parser(tokenize('@foo { color: red; }'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
    assert.equal(declType.cssRules[0] instanceof CSSAtRule, false);
    const declAst = astAtRule(declType.cssRules[0]);
    assert.ok(declAst.childRules?.some((r) => {
      if (r === null || typeof r !== 'object') return false;
      const rec = r as { type?: unknown; name?: unknown };
      return rec.type === 'declaration' && rec.name === 'color';
    }));

    const folded = new Parser(tokenize('@FOO { color: red; }'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
    assert.equal(folded.cssRules[0] instanceof CSSAtRule, false);
    astAtRule(folded.cssRules[0]);

    const ruleType = new Parser(tokenize('@foo { div { color: red; } }'), { atRules: { foo: 'rule' } }).parseStyleSheet();
    const ruleAst = astAtRule(ruleType.cssRules[0]);
    assert.ok(ruleAst.childRules?.some((r) => r instanceof CSSStyleRule));
  });
});

describe('MC/DC leftover unique-cause: replaceSync / parseStyleSheet / streaming consumeAtRule', () => {
  test('replaceSync top-level consumeAtRule nested F (style-rule body is FromStream)', () => {
    const sheet = replaceSyncSheet('@media all { .a { color: red; } } @layer foo; @unknown;');
    assert.deepEqual(ctorNames(sheet.cssRules), ['CSSMediaRule', 'CSSLayerStatementRule', 'CSSAtRule']);

    // cssom-1 § 6.5.1: constructed sheets drop @import.
    const warn = console.warn;
    console.warn = () => {};
    try {
      const imported = replaceSyncSheet('@import "x.css"; @layer foo;');
      assert.equal([...imported.cssRules].some((r) => r instanceof CSSImportRule), false);
      assert.ok(imported.cssRules[0] instanceof CSSLayerStatementRule);
    } finally {
      console.warn = warn;
    }
  });

  test('parseStyleSheet list vs parse() sheet unique-cause of top-level consumeAtRule', () => {
    const rules = parseStyleSheet('@supports (color: red) { .a { color: blue; } } @--foo; @unknown;');
    assert.ok(rules[0] instanceof CSSSupportsRule);
    assert.ok(rules[1] instanceof CSSAtRule);
    assert.equal(rules.length, 2);

    const sheet = parse('@supports (color: red) { .a { color: blue; } } @--foo; @unknown;');
    assert.ok(sheet.cssRules[0] instanceof CSSSupportsRule);
    assert.ok(sheet.cssRules[1] instanceof CSSAtRule);
    assert.equal(sheet.cssRules.length, 2);
  });

  test('streaming chunks across at-keyword / prelude / `{` unique-cause', () => {
    const sheet = parseStreaming([
      '@',
      'media (min-width: 1px) { .a { color: navy; } } ',
      '@unknown; @layer ',
      'foo;',
    ]);
    assert.deepEqual(ctorNames(sheet.cssRules), ['CSSMediaRule', 'CSSAtRule', 'CSSLayerStatementRule']);
  });
});
