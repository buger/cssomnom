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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG, SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
// Leftover unique-cause for src/shorthands.ts around L716 after
// tests/mcdc-hotspot-shorthands.test.ts, tests/mcdc-hotspot-shorthands-more.test.ts,
// tests/mcdc-hotspot-shorthands-still-hot.test.ts, tests/mcdc-hotspot-contract-background.test.ts,
// tests/mcdc-hotspot-expand-leftover.test.ts, tests/mcdc-shorthands-leftover-unique-cause.test.ts,
// and tests/mcdc-shorthands-round5-unique-cause.test.ts (last recapture 44/49
// package decisions, 5 incomplete; top-8 #2 start L716 s1===s2).
// Drive CSSStyleDeclaration.setProperty / getPropertyValue / getPropertyPriority /
// cssText / removeProperty and stylesheet parse (parse / parseStyleSheet /
// CSSStyleSheet.replaceSync). SHORTHANDS.expand/contract only for
// missing-longhand / mixed-case ident pairs getPropertyValue skips
// (same-CSS-wide early-returns at CSSStyleDeclaration L238; cssText uses
// tryCombineLogicalShorthand, not contractTwoValue).
// cssom-1 § 6.7.1 #set-a-css-declaration / § 6.7.2 #serialize-a-css-declaration-block
// / css-logical-1 #logical-shorthand-keyword / css-box-3 #propdef-margin
// / css-backgrounds-3 #the-border-shorthands / css-cascade-5 #defaulting-keywords.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { parse, parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { serialize } from '../src/serializer.ts';
import { SHORTHANDS } from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule, CSSStyleSheet } from '../src/CSSOM.ts';
import type { ComponentValue, IdentToken } from '../src/types.ts';

function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}

function ser(expanded: Record<string, ComponentValue[]> | null, name: string): string {
  assert.ok(expanded, `expected expansion containing ${name}`);
  const tokens = expanded[name];
  assert.ok(tokens, `missing longhand ${name}`);
  return serialize(tokens).trim();
}

function style(): CSSStyleDeclaration {
  return new CSSStyleDeclaration();
}

function setLonghands(pairs: Record<string, string>, priority?: string): CSSStyleDeclaration {
  const decl = style();
  for (const [name, value] of Object.entries(pairs)) {
    decl.setProperty(name, value, priority);
  }
  return decl;
}

function parsedStyle(css: string): CSSStyleDeclaration {
  const sheet = parse(css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, `expected CSSStyleRule for ${JSON.stringify(css)}`);
  return rule.style;
}

function replacedStyle(css: string): CSSStyleDeclaration {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, `expected CSSStyleRule for replaceSync ${JSON.stringify(css)}`);
  return rule.style;
}

function ident(value: string): IdentToken {
  return { type: 'ident', value };
}

