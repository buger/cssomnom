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
// Verifies: INT-REQ-260821-WTPD, SYS-REQ-260821-NGJH, SW-REQ-260821-MZ8P
// KI-6 / KI-14: parseStylesheetSync adapts type-0 at-rules to CSSParserAtRule
// and CSSKeyframeRule (type 8) to CSSParserQualifiedRule.
// cssom-1 § 6.4 #the-cssrule-interface
// css-syntax-3 § 5.5.2 #consume-an-at-rule / § 5.5.3 #consume-a-qualified-rule
// css-animations-1 #CSSKeyframeRule / #keyframe-selector
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CSS,
  CSSParserAtRule,
  CSSParserDeclaration,
  CSSParserQualifiedRule,
  toParserRule,
} from '../src/index.ts';

describe('KI-6 type-0 at-rule adapter', () => {
  // INT-REQ-260821-WTPD:malformed_recovers_or_errors_loudly:nominal
  test('parseStylesheetSync adapts type-0 @layer and @container to CSSParserAtRule', () => {
    const layer = CSS.parseStylesheetSync('@layer foo;');
    assert.equal(layer.length, 1);
    assert.ok(layer[0] instanceof CSSParserAtRule);
    assert.equal((layer[0] as CSSParserAtRule).name, 'layer');

    const layerBlock = CSS.parseStylesheetSync('@layer foo { .x { color: red; } }');
    assert.equal(layerBlock.length, 1);
    assert.ok(layerBlock[0] instanceof CSSParserAtRule);
    const layerAt = layerBlock[0] as CSSParserAtRule;
    assert.equal(layerAt.name, 'layer');
    assert.ok(layerAt.body?.[0] instanceof CSSParserQualifiedRule);

    const container = CSS.parseStylesheetSync('@container (min-width: 1px) { .x { color: red; } }');
    assert.equal(container.length, 1);
    assert.ok(container[0] instanceof CSSParserAtRule);
    const containerAt = container[0] as CSSParserAtRule;
    assert.equal(containerAt.name, 'container');
    assert.ok(containerAt.body?.[0] instanceof CSSParserQualifiedRule);
  });

  test('duck-typed type-0 cssText with quoted { keeps prelude', () => {
    // css-syntax-3 § 4.3.4 #consume-string-token: do not slice cssText at first `{`.
    const duck = { type: 0, cssText: '@container (style(--x: "{")) { .x { color: red } }' };
    const rule = toParserRule(duck);
    assert.ok(rule instanceof CSSParserAtRule);
    const at = rule as CSSParserAtRule;
    assert.equal(at.name, 'container');
    const preludeStr = at.prelude.map((v) => v.toString()).join('');
    assert.ok(preludeStr.includes('{'), `prelude lost quoted '{': ${JSON.stringify(preludeStr)}`);
    assert.ok(!preludeStr.includes('.x'), `prelude swallowed body: ${JSON.stringify(preludeStr)}`);
  });
});

describe('KI-14 keyframe qualified-rule adapter', () => {
  // INT-REQ-260821-WTPD:malformed_recovers_or_errors_loudly:nominal
  test('parseStylesheetSync maps @keyframes children to CSSParserQualifiedRule', () => {
    const sheet = CSS.parseStylesheetSync('@keyframes x { from { color: red } to { color: blue } 50% { opacity: 1 } }');
    assert.equal(sheet.length, 1);
    assert.ok(sheet[0] instanceof CSSParserAtRule);
    const at = sheet[0] as CSSParserAtRule;
    assert.equal(at.name, 'keyframes');
    assert.ok(at.body && at.body.length >= 3, `expected keyframe children, got ${at.body?.length}`);

    const fromRule = at.body[0];
    assert.ok(fromRule instanceof CSSParserQualifiedRule, `from child was ${fromRule?.constructor?.name}`);
    const fromPrelude = fromRule.prelude.map((t) => t.toString()).join('');
    assert.ok(fromPrelude.includes('from'), `from prelude was ${JSON.stringify(fromPrelude)}`);
    const fromColor = fromRule.body.find((d) => d instanceof CSSParserDeclaration && d.name === 'color');
    assert.ok(fromColor, 'from keyframe lacked color declaration');

    const toRule = at.body[1];
    assert.ok(toRule instanceof CSSParserQualifiedRule);
    const toPrelude = toRule.prelude.map((t) => t.toString()).join('');
    assert.ok(toPrelude.includes('to'), `to prelude was ${JSON.stringify(toPrelude)}`);

    const mid = at.body[2];
    assert.ok(mid instanceof CSSParserQualifiedRule);
    const midPrelude = mid.prelude.map((t) => t.toString()).join('');
    assert.ok(midPrelude.includes('50%'), `50% prelude was ${JSON.stringify(midPrelude)}`);
  });

  test('duck-typed KEYFRAME_RULE type 8 is a qualified rule, not unknown at-rule', () => {
    const duck = { type: 8, cssText: 'from { color: red }' };
    const rule = toParserRule(duck);
    assert.ok(rule instanceof CSSParserQualifiedRule, `type 8 duck was ${rule?.constructor?.name}`);
    const prelude = rule.prelude.map((t) => t.toString()).join('');
    assert.ok(prelude.includes('from'), `type 8 duck prelude was ${JSON.stringify(prelude)}`);
    const color = rule.body.find((d) => d instanceof CSSParserDeclaration && d.name === 'color');
    assert.ok(color, 'type 8 duck lacked color declaration');
  });
});
