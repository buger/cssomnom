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
// Round-3 leftover unique-cause for src/cascade/variable-resolver.ts
// resolveNodes after tests/mcdc-cascade-vars.test.ts and
// tests/mcdc-variable-resolver-still-hot-unique-cause.test.ts
// (32/37 D, 40/46 C, 5 incomplete). Hottest pairable seam L170
// resolvedFallback === null (F sampled only). Drive only through
// getCascadedStyle + var()/custom props. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSRule } from '../src/CSSOM.ts';
import type { Rule } from '../src/types.ts';

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

function child(css: string): CSSStyleDeclaration {
  return cascade('<html><body><div class="p"><div class="t"></div></div></body></html>', css, '.t');
}

function duckStyle(selectorText: string, decls: Record<string, string>): Rule {
  const names = Object.keys(decls);
  const style = {
    length: names.length,
    item: (i: number) => names[i] ?? '',
    getPropertyValue: (n: string) => decls[n] ?? '',
    getPropertyPriority: () => '',
  };
  return {
    type: CSSRule.STYLE_RULE,
    selectorText,
    style,
  } as unknown as Rule;
}

describe('MC/DC leftover unique-cause: resolveNodes L170 via getCascadedStyle', { concurrency: false }, () => {
  // css-env-1 § 3.1 #syntax-of-env
  // css-variables-1 § 3.1 #guaranteed-invalid, § 4 #resolving-var-functions
  test('env-unknown custom L170 T vs F vs no-fallback; L154 empty-custom contrast', () => {
    // resolveCustomProp only substituteVariables when includes('var('), so
    // `--x: env(unknown)` stays non-empty specified text. Use-site var()
    // then hits L162 includes('env(') T, inner env() is IACVT, L168 fallback.
    // still-hot used `--x: var(--missing)` which stores '' and hits L152/L154.
    const envUnknown = box(`
      .t {
        --x: env(unknown);
        color: var(--x, var(--also));
        background-color: var(--x, teal);
        caret-color: var(--x);
      }
    `);
    assert.equal(envUnknown.getPropertyValue('--x'), 'env(unknown)');
    // L170 T: fallback var(--also) is also IACVT.
    assert.equal(envUnknown.getPropertyValue('color'), 'rgb(0, 0, 0)');
    // L170 F: fallback teal substitutes.
    assert.equal(envUnknown.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    // L168 F: no fallback after env() IACVT.
    assert.equal(envUnknown.getPropertyValue('caret-color'), '');

    // L166 F: known env() substitutes (L170 not evaluated). Fallback unused.
    const envKnown = box('.t { --x: env(safe-area-inset-top); color: var(--x, red); padding-top: var(--x); }');
    assert.equal(envKnown.getPropertyValue('--x'), 'env(safe-area-inset-top)');
    assert.equal(envKnown.getPropertyValue('color'), '0px');
    assert.equal(envKnown.getPropertyValue('padding-top'), '0px');

    // L154 contrast: IACVT custom stores '' so L152 T, never L162/L170.
    const emptyIacvt = box('.t { --a: var(--missing); color: var(--a, var(--also)); background-color: var(--a, teal); }');
    assert.equal(emptyIacvt.getPropertyValue('--a'), '');
    assert.equal(emptyIacvt.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(emptyIacvt.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
  });

  test('nested env/var fallbacks unique-cause L170 T vs F', () => {
    const nestedEnv = box(`
      .t {
        --x: env(unknown);
        padding-top: var(--x, env(also));
        padding-right: var(--x, env(safe-area-inset-top));
        padding-bottom: var(--x, env(unknown, 8px));
      }
    `);
    assert.equal(nestedEnv.getPropertyValue('padding-top'), '');
    assert.equal(nestedEnv.getPropertyValue('padding-right'), '0px');
    assert.equal(nestedEnv.getPropertyValue('padding-bottom'), '8px');

    const nestedVar = box(`
      .t {
        --x: env(unknown);
        --y: env(also);
        color: var(--x, var(--y));
        background-color: var(--x, var(--y, teal));
        caret-color: var(--x, var(--y, env(also)));
        outline-color: var(--x, var(--y, lime));
      }
    `);
    assert.equal(nestedVar.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(nestedVar.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    assert.equal(nestedVar.getPropertyValue('caret-color'), '');
    assert.equal(nestedVar.getPropertyValue('outline-color'), 'rgb(0, 255, 0)');
  });

  test('L170 through var(--y) wrapping an env-unknown custom', () => {
    // resolveCustomProp substituteVariables(rawCustomProps) of
    // `--x: var(--y, fb)` with `--y: env(unknown)` hits L170 on --y.
    const miss = box('.t { --y: env(unknown); --x: var(--y, var(--missing)); color: var(--x, red); }');
    assert.equal(miss.getPropertyValue('--y'), 'env(unknown)');
    assert.equal(miss.getPropertyValue('--x'), '');
    assert.equal(miss.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const teal = box('.t { --y: env(unknown); --x: var(--y, teal); color: var(--x); }');
    assert.equal(teal.getPropertyValue('--x'), 'teal');
    assert.equal(teal.getPropertyValue('color'), 'rgb(0, 128, 128)');

    const noFb = box('.t { --y: env(unknown); --x: var(--y); color: var(--x, red); }');
    assert.equal(noFb.getPropertyValue('--x'), '');
    assert.equal(noFb.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('L170 inside rgb/calc/simple-block/braced/shorthand', () => {
    // Unique-cause L193/L197 resolvedChildren null T vs F while L170 runs
    // on the inner var(--x, …) (funcNameLower === 'var' F for rgb/calc).
    const inRgb = box(`
      .t {
        --x: env(unknown);
        color: rgb(var(--x, var(--no)), 0, 0);
        caret-color: rgb(var(--x, 0), 255, 0);
      }
    `);
    assert.equal(inRgb.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(inRgb.getPropertyValue('caret-color'), 'rgb(0, 255, 0)');

    const inCalc = box('.t { --x: env(unknown); height: calc(var(--x, var(--no))); width: calc(var(--x, 3px)); }');
    assert.equal(inCalc.getPropertyValue('height'), '');
    assert.equal(inCalc.getPropertyValue('width'), 'calc( 3px)');

    const block = box('.t { --x: env(unknown); z-index: (var(--x, var(--no))); opacity: (var(--x, 1)); }');
    assert.equal(block.getPropertyValue('z-index'), '');
    assert.equal(block.getPropertyValue('opacity'), '( 1)');

    const braced = box('.t { --x: env(unknown); color: var({ --x }, var(--no)); background-color: var({ --x }, teal); }');
    assert.equal(braced.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(braced.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    const shorthand = box('.t { --x: env(unknown); margin: var(--x, var(--no)); padding: var(--x, 1px); }');
    assert.equal(shorthand.getPropertyValue('margin-top'), '');
    assert.equal(shorthand.getPropertyValue('padding-top'), '1px');
  });

  test('inherited, inline, empty-comma F vs inner-var T', () => {
    // Empty fallback list is not null (L170 F); inner missing var() is null (T).
    const emptyComma = box('.t { --x: env(unknown); color: var(--x,); z-index: var(--x,); outline-color: var(--x, var(--no)); }');
    assert.equal(emptyComma.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(emptyComma.getPropertyValue('z-index'), '');
    assert.equal(emptyComma.getPropertyValue('outline-color'), 'rgb(0, 0, 0)');

    const inherited = child('.p { --x: env(unknown); } .t { color: var(--x, var(--no)); background-color: var(--x, lime); }');
    assert.equal(inherited.getPropertyValue('--x'), 'env(unknown)');
    assert.equal(inherited.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(inherited.getPropertyValue('background-color'), 'rgb(0, 255, 0)');

    const inline = cascade(
      '<html><body><div class="t" style="--x: env(unknown); color: var(--x, var(--no)); background-color: var(--x, lime)"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inline.getPropertyValue('--x'), 'env(unknown)');
    assert.equal(inline.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(inline.getPropertyValue('background-color'), 'rgb(0, 255, 0)');
  });

  test('L170 F currentcolor/color-mix/comma-list; comments in env() name', () => {
    const current = box('.t { --x: env(unknown); color: var(--x, currentcolor); }');
    assert.equal(current.getPropertyValue('color'), 'currentcolor');

    const mix = box('.t { --x: env(unknown); color: var(--x, color-mix(in srgb, red, blue)); }');
    assert.equal(mix.getPropertyValue('color'), 'color-mix(in srgb, red, blue)');

    const commas = box('.t { --x: env(unknown); font-family: var(--x, "A", sans-serif); }');
    assert.equal(commas.getPropertyValue('font-family'), 'A, sans-serif');

    // Unique-cause env() comment/whitespace filter then L170 T vs F.
    const comments = box('.t { --x: env( /*c*/ unknown /*d*/ ); color: var(--x, var(--z)); background-color: var(--x, orange); }');
    assert.equal(comments.getPropertyValue('--x'), 'env( /*c*/ unknown /*d*/ )');
    assert.equal(comments.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(comments.getPropertyValue('background-color'), 'rgb(255, 165, 0)');

    const keyboard = box('.t { --k: env(keyboard-inset-top); padding-top: var(--k, 99px); }');
    assert.equal(keyboard.getPropertyValue('--k'), 'env(keyboard-inset-top)');
    assert.equal(keyboard.getPropertyValue('padding-top'), '0px');
  });
});

describe('MC/DC leftover unique-cause: resolveNodes L69 / L112 / L115 / L131 mute via getCascadedStyle', { concurrency: false }, () => {
  // css-syntax-3 § 5.5.8 #consume-component-value, § 5.5.10 #consume-function
  // css-variables-1 § 4 #resolving-var-functions, § 4.4 #cycles
  test('L69 function vs ident/url; ducks re-tokenize as CSSFunction with name+array', () => {
    // Unique-cause node.type === 'function' T (var/env/rgb) vs F (ident/url/hash).
    // `"name" in node` F and Array.isArray F cannot unique-cause: consume-function
    // always emits CSSFunction { name, value: ComponentValue[] }.
    const mixed = box(`
      .t {
        --c: lime;
        --n: 5;
        color: var(--c);
        background-color: rgb(var(--n), 255, 0);
        list-style-image: url(foo.png);
        caret-color: ident;
      }
    `);
    assert.equal(mixed.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(mixed.getPropertyValue('background-color'), 'rgb(5, 255, 0)');
    assert.equal(mixed.getPropertyValue('list-style-image'), 'url("foo.png")');
    assert.equal(mixed.getPropertyValue('caret-color'), 'ident');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);
    // FunctionToken-shaped AST still serializes then parseComponentValues
    // consumes a CSSFunction with name + array (L69 name/array F unpairable).
    const tokenFn = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          declarations: [
            { name: '--x', value: tokenize('lime'), important: false },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(tokenFn.getPropertyValue('--x'), 'lime');
    assert.equal(tokenFn.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const cssom = getCascadedStyle(el, [duckStyle('.t', { '--x': 'teal', color: 'var(--x)' })]);
    assert.equal(cssom.getPropertyValue('color'), 'rgb(0, 128, 128)');
  });

  test('L112/L115 ident typeof string: dashed-ident T vs string/number/hash F', () => {
    // find() already requires typeof value === 'string' && startsWith('--'),
    // so ident T implies typeof T. Unique-cause ident F: not a dashed-ident.
    const dashed = box('.t { --theme: lime; color: var(--theme); background-color: var({ --theme }); }');
    assert.equal(dashed.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(dashed.getPropertyValue('background-color'), 'rgb(0, 255, 0)');

    const notIdent = box(`
      .t {
        color: var(" --theme ", red);
        background-color: var(123, teal);
        caret-color: var(#--x, orange);
        outline-color: var(theme(), lime);
      }
    `);
    assert.equal(notIdent.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(notIdent.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    assert.equal(notIdent.getPropertyValue('caret-color'), 'rgb(255, 165, 0)');
    assert.equal(notIdent.getPropertyValue('outline-color'), 'rgb(0, 255, 0)');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);
    // Numeric ident.value cannot survive collection: serialize then tokenize
    // always produces IdentToken.value string.
    const numericIdent = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          declarations: [
            {
              name: 'color',
              value: [
                { type: 'function', name: 'var', value: [{ type: 'ident', value: 123 }] },
              ],
              important: false,
            },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(numericIdent.getPropertyValue('color'), 'rgb(0, 0, 0)');
  });

  test('L131 idx !== -1 T on self and multi-node cycles; F unpairable', () => {
    // resolvingStack.has(varName) T implies Array.from(stack).indexOf !== -1.
    const self = box('.t { --a: var(--a); color: var(--a, lime); }');
    assert.equal(self.getPropertyValue('--a'), '');
    assert.equal(self.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const two = box('.t { --a: var(--b); --b: var(--a); color: var(--a, teal); }');
    assert.equal(two.getPropertyValue('--a'), '');
    assert.equal(two.getPropertyValue('--b'), '');
    assert.equal(two.getPropertyValue('color'), 'rgb(0, 128, 128)');

    const three = box('.t { --a: var(--b); --b: var(--c); --c: var(--a); color: var(--c, red); }');
    assert.equal(three.getPropertyValue('--a'), '');
    assert.equal(three.getPropertyValue('--b'), '');
    assert.equal(three.getPropertyValue('--c'), '');
    assert.equal(three.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });
});