describe('MC/DC L716 leftover: contractTwoValue CSS-wide s1===s2 (css-logical-1 #logical-shorthand-keyword)', () => {
  test('L716 T via getPropertyPriority / contract; F mixed CSS-wide (getPropertyValue skips same-wide)', () => {
    // Unique-cause: CSS-wide gate T, s1===s2 T. getPropertyValue of matching
    // CSS-wide longhands returns early without contractTwoValue (cssom-1
    // § 6.7.2); getPropertyPriority still calls contract (truthy → 'important').
    const same = setLonghands({
      'margin-block-start': 'inherit',
      'margin-block-end': 'inherit',
    }, 'important');
    assert.equal(same.getPropertyValue('margin-block'), 'inherit');
    assert.equal(same.getPropertyPriority('margin-block'), 'important');
    assert.equal(same.cssText, 'margin-block: inherit !important;');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('inherit'),
      'margin-block-end': comps('inherit'),
    }), 'inherit');
    assert.equal(SHORTHANDS['padding-inline'].contract({
      'padding-inline-start': comps('unset'),
      'padding-inline-end': comps('unset'),
    }), 'unset');
    assert.equal(SHORTHANDS['inset-block'].contract({
      'inset-block-start': [ident('INHERIT')],
      'inset-block-end': [ident('INHERIT')],
    }), 'INHERIT');

    const padSame = parsedStyle('.x { padding-block-start: revert; padding-block-end: revert; }');
    padSame.setProperty('padding-block-start', 'revert', 'important');
    padSame.setProperty('padding-block-end', 'revert', 'important');
    assert.equal(padSame.getPropertyPriority('padding-block'), 'important');

    // Unique-cause: CSS-wide gate T, s1===s2 F → null. getPropertyValue does
    // call contract here (mixed keywords fail the same-wide early return).
    const mixed = setLonghands({
      'margin-block-start': 'inherit',
      'margin-block-end': 'unset',
    });
    assert.equal(mixed.getPropertyValue('margin-block'), '');
    assert.equal(mixed.getPropertyPriority('margin-block'), '');
    assert.equal(mixed.cssText, 'margin-block: inherit unset;');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('inherit'),
      'margin-block-end': comps('unset'),
    }), null);

    const initial = setLonghands({
      'margin-inline-start': 'inherit',
      'margin-inline-end': 'initial',
    });
    assert.equal(initial.getPropertyValue('margin-inline'), '');
    assert.equal(SHORTHANDS['margin-inline'].contract({
      'margin-inline-start': comps('inherit'),
      'margin-inline-end': comps('initial'),
    }), null);

    const layer = replacedStyle('.x { inset-block-start: revert; inset-block-end: revert-layer; }');
    assert.equal(layer.getPropertyValue('inset-block'), '');
    assert.equal(SHORTHANDS['inset-block'].contract({
      'inset-block-start': comps('revert'),
      'inset-block-end': comps('revert-layer'),
    }), null);

    // Unique-cause: both CSS-wide via toLowerCase, s1===s2 F (case).
    // setProperty INHERIT/inherit still early-returns getPropertyValue.
    assert.equal(SHORTHANDS['padding-block'].contract({
      'padding-block-start': [ident('Inherit')],
      'padding-block-end': [ident('inherit')],
    }), null);
    const mixedCase = style();
    mixedCase.setProperty('padding-block-start', 'INHERIT');
    mixedCase.setProperty('padding-block-end', 'inherit');
    assert.equal(mixedCase.getPropertyValue('padding-block'), 'inherit');
    mixedCase.removeProperty('padding-block-end');
    assert.equal(mixedCase.getPropertyValue('padding-block'), '');
  });
});

describe('MC/DC L716 leftover: L715 CSS_WIDE.includes s2 unique-cause (css-cascade-5 #defaulting-keywords)', () => {
  test('s1 non-wide s2 wide T vs s1 wide s2 non-wide vs both non-wide', () => {
    // Unique-cause: includes(s1) F, includes(s2) T → enter L716, s1===s2 F.
    // round5 mixed inherit/unset short-circuits the second includes.
    const s2Wide = setLonghands({
      'margin-block-start': '10px',
      'margin-block-end': 'inherit',
    });
    assert.equal(s2Wide.getPropertyValue('margin-block'), '');
    assert.equal(s2Wide.cssText, 'margin-block: 10px inherit;');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('10px'),
      'margin-block-end': comps('inherit'),
    }), null);

    const padS2 = parsedStyle('.x { padding-inline-start: 4px; padding-inline-end: unset; }');
    assert.equal(padS2.getPropertyValue('padding-inline'), '');
    assert.equal(SHORTHANDS['padding-inline'].contract({
      'padding-inline-start': comps('4px'),
      'padding-inline-end': comps('unset'),
    }), null);

    const widthS2 = replacedStyle('.x { border-block-start-width: thin; border-block-end-width: inherit; }');
    assert.equal(widthS2.getPropertyValue('border-block-width'), '');
    assert.equal(SHORTHANDS['border-block-width'].contract({
      'border-block-start-width': comps('thin'),
      'border-block-end-width': comps('inherit'),
    }), null);

    // Unique-cause: includes(s1) T, includes(s2) F (second not skipped).
    const s1Wide = setLonghands({
      'margin-block-start': 'inherit',
      'margin-block-end': '10px',
    });
    assert.equal(s1Wide.getPropertyValue('margin-block'), '');
    assert.equal(s1Wide.cssText, 'margin-block: inherit 10px;');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('inherit'),
      'margin-block-end': comps('10px'),
    }), null);

    const colorS1 = setLonghands({
      'border-inline-start-color': 'revert',
      'border-inline-end-color': 'red',
    });
    assert.equal(colorS1.getPropertyValue('border-inline-color'), '');
    assert.equal(SHORTHANDS['border-inline-color'].contract({
      'border-inline-start-color': comps('revert'),
      'border-inline-end-color': comps('red'),
    }), null);

    // Unique-cause: both includes F → L718 s1===s2 T vs F (leftover covered
    // 10px/10px; re-hit so the CSS-wide OR F is paired on this row).
    const both = setLonghands({
      'margin-block-start': '10px',
      'margin-block-end': '20px',
    });
    assert.equal(both.getPropertyValue('margin-block'), '10px 20px');
    const collapsed = setLonghands({
      'margin-block-start': '8px',
      'margin-block-end': '8px',
    });
    assert.equal(collapsed.getPropertyValue('margin-block'), '8px');
  });
});

