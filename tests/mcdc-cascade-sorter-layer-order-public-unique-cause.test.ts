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
// Public-API unique-cause for src/cascade/cascade-sorter.ts
// compareCascadeDeclarations L50 / L55 `layerOrder !== Infinity`
// (css-cascade-5 § 6 #cascade-sort / § 6.1 #cascade-origin / § 6.4
// #layer-ordering). Drive only getCascadedStyle. Two important unlayered
// decls reach L50 with a.important T and a.layerOrder !== Infinity F
// (both Infinity). Mixed layered/unlayered never reaches L50/L55 — origin
// precedence returns first. Do not construct isInline+finite layerOrder.
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

describe('MC/DC public unique-cause: compareCascadeDeclarations layerOrder !== Infinity', { concurrency: false }, () => {
  // css-cascade-5 § 6 #cascade-sort
  test('two important unlayered decls unique-cause a.layerOrder Infinity at L50', () => {
    // Both important, both unlayered: same precedence 40, L50 sees
    // a.important T and a.layerOrder !== Infinity F (short-circuits b).
    const source = box('.t { z-index: 1 !important; } .t { z-index: 2 !important; }');
    assert.equal(source.getPropertyValue('z-index'), '2');
    const spec = box('.t { z-index: 1 !important; } div.t { z-index: 9 !important; }');
    assert.equal(spec.getPropertyValue('z-index'), '9');
    const same = box('.t { z-index: 4 !important; } .t { z-index: 4 !important; }');
    assert.equal(same.getPropertyValue('z-index'), '4');
  });

  test('two important inline decls also unique-cause L50 layerOrder Infinity', () => {
    const html = '<html><body><div class="t" style="z-index: 8 !important; z-index: 9 !important"></div></body></html>';
    const inline = cascade(html, '.t { z-index: 1 !important; }', '.t');
    assert.equal(inline.getPropertyValue('z-index'), '9');
    const oneInline = cascade(
      '<html><body><div class="t" style="z-index: 7 !important"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(oneInline.getPropertyValue('z-index'), '7');
  });

  test('two important layered decls unique-cause L50 TTT reverse vs same layer', () => {
    const reverse = box(`
      @layer a, b;
      @layer b { .t { z-index: 2 !important; } }
      @layer a { .t { z-index: 1 !important; } }
    `);
    assert.equal(reverse.getPropertyValue('z-index'), '1');
    const sameLayer = box(`
      @layer a {
        .t { z-index: 1 !important; }
        .t { z-index: 2 !important; }
      }
    `);
    assert.equal(sameLayer.getPropertyValue('z-index'), '2');
  });

  test('mixed important layered vs unlayered returns at origin precedence, not L50', () => {
    const layeredWins = box('@layer a { .t { z-index: 1 !important; } } .t { z-index: 2 !important; }');
    assert.equal(layeredWins.getPropertyValue('z-index'), '1');
    const laterUnlayered = box('.t { z-index: 2 !important; } @layer a { .t { z-index: 1 !important; } }');
    assert.equal(laterUnlayered.getPropertyValue('z-index'), '1');
  });

  test('two normal unlayered decls unique-cause L55 a.layerOrder Infinity', () => {
    const source = box('.t { z-index: 1; } .t { z-index: 2; }');
    assert.equal(source.getPropertyValue('z-index'), '2');
    const spec = box('.t { z-index: 1; } div.t { z-index: 9; }');
    assert.equal(spec.getPropertyValue('z-index'), '9');
  });

  test('two normal layered decls unique-cause L55 TTT later layer vs same layer', () => {
    const later = box(`
      @layer a, b;
      @layer b { .t { z-index: 2; } }
      @layer a { .t { z-index: 1; } }
    `);
    assert.equal(later.getPropertyValue('z-index'), '2');
    const same = box(`
      @layer a {
        .t { z-index: 1; }
        .t { z-index: 2; }
      }
    `);
    assert.equal(same.getPropertyValue('z-index'), '2');
  });

  test('mixed normal layered vs unlayered returns at origin precedence, not L55', () => {
    const unlayeredWins = box('@layer a { .t { z-index: 1; } } .t { z-index: 2; }');
    assert.equal(unlayeredWins.getPropertyValue('z-index'), '2');
  });

  test('custom properties sort the same L50 Infinity unique-cause via var()', () => {
    const unlayered = box(`
      .t { --x: 1px !important; }
      .t { --x: 2px !important; }
      .t { width: var(--x); }
    `);
    assert.equal(unlayered.getPropertyValue('width'), '2px');
    const layered = box(`
      @layer a, b;
      @layer b { .t { --x: 4px !important; } }
      @layer a { .t { --x: 3px !important; } }
      .t { width: var(--x); }
    `);
    assert.equal(layered.getPropertyValue('width'), '3px');
    const mixed = box(`
      @layer a { .t { --x: 5px !important; } }
      .t { --x: 6px !important; }
      .t { width: var(--x); }
    `);
    assert.equal(mixed.getPropertyValue('width'), '5px');
  });
});
