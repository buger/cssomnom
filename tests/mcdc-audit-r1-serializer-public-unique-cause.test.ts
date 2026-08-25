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
// Verifies: SYS-REQ-260821-KV30, SW-REQ-260821-YTV6, SYS-REQ-260821-SMW6,
// SW-REQ-260821-HW77, SW-REQ-260821-HNRG, SYS-REQ-260821-8TGB
// Public-API unique-cause legs for serializer / shorthands / parser-api
// decisions still hot after rounds 1-N:
//   - expandFont with and without a `/ <line-height>` component
//     (css-fonts-4 § 3.3 #font-prop).
//   - box-shorthand contraction blocked by an intervening logical longhand of
//     the same group (cssom-1 #serialize-a-css-declaration-block).
//   - outline / list-style / border-top contraction to the CSS-wide keyword
//     and to `none`/`disc` canonical values (css-ui-4 #outline,
//     css-lists-3 #list-style-property, css-backgrounds-3 #border).
//   - supports() selector() arms: multi-selector lists are unsupported while a
//     single valid selector is supported (css-conditional-3 § 7.1).
// Drive CSSStyleDeclaration.setProperty/cssText and supports().
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import { supports } from '../src/parser-api.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';

describe('MC/DC public unique-cause round 1: expandFont line-height arms', () => {
  test('font without a line-height component leaves lineHeightVal empty', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('font', '12px serif');
    assert.equal(style.getPropertyValue('font-size'), '12px');
    assert.equal(style.getPropertyValue('line-height'), 'normal');
    assert.equal(style.getPropertyValue('font-family'), 'serif');

    // Positive row: `/ 1.5` populates lineHeightVal.
    const withLh = new CSSStyleDeclaration();
    withLh.setProperty('font', 'italic small-caps bold 16px/1.5 serif');
    assert.equal(withLh.getPropertyValue('line-height'), '1.5');
    assert.equal(withLh.getPropertyValue('font-style'), 'italic');
    assert.equal(withLh.getPropertyValue('font-variant-caps'), 'small-caps');
    assert.equal(withLh.getPropertyValue('font-weight'), 'bold');
    assert.equal(withLh.getPropertyValue('font-family'), 'serif');
  });
});

describe('MC/DC public unique-cause round 1: shorthand contraction', () => {
  test('margin contraction is blocked by an intervening logical margin longhand', () => {
    const sheet = parse(
      '.a { margin-top: 1px; margin-inline-start: 2px; margin-right: 3px; margin-bottom: 4px; margin-left: 5px; }',
    );
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSStyleRule);
    // The intervening margin-group longhead prevents the physical 4-way
    // combine; each physical longhand survives on its own.
    const text = (rule as CSSStyleRule).style.cssText;
    assert.match(text, /margin-top: 1px/);
    assert.match(text, /margin-right: 3px/);
    assert.ok(!text.includes('margin:'));
  });

  test('all-initial outline / list-style / border-side contract to their canonical value', () => {
    const o = new CSSStyleDeclaration();
    o.setProperty('outline-color', 'initial');
    o.setProperty('outline-style', 'initial');
    o.setProperty('outline-width', 'initial');
    assert.equal(o.cssText, 'outline: initial;');

    const l = new CSSStyleDeclaration();
    l.setProperty('list-style-type', 'initial');
    l.setProperty('list-style-position', 'initial');
    l.setProperty('list-style-image', 'initial');
    assert.equal(l.cssText, 'list-style: initial;');

    const b = new CSSStyleDeclaration();
    b.setProperty('border-top-width', 'initial');
    b.setProperty('border-top-style', 'initial');
    b.setProperty('border-top-color', 'initial');
    assert.equal(b.cssText, 'border-top: initial;');
  });

  test('non-initial outline contracts in color-style-width order', () => {
    const o = new CSSStyleDeclaration();
    o.setProperty('outline-width', '2px');
    o.setProperty('outline-style', 'dashed');
    o.setProperty('outline-color', 'red');
    assert.equal(o.cssText, 'outline: red dashed 2px;');

    const allInitial = new CSSStyleDeclaration();
    allInitial.setProperty('outline-width', 'medium');
    allInitial.setProperty('outline-style', 'none');
    allInitial.setProperty('outline-color', 'currentcolor');
    assert.equal(allInitial.cssText, 'outline: none;');
  });
});

describe('MC/DC public unique-cause round 1: supports() selector() arms', () => {
  test('multi-selector lists are unsupported, single selectors supported', () => {
    // Unique-cause of selectors.length !== 1 T: a list is not a single complex
    // selector, so the condition evaluates unsupported.
    assert.equal(supports('selector(div, span)'), false);
    // Single valid selector row.
    assert.equal(supports('selector(div)'), true);

    // Invalid single selectors evaluate unsupported through the strict parser.
    assert.equal(supports('selector(:unknownpseudo)'), false);
    assert.equal(supports('selector(div >)'), false);
  });

  test('@support rules keep their condition text regardless of evaluation', () => {
    const sheet = parse('@supports selector(a) { .x { color: red; } }');
    const rule = sheet.cssRules[0] as { conditionText?: string };
    assert.equal(rule.conditionText, 'selector(a)');
  });
});