describe('MC/DC L716 leftover: L711 !v1 || !v2 unique-cause of v2 (cssom-1 § 6.7.2)', () => {
  test('v1 present v2 missing vs v1 missing vs both present', () => {
    // getPropertyValue skips contract when a longhand is absent
    // (`hasAllLonghands` is false). Direct contract is the only seam.
    const onlyStart = style();
    onlyStart.setProperty('margin-block-start', '10px');
    assert.equal(onlyStart.getPropertyValue('margin-block'), '');
    assert.equal(onlyStart.cssText, 'margin-block-start: 10px;');

    // Unique-cause: v1 T, v2 F.
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('10px'),
    }), null);
    assert.equal(SHORTHANDS['padding-inline'].contract({
      'padding-inline-start': comps('4px'),
    }), null);
    assert.equal(SHORTHANDS['inset-block'].contract({
      'inset-block-start': comps('auto'),
    }), null);
    assert.equal(SHORTHANDS['border-block-style'].contract({
      'border-block-start-style': comps('solid'),
    }), null);

    // Unique-cause: v1 F (v2 skipped).
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-end': comps('10px'),
    }), null);
    assert.equal(SHORTHANDS['margin-inline'].contract({}), null);
    const onlyEnd = parsedStyle('.x { padding-inline-end: 8px; }');
    assert.equal(onlyEnd.getPropertyValue('padding-inline'), '');
    onlyEnd.removeProperty('padding-inline-end');
    assert.equal(onlyEnd.cssText, '');

    // Unique-cause: v1 T, v2 T (OR false).
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('10px'),
      'margin-block-end': comps('20px'),
    }), '10px 20px');
    const both = replacedStyle('.x { margin-inline-start: 1px; margin-inline-end: 1px; }');
    assert.equal(both.getPropertyValue('margin-inline'), '1px');
  });
});

describe('MC/DC L716 leftover: expandBorderSide L830 val.type===hash (css-backgrounds-3 #the-border-shorthands)', () => {
  test('hash T vs function T vs neither (ident/string/dimension)', () => {
    // Unique-cause: type==='hash' T (function skipped). still-hot unique-caused
    // function T (`rgb()`) and both F (quoted string / percentage / number).
    const hash = style();
    hash.setProperty('border-top', '#f00');
    assert.equal(hash.getPropertyValue('border-top-color'), '#f00');
    assert.equal(hash.getPropertyValue('border-top-width'), 'medium');
    assert.equal(hash.getPropertyValue('border-top-style'), 'none');
    assert.equal(hash.getPropertyValue('border-top'), '#f00');
    assert.equal(hash.cssText, 'border-top: #f00;');

    const withWidth = style();
    withWidth.setProperty('border-left', '2px #abc');
    assert.equal(withWidth.getPropertyValue('border-left-color'), '#abc');
    assert.equal(withWidth.getPropertyValue('border-left-width'), '2px');

    const withStyle = parsedStyle('.x { border-bottom: solid #0f0; }');
    assert.equal(withStyle.getPropertyValue('border-bottom-color'), '#0f0');
    assert.equal(withStyle.getPropertyValue('border-bottom-style'), 'solid');

    const three = replacedStyle('.x { border-right: thick dashed #00f; }');
    assert.equal(three.getPropertyValue('border-right-color'), '#00f');
    assert.equal(three.getPropertyValue('border-right-width'), 'thick');

    assert.equal(ser(SHORTHANDS['border-top'].expand(comps('#fff')), 'border-top-color'), '#fff');
    const hex6 = SHORTHANDS['border-block-start'].expand(comps('#123456'));
    assert.equal(ser(hex6, 'border-block-start-color'), '#123456');

    // Unique-cause: hash F, function T.
    const rgb = style();
    rgb.setProperty('border-top', 'rgb(1, 2, 3)');
    assert.equal(rgb.getPropertyValue('border-top-color').includes('rgb'), true);

    // Unique-cause: hash F, function F (ident color / quoted string).
    const named = style();
    named.setProperty('border-top', 'red');
    assert.equal(named.getPropertyValue('border-top-color'), 'red');
    assert.equal(ser(SHORTHANDS['border-bottom'].expand(comps('"red"')), 'border-bottom-color').includes('red'), true);

    const fromSheet = parseStyleSheet('.x { border-top: #abc; }');
    assert.ok(fromSheet[0] instanceof CSSStyleRule);
    assert.equal(fromSheet[0].style.getPropertyValue('border-top-color'), '#abc');
  });
});
