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
// Verifies: SYS-REQ-260821-NGJH, SYS-REQ-260821-KA02, SW-REQ-260821-MZ8P, SW-REQ-260821-2Z0N, INT-REQ-260821-WTPD
// Leftover unique-cause for src/parser-api.ts qualifiedFromCssText (0/5 D
// after the KI-6/14 class-fix). Existing parser-api / toparser / keyframe
// adapter tests hit type-8 cssText once (`from { color: red }`) but do not
// unique-cause skip / at-keyword / no-block / non-`{` simple-block.
// Drive CSS.parseStylesheetSync / CSS.parseRule / exported toParserRule.
// css-syntax-3 § 5.5.3 #consume-a-qualified-rule / § 5.5.8 #consume-a-component-value
// / § 4.3.4 #consume-string-token,
// css-animations-1 #CSSKeyframeRule / #keyframe-selector,
// cssom-1 § 6.4 #the-cssrule-interface (KEYFRAME_RULE type 8).
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  CSSParserAtRule,
  CSSParserBlock,
  CSSParserDeclaration,
  CSSParserFunction,
  CSSParserQualifiedRule,
  CSSParserRule,
  toParserRule,
} from '../src/parser-api.ts';

function preludeText(rule: CSSParserQualifiedRule | CSSParserAtRule): string {
  return rule.prelude.map((t) => t.toString()).join('');
}

function asQualified(rule: CSSParserRule | null): CSSParserQualifiedRule {
  assert.ok(rule instanceof CSSParserQualifiedRule);
  return rule;
}

function asAt(rule: CSSParserRule | null): CSSParserAtRule {
  assert.ok(rule instanceof CSSParserAtRule);
  return rule;
}

function type8FromCssText(cssText: unknown): CSSParserQualifiedRule {
  return asQualified(toParserRule({ type: 8, cssText }));
}

function hasDecl(rule: CSSParserQualifiedRule, name: string): boolean {
  return rule.body.some((d) => d instanceof CSSParserDeclaration && d.name === name);
}

function isEmptyQualified(rule: CSSParserQualifiedRule): boolean {
  return rule.prelude.length === 0 && rule.body.length === 0;
}

describe('MC/DC leftover unique-cause: qualifiedFromCssText leading skip', () => {
  test('while i < length / whitespace unique-cause; comment tokens never emitted', () => {
    // L265 while (i < values.length && (whitespace || comment)).
    // css-syntax-3 § 5.5.3 #consume-a-qualified-rule: skip leading ws before prelude.
    // whitespace T, comment F: skip then ident (neither) stops.
    const ws = type8FromCssText('  from { color: red }');
    assert.equal(preludeText(ws), 'from');
    assert.equal(hasDecl(ws, 'color'), true);

    const tabNl = type8FromCssText('\t\nfrom { color: red }');
    assert.equal(preludeText(tabNl), 'from');
    assert.equal(hasDecl(tabNl, 'color'), true);

    // Both F: ident at i=0, while never increments.
    const noSkip = type8FromCssText('from { color: red }');
    assert.equal(preludeText(noSkip), 'from');
    assert.equal(hasDecl(noSkip, 'color'), true);

    // i < length F at the first check: comments are discarded by
    // AbstractTokenizer.consumeComments, so `/*c*/` tokenizes to [].
    const commentOnly = type8FromCssText('/*c*/');
    assert.equal(isEmptyQualified(commentOnly), true);

    // i < length T then F after skipping all remaining whitespace.
    const spacesOnly = type8FromCssText('   ');
    assert.equal(isEmptyQualified(spacesOnly), true);

    const wsComment = type8FromCssText('  /*c*/  ');
    assert.equal(isEmptyQualified(wsComment), true);

    // Comments before a prelude are stripped; unique-cause is the ident stop,
    // not a comment-token conjunct (mute: type === 'comment' T).
    const commentThenFrom = type8FromCssText('/*c*/from { color: red }');
    assert.equal(preludeText(commentThenFrom), 'from');
    assert.equal(hasDecl(commentThenFrom, 'color'), true);
  });
});

