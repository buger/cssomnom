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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8,
// SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX,
// SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-HHVE
// Public-API unique-cause for src/parser.ts consumeAtRuleFromStream nested
// (L1229 / isSupportedAtRule nested, css-nesting-1 § 3.3 #conditionals) and
// consumeRemnantsOfABadDeclaration (css-syntax-3 § 5.5.6
// #consume-remnants-of-a-bad-declaration). Drive parse / parseStyleSheet /
// CSSStyleSheet.replaceSync / StreamingTokenizer. No Reflect, no private
// consumeAtRuleFromStream calls.
// skipToNextSemicolonOrBlock is never invoked from src/ (dead helper) —
// listed UNREACHABLE in the writeup, not forced via internals.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseStyleSheet, Parser } from '../src/parser.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';
import {
  CSSAtRule,
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSLayerStatementRule,
  CSSLayerBlockRule,
  CSSImportRule,
  CSSStyleSheet,
  CSSNestedDeclarations,
} from '../src/CSSOM.ts';

function parseStreaming(chunks: string[]): CSSStyleSheet {
  const tokenizer = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tokenizer);
  const parser = new Parser(stream);
  for (const chunk of chunks) tokenizer.appendChunk(chunk);
  tokenizer.close();
  return parser.parseStyleSheet();
}

describe('MC/DC public unique-cause: consumeAtRuleFromStream nested T vs F', () => {
  test('nested @media / @layer / @supports inside a style rule (css-nesting-1 § 3.3)', () => {
    const sheet = parse(
      '.a { color: red; @media all { color: navy; } @supports (display: grid) { display: grid; } @layer foo; }',
    );
    assert.equal(sheet.cssRules.length, 1);
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.cssRules.length, 3);
    assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    assert.ok(host.cssRules[1] instanceof CSSSupportsRule);
    assert.ok(host.cssRules[2] instanceof CSSLayerStatementRule);
  });

  test('top-level statement @import / @media vs nested unknown drop', () => {
    const top = parse('@import "x.css"; @media all { .a { color: red; } }');
    assert.ok(top.cssRules[0] instanceof CSSImportRule);
    assert.ok(top.cssRules[1] instanceof CSSMediaRule);
    assert.ok(top.cssRules[1].cssRules[0] instanceof CSSStyleRule);

    // nested T: @import is not a nested-group at-rule → dropped
    const nestedImport = parse('.a { color: red; @import "x.css"; margin: 1px; }');
    const host = nestedImport.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('margin'), '1px');
    assert.equal(host.cssRules.length, 0);

    // nested T: unknown at-rule dropped (isSupported F when nested)
    const nestedUnknown = parse('.a { color: red; @unknown; margin: 1px; }');
    const uhost = nestedUnknown.cssRules[0];
    assert.ok(uhost instanceof CSSStyleRule);
    assert.equal(uhost.style.getPropertyValue('color'), 'red');
    assert.equal(uhost.style.getPropertyValue('margin'), '1px');
    assert.equal(uhost.cssRules.length, 0);

    // nested F (grouping body): unknown at-rule kept as CSSAtRule
    const grouping = parse('@media all { @unknown; .ok { color: red; } }');
    const media = grouping.cssRules[0];
    assert.ok(media instanceof CSSMediaRule);
    assert.ok(media.cssRules[0] instanceof CSSAtRule);
    assert.equal((media.cssRules[0] as CSSAtRule).name, 'unknown');
    assert.ok(media.cssRules[1] instanceof CSSStyleRule);
  });

  test('nested @layer block vs top-level @layer statement', () => {
    const nested = parse('.a { @layer utilities { color: olive; } }');
    const host = nested.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.ok(host.cssRules[0] instanceof CSSLayerBlockRule);

    const top = parse('@layer utilities; .a { color: red; }');
    assert.ok(top.cssRules[0] instanceof CSSLayerStatementRule);
    assert.ok(top.cssRules[1] instanceof CSSStyleRule);
  });

  test('replaceSync and parseStyleSheet drive the same nested FromStream arms', () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(
      '.a { color: red; @media (min-width: 1px) { color: navy; } @supports (color: red) { color: blue; } @layer foo; @unknown; }',
    );
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    assert.ok(host.cssRules[1] instanceof CSSSupportsRule);
    assert.ok(host.cssRules[2] instanceof CSSLayerStatementRule);
    assert.equal(
      [...host.cssRules].some((r) => r instanceof CSSAtRule && (r as CSSAtRule).name === 'unknown'),
      false,
    );

    const rules = parseStyleSheet('.a { @media all { color: teal; } @--foo; }');
    assert.equal(rules.length, 1);
    assert.ok(rules[0] instanceof CSSStyleRule);
    assert.ok(rules[0].cssRules[0] instanceof CSSMediaRule);
    assert.equal(rules[0].cssRules.length, 1);
  });

  test('StreamingTokenizer chunks across nested @media / @layer', () => {
    const sheet = parseStreaming([
      '.a { @med',
      'ia all { color: navy; } @layer ',
      'foo; }',
    ]);
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    assert.ok(host.cssRules[1] instanceof CSSLayerStatementRule);
  });
});

