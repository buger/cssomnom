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
// Verifies: SW-REQ-260821-FWNH, INT-REQ-260821-HJVC
// Public-API unique-cause for src/cascade/color-resolver.ts
// normalizeComputedColor `a !== undefined && a < 1` (css-color-4 § 4
// #resolving-color-values / § 15 #named-colors, cssom-1 § 6.8
// #resolved-values). Drive only getCascadedStyle. NAMED_COLORS has a 4th
// component only for `transparent` (0). `a < 1` F with `a` defined is
// UNREACHABLE (no opaque 4-tuple named color).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function cascade(html: string, css: string, selector: string): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function box(css: string): CSSStyleDeclaration {
  return cascade('<html><body><div class="t"></div></body></html>', css, '.t');
}

describe('MC/DC public unique-cause: normalizeComputedColor named a < 1', { concurrency: false }, () => {
  test('transparent unique-cause a defined and a < 1 vs 3-tuple named colors', () => {
    // Unique-cause: lower in NAMED_COLORS T, a !== undefined T, a < 1 T.
    const transparent = box('.t { color: transparent; }');
    assert.equal(transparent.getPropertyValue('color'), 'rgba(0, 0, 0, 0)');

    const mixed = box('.t { background-color: TRANSPARENT; outline-color: Transparent; }');
    assert.equal(mixed.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');
    assert.equal(mixed.getPropertyValue('outline-color'), 'rgba(0, 0, 0, 0)');

    // Unique-cause: a !== undefined F (3-tuple; a < 1 is not evaluated).
    const red = box('.t { color: red; }');
    assert.equal(red.getPropertyValue('color'), 'rgb(255, 0, 0)');
    const lime = box('.t { caret-color: lime; border-top-color: AliceBlue; }');
    assert.equal(lime.getPropertyValue('caret-color'), 'rgb(0, 255, 0)');
    assert.equal(lime.getPropertyValue('border-top-color'), 'rgb(240, 248, 255)');
  });

  test('named transparent vs hex/rgb alpha and currentcolor fallthrough', () => {
    // Named a < 1 is the 4-tuple table path, not hex / rgb() / hsl().
    const named = box('.t { color: transparent; }');
    assert.equal(named.getPropertyValue('color'), 'rgba(0, 0, 0, 0)');

    const hex = box('.t { color: #0000; }');
    assert.equal(hex.getPropertyValue('color'), 'rgba(0, 0, 0, 0)');
    const rgb = box('.t { color: rgba(0, 0, 0, 0); }');
    assert.equal(rgb.getPropertyValue('color'), 'rgba(0, 0, 0, 0)');

    const current = box('.t { color: currentcolor; }');
    assert.equal(current.getPropertyValue('color'), 'currentcolor');

    const inline = cascade(
      '<html><body><div class="t" style="color: transparent"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inline.getPropertyValue('color'), 'rgba(0, 0, 0, 0)');
  });
});