describe('MC/DC leftover unique-cause: qualifiedFromCssText at-keyword vs exhausted', () => {
  test('i >= length / at-keyword unique-cause returns empty qualified via ?? []', () => {
    // L266 if (i >= values.length || type === 'at-keyword') return null;
    // toParserRule type 8 maps null to CSSParserQualifiedRule([], []).
    // T,F (|| short-circuit): exhausted after skip.
    assert.equal(isEmptyQualified(type8FromCssText('   ')), true);
    assert.equal(isEmptyQualified(type8FromCssText('/*c*/')), true);

    // F,T: at-keyword is not a qualified-rule prelude.
    // css-syntax-3 § 5.5.3: at-keyword starts an at-rule, not a qualified rule.
    assert.equal(isEmptyQualified(type8FromCssText('@foo { color: red }')), true);
    assert.equal(isEmptyQualified(type8FromCssText('@keyframes x { from { color: red } }')), true);
    assert.equal(isEmptyQualified(type8FromCssText('  @media all { .x { color: red } }')), true);
    assert.equal(isEmptyQualified(type8FromCssText('@FOO')), true);

    // F,F: ident / percentage / hash continue into the prelude walk.
    const from = type8FromCssText('from { color: red }');
    assert.equal(preludeText(from), 'from');
    assert.equal(hasDecl(from, 'color'), true);
    const pct = type8FromCssText('50% { opacity: 1 }');
    assert.equal(preludeText(pct), '50%');
    assert.equal(hasDecl(pct, 'opacity'), true);
    const hash = type8FromCssText('#id { color: red }');
    assert.equal(preludeText(hash), '#id');
    assert.equal(hasDecl(hash, 'color'), true);
  });
});

describe('MC/DC leftover unique-cause: qualifiedFromCssText for-loop / `{` simple-block', () => {
  test('i < length exhaust F vs `{` body T; leftover after `{` is not a second rule', () => {
    // L269 for (; i < values.length; i++). T while prelude remains; F when
    // the list ends with no curly simple-block (bodyBlock stays null).
    const noBlock = type8FromCssText('from');
    assert.equal(preludeText(noBlock), 'from');
    assert.deepEqual(noBlock.body, []);

    const commaNoBlock = type8FromCssText('from, to');
    assert.equal(preludeText(commaNoBlock), 'from,to');
    assert.deepEqual(commaNoBlock.body, []);

    const numberNoBlock = type8FromCssText('0');
    assert.equal(preludeText(numberNoBlock), '0');
    assert.deepEqual(numberNoBlock.body, []);

    // T then break: first `{` simple-block is the body; trailing junk is ignored.
    const withBody = type8FromCssText('from { color: red } to { color: blue }');
    assert.equal(preludeText(withBody), 'from');
    assert.equal(hasDecl(withBody, 'color'), true);
    assert.equal(hasDecl(withBody, 'opacity'), false);
    assert.equal(withBody.body.length, 1);

    const fromTo = type8FromCssText('from, to { color: blue }');
    assert.equal(preludeText(fromTo), 'from,to');
    assert.equal(hasDecl(fromTo, 'color'), true);
  });

  test('simple-block `{` T,T vs `[]`/`()` T,F vs ident/string/function F', () => {
    // L271 v.type === 'simple-block' && associatedToken.type === '{'.
    // css-syntax-3 § 5.5.8 #consume-a-component-value: `{`/`[`/`(` become blocks.
    const curly = type8FromCssText('from { color: red }');
    assert.equal(preludeText(curly), 'from');
    assert.equal(hasDecl(curly, 'color'), true);

    const square = type8FromCssText('from [a] { color: red }');
    assert.equal(square.prelude.length, 2);
    const squareBlock = square.prelude[1];
    assert.ok(squareBlock instanceof CSSParserBlock);
    assert.equal(squareBlock.name, '[]');
    assert.equal(preludeText(square), 'from[a]');
    assert.equal(hasDecl(square, 'color'), true);

    const paren = type8FromCssText('from (1) { color: red }');
    assert.equal(paren.prelude.length, 2);
    const parenBlock = paren.prelude[1];
    assert.ok(parenBlock instanceof CSSParserBlock);
    assert.equal(parenBlock.name, '()');
    assert.equal(preludeText(paren), 'from(1)');
    assert.equal(hasDecl(paren, 'color'), true);

    // T,F as the *only* simple-block: `()` is not `{`, so bodyBlock stays null.
    const parenOnly = type8FromCssText('from ( { color: red } )');
    assert.equal(parenOnly.prelude.length, 2);
    const nestedParen = parenOnly.prelude[1];
    assert.ok(nestedParen instanceof CSSParserBlock);
    assert.equal(nestedParen.name, '()');
    assert.deepEqual(parenOnly.body, []);

    const squareFirst = type8FromCssText('[a] { color: red }');
    const firstBlock = squareFirst.prelude[0];
    assert.ok(firstBlock instanceof CSSParserBlock);
    assert.equal(firstBlock.name, '[]');
    assert.equal(preludeText(squareFirst), '[a]');
    assert.equal(hasDecl(squareFirst, 'color'), true);

    // F: function is not a simple-block; `{` inside args is not the rule body.
    const fn = type8FromCssText('from var(--x) { color: red }');
    const varFn = fn.prelude[1];
    assert.ok(varFn instanceof CSSParserFunction);
    assert.equal(varFn.name, 'var');
    assert.equal(hasDecl(fn, 'color'), true);

    const fnCurly = type8FromCssText('from foo({ color: red })');
    const fooFn = fnCurly.prelude[1];
    assert.ok(fooFn instanceof CSSParserFunction);
    assert.equal(fooFn.name, 'foo');
    assert.deepEqual(fnCurly.body, []);

    // F: ident / string / CDO / semicolon stay in the prelude.
    const cdo = type8FromCssText('<!-- from { color: red }');
    assert.equal(preludeText(cdo), '<!--from');
    assert.equal(hasDecl(cdo, 'color'), true);
    const semi = type8FromCssText('from; { color: red }');
    assert.equal(preludeText(semi), 'from;');
    assert.equal(hasDecl(semi, 'color'), true);
  });
});

