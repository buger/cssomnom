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
// Leftover unique-cause for src/parser.ts consumeBlockContents (16/20 D,
// 21/25 C, incomplete 4). Hottest seam L1004 next.type === "}" in the
// ident+colon lookahead OR. Remaining incomplete: L1020 foundBlock F,
// L973 while (true) F, L1002 while (true) F.
// tests/mcdc-branch-parser*.test.ts, tests/mcdc-branch-parser-leftover.test.ts,
// and tests/mcdc-parser-still-hot-unique-cause.test.ts isolate foundSemicolon
// via EOF (LazyComponentValueStream maps `}` → EOF) but not L1004 `}` T.
// Drive parse() / parseStyleSheet / CSSStyleSheet.replaceSync /
// Parser.parseBlockContents / parseRuleInBlock / nested rules / declarations.
// Prefer real CSS. css-syntax-3 § 5.4.5 #parse-block-contents /
// § 5.5.4 #consume-block-contents / § 5.5.3 #consume-qualified-rule /
// § 5.5.8 #consume-a-simple-block, css-nesting-1 § 3 #nest-selector /
// § 3.3 #conditionals / § 4.1 #cssnesteddeclarations. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseStyleSheet,
  parseRuleInBlock,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import type { Rule } from '../src/types.ts';
