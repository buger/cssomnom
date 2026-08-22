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
// Leftover unique-cause for src/parser.ts handleKeyframesRule after
// tests/mcdc-branch-parser.test.ts, tests/mcdc-branch-parser-atrules.test.ts,
// and tests/mcdc-parser-still-hot-unique-cause.test.ts (18/22 D, 24/28 C,
// incomplete 4). Hottest seam L532 next.type === "simple-block" &&
// associatedToken.type === "{". Remaining incomplete: length>0 F
// (ignored as single-condition after LOOP retarget), L518/L529 while (true) F.
// valid F with nonempty parts is public unique-cause: from, 999% vs from.
// Drive parseStyleSheet / CSSStyleSheet.replaceSync @keyframes.
// css-animations-1 #interface-csskeyframesrule / #keyframe-selector,
// css-syntax-3 § 5.5.2 #consume-an-at-rule / § 5.5.8 #consume-a-simple-block,
// css-values-4 § 4.1 #keywords, cssom-1 § 6.5.1 #dom-cssstylesheet-replacesync.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../src/parser.ts';
import {
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSMediaRule,
  CSSStyleRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';
import type { Rule } from '../src/types.ts';

function replaceSyncSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

function sheetKeyframes(css: string): CSSKeyframesRule[] {
  return parseStyleSheet(css).filter((r): r is CSSKeyframesRule => r instanceof CSSKeyframesRule);
}

function onlyKf(css: string): CSSKeyframesRule {
  const kfs = sheetKeyframes(css);
  assert.equal(kfs.length, 1, `expected one @keyframes in ${JSON.stringify(css)}`);
  return kfs[0];
}

function keysOf(rule: CSSKeyframesRule): string[] {
  return [...rule.cssRules].map((k) => (k as CSSKeyframeRule).keyText);
}

function assertKf(rule: Rule, name: string, keys: string[]): CSSKeyframesRule {
  assert.ok(rule instanceof CSSKeyframesRule, `expected CSSKeyframesRule for name=${name}`);
  assert.equal(rule.name, name);
  assert.deepEqual(keysOf(rule), keys);
  return rule;
}

function replaceKf(css: string): CSSKeyframesRule {
  const sheet = replaceSyncSheet(css);
  assert.ok(sheet.cssRules[0] instanceof CSSKeyframesRule, `expected @keyframes via replaceSync for ${JSON.stringify(css)}`);
  return sheet.cssRules[0] as CSSKeyframesRule;
}

function mediaKf(css: string): CSSKeyframesRule {
  const rules = parseStyleSheet(css);
  assert.ok(rules[0] instanceof CSSMediaRule, `expected @media host for ${JSON.stringify(css)}`);
  const inner = [...(rules[0] as CSSMediaRule).cssRules].find((r) => r instanceof CSSKeyframesRule);
  assert.ok(inner instanceof CSSKeyframesRule, `expected nested @keyframes in ${JSON.stringify(css)}`);
  return inner;
}

describe('MC/DC leftover unique-cause: handleKeyframesRule L532 associatedToken { (css-animations-1 #keyframe-selector)', () => {
  test('L532 AND unique-cause of keyframe block `{` vs `[` / `(` via parseStyleSheet', () => {
    // T,T: simple-block whose associated token is `{` ends the selector prelude
    // (css-syntax-3 § 5.5.8 #consume-a-simple-block). from/to fold to 0%/100%.
    assertKf(onlyKf('@keyframes go { from { color: red; } }'), 'go', ['0%']);
    assertKf(onlyKf('@keyframes go { to { color: blue; } }'), 'go', ['100%']);
    assertKf(onlyKf('@keyframes go { 50% { color: green; } }'), 'go', ['50%']);
    assertKf(onlyKf('@keyframes go { FROM { color: red; } To { color: blue; } }'), 'go', ['0%', '100%']);
    assertKf(onlyKf('@keyframes go { from, to { color: red; } }'), 'go', ['0%, 100%']);

    // T,F: `[…]` is a simple-block whose associated token is not `{`, so it is
    // pushed into the selector prelude instead of becoming the keyframe block.
    // Without a later `{` block, blockVal stays null and the keyframe is dropped.
    assertKf(onlyKf('@keyframes go { from [ color: red; ] }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from[ color: red; ] }'), 'go', []);
    assertKf(onlyKf('@keyframes go { to [ color: blue; ] }'), 'go', []);
    assertKf(onlyKf('@keyframes go { 50% [ color: green; ] }'), 'go', []);
    assertKf(onlyKf('@keyframes go { [from] { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { [ color: red; ] }'), 'go', []);

    // T,F: `(…)` is the other non-`{` simple-block (associated token `(`).
    assertKf(onlyKf('@keyframes go { from ( color: red; ) }'), 'go', []);
    assertKf(onlyKf('@keyframes go { (from) { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { ( color: red; ) }'), 'go', []);

    // F--: function-token `from(…)` is not a simple-block (css-syntax-3
    // § 4.3.4 #consume-a-function); unique-causes C1 F independently of `[`.
    assertKf(onlyKf('@keyframes go { from( color: red; ) }'), 'go', []);
    assertKf(onlyKf('@keyframes go { foo(from) { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { url(from) { color: red; } }'), 'go', []);
  });

  test('L532 T,F `[`/`(` pollutes prelude so a later `{` cannot save that keyframe', () => {
    // `[x]` / `(x)` is consumed as prelude (T,F), then `{ color: … }` is the
    // actual block (T,T). trimmed prelude is no longer a single from/to/%, so
    // the keyframe is dropped. A later sibling with a clean `{` still stays.
    assertKf(
      onlyKf('@keyframes go { from [x] { color: red; } to { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(
      onlyKf('@keyframes go { from (x) { color: red; } to { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(
      onlyKf('@keyframes go { 50% [ignored] { color: blue; } from { color: red; } }'),
      'go',
      ['0%'],
    );
    assertKf(
      onlyKf('@keyframes go { 50% { color: red; } from [x] { color: blue; } to { color: green; } }'),
      'go',
      ['50%', '100%'],
    );
    // T,T empty prelude `{ color: blue; }` after a kept keyframe: associated
    // token is `{` so the block is taken, but trimmed.length !== 1 drops it.
    assertKf(
      onlyKf('@keyframes go { from { color: red; } { color: blue; } }'),
      'go',
      ['0%'],
    );
    assertKf(
      onlyKf('@keyframes go { from { color: red; } [to] { color: blue; } }'),
      'go',
      ['0%'],
    );
    // Comma-list unique-cause: `[to]` is a selector part, not the `{` block.
    assertKf(onlyKf('@keyframes go { from, [to] { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from, to [x] { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { 0%, [50%], 100% { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from, to { color: red; } }'), 'go', ['0%, 100%']);

    // After a T,F `[` with no following `{`, the inner while hits EOF, blockVal
    // is null, and the outer loop breaks — later selectors are not recovered.
    assertKf(
      onlyKf('@keyframes go { from { color: red; } to [ color: blue; ] }'),
      'go',
      ['0%'],
    );
    assertKf(
      onlyKf('@keyframes go { from { color: red; } to ( color: blue; ) }'),
      'go',
      ['0%'],
    );
    assertKf(
      onlyKf('@keyframes go { from { color: red; } to [ color: blue; ] 50% { color: green; } }'),
      'go',
      ['0%'],
    );
  });

  test('replaceSync unique-cause of the same L532 rows (cssom-1 § 6.5.1 #dom-cssstylesheet-replacesync)', () => {
    assertKf(replaceKf('@keyframes go { from { color: red; } }'), 'go', ['0%']);
    assertKf(replaceKf('@keyframes go { from [ color: red; ] }'), 'go', []);
    assertKf(replaceKf('@keyframes go { from ( color: red; ) }'), 'go', []);
    assertKf(replaceKf('@keyframes go { from[ color: red; ] }'), 'go', []);
    assertKf(replaceKf('@keyframes go { from( color: red; ) }'), 'go', []);
    assertKf(replaceKf('@keyframes go { [from] { color: red; } }'), 'go', []);
    assertKf(
      replaceKf('@keyframes go { from [x] { color: red; } to { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(
      replaceKf('@KEYFRAMES go { from [x] { color: red; } TO { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(replaceKf('@keyframes "go" { from [x] { color: red; } }'), 'go', []);
    const dropped = replaceSyncSheet('@keyframes; .ok { color: green; }');
    assert.equal(dropped.cssRules.length, 1);
    assert.ok(dropped.cssRules[0] instanceof CSSStyleRule);
  });
});

describe('MC/DC leftover unique-cause: handleKeyframesRule grouping / vendor L532', () => {
  test('parseStyleSheet @media child still unique-causes L532 `[` vs `{`', () => {
    // Grouping @media children still reach handleKeyframesRule (unlike a nested
    // style-rule body: NESTED_GROUP_AT_RULES does not include keyframes).
    assertKf(
      mediaKf('@media all { @keyframes go { from { color: red; } } }'),
      'go',
      ['0%'],
    );
    assertKf(
      mediaKf('@media all { @keyframes go { from [ color: red; ] } }'),
      'go',
      [],
    );
    assertKf(
      mediaKf('@media (min-width: 1px) { @keyframes go { from [x] { color: red; } to { color: blue; } } }'),
      'go',
      ['100%'],
    );

    const nestedStyle = parseStyleSheet('.a { @keyframes go { from { color: red; } } }');
    assert.ok(nestedStyle[0] instanceof CSSStyleRule);
    assert.equal((nestedStyle[0] as CSSStyleRule).cssRules.length, 0);
  });

  test('vendor-prefix / mixed-case name still unique-causes L532 associatedToken', () => {
    // getAtRuleHandler: lower === 'keyframes' || endsWith('-keyframes').
    assertKf(
      onlyKf('@-webkit-keyframes go { from [x] { color: red; } to { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(
      onlyKf('@-moz-keyframes go { from [x] { color: red; } to { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(
      onlyKf('@KEYFRAMES go { from (x) { color: red; } TO { color: blue; } }'),
      'go',
      ['100%'],
    );
    assertKf(onlyKf('@keyframes "spin" { from [ color: red; ] }'), 'spin', []);
    assertKf(onlyKf('@keyframes "spin" { from { color: red; } }'), 'spin', ['0%']);
  });
});

describe('MC/DC leftover unique-cause: handleKeyframesRule valid F after a push (css-animations-1 #keyframe-selector)', () => {
  test('from, 999% unique-causes valid F with nonempty parts vs from T pair', () => {
    // valid F ∧ length T: `from` pushes '0%', then 999% is out of [0, 100]
    // so valid=false with a nonempty normalizedParts. The keyframe is dropped.
    // T pair: from { } keeps 0%. Drive parseStyleSheet and replaceSync.
    assertKf(onlyKf('@keyframes n { from, 999% { color: red } }'), 'n', []);
    assertKf(onlyKf('@keyframes n { from { color: red } }'), 'n', ['0%']);
    assertKf(replaceKf('@keyframes n { from, 999% { color: red } }'), 'n', []);
    assertKf(replaceKf('@keyframes n { from { color: red } }'), 'n', ['0%']);
  });
});

describe('MC/DC leftover unique-cause: handleKeyframesRule L588 / L518 / L529 mute witness', () => {
  test('length>0 F with valid T is unreachable: empty/comma prelude is valid F', () => {
    // lists always starts as [[]]. Empty / whitespace-only / leading / trailing
    // comma preludes hit trimmed.length !== 1 and set valid=false before any
    // push, so JS never evaluates length>0 under valid T. Any valid from/to/%
    // list pushes a part, so valid T with length 0 cannot occur via
    // parseStyleSheet / replaceSync (length F is the single-condition ignore).
    assertKf(onlyKf('@keyframes go { { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go {   { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from, { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { , from { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from, to, { color: red; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from  to { color: red; } }'), 'go', []);
    assertKf(replaceKf('@keyframes go { { color: red; } }'), 'go', []);

    // valid T, length>0 T still creates (pair against the mute F row).
    assertKf(onlyKf('@keyframes go { from { color: red; } }'), 'go', ['0%']);
    assertKf(onlyKf('@keyframes go { 0%, 50%, 100% { color: red; } }'), 'go', ['0%, 50%, 100%']);
  });

  test('L518/L529 while(true) F is a literal; inner EOF vs `{` / outer !blockVal vs EOF', () => {
    // L518 and L529 are `while (true)` — F is structurally unpairable.
    // Inner L529 exits T,T on `{` (still a keyframe) vs EOF without `{`
    // (blockVal null → outer else-break). Outer L518 then ends.
    assertKf(onlyKf('@keyframes go { from { color: red; } }'), 'go', ['0%']);
    assertKf(onlyKf('@keyframes go { from }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from [ color: red; ] }'), 'go', []);
    assertKf(onlyKf('@keyframes go { from { color: red; '), 'go', ['0%']);
    assertKf(onlyKf('@keyframes go { from [ color: red; '), 'go', []);
    // Semicolon skip at outer-loop start (between completed keyframes) vs
    // semicolon swallowed into an already-open prelude.
    assertKf(
      onlyKf('@keyframes go { from { color: red; } ; to { color: blue; } }'),
      'go',
      ['0%', '100%'],
    );
    assertKf(onlyKf('@keyframes go { from; 50% { color: blue; } }'), 'go', []);
    assertKf(onlyKf('@keyframes go { ; 50% { color: blue; } }'), 'go', ['50%']);
  });
});
