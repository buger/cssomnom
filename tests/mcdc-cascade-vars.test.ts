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
// Unique-cause leftovers for src/cascade/color-resolver.ts and
// src/cascade/variable-resolver.ts driven only through getCascadedStyle.
// No //mcdc:ignore.
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

describe('MC/DC unique-cause: cascade color-resolver via getCascadedStyle', { concurrency: false }, () => {
  // css-color-4 § 4 #resolving-color-values, § 5.2 #currentcolor-color, § 15 #named-colors
  test('currentcolor and color-mix fall through uniquely vs named, system, hex, rgb, hsl', () => {
    // Unique-cause: not a named/system/hex/rgb()/hsl() color, so normalizeComputedColor
    // returns the specified token (css-color-4 #currentcolor-color, #color-mix).
    const current = box('.t { color: currentcolor; background-color: CurrentColor; }');
    assert.equal(current.getPropertyValue('color'), 'currentcolor');
    assert.equal(current.getPropertyValue('background-color'), 'CurrentColor');

    const mix = box('.t { color: color-mix(in srgb, red, blue); outline-color: color-mix(in lab, currentcolor 50%, blue); }');
    assert.equal(mix.getPropertyValue('color'), 'color-mix(in srgb, red, blue)');
    assert.equal(mix.getPropertyValue('outline-color'), 'color-mix(in lab, currentcolor 50%, blue)');

    const named = box('.t { color: lime; }');
    assert.equal(named.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const hwb = box('.t { color: hwb(120 0% 0%); background-color: lab(50% 0 0); }');
    assert.equal(hwb.getPropertyValue('color'), 'hwb(120 0% 0%)');
    assert.equal(hwb.getPropertyValue('background-color'), 'lab(50% 0 0)');

    const child = cascade(
      '<html><body><div class="p"><span class="t"></span></div></body></html>',
      '.p { color: royalblue; } .t { background-color: currentcolor; outline-color: currentcolor; }',
      '.t',
    );
    assert.equal(child.getPropertyValue('color'), 'rgb(65, 105, 225)');
    assert.equal(child.getPropertyValue('background-color'), 'currentcolor');
    assert.equal(child.getPropertyValue('outline-color'), 'currentcolor');
  });

  // css-color-4 § 6 #system-colors
  test('system colors unique-cause lower in SYSTEM_COLORS independently of named colors', () => {
    const canvas = box('.t { color: Canvas; background-color: canvastext; caret-color: LinkText; outline-color: Highlight; }');
    assert.equal(canvas.getPropertyValue('color'), 'rgb(255, 255, 255)');
    assert.equal(canvas.getPropertyValue('background-color'), 'rgb(0, 0, 0)');
    assert.equal(canvas.getPropertyValue('caret-color'), 'rgb(0, 0, 238)');
    assert.equal(canvas.getPropertyValue('outline-color'), 'rgb(181, 213, 255)');

    const gray = box('.t { color: GrayText; }');
    assert.equal(gray.getPropertyValue('color'), 'rgb(128, 128, 128)');
  });

  // css-color-4 § 4.2 #hex-notation
  test('hex 8-digit vs leftover 5/7-digit and non-hex that fail every hex-length test', () => {
    // Unique-cause: /^[0-9a-fA-F]{8}$/ T vs F after 3/4/6 already failed.
    const eight = box('.t { color: #12345678; }');
    assert.equal(eight.getPropertyValue('color'), 'rgba(18, 52, 86, 0.4706)');
    const five = box('.t { color: #12345; background-color: #1234567; caret-color: #zzzzzz; }');
    assert.equal(five.getPropertyValue('color'), '#12345');
    assert.equal(five.getPropertyValue('background-color'), '#1234567');
    assert.equal(five.getPropertyValue('caret-color'), '#zzzzzz');
  });

  // css-color-4 § 4.1 #rgb-functions
  test('rgb() leftover unique-cause slash, percent, alpha, arity, and per-channel NaN', () => {
    // Unique-cause slashIdx !== -1 T: modern rgb(R G B / A).
    const slash = box('.t { color: rgb(0 255 0 / 0.5); }');
    assert.equal(slash.getPropertyValue('color'), 'rgba(0, 255, 0, 0.5)');
    const slashPct = box('.t { color: rgb(0 255 0 / 50%); }');
    assert.equal(slashPct.getPropertyValue('color'), 'rgba(0, 255, 0, 0.5)');
    const slashOpaque = box('.t { color: rgb(10 20 30 / 1); }');
    assert.equal(slashOpaque.getPropertyValue('color'), 'rgb(10, 20, 30)');

    // Unique-cause parseComp endsWith('%') T vs number.
    const pct = box('.t { color: rgb(100% 0% 0%); caret-color: RGB(10% 20% 30%); }');
    assert.equal(pct.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(pct.getPropertyValue('caret-color'), 'rgb(26, 51, 77)');

    // Unique-cause formatAlpha a<=0 F (0 < a < 1) vs a<=0 T (alpha 0).
    const mid = box('.t { color: rgba(0, 0, 0, 0.25); }');
    assert.equal(mid.getPropertyValue('color'), 'rgba(0, 0, 0, 0.25)');
    const zero = box('.t { color: rgba(255, 0, 0, 0); background-color: rgb(0, 255, 0, 0); }');
    assert.equal(zero.getPropertyValue('color'), 'rgba(255, 0, 0, 0)');
    assert.equal(zero.getPropertyValue('background-color'), 'rgba(0, 255, 0, 0)');

    // Unique-cause parseAlpha endsWith('%') T, isNaN T (non-% and %).
    const alphaPct = box('.t { color: rgba(0, 0, 0, 50%); }');
    assert.equal(alphaPct.getPropertyValue('color'), 'rgba(0, 0, 0, 0.5)');
    const alphaNaN = box('.t { color: rgba(0, 0, 0, foo); outline-color: rgba(1, 2, 3, %); border-top-color: rgba(1, 2, 3, 200%); }');
    assert.equal(alphaNaN.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(alphaNaN.getPropertyValue('outline-color'), 'rgb(1, 2, 3)');
    assert.equal(alphaNaN.getPropertyValue('border-top-color'), 'rgb(1, 2, 3)');

    // Unique-cause r===null / g===null / b===null independently (parsed F).
    const rBad = box('.t { color: rgb(foo, 0, 0); }');
    assert.equal(rBad.getPropertyValue('color'), 'rgb(foo, 0, 0)');
    const gBad = box('.t { color: rgb(0, foo, 0); }');
    assert.equal(gBad.getPropertyValue('color'), 'rgb(0, foo, 0)');
    const bBad = box('.t { color: rgb(0, 0, foo); }');
    assert.equal(bBad.getPropertyValue('color'), 'rgb(0, 0, foo)');
    const pctNaN = box('.t { color: rgb(foo% 0 0); background-color: rgb(0 bar% 0); }');
    assert.equal(pctNaN.getPropertyValue('color'), 'rgb(foo% 0 0)');
    assert.equal(pctNaN.getPropertyValue('background-color'), 'rgb(0 bar% 0)');

    // Unique-cause parts.length < 3 vs > 4 vs 3.
    const short = box('.t { color: rgb(1 2); }');
    assert.equal(short.getPropertyValue('color'), 'rgb(1 2)');
    const long = box('.t { color: rgb(1 2 3 4 5); }');
    assert.equal(long.getPropertyValue('color'), 'rgb(1 2 3 4 5)');
    const slashShort = box('.t { color: rgb(0 / 0.5); }');
    assert.equal(slashShort.getPropertyValue('color'), 'rgb(0 / 0.5)');
  });

  // css-color-4 § 4.3 #the-hsl-notation
  test('hsl() leftover unique-cause space form, hue units, sectors, slash alpha, arity', () => {
    // Unique-cause content.includes(',') F (space-separated) vs T (comma form already in fixtures).
    const space = box('.t { color: hsl(90 100% 50%); }');
    assert.equal(space.getPropertyValue('color'), 'rgb(128, 255, 0)');

    // Unique-cause parseHue deg / rad / turn independently of unitless.
    const deg = box('.t { color: hsl(120deg 100% 50%); }');
    assert.equal(deg.getPropertyValue('color'), 'rgb(0, 255, 0)');
    const rad = box('.t { color: hsl(2rad 100% 50%); }');
    assert.equal(rad.getPropertyValue('color'), 'rgb(23, 255, 0)');
    const turn = box('.t { color: hsl(0.5turn 100% 50%); }');
    assert.equal(turn.getPropertyValue('color'), 'rgb(0, 255, 255)');

    // Unique-cause hue-sector chain: h<120 T, h<180 F, h<240 T/F, h<300 T/F.
    const yellow = box('.t { color: hsl(60 100% 50%); }');
    assert.equal(yellow.getPropertyValue('color'), 'rgb(255, 255, 0)');
    const cyan = box('.t { color: hsl(180 100% 50%); }');
    assert.equal(cyan.getPropertyValue('color'), 'rgb(0, 255, 255)');
    const blue = box('.t { color: hsl(210 100% 50%); }');
    assert.equal(blue.getPropertyValue('color'), 'rgb(0, 128, 255)');
    const navy = box('.t { color: hsl(240 100% 50%); }');
    assert.equal(navy.getPropertyValue('color'), 'rgb(0, 0, 255)');
    const magenta = box('.t { color: hsl(270 100% 50%); }');
    assert.equal(magenta.getPropertyValue('color'), 'rgb(128, 0, 255)');
    const fuchsia = box('.t { color: hsl(300 100% 50%); }');
    assert.equal(fuchsia.getPropertyValue('color'), 'rgb(255, 0, 255)');
    const rose = box('.t { color: hsl(330 100% 50%); }');
    assert.equal(rose.getPropertyValue('color'), 'rgb(255, 0, 128)');

    // Unique-cause slashIdx T, parts.length === 4 T, alpha % vs number, a===1 F, isNaN(a) T.
    const slash = box('.t { color: hsl(120 100% 50% / 0.4); }');
    assert.equal(slash.getPropertyValue('color'), 'rgba(0, 255, 0, 0.4)');
    const slashPct = box('.t { color: hsl(120 100% 50% / 40%); }');
    assert.equal(slashPct.getPropertyValue('color'), 'rgba(0, 255, 0, 0.4)');
    const slashZero = box('.t { color: hsl(120 100% 50% / 0); background-color: hsla(120, 100%, 50%, 0%); }');
    assert.equal(slashZero.getPropertyValue('color'), 'rgba(0, 255, 0, 0)');
    assert.equal(slashZero.getPropertyValue('background-color'), 'rgba(0, 255, 0, 0)');
    const nanAlpha = box('.t { color: hsla(120, 100%, 50%, foo); caret-color: hsl(120 100% 50% / foo); }');
    assert.equal(nanAlpha.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(nanAlpha.getPropertyValue('caret-color'), 'rgb(0, 255, 0)');

    // Unique-cause parsePct endsWith('%') F and n>1 T vs F.
    const nOverOne = box('.t { color: hsl(120 50 50); }');
    assert.equal(nOverOne.getPropertyValue('color'), 'rgb(64, 191, 64)');
    const nUnit = box('.t { color: hsl(120 0.5 0.5); }');
    assert.equal(nUnit.getPropertyValue('color'), 'rgb(64, 191, 64)');

    // Unique-cause parts.length < 3 / > 4 and hslMatch F already covered by currentcolor.
    const empty = box('.t { color: hsl(); }');
    assert.equal(empty.getPropertyValue('color'), 'hsl()');
    const extra = box('.t { color: hsl(1, 2, 3, 4, 5); }');
    assert.equal(extra.getPropertyValue('color'), 'hsl(1, 2, 3, 4, 5)');

    const mixedCase = box('.t { color: HSL(120, 100%, 50%); background-color: HSLA(120, 100%, 50%, 0.2); }');
    assert.equal(mixedCase.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(mixedCase.getPropertyValue('background-color'), 'rgba(0, 255, 0, 0.2)');
  });
});

describe('MC/DC unique-cause: cascade variable-resolver via getCascadedStyle', { concurrency: false }, () => {
  // css-variables-1 § 3 #using, § 4 #resolving-var-functions
  test('var() custom properties substitute, chain, and leave currentcolor/color-mix unnormalized', () => {
    const direct = box('.t { --c: lime; color: var(--c); }');
    assert.equal(direct.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(direct.getPropertyValue('--c'), 'lime');

    const current = box('.t { --c: currentcolor; color: var(--c); }');
    assert.equal(current.getPropertyValue('color'), 'currentcolor');

    const mix = box('.t { --mix: color-mix(in srgb, yellow, blue); color: var(--mix); }');
    assert.equal(mix.getPropertyValue('color'), 'color-mix(in srgb, yellow, blue)');
    assert.equal(mix.getPropertyValue('--mix'), 'color-mix(in srgb, yellow, blue)');

    const chain = box('.t { --x: var(--y); --y: 10px; width: var(--x); }');
    assert.equal(chain.getPropertyValue('width'), '10px');
    assert.equal(chain.getPropertyValue('--x'), '10px');
    assert.equal(chain.getPropertyValue('--y'), '10px');

    const nested = box('.t { --a: var(--b, var(--c, red)); --c: blue; color: var(--a); }');
    assert.equal(nested.getPropertyValue('color'), 'rgb(0, 0, 255)');
    assert.equal(nested.getPropertyValue('--a'), 'blue');
  });

  test('var() fallbacks unique-cause missing, nested, empty, currentcolor, and color-mix', () => {
    const missing = box('.t { color: var(--undefined-var, purple); background-color: var(--undefined-1, var(--undefined-2, teal)); }');
    assert.equal(missing.getPropertyValue('color'), 'rgb(128, 0, 128)');
    assert.equal(missing.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    // Unique-cause !varName T with fallback vs without (ident is not a dashed-ident).
    const badName = box('.t { color: var(foo, red); background-color: var(foo); }');
    assert.equal(badName.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(badName.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');

    const currentFb = box('.t { color: var(--missing, currentcolor); }');
    assert.equal(currentFb.getPropertyValue('color'), 'currentcolor');
    const mixFb = box('.t { color: var(--missing, color-mix(in srgb, red, blue)); }');
    assert.equal(mixFb.getPropertyValue('color'), 'color-mix(in srgb, red, blue)');
    const nestedCurrent = box('.t { color: var(--no, var(--still, currentcolor)); }');
    assert.equal(nestedCurrent.getPropertyValue('color'), 'currentcolor');
    const nestedMix = box('.t { color: var(--no, var(--still, color-mix(in srgb, red, blue))); }');
    assert.equal(nestedMix.getPropertyValue('color'), 'color-mix(in srgb, red, blue)');

    // Unique-cause resolvedFallback === null T: inner var has no fallback.
    const nestedMiss = box('.t { color: var(--missing, var(--also)); background-color: var(--missing, var(--also, teal)); }');
    assert.equal(nestedMiss.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(nestedMiss.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    // Empty custom serializes as space (css-variables-1 #serializing-custom-props) and is
    // not rawCustomVal === '', so var(--empty, blue) does not take the fallback.
    const empty = box('.t { --empty: ; color: var(--empty, blue); background-color: var(--empty); }');
    assert.equal(empty.getPropertyValue('--empty'), ' ');
    assert.equal(empty.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(empty.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');

    const emptyComma = box('.t { color: var(--missing,) red; z-index: var(--missing,); }');
    assert.equal(emptyComma.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(emptyComma.getPropertyValue('z-index'), '');
  });

  // css-variables-1 § 4.4 #cycles
  test('cycles unique-cause self, two-node, fallback-from-cyclic, and unused fallback', () => {
    const self = box('.t { --a: var(--a); color: var(--a); }');
    assert.equal(self.getPropertyValue('--a'), '');
    assert.equal(self.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const selfFb = box('.t { --a: var(--a); color: var(--a, lime); }');
    assert.equal(selfFb.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const two = box('.t { --a: var(--b); --b: var(--a); color: var(--a, lime); }');
    assert.equal(two.getPropertyValue('--a'), '');
    assert.equal(two.getPropertyValue('--b'), '');
    assert.equal(two.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const three = box('.t { --a: var(--b, cycle); --b: var(--c, cycle); --c: var(--a, cycle); --ok: valid; }');
    assert.equal(three.getPropertyValue('--a'), '');
    assert.equal(three.getPropertyValue('--b'), '');
    assert.equal(three.getPropertyValue('--c'), '');
    assert.equal(three.getPropertyValue('--ok'), 'valid');

    const viaCyclic = box('.t { --x: var(--y, valid); --y: var(--a, valid); --a: var(--b); --b: var(--a); }');
    assert.equal(viaCyclic.getPropertyValue('--a'), '');
    assert.equal(viaCyclic.getPropertyValue('--x'), 'valid');
    assert.equal(viaCyclic.getPropertyValue('--y'), 'valid');

    const unused = box('.t { --x: var(--a, valid); --a: var(--y, var(--b, cycle)); --b: var(--y, var(--c, cycle)); --c: var(--y, var(--a, cycle)); --y: valid; }');
    assert.equal(unused.getPropertyValue('--a'), 'valid');
    assert.equal(unused.getPropertyValue('--x'), 'valid');

    // Unique-cause fallback to a cyclic var is IACVT (resolvedFallback === null).
    const fbCycle = box('.t { --a: var(--a); color: var(--missing, var(--a)); }');
    assert.equal(fbCycle.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const innerFb = box('.t { --a: var(--b, lime); --b: var(--a); color: var(--a); background-color: var(--b, red); }');
    assert.equal(innerFb.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(innerFb.getPropertyValue('background-color'), 'rgb(255, 0, 0)');
  });

  // css-env-1 § 3.1 #syntax-of-env
  test('env() leftover unique-cause known name, missing ident, unknown with/without fallback, nested', () => {
    const known = box('.t { padding-left: env(safe-area-inset-left); margin-top: env(safe-area-inset-top, 99px); }');
    assert.equal(known.getPropertyValue('padding-left'), '0px');
    assert.equal(known.getPropertyValue('margin-top'), '0px');

    // Unique-cause envIdent F / envName F: no ident, numeric name.
    const noIdent = box('.t { padding-top: env(); padding-right: env(123, 9px); padding-bottom: env(unknown); }');
    assert.equal(noIdent.getPropertyValue('padding-top'), '');
    assert.equal(noIdent.getPropertyValue('padding-right'), '9px');
    assert.equal(noIdent.getPropertyValue('padding-bottom'), '');

    const unknownFb = box('.t { padding-top: env(unknown, 12px); }');
    assert.equal(unknownFb.getPropertyValue('padding-top'), '12px');

    // Unique-cause resolvedFallback === null T: fallback var is missing / cyclic.
    const nestedNull = box('.t { padding-top: env(unknown, var(--missing)); padding-right: env(unknown, env(also-unknown)); padding-bottom: env(unknown, env(safe-area-inset-right)); }');
    assert.equal(nestedNull.getPropertyValue('padding-top'), '');
    assert.equal(nestedNull.getPropertyValue('padding-right'), '');
    assert.equal(nestedNull.getPropertyValue('padding-bottom'), '0px');

    // Unique-cause rawCustomVal.includes('env(') T while includes('var(') F.
    const viaCustom = box(`
      .t {
        --x: env(safe-area-inset-top);
        --y: env(unknown, 8px);
        --z: env(unknown);
        padding-top: var(--x);
        padding-right: var(--y);
        padding-bottom: var(--z, 3px);
        padding-left: var(--z);
      }
    `);
    assert.equal(viaCustom.getPropertyValue('padding-top'), '0px');
    assert.equal(viaCustom.getPropertyValue('padding-right'), '8px');
    assert.equal(viaCustom.getPropertyValue('padding-bottom'), '3px');
    assert.equal(viaCustom.getPropertyValue('padding-left'), '');
    assert.equal(viaCustom.getPropertyValue('--x'), 'env(safe-area-inset-top)');

    const missingY = box('.t { --x: var(--y, env(safe-area-inset-top)); padding-top: var(--x); }');
    assert.equal(missingY.getPropertyValue('padding-top'), '0px');
  });

  test('var() leftover unique-cause braced names, other functions, and simple-blocks', () => {
    // Unique-cause simple-block { associatedToken: T vs ident path / ( block.
    const braced = box('.t { --theme: lime; color: var({ --theme }); background-color: var({--theme}); }');
    assert.equal(braced.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(braced.getPropertyValue('background-color'), 'rgb(0, 255, 0)');

    const braceMiss = box('.t { color: var({ --no }, currentcolor); background-color: var({ --no }); caret-color: var({ 123 }, red); outline-color: var({}); }');
    assert.equal(braceMiss.getPropertyValue('color'), 'currentcolor');
    assert.equal(braceMiss.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');
    assert.equal(braceMiss.getPropertyValue('caret-color'), 'rgb(255, 0, 0)');
    assert.equal(braceMiss.getPropertyValue('outline-color'), 'rgb(0, 0, 0)');

    const parenName = box('.t { --theme: lime; background-color: var(( --theme )); }');
    assert.equal(parenName.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');

    // Unique-cause funcNameLower === 'var' F: other function whose children contain var().
    const inRgb = box('.t { --r: 255; color: rgb(var(--r), 0, 0); }');
    assert.equal(inRgb.getPropertyValue('color'), 'rgb(255, 0, 0)');
    const inRgbMiss = box('.t { color: rgb(var(--missing), 0, 0); }');
    assert.equal(inRgbMiss.getPropertyValue('color'), 'rgb(0, 0, 0)');
    const inCalc = box('.t { --gap: 3px; height: calc(10px + var(--gap, 2px)); width: calc(var(--missing)); }');
    assert.equal(inCalc.getPropertyValue('height'), 'calc(10px + 3px)');
    assert.equal(inCalc.getPropertyValue('width'), '');

    // Unique-cause node.type === 'simple-block' T; resolvedChildren === null T inside the block.
    const paren = box('.t { --z: 1; z-index: (var(--z)); }');
    assert.equal(paren.getPropertyValue('z-index'), '(1)');
    const square = box('.t { --z: 2; z-index: [var(--z)]; }');
    assert.equal(square.getPropertyValue('z-index'), '[2]');
    const missBlock = box('.t { z-index: (var(--missing)); }');
    assert.equal(missBlock.getPropertyValue('z-index'), '');

    const cycleInFn = box('.t { --a: var(--b); --b: var(--a); color: rgb(var(--a), 0, 0); padding-top: env(unknown, var(--a)); }');
    assert.equal(cycleInFn.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(cycleInFn.getPropertyValue('padding-top'), '');
  });

  // css-cascade-5 § 6.2 #default, § 6.3 #revert-layer, § 6.3.3 #revert-rule-keyword, § 7.3
  test('custom-property CSS-wide keywords unique-cause inherit, unset, initial, revert, revert-rule', () => {
    const child = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { --x: orange; --y: teal; --z: pink; } .t { --x: inherit; --y: unset; --z: initial; --w: revert; }',
      '.t',
    );
    assert.equal(child.getPropertyValue('--x'), 'orange');
    assert.equal(child.getPropertyValue('--y'), 'teal');
    assert.equal(child.getPropertyValue('--z'), '');
    assert.equal(child.getPropertyValue('--w'), '');

    const root = cascade(
      '<html id="root"><body></body></html>',
      '#root { --x: inherit; --y: unset; --z: initial; --w: revert; --q: revert-layer; }',
      '#root',
    );
    assert.equal(root.getPropertyValue('--x'), '');
    assert.equal(root.getPropertyValue('--y'), '');
    assert.equal(root.getPropertyValue('--z'), '');
    assert.equal(root.getPropertyValue('--w'), '');
    assert.equal(root.getPropertyValue('--q'), '');

    const revertRule = box('.t { --x: first; } .t { --x: revert-rule; }');
    assert.equal(revertRule.getPropertyValue('--x'), 'first');

    const inheritAfterSkip = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { --x: orange; } .t { --x: var(--missing); --x: revert-rule; }',
      '.t',
    );
    assert.equal(inheritAfterSkip.getPropertyValue('--x'), 'orange');
  });

  test('revert-layer unique-cause same-layer skip vs previous lower layer vs no previous', () => {
    // Unique-cause while layerOrder >= decl.layerOrder T (skip unlayered twin) then F (take @layer a).
    const skipSame = box(`
      @layer a { .t { --x: from-a; } }
      .t { --x: from-unlayered; }
      .t { --x: revert-layer; }
    `);
    assert.equal(skipSame.getPropertyValue('--x'), 'from-a');

    // Unique-cause prevIdx >= 0 T and layerOrder >= F immediately (take previous lower layer).
    const prevLower = box(`
      @layer a { .t { --x: from-a; } }
      @layer b { .t { --x: from-b; } }
      @layer c { .t { --x: revert-layer; } }
    `);
    assert.equal(prevLower.getPropertyValue('--x'), 'from-b');

    // Unique-cause prevIdx >= 0 F: only declaration, inherit nothing.
    const only = box('.t { --x: revert-layer; }');
    assert.equal(only.getPropertyValue('--x'), '');
  });
});