describe('MC/DC leftover unique-cause: qualifiedFromCssText quoted `{` is not the body', () => {
  test('string `{` stays in the prelude; the later curly block is the body', () => {
    // css-syntax-3 § 4.3.4 #consume-string-token: `{` inside a string is not
    // a simple-block. L271 type === 'simple-block' F on the string token.
    const quoted = type8FromCssText('from "{" { color: red }');
    assert.equal(preludeText(quoted), 'from"{"');
    assert.equal(hasDecl(quoted, 'color'), true);
    assert.equal(quoted.body.length, 1);

    // No later curly block: the quoted `{ color: red }` is prelude-only.
    const quotedOnly = type8FromCssText('from "{ color: red }"');
    assert.equal(preludeText(quotedOnly), 'from"{ color: red }"');
    assert.deepEqual(quotedOnly.body, []);

    const stringFirst = type8FromCssText('"from" { color: red }');
    assert.equal(preludeText(stringFirst), '"from"');
    assert.equal(hasDecl(stringFirst, 'color'), true);
  });
});

describe('MC/DC leftover unique-cause: qualifiedFromCssText bodyBlock ternary', () => {
  test('bodyBlock T empty vs T decls vs F no-block; empty prelude `{` is still a body', () => {
    // L277 bodyBlock ? consumeDeclarationsFromBlockContents : [].
    const withDecls = type8FromCssText('from { color: red; opacity: 1 }');
    assert.equal(withDecls.body.length, 2);
    assert.equal(hasDecl(withDecls, 'color'), true);
    assert.equal(hasDecl(withDecls, 'opacity'), true);

    const emptyBlock = type8FromCssText('from {}');
    assert.equal(preludeText(emptyBlock), 'from');
    assert.deepEqual(emptyBlock.body, []);

    const onlySemi = type8FromCssText('from { ; }');
    assert.equal(preludeText(onlySemi), 'from');
    assert.deepEqual(onlySemi.body, []);

    const noBlock = type8FromCssText('from');
    assert.equal(preludeText(noBlock), 'from');
    assert.deepEqual(noBlock.body, []);

    // First non-ws token is `{`: prelude stays [], body still consumed.
    const bare = type8FromCssText('{ color: red }');
    assert.equal(bare.prelude.length, 0);
    assert.equal(hasDecl(bare, 'color'), true);

    const wsBare = type8FromCssText('  { color: red }');
    assert.equal(wsBare.prelude.length, 0);
    assert.equal(hasDecl(wsBare, 'color'), true);

    const custom = type8FromCssText('from { --x: 1 }');
    assert.equal(hasDecl(custom, '--x'), true);

    // css-syntax-3 § 5.5.9 #consume-simple-block: unclosed `{` still yields a block.
    const unclosed = type8FromCssText('from { color: red');
    assert.equal(preludeText(unclosed), 'from');
    assert.equal(hasDecl(unclosed, 'color'), true);
  });
});

