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
// Leftover unique-cause for src/parser.ts consumeAtRule / consumeAtRuleFromStream,
// consumeDeclarationFromStream, and nesting (consumeBlockContents /
// consumeNestedQualifiedRuleFromStream / normalizeNestedSelector), not already
// in tests/mcdc-branch-parser*.test.ts. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseRuleInBlock,
  validateDeclarationValue,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import {
  CSSStyleRule,
  CSSAtRule,
  CSSNestedDeclarations,
  CSSLayerStatementRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSContainerRule,
  CSSScopeRule,
  CSSStartingStyleRule,
  CSSMarginRule,
  CSSImportRule,
  CSSKeyframesRule,
  CSSFontFaceRule,
  CSSPageRule,
  CSSPropertyRule,
} from '../src/CSSOM.ts';
import type { Declaration } from '../src/types.ts';

function firstStyle(css: string): CSSStyleRule {
  const sheet = parse(css);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule, `expected style rule for ${JSON.stringify(css)}`);
  return sheet.cssRules[0];
}

function parseDecl(css: string): Declaration | null {
  return new Parser(tokenize(css)).parseDeclaration();
}

function attr(css: string) {
  return new Parser(tokenize(css)).parseStyleAttribute();
}

function silentWarn<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
}

function valuesOf(decl: Declaration): string[] {
  return decl.value.map((v) => v.type);
}