import {
  CSSStyleRule,
  CSSNestedDeclarations,
  CSSMediaRule,
  CSSSupportsRule,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSImportRule,
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

function nestedDecl(rule: Rule): CSSNestedDeclarations {
  assert.ok(rule instanceof CSSNestedDeclarations, `expected CSSNestedDeclarations, got ${rule.constructor.name}`);
  return rule;
}

describe('MC/DC leftover unique-cause: consumeBlockContents L1004 EOF vs } vs neither', () => {
  test('EOF T, } F: parseStyleSheet / replaceSync / streaming map block `}` to EOF', () => {
    // css-syntax-3 § 5.5.3 #consume-qualified-rule: after `{`,
    // LazyComponentValueStream mirrors `}` as EOF, so the ident+colon
    // lookahead at L1004 sees EOF T and never evaluates `}`.
    const eof = firstStyle('.a { color: red }');
    assert.equal(eof.style.getPropertyValue('color').trim(), 'red');
    assert.equal(eof.style.getPropertyValue('color').includes('}'), false);

    const eofList = parseStyleSheet('.a { color: red }');
    assert.equal((eofList[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');

    const eofRepl = replaceSyncSheet('.a { color: navy }');
    assert.equal((eofRepl.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'navy');

    const streamed = parseStreaming(['.a { col', 'or: teal }']);
    assert.equal((streamed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'teal');

    // empty value still EOF T (no semicolon before the mirrored `}`).
    const empty = firstStyle('.a { color: }');
    assert.equal(empty.style.getPropertyValue('color').trim(), '');
  });

  test('EOF F, } T: parseBlockContents keeps `}` as a component value', () => {
    // css-syntax-3 § 5.4.5 #parse-block-contents: top-level `}` is not a
    // simple-block closer, so ArrayComponentValueStream yields type `}`.
    // L1004 unique-cause of `}` with EOF F → foundSemicolon T → isDecl.
    // consumeDeclarationFromStream does not stop at `}`, so `}` stays in
    // the declaration value (contrast parseStyleSheet, which never injects it).
    const brace = blockContents('color: red }');
    assert.equal(brace.length, 1);
    const decl = nestedDecl(brace[0]);
    assert.equal(decl.style.getPropertyValue('color').includes('red'), true);
    assert.equal(decl.style.getPropertyValue('color').includes('}'), true);

    const tight = blockContents('color:}');
    assert.equal(tight.length, 1);
    assert.equal(nestedDecl(tight[0]).style.getPropertyValue('color').includes('}'), true);

    const spaced = blockContents('color: }');
    assert.equal(spaced.length, 1);
    assert.equal(nestedDecl(spaced[0]).style.getPropertyValue('color').includes('}'), true);

    // `[` / `(` simple-blocks are not `{`, so the lookahead pushes them
    // and still unique-causes L1004 `}` T.
    const square = blockContents('color: [x] }');
    assert.equal(nestedDecl(square[0]).style.getPropertyValue('color').includes('}'), true);
    const paren = blockContents('color: (x) }');
    assert.equal(nestedDecl(paren[0]).style.getPropertyValue('color').includes('}'), true);
  });

  test('both F: semicolon / `{` simple-block unique-cause of the lookahead continue', () => {
    // semicolon T (L1008) unique-causes foundSemicolon without L1004.
    const semi = firstStyle('.a { color: red; }');
    assert.equal(semi.style.getPropertyValue('color').trim(), 'red');
    const semiBlock = blockContents('color: red;');
    assert.equal(nestedDecl(semiBlock[0]).style.getPropertyValue('color').trim(), 'red');

    // `{` simple-block unique-causes foundBlock (L1012) with foundSemicolon F.
    const hover = firstStyle('.a { color:hover { color: red; } }');
    assert.equal((hover.cssRules[0] as CSSStyleRule).selectorText, '& color:hover');
    assert.equal((hover.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');

    const hoverBlock = blockContents('color:hover { color: red; }');
    assert.ok(hoverBlock[0] instanceof CSSStyleRule);
    assert.equal((hoverBlock[0] as CSSStyleRule).selectorText, 'color:hover');
  });
});

describe('MC/DC leftover unique-cause: consumeBlockContents L977 outer EOF vs }', () => {
  test('outer terminator unique-cause of EOF T vs } T vs neither', () => {
    // EOF T, } F: no stray `}` token.
    assert.equal(blockContents('').length, 0);
    assert.equal(blockContents('   ').length, 0);
    const eofDecl = blockContents('color: red');
    assert.equal(nestedDecl(eofDecl[0]).style.getPropertyValue('color').trim(), 'red');

    // } T, EOF F: `}` after a semicolon (L1004 does not run; L1008 already
    // ended the ident+colon lookahead). Bare `}` is skipped at L977.
    const afterSemi = blockContents('color: red; }');
    assert.equal(afterSemi.length, 1);
    assert.equal(nestedDecl(afterSemi[0]).style.getPropertyValue('color').trim(), 'red');
    assert.equal(nestedDecl(afterSemi[0]).style.getPropertyValue('color').includes('}'), false);
    assert.equal(blockContents('}').length, 0);
    assert.equal(blockContents(';;;').length, 0);

    // neither: whitespace / semicolon skip then a following declaration.
    const both = blockContents('  ; color: green;');
    assert.equal(nestedDecl(both[0]).style.getPropertyValue('color').trim(), 'green');
  });
});

describe('MC/DC leftover unique-cause: consumeBlockContents foundBlock / parseSelectorAST', () => {
  test('foundBlock T: valid selector vs invalid selector unique-cause of isDecl', () => {
    // foundBlock T, parseSelectorAST T → isDecl F → nested qualified rule.
    const divHover = firstStyle('.a { div:hover { color: red; } background: blue; }');
    assert.equal((divHover.cssRules[0] as CSSStyleRule).selectorText, '& div:hover');
    assert.ok(divHover.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((divHover.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('background').trim(), 'blue');

    const typeSel = firstStyle('.a { div { color: red; } }');
    assert.equal((typeSel.cssRules[0] as CSSStyleRule).selectorText, '& div');

    // foundBlock T, parseSelectorAST F → isDecl T, then curly+value rejects
    // the declaration (css-syntax-3 § 5.5.5 / consumeDeclarationFromStream).
    const colorBlock = firstStyle('.a { color: red { x: y; } background: blue; }');
    assert.equal(colorBlock.style.getPropertyValue('color'), '');
    assert.equal(colorBlock.style.getPropertyValue('background').trim(), 'blue');
    assert.equal(colorBlock.cssRules.length, 0);

    const colorBlockFrag = blockContents('color: red { x }');
    assert.equal(colorBlockFrag.length, 0);

    // associatedToken `{` F: `[` / `(` are not foundBlock; treated as decl value.
    const square = firstStyle('.a { color: red [x]; }');
    assert.equal(square.style.getPropertyValue('color').includes('['), true);
    const paren = firstStyle('.a { color: red (x); }');
    assert.equal(paren.style.getPropertyValue('color').includes('('), true);
  });
});

describe('MC/DC leftover unique-cause: consumeBlockContents nested / isDecl lookahead', () => {
  test('nested T vs F unique-cause of ident+colon isDecl vs nested-qualified fallback', () => {
    // nested T, isNestedStyleRule T: style-rule body prefixes `&`.
    const host = firstStyle('.a { color: red; .b { color: blue; } }');
    assert.equal(host.style.getPropertyValue('color').trim(), 'red');
    assert.ok(host.cssRules[0] instanceof CSSStyleRule);
    assert.equal((host.cssRules[0] as CSSStyleRule).selectorText, '& .b');

    // nested T, isNestedStyleRule F (parseBlockContents): isDecl still runs, no `&`.
    const block = blockContents('color: red; .b { color: blue; }');
    assert.ok(block[0] instanceof CSSNestedDeclarations);
    assert.equal(nestedDecl(block[0]).style.getPropertyValue('color').trim(), 'red');
    assert.ok(block[1] instanceof CSSStyleRule);
    assert.equal((block[1] as CSSStyleRule).selectorText, '.b');

    // nested F: grouping-rule bodies inherit the at-rule nested flag
    // (handleGroupingAtRule → consumeNestedRules). Top-level @media skips
    // isDecl, so ident+colon without `{` is not kept as CSSNestedDeclarations.
    const topMedia = parse('@media all { color: red; }');
    assert.ok(topMedia.cssRules[0] instanceof CSSMediaRule);
    assert.equal((topMedia.cssRules[0] as CSSMediaRule).cssRules.length, 0);
    const topList = parseStyleSheet('@supports (color: red) { color: teal; }');
    assert.ok(topList[0] instanceof CSSSupportsRule);
    assert.equal((topList[0] as CSSSupportsRule).cssRules.length, 0);
    const topRepl = replaceSyncSheet('@layer nest { color: olive; }');
    assert.ok(topRepl.cssRules[0] instanceof CSSLayerBlockRule);
    assert.equal((topRepl.cssRules[0] as CSSLayerBlockRule).cssRules.length, 0);

    // nested T grouping body (style-rule @media): isDecl keeps the declaration.
    const nestedMedia = firstStyle('.a { @media all { color: navy; } }');
    const inner = nestedMedia.cssRules[0] as CSSMediaRule;
    assert.ok(inner instanceof CSSMediaRule);
    assert.equal(inner.cssRules.length, 1);
    assert.ok(inner.cssRules[0] instanceof CSSNestedDeclarations);
    assert.equal((inner.cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('color').trim(), 'navy');

    const nestedSupports = firstStyle('.a { @supports (display: grid) { color: teal; } }');
    assert.equal(
      ((nestedSupports.cssRules[0] as CSSSupportsRule).cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('color').trim(),
      'teal',
    );

    // parseRuleInBlock nested F rejects a bare declaration (not a rule).
    assert.throws(() => parseRuleInBlock('color: blue;', false), { name: 'SyntaxError' });
    const unprefixed = parseRuleInBlock('.child { color: red; }', false);
    assert.ok(unprefixed instanceof CSSStyleRule);
    assert.equal(unprefixed.selectorText, '.child');
    const prefixed = parseRuleInBlock('.child { color: red; }', true);
    assert.ok(prefixed instanceof CSSStyleRule);
    assert.equal(prefixed.selectorText, '& .child');
  });

  test('isDecl unique-cause of ident / --custom / -- / colon / whitespace', () => {
    // first.type === 'ident' F: hash / pseudo / type-star start a nested rule.
    assert.equal((firstStyle('.a { #id { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& #id');
    assert.equal((firstStyle('.a { :hover { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& :hover');
    assert.equal((firstStyle('.a { * { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& *');

    // startsWith('--') T && !== '--' T → isDecl without the L1004 lookahead.
    const custom = firstStyle('.a { --foo: red; .b { color: blue; } --bar: green; }');
    assert.equal(custom.style.getPropertyValue('--foo').trim(), 'red');
    assert.ok(custom.cssRules[0] instanceof CSSStyleRule);
    assert.ok(custom.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((custom.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('--bar').trim(), 'green');

    // parseBlockContents: `--foo: red }` skips L1004; `}` fails custom
    // validation (css-variables-1 #syntax) so the decl is dropped. Contrast
    // `color: red }` which unique-causes L1004 and keeps `}`.
    assert.equal(blockContents('--foo: red }').length, 0);
    assert.equal(blockContents('--foo: red').length, 1);
    assert.equal(nestedDecl(blockContents('--foo: red')[0]).style.getPropertyValue('--foo').trim(), 'red');

    // startsWith('--') T && !== '--' F: `--:` is not isDecl.
    const dashOnly = firstStyle('.a { --: red; color: blue; }');
    assert.equal(dashOnly.style.getPropertyValue('--'), '');
    assert.equal(dashOnly.style.getPropertyValue('color').trim(), 'blue');

    // colon F: type selector `div { }` vs `div;` bad nested rule.
    const typeSel = firstStyle('.a { div { color: red; } background: blue; }');
    assert.equal((typeSel.cssRules[0] as CSSStyleRule).selectorText, '& div');
    assert.ok(typeSel.cssRules[1] instanceof CSSNestedDeclarations);
    const identSemi = firstStyle('.a { div; color: blue; }');
    assert.equal(identSemi.style.getPropertyValue('color').trim(), 'blue');
    assert.equal(identSemi.cssRules.length, 0);

    // whitespace after ident unique-cause of the skip-while vs tight colon.
    assert.equal(firstStyle('.a { color:red; }').style.getPropertyValue('color').trim(), 'red');
    assert.equal(firstStyle('.a { color : blue; }').style.getPropertyValue('color').trim(), 'blue');
  });
});

describe('MC/DC leftover unique-cause: consumeBlockContents flushDecls / at-rule / nested rule', () => {
  test('atRule T vs F unique-cause of flushDecls vs coalesced declarations', () => {
    // atRule T: flush leading decls into the style rule, leftover after
    // the nested grouping rule becomes CSSNestedDeclarations.
    const withMedia = firstStyle('.a { color: red; @media (min-width: 1px) { color: navy; } margin: 1px; }');
    assert.equal(withMedia.style.getPropertyValue('color').trim(), 'red');
    assert.equal(withMedia.style.getPropertyValue('margin'), '');
    assert.ok(withMedia.cssRules[0] instanceof CSSMediaRule);
    assert.ok(withMedia.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((withMedia.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('margin').trim(), '1px');

    const nestedLayer = firstStyle('.a { color: red; @layer nest { color: olive; } padding: 2px; }');
    assert.ok(nestedLayer.cssRules[0] instanceof CSSLayerBlockRule);
    assert.ok(nestedLayer.cssRules[1] instanceof CSSNestedDeclarations);

    // atRule F: nested @import is dropped and does not flush, so later
    // declarations coalesce with the leading run (css-nesting-1 § 3.3).
    const droppedImport = firstStyle('.a { color: red; @import "x.css"; margin: 1px; }');
    assert.equal(droppedImport.style.getPropertyValue('color').trim(), 'red');
    assert.equal(droppedImport.style.getPropertyValue('margin').trim(), '1px');
    assert.equal([...droppedImport.cssRules].some((r) => r instanceof CSSImportRule), false);

    const droppedUnknown = firstStyle('.a { color: red; @unknown; padding: 2px; }');
    assert.equal(droppedUnknown.style.getPropertyValue('color').trim(), 'red');
    assert.equal(droppedUnknown.style.getPropertyValue('padding').trim(), '2px');

    // statement @layer is atRule T and does flush.
    const layerStmt = firstStyle('.a { color: red; @layer foo; margin: 1px; }');
    assert.ok(layerStmt.cssRules[0] instanceof CSSLayerStatementRule);
    assert.ok(layerStmt.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((layerStmt.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('margin').trim(), '1px');
  });

  test('nested qualified rule T vs F and first-vs-later CSSNestedDeclarations flatten', () => {
    const host = firstStyle(`
      .a {
        color: red;
        .b { color: blue; }
        margin: 1px;
        .c { color: green; }
        padding: 2px;
      }
    `);
    assert.equal(host.style.getPropertyValue('color').trim(), 'red');
    assert.equal(host.style.getPropertyValue('margin'), '');
    const kids = [...host.cssRules];
    assert.ok(kids[0] instanceof CSSStyleRule);
    assert.equal((kids[0] as CSSStyleRule).selectorText, '& .b');
    assert.ok(kids[1] instanceof CSSNestedDeclarations);
    assert.equal((kids[1] as CSSNestedDeclarations).style.getPropertyValue('margin').trim(), '1px');
    assert.ok(kids[2] instanceof CSSStyleRule);
    assert.equal((kids[2] as CSSStyleRule).selectorText, '& .c');
    assert.ok(kids[3] instanceof CSSNestedDeclarations);
    assert.equal((kids[3] as CSSNestedDeclarations).style.getPropertyValue('padding').trim(), '2px');

    // first item is a nested rule (leading decls.length === 0 at first flush).
    const noLead = firstStyle('.a { .b { color: red; } color: blue; }');
    assert.equal(noLead.style.cssText.trim(), '');
    assert.ok(noLead.cssRules[0] instanceof CSSStyleRule);
    assert.ok(noLead.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((noLead.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('color').trim(), 'blue');

    // rule F: invalid nested selector / ident-without-block dropped; later decl kept.
    const invalid = firstStyle('.a { 123 { color: red; } color: blue; }');
    assert.equal(invalid.style.getPropertyValue('color').trim(), 'blue');
    assert.equal(invalid.cssRules.length, 0);

    const noBlock = firstStyle('.a { div; color: blue; }');
    assert.equal(noBlock.style.getPropertyValue('color').trim(), 'blue');

    const emptyBlock = firstStyle('.a { }');
    assert.equal(emptyBlock.style.cssText.trim(), '');
    assert.equal(emptyBlock.cssRules.length, 0);
  });

  test('parseRuleInBlock / parseBlockContents / replaceSync nested-declaration leftover', () => {
    const decls = parseRuleInBlock('color: blue;', true);
    assert.ok(decls instanceof CSSNestedDeclarations);
    assert.equal(decls.style.getPropertyValue('color').trim(), 'blue');

    const media = parseRuleInBlock('@media (min-width: 1px) { color: red; }', true);
    assert.ok(media instanceof CSSMediaRule);
    assert.equal(
      ((media as CSSMediaRule).cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('color').trim(),
      'red',
    );

    const two = blockContents('color: blue; margin: 1px;');
    assert.equal(two.length, 1);
    assert.equal(nestedDecl(two[0]).style.getPropertyValue('margin').trim(), '1px');

    const replaced = replaceSyncSheet('.a { color: red; .b { color: navy; } margin: 1px; }');
    const style = replaced.cssRules[0] as CSSStyleRule;
    assert.equal(style.style.getPropertyValue('color').trim(), 'red');
    assert.ok(style.cssRules[0] instanceof CSSStyleRule);
    assert.ok(style.cssRules[1] instanceof CSSNestedDeclarations);

    const streamed = parseStreaming(['.a { color: red; .b { col', 'or: navy; } }']);
    assert.equal((streamed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');
    assert.equal(((streamed.cssRules[0] as CSSStyleRule).cssRules[0] as CSSStyleRule).selectorText, '& .b');
  });
});