describe('MC/DC leftover unique-cause: parseStylesheetSync / parseRule vs type-8 cssText', () => {
  test('real CSSKeyframeRule uses keyText+style; type-8 cssText duck uses qualifiedFromCssText', () => {
    // parseStylesheetSync / parseRule go through instanceof CSSKeyframeRule
    // (cssomKeyframeToQualified keyText path), not qualifiedFromCssText.
    const sheet = CSS.parseStylesheetSync('@keyframes x { from { color: red } to { color: blue } 50% { opacity: 1 } }');
    assert.equal(sheet.length, 1);
    const at = asAt(sheet[0]);
    assert.equal(at.name, 'keyframes');
    assert.equal(at.body?.length, 3);
    const fromChild = asQualified(at.body[0]);
    assert.equal(preludeText(fromChild), 'from');
    assert.equal(hasDecl(fromChild, 'color'), true);
    const toChild = asQualified(at.body[1]);
    assert.equal(preludeText(toChild), 'to');
    assert.equal(hasDecl(toChild, 'color'), true);
    const midChild = asQualified(at.body[2]);
    assert.equal(preludeText(midChild), '50%');
    assert.equal(hasDecl(midChild, 'opacity'), true);

    const viaRule = asAt(CSS.parseRule('@keyframes x { from { color: red } }'));
    assert.equal(viaRule.name, 'keyframes');
    const viaChild = asQualified(viaRule.body?.[0] ?? null);
    assert.equal(preludeText(viaChild), 'from');
    assert.equal(hasDecl(viaChild, 'color'), true);

    // Top-level `from { }` is CSSStyleRule (type 1): selectorText prelude,
    // nested cssRules body — not qualifiedFromCssText, so no color declaration.
    const topSheet = CSS.parseStylesheetSync('from { color: red }');
    const top = asQualified(topSheet[0]);
    assert.equal(preludeText(top), 'from');
    assert.deepEqual(top.body, []);
    const topRule = asQualified(CSS.parseRule('from { color: red }'));
    assert.equal(preludeText(topRule), 'from');
    assert.deepEqual(topRule.body, []);

    // Same cssText as a KEYFRAME_RULE duck reconstructs the declaration body.
    const duck = type8FromCssText('from { color: red }');
    assert.equal(preludeText(duck), 'from');
    assert.equal(hasDecl(duck, 'color'), true);

    // keyText string wins over cssText: qualifiedFromCssText is not entered.
    const keyTextWins = asQualified(toParserRule({
      type: 8,
      keyText: 'from',
      cssText: 'to { color: blue }',
    }));
    assert.equal(preludeText(keyTextWins), 'from');
    assert.deepEqual(keyTextWins.body, []);

    // keyText not a string: fall through to cssText reconstruction.
    const keyTextNotString = asQualified(toParserRule({
      type: 8,
      keyText: 0,
      cssText: 'from { color: red }',
    }));
    assert.equal(preludeText(keyTextNotString), 'from');
    assert.equal(hasDecl(keyTextNotString, 'color'), true);

    // Empty / non-string cssText never enter qualifiedFromCssText.
    assert.equal(isEmptyQualified(asQualified(toParserRule({ type: 8 }))), true);
    assert.equal(isEmptyQualified(asQualified(toParserRule({ type: 8, cssText: '' }))), true);
    assert.equal(isEmptyQualified(asQualified(toParserRule({ type: 8, cssText: 123 }))), true);
  });
});