describe('MC/DC leftover unique-cause: consumeAtRule (css-syntax-3 § 5.5.2 #consume-at-rule)', () => {
  test('semicolon vs EOF unique-cause of the statement terminator OR', () => {
    // semicolon T, EOF F
    const semi = parse('@unknown; .ok { color: green; }');
    assert.equal(semi.cssRules.length, 2);
    assert.ok(semi.cssRules[0] instanceof CSSAtRule);
    assert.equal((semi.cssRules[0] as CSSAtRule).name, 'unknown');
    assert.ok(semi.cssRules[1] instanceof CSSStyleRule);

    // semicolon F, EOF T
    const eof = parse('@unknown');
    assert.equal(eof.cssRules.length, 1);
    assert.ok(eof.cssRules[0] instanceof CSSAtRule);
    assert.equal((eof.cssRules[0] as CSSAtRule).name, 'unknown');

    // both F → `{` block path
    const block = parse('@unknown { color: red; }');
    assert.ok(block.cssRules[0] instanceof CSSAtRule);
    assert.equal((block.cssRules[0] as CSSAtRule).cssText.includes('{'), true);
  });

  test('} unique-cause of nested vs top-level (prelude-append vs return-null)', () => {
    // nested T: consumeAtRule returns null without treating `}` as a statement
    assert.equal(new Parser(tokenize('@foo }')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@layer }')).consumeRule(true), null);

    // nested F: `}` is appended to the prelude and parsing continues
    const top = new Parser(tokenize('@foo }')).consumeRule(false);
    assert.ok(top instanceof CSSAtRule);
    assert.equal(top.name, 'foo');

    // leftover: top-level `}` does not end the at-rule, so the next qualified
    // rule is consumed into the prelude (unique-cause of nested F on `}`).
    const swallowed = parse('@foo } .ok { color: red; }');
    assert.equal(swallowed.cssRules.length, 1);
    assert.ok(swallowed.cssRules[0] instanceof CSSAtRule);
    assert.equal((swallowed.cssRules[0] as CSSAtRule).name, 'foo');
  });

  test('isSupportedAtRule leftover unique-cause of -- prefix, margin names, and nested groups', () => {
    // lower.startsWith('--') T (not in mcdc-branch-parser*.test.ts)
    const dashed = parse('@--foo; @--foo { color: red; } @--keyframes x { from { color: red; } } .ok { color: green; }');
    assert.equal(dashed.cssRules.length, 1);
    assert.equal((dashed.cssRules[0] as CSSStyleRule).selectorText, '.ok');

    // charset / mediaall mixed-case leftover of toLowerCase
    const mixed = parse('@CHARSET "utf-8"; @MediaAll { p { color: red; } } .ok { color: green; }');
    assert.equal(mixed.cssRules.length, 1);
    assert.equal((mixed.cssRules[0] as CSSStyleRule).selectorText, '.ok');

    // MARGIN_RULE_NAMES.has T before nested check: nested @top-left is kept
    const margin = firstStyle('.a { @top-left { content: "x"; } color: blue; }');
    assert.ok(margin.cssRules[0] instanceof CSSMarginRule);
    assert.equal((margin.cssRules[0] as CSSMarginRule).name, 'top-left');
    // nested margin statement (handler exists, block F → null)
    const marginStmt = firstStyle('.a { @top-left; color: blue; }');
    assert.equal([...marginStmt.cssRules].some((r) => r instanceof CSSMarginRule), false);
    assert.equal(marginStmt.style.getPropertyValue('color'), 'blue');

    // nested NESTED_GROUP unique-cause of each member T vs non-member F
    const groups = firstStyle(`
      .a {
        @media (min-width: 1px) { color: navy; }
        @supports (display: grid) { color: teal; }
        @container (min-width: 1px) { color: purple; }
        @layer nest { color: olive; }
        @scope { color: maroon; }
        @starting-style { color: silver; }
      }
    `);
    const kinds = [...groups.cssRules].map((r) => r.constructor.name);
    assert.ok(kinds.includes('CSSMediaRule'));
    assert.ok(kinds.includes('CSSSupportsRule'));
    assert.ok(kinds.includes('CSSContainerRule'));
    assert.ok(kinds.includes('CSSLayerBlockRule'));
    assert.ok(kinds.includes('CSSScopeRule'));
    assert.ok(kinds.includes('CSSStartingStyleRule'));

    // nested non-group F: dropped, following decl kept (no flush)
    const dropped = firstStyle(`
      .a {
        color: red;
        @keyframes x { from { color: black; } }
        @font-face { font-family: X; src: url(x); }
        @page { margin: 1cm; }
        @property --x { syntax: "*"; inherits: false; }
        @import "nope.css";
        margin: 1px;
      }
    `);
    assert.equal([...dropped.cssRules].some((r) => r instanceof CSSKeyframesRule), false);
    assert.equal([...dropped.cssRules].some((r) => r instanceof CSSFontFaceRule), false);
    assert.equal([...dropped.cssRules].some((r) => r instanceof CSSPageRule), false);
    assert.equal([...dropped.cssRules].some((r) => r instanceof CSSPropertyRule), false);
    assert.equal([...dropped.cssRules].some((r) => r instanceof CSSImportRule), false);
    assert.equal(dropped.style.getPropertyValue('color'), 'red');
    assert.equal(dropped.style.getPropertyValue('margin'), '1px');
  });

  test('handler vs nested unique-cause of statement and block arms', () => {
    // handler T, block F, nested F: @layer statement
    const layerTop = parse('@layer;');
    assert.ok(layerTop.cssRules[0] instanceof CSSLayerStatementRule);

    // handler T, block F, nested T, handler returns the statement
    const layerNested = new Parser(tokenize('@layer;')).consumeRule(true);
    assert.ok(layerNested instanceof CSSLayerStatementRule);

    // handler T, block F, nested T, handler returns null (@media requires a block)
    assert.equal(new Parser(tokenize('@media;')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('@supports;')).consumeRule(true), null);

    // handler T, block T, nested T
    const mediaNested = new Parser(tokenize('@media (min-width: 1px) { color: red; }')).consumeRule(true);
    assert.ok(mediaNested instanceof CSSMediaRule);

    // handler F, nested T → null; handler F, nested F → CSSAtRule
    assert.equal(new Parser(tokenize('@unknown;')).consumeRule(true), null);
    const unknownTop = new Parser(tokenize('@unknown;')).consumeRule(false);
    assert.ok(unknownTop instanceof CSSAtRule);

    // handler F, block T, nested F
    const unknownBlock = new Parser(tokenize('@unknown { color: red; }')).consumeRule(false);
    assert.ok(unknownBlock instanceof CSSAtRule);
    // handler F, block T, nested T
    assert.equal(new Parser(tokenize('@unknown { color: red; }')).consumeRule(true), null);
  });

  test('options.atRules leftover unique-cause of declaration vs rule vs neither on the `{` path', () => {
    // customAtRuleType === 'declaration' T (already in atrules); leftover 'other' / missing
    const other = new Parser(tokenize('@foo { color: red; }'), { atRules: { foo: 'other' } }).parseStyleSheet();
    assert.ok(other.cssRules[0] instanceof CSSAtRule);

    const missing = new Parser(tokenize('@foo { color: red; }'), { atRules: {} }).parseStyleSheet();
    assert.ok(missing.cssRules[0] instanceof CSSAtRule);

    // statement form does not consult atRules (only the `{` arm does)
    const stmt = new Parser(tokenize('@foo;'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
    assert.ok(stmt.cssRules[0] instanceof CSSAtRule);

    // declaration T: childRules are declarations, not CSSAtRule
    const declType = new Parser(tokenize('@foo { color: red; }'), { atRules: { foo: 'declaration' } }).parseStyleSheet();
    assert.equal(declType.cssRules[0] instanceof CSSAtRule, false);
    const declAst = declType.cssRules[0] as unknown as { type?: string; childRules?: { type?: string; name?: string }[] };
    assert.equal(declAst.type, 'at-rule');
    assert.ok(declAst.childRules?.some((r) => r.type === 'declaration' && r.name === 'color'));

    // rule T leftover vs FromStream (below): stylesheet path creates nested CSSStyleRule
    const ruleType = new Parser(tokenize('@foo { div { color: red; } }'), { atRules: { foo: 'rule' } }).parseStyleSheet();
    const ruleAst = ruleType.cssRules[0] as unknown as { type?: string; childRules?: unknown[] };
    assert.equal(ruleAst.type, 'at-rule');
    assert.ok(ruleAst.childRules?.some((r) => r instanceof CSSStyleRule));
  });

  test('prelude unique-cause of non-block component values', () => {
    const sheet = parse('@foo url(x) [y] ident;');
    assert.ok(sheet.cssRules[0] instanceof CSSAtRule);
    assert.equal((sheet.cssRules[0] as CSSAtRule).name, 'foo');
    assert.equal((sheet.cssRules[0] as CSSAtRule).cssText.includes('url'), true);
    assert.equal((sheet.cssRules[0] as CSSAtRule).cssText.includes('[y]'), true);
  });
});

describe('MC/DC leftover unique-cause: consumeAtRuleFromStream (css-syntax-3 § 5.5.2, block contents)', () => {
  test('semicolon vs EOF vs } vs simple-block unique-cause', () => {
    // parseBlockContents uses nested=true, isNestedStyleRule=false → FromStream nested F
    const eof = new Parser(tokenize('@unknown')).parseBlockContents();
    assert.equal(eof.length, 1);
    assert.ok(eof[0] instanceof CSSAtRule);

    const semi = new Parser(tokenize('@unknown; color: blue;')).parseBlockContents();
    assert.ok(semi[0] instanceof CSSAtRule);
    assert.ok(semi[1] instanceof CSSNestedDeclarations);
    assert.equal((semi[1] as CSSNestedDeclarations).style.getPropertyValue('color'), 'blue');

    // } treated as EOF-like terminator (unlike consumeAtRule, which appends `}` to the prelude)
    const rbrace = new Parser(tokenize('@unknown }')).parseBlockContents();
    assert.equal(rbrace.length, 1);
    assert.ok(rbrace[0] instanceof CSSAtRule);
    assert.equal((rbrace[0] as CSSAtRule).name, 'unknown');

    const block = new Parser(tokenize('@unknown { color: red; }')).parseBlockContents();
    assert.ok(block[0] instanceof CSSAtRule);
  });

  test('handler-returns-null unique-cause of `if (!handledRule) return null`', () => {
    // handler T, no block → null; following decl kept
    const font = new Parser(tokenize('@font-face; color: red;')).parseBlockContents();
    assert.equal(font.some((r) => r instanceof CSSFontFaceRule), false);
    assert.ok(font[0] instanceof CSSNestedDeclarations);
    assert.equal((font[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');

    const media = new Parser(tokenize('@media; color: red;')).parseBlockContents();
    assert.equal(media.some((r) => r instanceof CSSMediaRule), false);
    assert.equal((media[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');

    // handler T, block T
    const fontBlock = new Parser(tokenize('@font-face { font-family: X; src: url(x); }')).parseBlockContents();
    assert.ok(fontBlock[0] instanceof CSSFontFaceRule);

    // isSupportedAtRule F (@charset) vs handler F (@unknown)
    const charset = new Parser(tokenize('@charset "x"; color: red;')).parseBlockContents();
    assert.equal(charset.some((r) => r instanceof CSSAtRule), false);
    assert.equal((charset[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');
  });

  test('FromStream does not honor options.atRules (consumeAtRule `{` arm leftover twin)', () => {
    const opts = { atRules: { foo: 'declaration' as const } };
    const fromStream = new Parser(tokenize('@foo { color: red; }'), opts).parseBlockContents();
    assert.ok(fromStream[0] instanceof CSSAtRule);

    const viaTokens = new Parser(tokenize('@foo { color: red; }'), opts).parseStyleSheet();
    assert.equal(viaTokens.cssRules[0] instanceof CSSAtRule, false);
  });

  test('style-rule nested unique-cause of FromStream dropping unknown at-rules', () => {
    const host = firstStyle('.a { color: red; @unknown; margin: 1px; @unknown { color: navy; } padding: 2px; }');
    // dropped at-rules do not flushDecls, so prior decls stay on the style rule
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('margin'), '1px');
    assert.equal(host.style.getPropertyValue('padding'), '2px');
    assert.equal(host.cssRules.length, 0);

    const withMedia = firstStyle('.a { color: red; @media (min-width: 1px) { color: navy; } margin: 1px; }');
    assert.equal(withMedia.style.getPropertyValue('color'), 'red');
    assert.ok(withMedia.cssRules[0] instanceof CSSMediaRule);
    assert.ok(withMedia.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((withMedia.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('margin'), '1px');
  });
});

describe('MC/DC leftover unique-cause: consumeDeclaration (css-syntax-3 § 5.5.5 #consume-declaration)', () => {
  test('non-ident start unique-cause vs ident after whitespace', () => {
    // firstValue.type !== 'ident' leftover vs the existing `123:` row
    assert.equal(parseDecl('#id: red'), null);
    assert.equal(parseDecl('.foo: red'), null);
    assert.equal(parseDecl('@x: red'), null);
    assert.equal(parseDecl('"color": red'), null);

    // ident T, leading whitespace already in mcdc-branch-parser; leftover no-ws / empty value
    const empty = parseDecl('color:');
    assert.ok(empty);
    assert.equal(empty.name, 'color');
    assert.equal(empty.value.length, 0);

    const tight = parseDecl('color:red');
    assert.ok(tight);
    assert.equal(tight.name, 'color');
  });

  test('name === "--" unique-cause vs --foo vs single-dash ident', () => {
    assert.equal(parseDecl('--: red'), null);
    const custom = parseDecl('--foo: green');
    assert.ok(custom);
    assert.equal(custom.name, '--foo');
    assert.equal(custom.raw, 'green');

    const sheet = parse('.a { --: red; --foo: green; }');
    const style = (sheet.cssRules[0] as CSSStyleRule).style;
    assert.equal(style.getPropertyValue('--'), '');
    assert.equal(style.getPropertyValue('--foo'), 'green');

    const recovered = attr('--: red; --x: blue');
    assert.equal(recovered.getPropertyValue('--'), '');
    assert.equal(recovered.getPropertyValue('--x'), 'blue');
  });

  test('colon unique-cause of missing vs present vs whitespace-around', () => {
    assert.equal(parseDecl('color red'), null);
    const spaced = parseDecl('color : blue');
    assert.ok(spaced);
    assert.equal(spaced.name, 'color');
    const recovered = attr('color red; color: blue');
    assert.equal(recovered.getPropertyValue('color'), 'blue');
  });

  test('EOF vs semicolon unique-cause of the value-stop OR', () => {
    // EOF T, semicolon F
    const eof = parseDecl('color: red');
    assert.ok(eof);
    assert.equal(eof.value[0]?.type, 'ident');

    // semicolon T, EOF F
    const semi = parseDecl('color: red;');
    assert.ok(semi);
    assert.equal(semi.value[0]?.type, 'ident');

    // } is not a terminator here (leftover vs consumeBlockContents)
    const rbrace = attr('color: red } background: blue');
    assert.equal(rbrace.getPropertyValue('color').includes('red'), true);
    assert.equal(rbrace.getPropertyValue('color').includes('}'), true);
  });

  test('curly-block stop unique-cause of the AND (non-custom, `{`, prior non-ws)', () => {
    // all T: stop after the `{` block, then hasCurlyBlock && nonWsCount > 1 → null
    assert.equal(parseDecl('color: red { x }'), null);
    const recovered = attr('color: red { x }; background: blue');
    assert.equal(recovered.getPropertyValue('color'), '');
    assert.equal(recovered.getPropertyValue('background'), 'blue');

    // some(non-ws) F unique-cause: `{` is the first non-ws value → keep
    const onlyBlock = parseDecl('color: { x }');
    assert.ok(onlyBlock);
    assert.equal(onlyBlock.value.some((v) => v.type === 'simple-block'), true);
    const onlyBlockAttr = attr('color: { x }; background: blue');
    assert.equal(onlyBlockAttr.getPropertyValue('color').includes('{'), true);
    assert.equal(onlyBlockAttr.getPropertyValue('background'), 'blue');

    // associatedToken `{` F unique-cause: `[` / `(` blocks are kept
    const square = parseDecl('color: red [x]');
    assert.ok(square);
    assert.equal(valuesOf(square).includes('simple-block'), true);
    const paren = parseDecl('color: red (x)');
    assert.ok(paren);
    assert.equal(valuesOf(paren).includes('simple-block'), true);

    // name.startsWith('--') T unique-cause: custom does not stop at `{`
    const custom = parseDecl('--x: red { x }');
    assert.ok(custom);
    assert.equal(custom.raw?.includes('{'), true);
    const customOnly = parseDecl('--x: { a: b }');
    assert.ok(customOnly);
    assert.equal(customOnly.raw?.includes('{'), true);
  });

  test('!important unique-cause of ident / important / delim / "!"', () => {
    const base = parseDecl('color: red !important');
    assert.ok(base);
    assert.equal(base.important, true);
    assert.deepEqual(valuesOf(base), ['ident']);

    // ASCII case leftover
    assert.equal(parseDecl('color: red !IMPORTANT')?.important, true);
    assert.equal(parseDecl('color: red !Important')?.important, true);

    // ident F: last token is delim / number
    assert.equal(parseDecl('color: red!')?.important, false);
    assert.equal(parseDecl('color: 1')?.important, false);

    // important F unique-cause of toLowerCase match
    const notImportant = parseDecl('color: red ! importance');
    assert.ok(notImportant);
    assert.equal(notImportant.important, false);

    // delim `!` F: `?important` and bare `important`
    assert.equal(parseDecl('color: red ?important')?.important, false);
    assert.equal(parseDecl('color: red important')?.important, false);

    // i2 < 0 unique-cause: value is only `important` (no `!`)
    const onlyIdent = parseDecl('color: important');
    assert.ok(onlyIdent);
    assert.equal(onlyIdent.important, false);
    assert.equal(onlyIdent.value[0]?.type, 'ident');

    // i1 bang-only: `!important` with empty value
    const bangOnly = parseDecl('color: !important');
    assert.ok(bangOnly);
    assert.equal(bangOnly.important, true);
    assert.equal(bangOnly.value.length, 0);

    // whitespace between `!` and `important` is skipped by lastNonWsIndex
    assert.equal(parseDecl('color: red ! important')?.important, true);
    assert.equal(parseDecl('color: red!important')?.important, true);

    // custom: `!important` is stripped before validateCustomPropertyValue
    const customImp = parseDecl('--foo: green !important');
    assert.ok(customImp);
    assert.equal(customImp.important, true);
    assert.equal(customImp.raw, 'green');
    // leftover `!` that is not `!important` fails custom validation
    assert.equal(parseDecl('--foo: green ! bar'), null);
  });

  test('validateCustomPropertyValue leftover unique-cause of bad-url, unmatched closers, top-level ! / ;', () => {
    assert.equal(silentWarn(() => parseDecl('--x: url(oops")')), null);
    assert.equal(silentWarn(() => parseDecl('--x: "oops\n"')), null);
    assert.equal(parseDecl('--x: foo ]'), null);
    assert.equal(parseDecl('--x: foo )'), null);
    assert.equal(parseDecl('--x: foo }'), null);

    // topLevel && delim `!` T vs nested in a simple-block / function (topLevel F)
    assert.equal(Parser.validateCustomPropertyValue(new Parser(tokenize('!')).parseComponentValues()), false);
    assert.equal(Parser.validateCustomPropertyValue(new Parser(tokenize(';')).parseComponentValues()), false);
    assert.equal(Parser.validateCustomPropertyValue(new Parser(tokenize('[ ! ]')).parseComponentValues()), true);
    assert.equal(Parser.validateCustomPropertyValue(new Parser(tokenize('foo(!)')).parseComponentValues()), true);
    const nestedBang = parseDecl('--x: [ ! ]');
    assert.ok(nestedBang);
    assert.equal(nestedBang.raw?.includes('!'), true);
  });

  test('unicode-range leftover unique-cause of mixed-case name vs junk', () => {
    const mixed = parseDecl('UNICODE-RANGE: U+26');
    assert.ok(mixed);
    assert.equal(mixed.value[0]?.type, 'unicode-range');
    assert.equal(parseDecl('unicode-range: not-a-range'), null);
    const face = parse('@font-face { UNICODE-RANGE: U+26; font-family: X; }');
    assert.equal((face.cssRules[0] as CSSFontFaceRule).style.getPropertyValue('unicode-range'), 'U+26');
  });

  test('consumeDeclarationsFromBlockContents leftover unique-cause of at-keyword skip and bad-decl consume', () => {
    // at-keyword is consumed and not stored as a declaration
    const withAt = attr('@media screen; color: blue');
    assert.equal(withAt.getPropertyValue('color'), 'blue');

    // bad declaration consumed until semicolon, later decl kept
    const bad = attr('123: red; color: blue');
    assert.equal(bad.getPropertyValue('color'), 'blue');

    // validateDeclarationValue leftover of nested var() vs ok
    const badVar = new Parser(tokenize('foo var()')).parseComponentValues();
    assert.equal(validateDeclarationValue(badVar), false);
    const ok = new Parser(tokenize('1px solid red')).parseComponentValues();
    assert.equal(validateDeclarationValue(ok), true);
    const nestedBad = silentWarn(() => new Parser(tokenize('foo ( "oops\n" )')).parseComponentValues());
    assert.equal(validateDeclarationValue(nestedBad), false);
  });
});

describe('MC/DC leftover unique-cause: nesting (css-nesting-1 § 3 #nest-selector, § 4.1 #cssnesteddeclarations)', () => {
  test('nested vs isNestedStyleRule unique-cause of isDecl lookahead and & prefix', () => {
    // nested T, isNestedStyleRule T (style rule body)
    const host = firstStyle('.a { color: red; .b { color: blue; } }');
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.ok(host.cssRules[0] instanceof CSSStyleRule);
    assert.equal((host.cssRules[0] as CSSStyleRule).selectorText, '& .b');

    // nested T, isNestedStyleRule F (parseBlockContents): isDecl still runs, no `&`
    const block = new Parser(tokenize('color: red; .b { color: blue; }')).parseBlockContents();
    assert.ok(block[0] instanceof CSSNestedDeclarations);
    assert.equal((block[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');
    assert.ok(block[1] instanceof CSSStyleRule);
    assert.equal((block[1] as CSSStyleRule).selectorText, '.b');

    // nested F: ident+colon is not a declaration (parseRuleInBlock false)
    assert.throws(() => parseRuleInBlock('color: blue;', false), { name: 'SyntaxError' });
    const unprefixed = parseRuleInBlock('.child { color: red; }', false);
    assert.ok(unprefixed instanceof CSSStyleRule);
    assert.equal(unprefixed.selectorText, '.child');
    const prefixed = parseRuleInBlock('.child { color: red; }', true);
    assert.ok(prefixed instanceof CSSStyleRule);
    assert.equal(prefixed.selectorText, '& .child');
  });

  test('isDecl unique-cause of ident / --custom / colon / foundSemicolon / foundBlock', () => {
    // first.type === 'ident' F: hash / colon / combinator / type-star start a nested rule
    const hash = firstStyle('.a { #id { color: red; } }');
    assert.equal((hash.cssRules[0] as CSSStyleRule).selectorText, '& #id');
    const hover = firstStyle('.a { :hover { color: red; } }');
    assert.equal((hover.cssRules[0] as CSSStyleRule).selectorText, '& :hover');
    const star = firstStyle('.a { * { color: red; } }');
    assert.equal((star.cssRules[0] as CSSStyleRule).selectorText, '& *');

    // startsWith('--') T && !== '--' T → isDecl (custom kept on the style)
    const custom = firstStyle('.a { --foo: red; .b { color: blue; } --bar: green; }');
    assert.equal(custom.style.getPropertyValue('--foo'), 'red');
    assert.ok(custom.cssRules[0] instanceof CSSStyleRule);
    assert.ok(custom.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((custom.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('--bar'), 'green');

    // startsWith('--') T && !== '--' F: `--:` is not isDecl; custom-property prelude + `{` remnants
    const dashOnly = firstStyle('.a { --: red; color: blue; }');
    assert.equal(dashOnly.style.getPropertyValue('--'), '');
    assert.equal(dashOnly.style.getPropertyValue('color'), 'blue');
    const dashBlock = firstStyle('.a { --: { color: red; } color: blue; }');
    assert.equal(dashBlock.style.cssText.trim(), '');
    assert.equal(dashBlock.cssRules.length, 0);
    // remnants stop at semicolon unique-cause
    const dashSemi = firstStyle('.a { --: { color: red; }; color: blue; }');
    assert.equal(dashSemi.style.getPropertyValue('color'), 'blue');

    // colon F: type selector `div { }` is a nested rule; `div;` is a bad nested rule
    const typeSel = firstStyle('.a { div { color: red; } background: blue; }');
    assert.equal((typeSel.cssRules[0] as CSSStyleRule).selectorText, '& div');
    assert.ok(typeSel.cssRules[1] instanceof CSSNestedDeclarations);
    const identSemi = firstStyle('.a { div; color: blue; }');
    assert.equal(identSemi.style.getPropertyValue('color'), 'blue');
    assert.equal(identSemi.cssRules.length, 0);

    // foundSemicolon T via EOF (no semicolon before `}`)
    const eofDecl = firstStyle('.a { color: red }');
    assert.equal(eofDecl.style.getPropertyValue('color').trim(), 'red');

    // foundBlock T, parseSelectorAST T: `div:hover` / `color:hover` are selectors
    const divHover = firstStyle('.a { div:hover { color: red; } }');
    assert.equal((divHover.cssRules[0] as CSSStyleRule).selectorText, '& div:hover');
    const colorHover = firstStyle('.a { color:hover { color: red; } background: blue; }');
    assert.equal((colorHover.cssRules[0] as CSSStyleRule).selectorText, '& color:hover');
    assert.ok(colorHover.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((colorHover.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('background'), 'blue');

    // foundBlock T, parseSelectorAST F → isDecl T, then curly+value rejects the decl
    const colorBlock = firstStyle('.a { color: red { x: y; } background: blue; }');
    assert.equal(colorBlock.style.getPropertyValue('color'), '');
    assert.equal(colorBlock.style.getPropertyValue('background'), 'blue');
    assert.equal(colorBlock.cssRules.length, 0);
  });

  test('flushDecls unique-cause of first CSSNestedDeclarations flatten vs later leftover', () => {
    const host = firstStyle(`
      .a {
        color: red;
        .b { color: blue; }
        margin: 1px;
        .c { color: green; }
        padding: 2px;
      }
    `);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('margin'), '');
    const kids = [...host.cssRules];
    assert.ok(kids[0] instanceof CSSStyleRule);
    assert.equal((kids[0] as CSSStyleRule).selectorText, '& .b');
    assert.ok(kids[1] instanceof CSSNestedDeclarations);
    assert.equal((kids[1] as CSSNestedDeclarations).style.getPropertyValue('margin'), '1px');
    assert.ok(kids[2] instanceof CSSStyleRule);
    assert.equal((kids[2] as CSSStyleRule).selectorText, '& .c');
    assert.ok(kids[3] instanceof CSSNestedDeclarations);
    assert.equal((kids[3] as CSSNestedDeclarations).style.getPropertyValue('padding'), '2px');

    // first item is a nested rule (isFirst CSSNestedDeclarations F)
    const noLead = firstStyle('.a { .b { color: red; } color: blue; }');
    assert.equal(noLead.style.cssText.trim(), '');
    assert.ok(noLead.cssRules[0] instanceof CSSStyleRule);
    assert.ok(noLead.cssRules[1] instanceof CSSNestedDeclarations);
  });

  test('normalizeNestedSelector leftover unique-cause of combinators, || vs |, comma, and &', () => {
    assert.equal((firstStyle('.a { > .b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& > .b');
    assert.equal((firstStyle('.a { + .b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& + .b');
    assert.equal((firstStyle('.a { ~ .b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& ~ .b');
    // || both pipes T vs single | (namespace, not a combinator)
    assert.equal((firstStyle('.a { || .b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& || .b');
    assert.equal((firstStyle('.a { |div { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& |div');

    // containsAmpersand T in delim vs function (no extra `& ` prefix)
    assert.equal((firstStyle('.a { & .b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& .b');
    assert.equal((firstStyle('.a { & { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '&');
    assert.equal((firstStyle('.a { :is(&) { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, ':is(&)');
    assert.equal((firstStyle('.a { & > b { color: red; } }').cssRules[0] as CSSStyleRule).selectorText, '& > b');

    // comma list: implicit prefix on the segment without `&`
    assert.equal(
      (firstStyle('.a { & .b, .c { color: red; } }').cssRules[0] as CSSStyleRule).selectorText,
      '& .b, & .c',
    );
    assert.equal(
      (firstStyle('.a { & > b, + c { color: red; } }').cssRules[0] as CSSStyleRule).selectorText,
      '& > b, & + c',
    );

    // empty segment unique-cause: selectorText === '' → createStyleRule null
    const emptyComma = firstStyle('.a { .b, { color: red; } color: blue; }');
    assert.equal(emptyComma.cssRules.length, 0);
    assert.equal(emptyComma.style.getPropertyValue('color'), 'blue');
    const trailing = firstStyle('.a { .b, .c, { color: red; } color: blue; }');
    assert.equal(trailing.cssRules.length, 0);
    assert.equal(trailing.style.getPropertyValue('color'), 'blue');
  });

  test('consumeNestedQualifiedRuleFromStream leftover unique-cause of stopToken, invalid selector, custom prelude', () => {
    // stopToken semicolon / EOF without `{` → null, later decl kept
    const noBlock = firstStyle('.a { div; color: blue; }');
    assert.equal(noBlock.style.getPropertyValue('color'), 'blue');

    // invalid nested selector dropped
    const invalid = firstStyle('.a { 123 { color: red; } color: blue; }');
    assert.equal(invalid.style.getPropertyValue('color'), 'blue');
    assert.equal(invalid.cssRules.length, 0);

    // `--foo` without colon: isDecl T, consumeDeclaration colon-miss, block leftover skipped
    const customNoColon = firstStyle('.a { --foo { color: red; } color: blue; }');
    assert.equal(customNoColon.style.getPropertyValue('color'), 'blue');
    assert.equal(customNoColon.style.getPropertyValue('--foo'), '');

    // isCustomPropertyDeclaration unique-cause (public)
    const customPrelude = new Parser(tokenize('--x : ')).parseComponentValues();
    assert.equal(Parser.isCustomPropertyDeclaration(customPrelude), true);
    assert.equal(Parser.isCustomPropertyDeclaration(new Parser(tokenize('-- : ')).parseComponentValues()), true);
    assert.equal(Parser.isCustomPropertyDeclaration([]), false);
    assert.equal(Parser.isCustomPropertyDeclaration(new Parser(tokenize('color : ')).parseComponentValues()), false);
    assert.equal(Parser.isCustomPropertyDeclaration(new Parser(tokenize('--x ')).parseComponentValues()), false);

    // consumeRule(true) prefixes; consumeRule(false) does not
    const nested = new Parser(tokenize('.child { color: blue; }')).consumeRule(true);
    assert.ok(nested instanceof CSSStyleRule);
    assert.equal(nested.selectorText, '& .child');
    const top = new Parser(tokenize('.child { color: blue; }')).consumeRule(false);
    assert.ok(top instanceof CSSStyleRule);
    assert.equal(top.selectorText, '.child');
  });

  test('parseRuleInBlock leftover unique-cause of nested decls vs style vs at-rule vs arity', () => {
    const decls = parseRuleInBlock('color: blue;', true);
    assert.ok(decls instanceof CSSNestedDeclarations);
    assert.equal(decls.style.getPropertyValue('color'), 'blue');

    const two = parseRuleInBlock('color: blue; margin: 1px;', true);
    assert.ok(two instanceof CSSNestedDeclarations);
    assert.equal(two.style.getPropertyValue('margin'), '1px');

    const media = parseRuleInBlock('@media (min-width: 1px) { color: red; }', true);
    assert.ok(media instanceof CSSMediaRule);
    const scope = parseRuleInBlock('@scope { color: red; }', true);
    assert.ok(scope instanceof CSSScopeRule);
    const starting = parseRuleInBlock('@starting-style { color: red; }', true);
    assert.ok(starting instanceof CSSStartingStyleRule);
    const supports = parseRuleInBlock('@supports (display: grid) { color: red; }', true);
    assert.ok(supports instanceof CSSSupportsRule);
    const container = parseRuleInBlock('@container (min-width: 1px) { color: red; }', true);
    assert.ok(container instanceof CSSContainerRule);

    assert.throws(() => parseRuleInBlock('color: blue; .b { color: red; }', true), { name: 'SyntaxError' });
  });
});
