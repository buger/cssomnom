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
// Verifies: INT-REQ-260821-N2VE, SW-REQ-260821-QV2H, SW-REQ-260821-7M07, SYS-REQ-260821-SBJ7
// Leftover unique-cause for src/TokenStream.ts (ArrayTokenStream,
// ArrayComponentValueStream, StreamingTokenizerStream, LazyComponentValueStream)
// not already uniquely witnessed by tests/streaming.test.ts,
// tests/component-value-stream.test.ts, or tests/mcdc-branch-parser*.test.ts.
// Drive Parser / tokenize (and Parser(StreamingTokenizerStream) for the
// streaming adapter). No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizer, NeedMoreDataError } from '../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';
import {
  CSSStyleRule,
  CSSMediaRule,
  CSSNestedDeclarations,
  CSSStyleSheet,
} from '../src/CSSOM.ts';

function firstStyle(css: string): CSSStyleRule {
  const sheet = parse(css);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule, `expected style rule for ${JSON.stringify(css)}`);
  return sheet.cssRules[0];
}

function parseStreaming(chunks: string[], close = true): CSSStyleSheet {
  const tokenizer = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tokenizer);
  const parser = new Parser(stream);
  for (const chunk of chunks) tokenizer.appendChunk(chunk);
  if (close) tokenizer.close();
  return parser.parseStyleSheet();
}

function assertNeedMoreData(fn: () => unknown): void {
  assert.throws(fn, (err: unknown) => err instanceof NeedMoreDataError);
}

