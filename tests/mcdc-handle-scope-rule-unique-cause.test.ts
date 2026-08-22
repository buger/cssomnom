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
// Leftover unique-cause for src/parser.ts handleScopeRule after
// tests/mcdc-branch-parser-atrules.test.ts and
// tests/mcdc-parser-still-hot-unique-cause.test.ts (5/9 D, 13/18 C,
// incomplete 4). Hottest seam L467 i < prelude.length &&
// associatedToken.type === "("; also L466 while after `to`, L456
// if (startSelector), L477 if (endSelector).
// Drive parseStyleSheet / CSSStyleSheet.replaceSync @scope.
// css-cascade-6 #at-ruledef-scope, css-nesting-1 § 4.1 #nesting-at-scope,
// css-syntax-3 § 5.5.2 #consume-an-at-rule, selectors-4 #relative-selector.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../src/parser.ts';
import {
  CSSScopeRule,
  CSSStyleRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';
import type { Rule } from '../src/types.ts';

function replaceSyncSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

function sheetScopes(css: string): CSSScopeRule[] {
  return parseStyleSheet(css).filter((r): r is CSSScopeRule => r instanceof CSSScopeRule);
}

function onlyScope(css: string): CSSScopeRule {
  const scopes = sheetScopes(css);
  assert.equal(scopes.length, 1, `expected one @scope in ${JSON.stringify(css)}`);
  return scopes[0];
}

function nestedScope(css: string): CSSScopeRule {
  const rules = parseStyleSheet(css);
  assert.ok(rules[0] instanceof CSSStyleRule, `expected style host for ${JSON.stringify(css)}`);
  const nested = [...(rules[0] as CSSStyleRule).cssRules].find((r) => r instanceof CSSScopeRule);
  assert.ok(nested instanceof CSSScopeRule, `expected nested @scope in ${JSON.stringify(css)}`);
  return nested;
}

function replaceScope(css: string): CSSScopeRule {
  const sheet = replaceSyncSheet(css);
  assert.ok(sheet.cssRules[0] instanceof CSSScopeRule, `expected @scope via replaceSync for ${JSON.stringify(css)}`);
  return sheet.cssRules[0] as CSSScopeRule;
}

function replaceNestedScope(css: string): CSSScopeRule {
  const sheet = replaceSyncSheet(css);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  const nested = [...(sheet.cssRules[0] as CSSStyleRule).cssRules].find((r) => r instanceof CSSScopeRule);
  assert.ok(nested instanceof CSSScopeRule, `expected nested @scope via replaceSync for ${JSON.stringify(css)}`);
  return nested;
}

function assertScope(rule: Rule, start: string | null, end: string | null): CSSScopeRule {
  assert.ok(rule instanceof CSSScopeRule);
  assert.equal(rule.startSelector, start);
  assert.equal(rule.endSelector, end);
  return rule;
}

describe('MC/DC leftover unique-cause: handleScopeRule L466/L467 after to (css-cascade-6 #at-ruledef-scope)', () => {
  test('L467 3-way AND unique-cause of end-selector paren via parseStyleSheet', () => {
    // TTT: i < length, simple-block, associatedToken `(`.
    const paren = onlyScope('@scope to (span) { p { color: red; } }');
    assertScope(paren, null, '(span)');
    assert.equal(paren.cssRules.length, 1);

    const both = onlyScope('@scope (div) to (span) { p { color: red; } }');
    assertScope(both, '(div)', '(span)');

    // TTF: simple-block `[span]` is not `(`. css-syntax-3 § 5.5.8 #consume-a-simple-block.
    // still-hot unique-caused start `[div]`; this is the matching end-selector arm.
    const square = onlyScope('@scope to [span] { p { color: red; } }');
    assertScope(square, null, null);
    assert.equal(square.cssRules.length, 1);

    const squareAfterStart = onlyScope('@scope (div) to [span] { p { color: red; } }');
    assertScope(squareAfterStart, '(div)', null);

    const squareNoWs = onlyScope('@scope to[span] { p { color: red; } }');
    assertScope(squareNoWs, null, null);

    // TFT: ident after `to` is not a simple-block (still-hot had `to span`; keep
    // the pair in this file so L467 C2 F is independent of C3).
    const ident = onlyScope('@scope to span { p { color: red; } }');
    assertScope(ident, null, null);

    const fn = onlyScope('@scope to foo(span) { p { color: red; } }');
    assertScope(fn, null, null);

    // F--: after consuming `to`, prelude is exhausted. `{` is the at-rule block
    // (css-syntax-3 § 5.5.2), not a prelude simple-block. Unique-causes both
    // L466 while `i < prelude.length` F and L467 `i < prelude.length` F.
    const toOnly = onlyScope('@scope to { p { color: red; } }');
    assertScope(toOnly, null, null);
    assert.equal(toOnly.cssRules.length, 1);

    const toNoWs = onlyScope('@scope to{ p { color: red; } }');
    assertScope(toNoWs, null, null);

    const toAfterStart = onlyScope('@scope (div) to { p { color: red; } }');
    assertScope(toAfterStart, '(div)', null);

    // Mixed-case TO still enters the ident arm (still-hot); `[span]` then
    // unique-causes associatedToken `(` F on that path.
    const toUpperSquare = onlyScope('@scope TO [span] { p { color: red; } }');
    assertScope(toUpperSquare, null, null);
    const toUpperBare = onlyScope('@scope (div) TO { p { color: blue; } }');
    assertScope(toUpperBare, '(div)', null);
  });

  test('L466 after-to whitespace unique-cause vs L467 associatedToken', () => {
    // L466 T T then L467 TTT: spaces after `to` are skipped, then `(span)`.
    const wsParen = onlyScope('@scope to   (span) { p { color: red; } }');
    assertScope(wsParen, null, '(span)');

    const tabNl = onlyScope('@scope to\t\n(span) { p { color: red; } }');
    assertScope(tabNl, null, '(span)');

    // L466 T T then L467 TTF: whitespace skip unique-cause does not change `[`.
    const wsSquare = onlyScope('@scope to   [span] { p { color: red; } }');
    assertScope(wsSquare, null, null);

    const startWsSquare = onlyScope('@scope (div)  to  [span] { p { color: red; } }');
    assertScope(startWsSquare, '(div)', null);

    // L466 T F: no whitespace between `to` and `[` / `(`.
    // `to(span)` is a function-token (css-syntax-3 § 4.3.4), so the ident `to`
    // arm never runs and end stays null.
    assertScope(onlyScope('@scope to(span) { p { color: red; } }'), null, null);
    assertScope(onlyScope('@scope (div) to(span) { p { color: red; } }'), '(div)', null);
    // `)to (` (no space after the start block) still sees ident `to`.
    assertScope(onlyScope('@scope (div)to (span) { p { color: red; } }'), '(div)', '(span)');

    // L466 F: trailing spaces after `to` are in the prelude, skipped, then i >= length.
    const trailWs = onlyScope('@scope to   { p { color: red; } }');
    assertScope(trailWs, null, null);
  });

  test('replaceSync unique-cause of the same L466/L467 rows (cssom-1 § 6.5.1 #dom-cssstylesheet-replacesync)', () => {
    assertScope(replaceScope('@scope to (span) { p { color: red; } }'), null, '(span)');
    assertScope(replaceScope('@scope (div) to (span) { p { color: red; } }'), '(div)', '(span)');
    assertScope(replaceScope('@scope to [span] { p { color: red; } }'), null, null);
    assertScope(replaceScope('@scope (div) to [span] { p { color: red; } }'), '(div)', null);
    assertScope(replaceScope('@scope to { p { color: red; } }'), null, null);
    assertScope(replaceScope('@scope (div) to { p { color: red; } }'), '(div)', null);
    assertScope(replaceScope('@scope to[span] { p { color: red; } }'), null, null);
    assertScope(replaceScope('@SCOPE TO [span] { p { color: red; } }'), null, null);

    const implied = replaceSyncSheet('@scope { p { color: red; } }');
    assertScope(implied.cssRules[0], null, null);

    const dropped = replaceSyncSheet('@scope; .ok { color: green; }');
    assert.equal(dropped.cssRules.length, 1);
    assert.ok(dropped.cssRules[0] instanceof CSSStyleRule);
  });
});

describe('MC/DC leftover unique-cause: handleScopeRule nested FromStream after to', () => {
  test('parseStyleSheet nested @scope L467 `[` vs `to {` vs `(span)`', () => {
    // css-nesting-1 § 4.1 #nesting-at-scope: nested body uses FromStream.
    assertScope(nestedScope('.a { @scope to (span) { color: red; } }'), null, '(span)');
    assertScope(nestedScope('.a { @scope to [span] { color: red; } }'), null, null);
    assertScope(nestedScope('.a { @scope to { color: red; } }'), null, null);
    assertScope(nestedScope('.a { @scope (div) to [span] { color: red; } }'), '(div)', null);
    assertScope(nestedScope('.a { @scope (div) to { color: red; } }'), '(div)', null);
    // still-hot unique-caused nested relative start; `[` after `to` is independent.
    assertScope(nestedScope('.a { @scope (> .b) to [span] { color: red; } }'), '(> .b)', null);
    assertScope(nestedScope('.a { @scope (> .b) to { color: red; } }'), '(> .b)', null);
  });

  test('replaceSync nested @scope L466/L467 unique-cause', () => {
    assertScope(replaceNestedScope('.a { @scope to (span) { color: red; } }'), null, '(span)');
    assertScope(replaceNestedScope('.a { @scope to [span] { color: red; } }'), null, null);
    assertScope(replaceNestedScope('.a { @scope to { color: red; } }'), null, null);
    assertScope(replaceNestedScope('.a { @scope (div) to [span] { color: red; } }'), '(div)', null);
    assertScope(replaceNestedScope('.a { @scope (div) to { color: red; } }'), '(div)', null);
    assertScope(replaceNestedScope('.a { @scope TO [span] { color: red; } }'), null, null);
  });
});

describe('MC/DC leftover unique-cause: handleScopeRule L456/L477 wrap mute witness', () => {
  test('empty / whitespace / comments-only () throw before if (startSelector)/if (endSelector)', () => {
    // L456 if (startSelector) and L477 if (endSelector) only run after
    // SelectorParser.parse() succeeds. selectors-4 empty lists throw
    // (`Selector list cannot be empty`), so serialize(block.value).trim() is
    // never "" on the wrap arm. css-syntax-3 § 4.3.2 #consume-comments discards
    // comments, so `(/**/)` is the same empty list. Structurally unpairable F
    // via parseStyleSheet / replaceSync (no //mcdc:ignore).
    assert.deepEqual(parseStyleSheet('@scope () { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope ( ) { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope (/**/) { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope to () { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope to ( ) { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope (div) to () { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope (div) to ( ) { p { color: red; } }'), []);

    const emptyStart = replaceSyncSheet('@scope () { p { color: red; } }');
    assert.equal(emptyStart.cssRules.length, 0);
    const emptyEnd = replaceSyncSheet('@scope (div) to () { p { color: red; } }');
    assert.equal(emptyEnd.cssRules.length, 0);

    // Successful parse always wraps a non-empty serialize (L456/L477 T).
    assertScope(onlyScope('@scope (div) { p { color: red; } }'), '(div)', null);
    assertScope(onlyScope('@scope to (span) { p { color: red; } }'), null, '(span)');
    assertScope(onlyScope('@scope (*) { p { color: red; } }'), '(*)', null);
    assertScope(onlyScope('@scope to (*) { p { color: red; } }'), null, '(*)');
  });

  test('end relative selector throws (no allowRelative) vs start nested relative T', () => {
    // End SelectorParser does not pass allowRelative (handleScopeRule L470).
    // Relative end is dropped even nested; not an L456/L477 wrap F.
    assert.deepEqual(parseStyleSheet('@scope to (> .b) { p { color: red; } }'), []);
    assert.deepEqual(parseStyleSheet('@scope (div) to (> .b) { p { color: red; } }'), []);
    const host = parseStyleSheet('.a { @scope to (> .b) { color: red; } }');
    assert.ok(host[0] instanceof CSSStyleRule);
    assert.equal((host[0] as CSSStyleRule).cssRules.length, 0);
    const startRel = parseStyleSheet('.a { @scope (> .b) { color: red; } }');
    assert.ok(startRel[0] instanceof CSSStyleRule);
    assertScope((startRel[0] as CSSStyleRule).cssRules[0], '(> .b)', null);
  });
});