describe('MC/DC public unique-cause: consumeRemnantsOfABadDeclaration nested T vs F', () => {
  test('nested T: `--:` + `{` block is a bad nested qualified rule; remnants stop at `;` or `}`', () => {
    // css-syntax-3 § 5.5.3 / § 5.5.6: prelude `--:` looks like a custom
    // property (starts with `--`) followed by a `{` block → remnants.
    // Nested T + non-terminator tokens: eat through `color: red;` then stop.
    const eaten = parse('.a { --: { leftover } color: red; margin: 1px; }');
    const host = eaten.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), '');
    assert.equal(host.style.getPropertyValue('margin'), '1px');

    // Nested T + semicolon immediately after the block: following decl kept
    const semi = parse('.a { --: { leftover }; color: red; }');
    const shost = semi.cssRules[0];
    assert.ok(shost instanceof CSSStyleRule);
    assert.equal(shost.style.getPropertyValue('color'), 'red');

    // Nested T + `}`: do not consume the style-rule closer; next rule survives
    const rbrace = parse('.a { --: { leftover } } .b { color: blue; }');
    assert.equal(rbrace.cssRules.length, 2);
    assert.ok(rbrace.cssRules[0] instanceof CSSStyleRule);
    assert.ok(rbrace.cssRules[1] instanceof CSSStyleRule);
    assert.equal(rbrace.cssRules[1].style.getPropertyValue('color'), 'blue');
  });

  test('nested F (top-level @media body): remnants consume `}` and swallow the following rule', () => {
    // Grouping bodies call FromStream with nested F. Remnants on `}` consume
    // the closer, so `.ok { color: red; }` is eaten with the bad prelude.
    const swallowed = parse('@media all { --: { leftover } .ok { color: red; } }');
    const media = swallowed.cssRules[0];
    assert.ok(media instanceof CSSMediaRule);
    assert.equal(media.cssRules.length, 0);

    // Semicolon unique-cause: remnants stop, following qualified rule kept
    const kept = parse('@media all { --: { leftover }; .ok { color: red; } }');
    const keptMedia = kept.cssRules[0];
    assert.ok(keptMedia instanceof CSSMediaRule);
    assert.equal(keptMedia.cssRules.length, 1);
    assert.ok(keptMedia.cssRules[0] instanceof CSSStyleRule);
    assert.equal(keptMedia.cssRules[0].style.getPropertyValue('color'), 'red');
  });

  test('`--foo:` with a `{` block is a declaration, not remnants (isDecl T)', () => {
    const sheet = parse('.a { --foo: { leftover } color: red; }');
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('--foo').includes('leftover'), true);
  });

  test('EOF remnants of `--:` inside an unclosed style rule', () => {
    const sheet = parse('.a { color: red; --: { leftover }');
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.cssRules.length, 0);
  });
});

describe('MC/DC public unique-cause: nested declarations after a dropped at-rule', () => {
  test('trailing decls after nested @unknown stay on the host style', () => {
    const sheet = parse('.a { color: red; @unknown { color: navy; } padding: 2px; }');
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.equal(host.style.getPropertyValue('color'), 'red');
    assert.equal(host.style.getPropertyValue('padding'), '2px');
    assert.equal(host.cssRules.length, 0);
  });

  test('nested @media with a following nested declaration', () => {
    const sheet = parse('.a { color: red; @media all { color: navy; } margin: 1px; }');
    const host = sheet.cssRules[0];
    assert.ok(host instanceof CSSStyleRule);
    assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    assert.ok(host.cssRules[1] instanceof CSSNestedDeclarations);
    assert.equal(host.cssRules[1].style.getPropertyValue('margin'), '1px');
  });
});