describe('MC/DC leftover unique-cause: ArrayTokenStream (css-syntax-3 § 5.5.1 #consume-stylesheet-contents, INT-REQ-260821-N2VE)', () => {
  test('next unique-cause of type !== EOF vs EOF sentinel from tokenize', () => {
    // T: consumeToken shifts a non-EOF ident/block token.
    const sheet = parse('.x { color: blue; }');
    assert.equal(sheet.cssRules.length, 1);
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'blue');

    // F: LazyComponentValueStream fetchNext calls consumeComponentValue at the
    // tokenizer EOF (parseDeclaration mirror is 'EOF'). next() must not advance
    // past the sentinel (css-syntax-3 § 4.3.1 #consume-token).
    const decl = new Parser(tokenize('color: red')).parseDeclaration();
    assert.ok(decl);
    assert.equal(decl.name, 'color');
    assert.equal(decl.value[0]?.type, 'ident');

    // Unclosed qualified rule: consumeComponentValue at EOF still returns the
    // sentinel without throwing (Lazy fetchNext, not consumeBlock).
    const unclosed = new Parser(tokenize('.x { color: red')).parseStyleSheet();
    assert.equal(unclosed.cssRules.length, 1);
    assert.ok(unclosed.cssRules[0] instanceof CSSStyleRule);
    assert.equal((unclosed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');
  });

  test('peek unique-cause of tokens[index] present vs synthesized EOF', () => {
    // T: tokenize('') still emits an <EOF-token>; peek returns that token.
    const empty = new Parser(tokenize('')).parseStyleSheet();
    assert.equal(empty.cssRules.length, 0);

    // T leftover: whitespace-only is discarded, then peek of the real EOF token
    // ends consumeListOfRules without next() on the sentinel.
    const ws = new Parser(tokenize('  \n\t ')).parseStyleSheet();
    assert.equal(ws.cssRules.length, 0);

    // F: Parser([]) has no tokens, so peek synthesizes { type: 'EOF' } via
    // `this.tokens[this.index] || { type: 'EOF', value: '' }`.
    const missing = new Parser([]).parseStyleSheet();
    assert.equal(missing.cssRules.length, 0);
  });
});

describe('MC/DC leftover unique-cause: ArrayComponentValueStream (css-syntax-3 § 5.5.5 #consume-block-contents)', () => {
  test('peek unique-cause of values[index] present vs synthesized EOF', () => {
    // T: parseStyleAttribute component values sit in the array.
    const style = new Parser(tokenize('color: red; margin: 0')).parseStyleAttribute();
    assert.equal(style.getPropertyValue('color'), 'red');
    assert.equal(style.getPropertyValue('margin'), '0');

    // F: empty block / empty style attribute — peek past the end synthesizes EOF.
    const emptyAttr = new Parser(tokenize('')).parseStyleAttribute();
    assert.equal(emptyAttr.length, 0);
    const emptyBlock = new Parser(tokenize('')).parseBlockContents();
    assert.equal(emptyBlock.length, 0);
    const emptyMedia = parse('@media { }');
    assert.ok(emptyMedia.cssRules[0] instanceof CSSMediaRule);
    assert.equal((emptyMedia.cssRules[0] as CSSMediaRule).cssRules.length, 0);
  });

  test('next unique-cause of type !== EOF vs remnants next() on synthesized EOF', () => {
    // T: parseBlockContents ArrayComponentValueStream shifts decls / nested rules
    // (top-level @media passes nested=F so leftover decls are not isDecl).
    const block = new Parser(tokenize('.x { color: navy; } color: red;')).parseBlockContents();
    assert.equal(block.length, 2);
    assert.ok(block[0] instanceof CSSStyleRule);
    assert.ok(block[1] instanceof CSSNestedDeclarations);
    assert.equal((block[1] as CSSNestedDeclarations).style.getPropertyValue('color'), 'red');

    const media = parse('@media all { .x { color: navy; } }');
    const rule = media.cssRules[0] as CSSMediaRule;
    assert.equal(rule.cssRules.length, 1);
    assert.ok(rule.cssRules[0] instanceof CSSStyleRule);

    // F: `--:` + simple-block is not isDecl; remnants call next() on the
    // synthesized EOF at the end of the grouping block's value array.
    const remnants = parse('@media { --: { foo } }');
    const grouping = remnants.cssRules[0] as CSSMediaRule;
    assert.equal(grouping.cssRules.length, 0);

    // semicolon unique-cause of remnants stop vs EOF (next type !== EOF).
    const semi = parse('@media { --: { foo }; .ok { color: green; } }');
    const after = semi.cssRules[0] as CSSMediaRule;
    assert.equal(after.cssRules.length, 1);
    assert.equal((after.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'green');
  });
});

describe('MC/DC leftover unique-cause: LazyComponentValueStream (css-syntax-3 § 5.5.3 #consume-qualified-rule, css-nesting-1 § 3)', () => {
  test('peek unique-cause of index < buffer.length after isDecl rewind', () => {
    // T: ident+colon lookahead next()s into the buffer, then position rewind
    // peeks a previously buffered ident (index < buffer.length).
    const decl = firstStyle('.a { color: red; }');
    assert.equal(decl.style.getPropertyValue('color'), 'red');

    // F: first peek of a nested type selector is a fresh fetch (index === length).
    const nested = firstStyle('.a { div { color: blue; } }');
    assert.equal((nested.cssRules[0] as CSSStyleRule).selectorText, '& div');
    assert.equal((nested.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'blue');

    // Rewind after colon-miss (div { }) still sets position ≤ buffer.length.
    const miss = firstStyle('.a { div { color: red; } background: blue; }');
    assert.equal((miss.cssRules[0] as CSSStyleRule).selectorText, '& div');
    assert.ok(miss.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal((miss.cssRules[1] as CSSNestedDeclarations).style.getPropertyValue('background'), 'blue');
  });

  test('peek unique-cause of done after mirror } vs tokenizer EOF', () => {
    // mirror T: closing `}` of the style rule is the Lazy mirrorToken, not buffered.
    const closed = firstStyle('.a { color: red; }');
    assert.equal(closed.style.getPropertyValue('color'), 'red');

    // val.type === 'EOF' T (mirror F): unclosed `{` — fetchNext returns the
    // tokenizer EOF, not `}`. Lookahead sets done, rewind, then
    // consumeDeclarationFromStream peeks with done=T (index ≥ buffer.length).
    const unclosed = parse('.a { color: red');
    assert.equal(unclosed.cssRules.length, 1);
    assert.ok(unclosed.cssRules[0] instanceof CSSStyleRule);
    assert.equal((unclosed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');

    // done F + mirror F + EOF F: ordinary ident fetch into the buffer.
    const ident = firstStyle('.a { background: blue; }');
    assert.equal(ident.style.getPropertyValue('background'), 'blue');
  });

  test('peek unique-cause of parseDeclaration mirrorToken === EOF vs style-rule }', () => {
    // parseDeclaration uses mirror 'EOF': tokenizer EOF is the mirror arm,
    // not the later `val.type === 'EOF'` arm (that arm is unique-caused by
    // the unclosed style-rule test above).
    const decl = new Parser(tokenize('color: green !important')).parseDeclaration();
    assert.ok(decl);
    assert.equal(decl.name, 'color');
    assert.equal(decl.important, true);

    const empty = new Parser(tokenize('')).parseDeclaration();
    assert.equal(empty, null);

    const noColon = new Parser(tokenize('color red')).parseDeclaration();
    assert.equal(noColon, null);
  });

  test('next unique-cause of type !== EOF vs remnants next() on Lazy EOF', () => {
    // T: next() shifts buffered decls / nested rules inside the style body.
    const host = firstStyle('.a { color: red; .b { color: blue; } }');
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal((host.cssRules[0] as CSSStyleRule).selectorText, '& .b');

    // F: `--:` + `{ }` is not isDecl; remnants next() the Lazy EOF produced
    // by the style-rule mirror `}`.
    const remnants = firstStyle('.a { --: { foo } color: blue; }');
    assert.equal(remnants.style.getPropertyValue('color'), '');
    assert.equal(remnants.cssRules.length, 0);

    // semicolon unique-cause of remnants stop (next type !== EOF).
    const semi = firstStyle('.a { --: { foo }; color: blue; }');
    assert.equal(semi.style.getPropertyValue('color'), 'blue');
  });

  test('position setter unique-cause of pos > buffer.length F (valid rewind)', () => {
    // F: isDecl lookahead saves position, next()s, then assigns the saved
    // index (never greater than buffer.length). The T/throw arm is not
    // reachable through Parser — consumeBlockContents only restores a
    // previously observed index.
    const colon = firstStyle('.a { color: red; margin: 1px; }');
    assert.equal(colon.style.getPropertyValue('color'), 'red');
    assert.equal(colon.style.getPropertyValue('margin'), '1px');

    const typeSel = firstStyle('.a { span { color: red; } }');
    assert.equal((typeSel.cssRules[0] as CSSStyleRule).selectorText, '& span');

    const custom = firstStyle('.a { --foo: red; color: blue; }');
    assert.equal(custom.style.getPropertyValue('--foo'), 'red');
    assert.equal(custom.style.getPropertyValue('color'), 'blue');
  });
});

describe('MC/DC leftover unique-cause: StreamingTokenizerStream (css-syntax-3 § 4.3.1 #consume-token, SW-REQ-260821-QV2H)', () => {
  test('peek unique-cause of empty buffer fetch vs already-buffered tokens', () => {
    // length === 0 T then length > 0 T: first peek drains getTokens() into
    // the buffer. Subsequent peeks (Parser nextToken before consumeToken)
    // hit length === 0 F with length > 0 T.
    const sheet = parseStreaming(['.x { color: teal; }']);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'teal');

    // Split chunks: first peek after the first chunk, then more tokens after
    // the second chunk + close (buffer empty T again on the later fetch).
    const split = parseStreaming(['.x { color: ', 'navy; }']);
    assert.equal((split.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'navy');
  });

  test('peek unique-cause of tokenizer.closed F (NeedMoreData) vs T (fabricated EOF)', () => {
    // closed=F: incomplete chunk, getTokens() empty, Parser peek must throw
    // NeedMoreData rather than invent EOF (css-syntax-3 § 4.3.1).
    const incomplete = new StreamingTokenizer();
    const incompleteStream = new StreamingTokenizerStream(incomplete);
    const incompleteParser = new Parser(incompleteStream);
    incomplete.appendChunk('.x { color: re');
    assertNeedMoreData(() => incompleteParser.parseStyleSheet());

    // closed=F leftover: complete tokens without close — after the style
    // rule, consumeListOfRules peeks an empty buffer on an open tokenizer.
    const open = new StreamingTokenizer();
    const openStream = new StreamingTokenizerStream(open);
    const openParser = new Parser(openStream);
    open.appendChunk('.x { color: red; }');
    assertNeedMoreData(() => openParser.parseStyleSheet());

    // closed=T + buffered EOF: close() emits <EOF-token> into getTokens().
    const bufferedEof = new StreamingTokenizer();
    const bufferedStream = new StreamingTokenizerStream(bufferedEof);
    bufferedEof.close();
    const emptyClosed = new Parser(bufferedStream).parseStyleSheet();
    assert.equal(emptyClosed.cssRules.length, 0);

    // closed=T + fabricated EOF: drain the tokenizer's EOF first so peek
    // takes the `if (this.tokenizer.closed)` arm (buffer still empty after
    // getTokens()).
    const drained = new StreamingTokenizer();
    const drainedStream = new StreamingTokenizerStream(drained);
    drained.close();
    drained.getTokens();
    const fabricated = new Parser(drainedStream).parseStyleSheet();
    assert.equal(fabricated.cssRules.length, 0);
  });

  test('next unique-cause of type !== EOF && bufferedTokens.length > 0', () => {
    // TT: next() of a non-EOF token shifts the buffer.
    const sheet = parseStreaming(['div { color: red; }']);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');

    // FT: unclosed `{` after close() — consumeComponentValue at EOF calls
    // next() while the buffered <EOF-token> is still in the array (next
    // must not shift it). TF (non-EOF with empty buffer) is unreachable:
    // peek only returns a non-EOF token from bufferedTokens[0].
    const unclosed = parseStreaming(['.x { color: red']);
    assert.equal(unclosed.cssRules.length, 1);
    assert.ok(unclosed.cssRules[0] instanceof CSSStyleRule);
    assert.equal((unclosed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').trim(), 'red');

    // Empty closed stream: peek/next of EOF with a buffered sentinel.
    const eofOnly = parseStreaming([]);
    assert.equal(eofOnly.cssRules.length, 0);
  });
});
