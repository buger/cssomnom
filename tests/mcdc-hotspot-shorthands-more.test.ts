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
// Verifies: SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { serialize } from '../src/serializer.ts';
import {
  SHORTHANDS,
  FONT_LONGHANDS,
  FONT_VARIANT_LONGHANDS,
  BORDER_ALL_LONGHANDS,
  BORDER_IMAGE_LONGHANDS,
  LIST_STYLE_LONGHANDS,
  FLEX_LONGHANDS,
  isInitialBorderImage,
} from '../src/shorthands.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { ComponentValue } from '../src/types.ts';

function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}

function ser(expanded: Record<string, ComponentValue[]> | null, name: string): string {
  assert.ok(expanded, `expected expansion containing ${name}`);
  const tokens = expanded[name];
  assert.ok(tokens, `missing longhand ${name}`);
  return serialize(tokens).trim();
}

describe('MC/DC hotspot: expandBackground', () => {
  test('css-wide keywords copy onto every background longhand', () => {
    for (const kw of ['initial', 'inherit', 'unset', 'revert', 'revert-layer']) {
      const expanded = SHORTHANDS['background'].expand(comps(kw));
      assert.ok(expanded);
      for (const name of [
        'background-image', 'background-position', 'background-size', 'background-repeat',
        'background-attachment', 'background-origin', 'background-clip', 'background-color',
      ]) {
        assert.equal(ser(expanded, name), kw);
      }
    }
  });

  test('empty layer, size without position, color not last, unknown token reject', () => {
    assert.equal(SHORTHANDS['background'].expand(comps(', red')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('red,')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('url(a.png) / cover')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('/ 10px')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('red, url(a.png)')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('not-a-bg-token')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('left 10px top 20px center')), null);
  });

  test('slash size cover/contain/auto/lengths and two-token size', () => {
    const cover = SHORTHANDS['background'].expand(comps('left / cover'));
    assert.equal(ser(cover, 'background-size'), 'cover');
    assert.equal(ser(cover, 'background-position').includes('left'), true);

    const contain = SHORTHANDS['background'].expand(comps('center / contain'));
    assert.equal(ser(contain, 'background-size'), 'contain');

    const auto = SHORTHANDS['background'].expand(comps('top / auto'));
    assert.equal(ser(auto, 'background-size').includes('auto'), true);

    const two = SHORTHANDS['background'].expand(comps('0% 0% / 10px 20px'));
    assert.equal(ser(two, 'background-size').includes('10px'), true);
    assert.equal(ser(two, 'background-size').includes('20px'), true);

    const calcSize = SHORTHANDS['background'].expand(comps('center / calc(10px + 2px)'));
    assert.equal(ser(calcSize, 'background-size').includes('calc('), true);

    assert.equal(SHORTHANDS['background'].expand(comps('center / italic')), null);
  });

  test('repeat-x/y, two-token repeat, attachment, and image tokens', () => {
    assert.equal(ser(SHORTHANDS['background'].expand(comps('repeat-x')), 'background-repeat'), 'repeat no-repeat');
    assert.equal(ser(SHORTHANDS['background'].expand(comps('repeat-y')), 'background-repeat'), 'no-repeat repeat');
    assert.equal(ser(SHORTHANDS['background'].expand(comps('no-repeat space')), 'background-repeat'), 'no-repeat space');

    assert.equal(ser(SHORTHANDS['background'].expand(comps('fixed')), 'background-attachment'), 'fixed');
    assert.equal(ser(SHORTHANDS['background'].expand(comps('local')), 'background-attachment'), 'local');

    const img = SHORTHANDS['background'].expand(comps('url(a.png)'));
    assert.equal(ser(img, 'background-image').includes('url('), true);
    assert.equal(SHORTHANDS['background'].expand(comps('url(a.png) url(b.png)')), null);

    const grad = SHORTHANDS['background'].expand(comps('linear-gradient(red, blue)'));
    assert.equal(ser(grad, 'background-image').includes('linear-gradient'), true);

    const none = SHORTHANDS['background'].expand(comps('none'));
    assert.equal(ser(none, 'background-image'), 'none');
  });

  test('box keywords: one, two, clip-only, three-with-two-clips, too many', () => {
    const one = SHORTHANDS['background'].expand(comps('content-box'));
    assert.equal(ser(one, 'background-origin'), 'content-box');
    assert.equal(ser(one, 'background-clip'), 'content-box');

    const mixed = SHORTHANDS['background'].expand(comps('padding-box content-box'));
    assert.equal(ser(mixed, 'background-origin'), 'padding-box');
    assert.equal(ser(mixed, 'background-clip'), 'content-box');

    const text = SHORTHANDS['background'].expand(comps('text'));
    assert.equal(ser(text, 'background-origin'), 'border-box');
    assert.equal(ser(text, 'background-clip'), 'text');

    const clipThenOrigin = SHORTHANDS['background'].expand(comps('text content-box'));
    assert.equal(ser(clipThenOrigin, 'background-origin'), 'content-box');
    assert.equal(ser(clipThenOrigin, 'background-clip'), 'text');

    const originThenClip = SHORTHANDS['background'].expand(comps('content-box text'));
    assert.equal(ser(originThenClip, 'background-origin'), 'content-box');
    assert.equal(ser(originThenClip, 'background-clip'), 'text');

    const twoClips = SHORTHANDS['background'].expand(comps('text border-area'));
    assert.equal(ser(twoClips, 'background-origin'), 'border-box');
    assert.equal(ser(twoClips, 'background-clip').includes('text'), true);
    assert.equal(ser(twoClips, 'background-clip').includes('border-area'), true);

    const three = SHORTHANDS['background'].expand(comps('padding-box text border-area'));
    assert.ok(three);
    assert.equal(ser(three, 'background-origin'), 'padding-box');

    assert.equal(SHORTHANDS['background'].expand(comps('padding-box content-box border-box')), null);
    assert.equal(SHORTHANDS['background'].expand(comps('padding-box content-box border-box text')), null);
  });

  test('position keyword normalization and color tokens', () => {
    assert.equal(ser(SHORTHANDS['background'].expand(comps('left')), 'background-position').includes('center'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('right')), 'background-position').includes('center'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('top')), 'background-position').includes('center'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('bottom')), 'background-position').includes('center'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('center')), 'background-position').includes('center'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('10%')), 'background-position').includes('10%'), true);

    const swapped = SHORTHANDS['background'].expand(comps('top left'));
    const pos = ser(swapped, 'background-position');
    assert.equal(pos.indexOf('left') < pos.indexOf('top'), true);

    assert.equal(ser(SHORTHANDS['background'].expand(comps('#00ff00')), 'background-color').toLowerCase().includes('0'), true);
    assert.equal(ser(SHORTHANDS['background'].expand(comps('rgb(1, 2, 3)')), 'background-color').includes('rgb'), true);
    assert.equal(SHORTHANDS['background'].expand(comps('red blue')), null);

    const lastColor = SHORTHANDS['background'].expand(comps('url(a.png), url(b.png) blue'));
    assert.equal(ser(lastColor, 'background-color'), 'blue');
  });

  test('CSSStyleDeclaration expands background shorthand', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('background', 'url(a.png) center / cover no-repeat fixed content-box red');
    assert.equal(style.getPropertyValue('background-image').includes('url('), true);
    assert.equal(style.getPropertyValue('background-position').includes('center'), true);
    assert.equal(style.getPropertyValue('background-size').includes('cover'), true);
    assert.equal(style.getPropertyValue('background-repeat'), 'no-repeat');
    assert.equal(style.getPropertyValue('background-attachment'), 'fixed');
    assert.equal(style.getPropertyValue('background-origin'), 'content-box');
    assert.equal(style.getPropertyValue('background-color'), 'red');

    style.setProperty('background', 'not-a-bg');
    assert.equal(style.getPropertyValue('background-color'), 'red');
  });
});

describe('MC/DC hotspot: expandBox / contractBox', () => {
  test('margin 1/2/3/4 values and invalid length reject', () => {
    const one = SHORTHANDS['margin'].expand(comps('10px'));
    assert.equal(ser(one, 'margin-top'), '10px');
    assert.equal(ser(one, 'margin-right'), '10px');
    assert.equal(ser(one, 'margin-bottom'), '10px');
    assert.equal(ser(one, 'margin-left'), '10px');

    const two = SHORTHANDS['margin'].expand(comps('10px 20px'));
    assert.equal(ser(two, 'margin-top'), '10px');
    assert.equal(ser(two, 'margin-right'), '20px');
    assert.equal(ser(two, 'margin-left'), '20px');

    const three = SHORTHANDS['margin'].expand(comps('1px 2px 3px'));
    assert.equal(ser(three, 'margin-bottom'), '3px');
    assert.equal(ser(three, 'margin-left'), '2px');

    const four = SHORTHANDS['margin'].expand(comps('1px 2px 3px 4px'));
    assert.equal(ser(four, 'margin-left'), '4px');

    assert.equal(SHORTHANDS['margin'].expand(comps('')), null);
    assert.equal(SHORTHANDS['margin'].expand(comps('1px 2px 3px 4px 5px')), null);
    assert.equal(SHORTHANDS['margin'].expand(comps('red')), null);
    assert.equal(SHORTHANDS['margin'].expand(comps('10deg')), null);
  });

  test('logical prefix maps onto logical longhands; auto/0/calc accepted', () => {
    const logical = SHORTHANDS['margin'].expand(comps('logical 1px 2px 3px 4px'));
    assert.ok(logical);
    assert.equal(ser(logical, 'margin-block-start'), '1px');
    assert.equal(ser(logical, 'margin-inline-start'), '2px');
    assert.equal(ser(logical, 'margin-block-end'), '3px');
    assert.equal(ser(logical, 'margin-inline-end'), '4px');

    const auto = SHORTHANDS['margin'].expand(comps('auto 0'));
    assert.equal(ser(auto, 'margin-top'), 'auto');
    assert.equal(ser(auto, 'margin-right'), '0');

    const calc = SHORTHANDS['margin'].expand(comps('calc(1px + 2px)'));
    assert.equal(ser(calc, 'margin-top').startsWith('calc('), true);
  });

  test('contractBox physical 1/2/3/4, css-wide same vs mixed, missing longhands', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin-top', '1px');
    style.setProperty('margin-right', '1px');
    style.setProperty('margin-bottom', '1px');
    style.setProperty('margin-left', '1px');
    assert.equal(style.getPropertyValue('margin'), '1px');

    style.setProperty('margin-right', '2px');
    style.setProperty('margin-left', '2px');
    assert.equal(style.getPropertyValue('margin'), '1px 2px');

    style.setProperty('margin-bottom', '3px');
    assert.equal(style.getPropertyValue('margin'), '1px 2px 3px');

    style.setProperty('margin-left', '4px');
    assert.equal(style.getPropertyValue('margin'), '1px 2px 3px 4px');

    const wide = SHORTHANDS['margin'].contract({
      'margin-top': comps('inherit'),
      'margin-right': comps('inherit'),
      'margin-bottom': comps('inherit'),
      'margin-left': comps('inherit'),
    });
    assert.equal(wide, 'inherit');

    const mixedWide = SHORTHANDS['margin'].contract({
      'margin-top': comps('inherit'),
      'margin-right': comps('initial'),
      'margin-bottom': comps('inherit'),
      'margin-left': comps('inherit'),
    });
    assert.equal(mixedWide, null);

    assert.equal(SHORTHANDS['margin'].contract({ 'margin-top': comps('1px') }), null);
  });

  test('contractBox logical 1/2/3/4 values and mixed css-wide', () => {
    const all = SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-inline-start': comps('1px'),
      'margin-block-end': comps('1px'),
      'margin-inline-end': comps('1px'),
    });
    assert.equal(all, 'logical 1px');

    const two = SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-inline-start': comps('2px'),
      'margin-block-end': comps('1px'),
      'margin-inline-end': comps('2px'),
    });
    assert.equal(two, 'logical 1px 2px');

    const three = SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-inline-start': comps('2px'),
      'margin-block-end': comps('3px'),
      'margin-inline-end': comps('2px'),
    });
    assert.equal(three, 'logical 1px 2px 3px');

    const four = SHORTHANDS['margin'].contract({
      'margin-block-start': comps('1px'),
      'margin-inline-start': comps('2px'),
      'margin-block-end': comps('3px'),
      'margin-inline-end': comps('4px'),
    });
    assert.equal(four, 'logical 1px 2px 3px 4px');

    const mixed = SHORTHANDS['margin'].contract({
      'margin-block-start': comps('inherit'),
      'margin-inline-start': comps('1px'),
      'margin-block-end': comps('inherit'),
      'margin-inline-end': comps('inherit'),
    });
    assert.equal(mixed, null);
  });
});

describe('MC/DC hotspot: expandTwoValue / contractTwoValue', () => {
  test('margin-block, overflow, and css-wide same vs mixed', () => {
    const one = SHORTHANDS['margin-block'].expand(comps('10px'));
    assert.equal(ser(one, 'margin-block-start'), '10px');
    assert.equal(ser(one, 'margin-block-end'), '10px');

    const two = SHORTHANDS['margin-block'].expand(comps('10px 20px'));
    assert.equal(ser(two, 'margin-block-start'), '10px');
    assert.equal(ser(two, 'margin-block-end'), '20px');

    assert.equal(SHORTHANDS['margin-block'].expand(comps('')), null);
    assert.equal(SHORTHANDS['margin-block'].expand(comps('1px 2px 3px')), null);

    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('1px'),
      'margin-block-end': comps('1px'),
    }), '1px');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('1px'),
      'margin-block-end': comps('2px'),
    }), '1px 2px');
    assert.equal(SHORTHANDS['margin-block'].contract({
      'margin-block-start': comps('inherit'),
      'margin-block-end': comps('initial'),
    }), null);

    const style = new CSSStyleDeclaration();
    style.setProperty('overflow-x', 'hidden');
    style.setProperty('overflow-y', 'hidden');
    assert.equal(style.getPropertyValue('overflow'), 'hidden');

    style.setProperty('overflow-y', 'scroll');
    assert.equal(style.getPropertyValue('overflow'), 'hidden scroll');

    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-x': comps('inherit'),
      'overflow-y': comps('inherit'),
    }), 'inherit');
    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-x': comps('inherit'),
      'overflow-y': comps('initial'),
    }), null);
    assert.equal(SHORTHANDS['overflow'].contract({ 'overflow-x': comps('hidden') }), null);
  });
});

describe('MC/DC hotspot: border / border-side / outline', () => {
  test('expandBorder empty, css-wide, width/style/color token kinds', () => {
    assert.equal(SHORTHANDS['border'].expand(comps('')), null);
    assert.equal(SHORTHANDS['border'].expand(comps('1px solid red extra')), null);

    const inherit = SHORTHANDS['border'].expand(comps('inherit'));
    assert.ok(inherit);
    for (const lh of BORDER_ALL_LONGHANDS) {
      assert.equal(ser(inherit, lh), 'inherit');
    }

    const solid = SHORTHANDS['border'].expand(comps('2px dashed #abc'));
    assert.equal(ser(solid, 'border-top-width'), '2px');
    assert.equal(ser(solid, 'border-top-style'), 'dashed');
    assert.equal(ser(solid, 'border-top-color').toLowerCase().includes('a') || ser(solid, 'border-top-color').includes('#'), true);

    const thick = SHORTHANDS['border'].expand(comps('thick solid rgb(1, 2, 3)'));
    assert.equal(ser(thick, 'border-left-width'), 'thick');
    assert.equal(ser(thick, 'border-left-style'), 'solid');
    assert.equal(ser(thick, 'border-left-color').includes('rgb'), true);

    const identColor = SHORTHANDS['border'].expand(comps('red'));
    assert.equal(ser(identColor, 'border-top-color'), 'red');
    assert.equal(ser(identColor, 'border-top-style'), 'none');
  });

  test('contractBorder missing, mixed sides, non-initial image, formatBorderSideValue', () => {
    assert.equal(SHORTHANDS['border'].contract({ 'border-top-width': comps('1px') }), null);

    const style = new CSSStyleDeclaration();
    style.setProperty('border', '1px solid red');
    assert.equal(style.getPropertyValue('border').includes('1px'), true);
    assert.equal(style.getPropertyValue('border').includes('solid'), true);
    assert.equal(style.getPropertyValue('border').includes('red'), true);

    style.setProperty('border-right-color', 'blue');
    assert.equal(style.getPropertyValue('border'), '');

    const initials = SHORTHANDS['border-top'].contract({
      'border-top-width': comps('medium'),
      'border-top-style': comps('none'),
      'border-top-color': comps('currentcolor'),
    });
    assert.equal(initials, 'none');

    const widthOnly = SHORTHANDS['border-top'].contract({
      'border-top-width': comps('2px'),
      'border-top-style': comps('none'),
      'border-top-color': comps('currentcolor'),
    });
    assert.equal(widthOnly, '2px');

    const styleOnly = SHORTHANDS['border-top'].contract({
      'border-top-width': comps('medium'),
      'border-top-style': comps('solid'),
      'border-top-color': comps('currentcolor'),
    });
    assert.equal(styleOnly, 'solid');

    const mixedWide = SHORTHANDS['border-top'].contract({
      'border-top-width': comps('inherit'),
      'border-top-style': comps('solid'),
      'border-top-color': comps('inherit'),
    });
    assert.equal(mixedWide, null);

    const sameWide = SHORTHANDS['border-top'].contract({
      'border-top-width': comps('unset'),
      'border-top-style': comps('unset'),
      'border-top-color': comps('unset'),
    });
    assert.equal(sameWide, 'unset');
  });

  test('border-image expand/contract and isInitialBorderImage', () => {
    assert.equal(SHORTHANDS['border-image'].expand(comps('')), null);

    const none = SHORTHANDS['border-image'].expand(comps('none'));
    assert.equal(ser(none, 'border-image-source'), 'none');
    assert.equal(isInitialBorderImage(none!), true);

    const inherit = SHORTHANDS['border-image'].expand(comps('inherit'));
    for (const lh of BORDER_IMAGE_LONGHANDS) {
      assert.equal(ser(inherit, lh), 'inherit');
    }

    const url = SHORTHANDS['border-image'].expand(comps('url(a.png)'));
    assert.equal(ser(url, 'border-image-source').includes('url('), true);
    assert.equal(isInitialBorderImage(url!), false);

    const withVar = SHORTHANDS['border-image'].expand(comps('var(--img)'));
    assert.ok(withVar);
    assert.equal(ser(withVar, 'border-image-source').includes('var('), true);

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-source': comps('none'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    }), 'none');

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-source': comps('url(a.png)'),
      'border-image-slice': comps('100%'),
      'border-image-width': comps('1'),
      'border-image-outset': comps('0'),
      'border-image-repeat': comps('stretch'),
    })?.includes('url('), true);

    assert.equal(SHORTHANDS['border-image'].contract({
      'border-image-source': comps('inherit'),
      'border-image-slice': comps('initial'),
      'border-image-width': comps('inherit'),
      'border-image-outset': comps('inherit'),
      'border-image-repeat': comps('inherit'),
    }), null);

    assert.equal(isInitialBorderImage({ 'border-image-source': comps('none') }), false);
  });

  test('outline expand/contract width/style/color and css-wide', () => {
    assert.equal(SHORTHANDS['outline'].expand(comps('')), null);
    const inherit = SHORTHANDS['outline'].expand(comps('inherit'));
    assert.equal(ser(inherit, 'outline-color'), 'inherit');
    assert.equal(ser(inherit, 'outline-style'), 'inherit');
    assert.equal(ser(inherit, 'outline-width'), 'inherit');

    const auto = SHORTHANDS['outline'].expand(comps('auto'));
    assert.equal(ser(auto, 'outline-style'), 'auto');

    const thick = SHORTHANDS['outline'].expand(comps('2px dotted blue'));
    assert.equal(ser(thick, 'outline-width'), '2px');
    assert.equal(ser(thick, 'outline-style'), 'dotted');
    assert.equal(ser(thick, 'outline-color'), 'blue');

    const hash = SHORTHANDS['outline'].expand(comps('#f00'));
    assert.equal(ser(hash, 'outline-color').includes('#') || ser(hash, 'outline-color').toLowerCase().includes('f'), true);

    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('currentcolor'),
      'outline-style': comps('none'),
      'outline-width': comps('medium'),
    }), 'none');

    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('red'),
      'outline-style': comps('solid'),
      'outline-width': comps('2px'),
    }), 'red solid 2px');

    assert.equal(SHORTHANDS['outline'].contract({
      'outline-color': comps('inherit'),
      'outline-style': comps('solid'),
      'outline-width': comps('inherit'),
    }), null);

    assert.equal(SHORTHANDS['outline'].contract({ 'outline-color': comps('red') }), null);

    const style = new CSSStyleDeclaration();
    style.setProperty('outline', '1px solid red');
    assert.equal(style.getPropertyValue('outline-width'), '1px');
    assert.equal(style.getPropertyValue('outline-style'), 'solid');
    assert.equal(style.getPropertyValue('outline-color'), 'red');
  });
});

describe('MC/DC hotspot: font-variant / contractFont', () => {
  test('expandFontVariant empty, css-wide, normal, none, keyword groups, functions', () => {
    assert.equal(SHORTHANDS['font-variant'].expand(comps('')), null);

    const inherit = SHORTHANDS['font-variant'].expand(comps('inherit'));
    for (const lh of FONT_VARIANT_LONGHANDS) {
      assert.equal(ser(inherit, lh), 'inherit');
    }

    const normal = SHORTHANDS['font-variant'].expand(comps('normal'));
    for (const lh of FONT_VARIANT_LONGHANDS) {
      assert.equal(ser(normal, lh), 'normal');
    }

    const none = SHORTHANDS['font-variant'].expand(comps('none'));
    assert.equal(ser(none, 'font-variant-ligatures'), 'none');
    assert.equal(ser(none, 'font-variant-caps'), 'normal');

    const mixed = SHORTHANDS['font-variant'].expand(comps('common-ligatures small-caps historical-forms lining-nums jis78 sub emoji'));
    assert.equal(ser(mixed, 'font-variant-ligatures'), 'common-ligatures');
    assert.equal(ser(mixed, 'font-variant-caps'), 'small-caps');
    assert.equal(ser(mixed, 'font-variant-alternates'), 'historical-forms');
    assert.equal(ser(mixed, 'font-variant-numeric'), 'lining-nums');
    assert.equal(ser(mixed, 'font-variant-east-asian'), 'jis78');
    assert.equal(ser(mixed, 'font-variant-position'), 'sub');
    assert.equal(ser(mixed, 'font-variant-emoji'), 'emoji');

    const stylistic = SHORTHANDS['font-variant'].expand(comps('stylistic(foo)'));
    assert.equal(ser(stylistic, 'font-variant-alternates').includes('stylistic'), true);

    const skippedNormal = SHORTHANDS['font-variant'].expand(comps('normal small-caps'));
    assert.equal(ser(skippedNormal, 'font-variant-caps'), 'small-caps');

    assert.equal(SHORTHANDS['font-variant'].expand(comps('not-a-variant')), null);
    assert.equal(SHORTHANDS['font-variant'].expand(comps('var(--x)')), null);
    assert.equal(SHORTHANDS['font-variant'].expand(comps('12px')), null);
  });

  test('contractFontVariant missing, css-wide, none, and joined non-normal', () => {
    assert.equal(SHORTHANDS['font-variant'].contract({ 'font-variant-caps': comps('small-caps') }), null);

    const allNormal: Record<string, ComponentValue[]> = {};
    for (const lh of FONT_VARIANT_LONGHANDS) allNormal[lh] = comps('normal');
    assert.equal(SHORTHANDS['font-variant'].contract(allNormal), 'normal');

    const allNoneLig = { ...allNormal, 'font-variant-ligatures': comps('none') };
    assert.equal(SHORTHANDS['font-variant'].contract(allNoneLig), 'none');

    const nonePlusCaps = { ...allNoneLig, 'font-variant-caps': comps('small-caps') };
    assert.equal(SHORTHANDS['font-variant'].contract(nonePlusCaps), null);

    const mixedWide = { ...allNormal, 'font-variant-caps': comps('inherit') };
    assert.equal(SHORTHANDS['font-variant'].contract(mixedWide), null);

    const allInherit: Record<string, ComponentValue[]> = {};
    for (const lh of FONT_VARIANT_LONGHANDS) allInherit[lh] = comps('inherit');
    assert.equal(SHORTHANDS['font-variant'].contract(allInherit), 'inherit');

    const joined = { ...allNormal, 'font-variant-caps': comps('small-caps'), 'font-variant-numeric': comps('ordinal') };
    assert.equal(SHORTHANDS['font-variant'].contract(joined), 'small-caps ordinal');
  });

  test('contractFont omits normals, rejects non-normal extra variants, css-wide', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('font', 'italic small-caps 700 condensed 16px / 1.2 serif');
    const contracted = style.getPropertyValue('font');
    assert.equal(contracted.includes('italic'), true);
    assert.equal(contracted.includes('small-caps'), true);
    assert.equal(contracted.includes('700'), true);
    assert.equal(contracted.includes('condensed'), true);
    assert.equal(contracted.includes('16px'), true);
    assert.equal(contracted.includes('1.2'), true);
    assert.equal(contracted.includes('serif'), true);

    style.setProperty('font-weight', '400');
    assert.equal(style.getPropertyValue('font').includes('400'), false);

    style.setProperty('font-variant-ligatures', 'none');
    assert.equal(style.getPropertyValue('font'), '');

    const missing = SHORTHANDS['font'].contract({ 'font-size': comps('16px') });
    assert.equal(missing, null);

    const allInherit: Record<string, ComponentValue[]> = {};
    for (const lh of FONT_LONGHANDS) allInherit[lh] = comps('normal');
    for (const lh of ['font-style', 'font-variant-caps', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family']) {
      allInherit[lh] = comps('inherit');
    }
    assert.equal(SHORTHANDS['font'].contract(allInherit), 'inherit');

    const mixedWide = { ...allInherit, 'font-size': comps('16px') };
    assert.equal(SHORTHANDS['font'].contract(mixedWide), null);
  });
});

describe('MC/DC hotspot: list-style / flex / overflow / line-clamp / border-radius / all', () => {
  test('expandListStyle ident, none, url, gradient, and reject extras', () => {
    assert.equal(SHORTHANDS['list-style'].expand(comps('')), null);
    assert.equal(SHORTHANDS['list-style'].expand(comps('inside disc url(a.png) extra')), null);

    const inherit = SHORTHANDS['list-style'].expand(comps('inherit'));
    for (const lh of LIST_STYLE_LONGHANDS) {
      assert.equal(ser(inherit, lh), 'inherit');
    }

    const inside = SHORTHANDS['list-style'].expand(comps('inside square'));
    assert.equal(ser(inside, 'list-style-position'), 'inside');
    assert.equal(ser(inside, 'list-style-type'), 'square');

    const noneFirst = SHORTHANDS['list-style'].expand(comps('none'));
    assert.equal(ser(noneFirst, 'list-style-type'), 'none');
    assert.equal(ser(noneFirst, 'list-style-image'), 'none');

    assert.equal(SHORTHANDS['list-style'].expand(comps('none square')), null);
    const typeThenNone = SHORTHANDS['list-style'].expand(comps('square none'));
    assert.equal(ser(typeThenNone, 'list-style-image'), 'none');
    assert.equal(ser(typeThenNone, 'list-style-type'), 'square');

    const url = SHORTHANDS['list-style'].expand(comps('url(a.png)'));
    assert.equal(ser(url, 'list-style-image').includes('url('), true);

    const grad = SHORTHANDS['list-style'].expand(comps('linear-gradient(red, blue)'));
    assert.equal(ser(grad, 'list-style-image').includes('linear-gradient'), true);

    assert.equal(SHORTHANDS['list-style'].expand(comps('disc circle')), null);
    assert.equal(SHORTHANDS['list-style'].expand(comps('12px')), null);

    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('disc'),
      'list-style-position': comps('outside'),
      'list-style-image': comps('none'),
    }), 'disc');

    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('square'),
      'list-style-position': comps('inside'),
      'list-style-image': comps('url(a.png)'),
    })?.includes('inside'), true);

    assert.equal(SHORTHANDS['list-style'].contract({
      'list-style-type': comps('inherit'),
      'list-style-position': comps('initial'),
      'list-style-image': comps('inherit'),
    }), null);

    assert.equal(SHORTHANDS['list-style'].contract({ 'list-style-type': comps('disc') }), null);
  });

  test('expandFlex none/auto/numbers/basis and contract specials', () => {
    assert.equal(SHORTHANDS['flex'].expand(comps('')), null);
    assert.equal(SHORTHANDS['flex'].expand(comps('1 2 3 4')), null);

    const inherit = SHORTHANDS['flex'].expand(comps('inherit'));
    for (const lh of FLEX_LONGHANDS) assert.equal(ser(inherit, lh), 'inherit');

    const none = SHORTHANDS['flex'].expand(comps('none'));
    assert.equal(ser(none, 'flex-grow'), '0');
    assert.equal(ser(none, 'flex-shrink'), '0');
    assert.equal(ser(none, 'flex-basis'), 'auto');

    const auto = SHORTHANDS['flex'].expand(comps('auto'));
    assert.equal(ser(auto, 'flex-grow'), '1');
    assert.equal(ser(auto, 'flex-basis'), 'auto');

    const grow = SHORTHANDS['flex'].expand(comps('2'));
    assert.equal(ser(grow, 'flex-grow'), '2');
    assert.equal(ser(grow, 'flex-shrink'), '1');
    assert.equal(ser(grow, 'flex-basis'), '0px');

    const two = SHORTHANDS['flex'].expand(comps('1 2'));
    assert.equal(ser(two, 'flex-shrink'), '2');

    const basis = SHORTHANDS['flex'].expand(comps('1 1 20%'));
    assert.equal(ser(basis, 'flex-basis'), '20%');

    const content = SHORTHANDS['flex'].expand(comps('content'));
    assert.equal(ser(content, 'flex-basis'), 'content');

    assert.equal(SHORTHANDS['flex'].expand(comps('1 2 3')), null);
    assert.equal(SHORTHANDS['flex'].expand(comps('auto content')), null);
    assert.equal(SHORTHANDS['flex'].expand(comps('solid')), null);

    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('0'),
      'flex-shrink': comps('1'),
      'flex-basis': comps('auto'),
    }), 'initial');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('1'),
      'flex-shrink': comps('1'),
      'flex-basis': comps('auto'),
    }), 'auto');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('0'),
      'flex-shrink': comps('0'),
      'flex-basis': comps('auto'),
    }), 'none');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('2'),
      'flex-shrink': comps('1'),
      'flex-basis': comps('0px'),
    }), '2 1 0px');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('2'),
      'flex-shrink': comps('3'),
      'flex-basis': comps('0px'),
    }), '2 3 0px');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('1'),
      'flex-shrink': comps('1'),
      'flex-basis': comps('auto'),
    }), 'auto');
    assert.equal(SHORTHANDS['flex'].contract({
      'flex-grow': comps('inherit'),
      'flex-shrink': comps('initial'),
      'flex-basis': comps('inherit'),
    }), null);
    assert.equal(SHORTHANDS['flex'].contract({ 'flex-grow': comps('1') }), null);

    const style = new CSSStyleDeclaration();
    style.setProperty('flex', '2 3 10px');
    assert.equal(style.getPropertyValue('flex-grow'), '2');
    assert.equal(style.getPropertyValue('flex-shrink'), '3');
    assert.equal(style.getPropertyValue('flex-basis'), '10px');
  });

  test('contractOverflow var mismatch vs match', () => {
    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-x': comps('var(--a)'),
      'overflow-y': comps('var(--a)'),
    }), 'var(--a)');
    assert.equal(SHORTHANDS['overflow'].contract({
      'overflow-x': comps('var(--a)'),
      'overflow-y': comps('var(--b)'),
    }), null);
  });

  test('line-clamp expand/contract none, css-wide, number', () => {
    assert.equal(SHORTHANDS['line-clamp'].expand(comps('')), null);
    assert.equal(ser(SHORTHANDS['line-clamp'].expand(comps('inherit')), 'max-lines'), 'inherit');
    assert.equal(ser(SHORTHANDS['line-clamp'].expand(comps('none')), 'max-lines'), 'none');
    assert.equal(ser(SHORTHANDS['line-clamp'].expand(comps('3')), 'max-lines'), '3');

    assert.equal(SHORTHANDS['line-clamp'].contract({ 'max-lines': comps('none') }), 'none');
    assert.equal(SHORTHANDS['line-clamp'].contract({ 'max-lines': comps('unset') }), 'unset');
    assert.equal(SHORTHANDS['line-clamp'].contract({ 'max-lines': comps('2') }), '2');
    assert.equal(SHORTHANDS['line-clamp'].contract({}), null);
  });

  test('border-radius 1-4, slash elliptical, logical/empty/too-many reject', () => {
    assert.equal(SHORTHANDS['border-radius'].expand(comps('')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('logical 1px')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('1px 2px 3px 4px 5px')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('/ 1px')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('1px /')), null);
    assert.equal(SHORTHANDS['border-radius'].expand(comps('1px / 2px / 3px')), null);

    const one = SHORTHANDS['border-radius'].expand(comps('10px'));
    assert.equal(ser(one, 'border-top-left-radius'), '10px');
    assert.equal(ser(one, 'border-bottom-right-radius'), '10px');

    const four = SHORTHANDS['border-radius'].expand(comps('1px 2px 3px 4px'));
    assert.equal(ser(four, 'border-top-left-radius'), '1px');
    assert.equal(ser(four, 'border-top-right-radius'), '2px');
    assert.equal(ser(four, 'border-bottom-right-radius'), '3px');
    assert.equal(ser(four, 'border-bottom-left-radius'), '4px');

    const ellip = SHORTHANDS['border-radius'].expand(comps('10px / 20px'));
    assert.equal(ser(ellip, 'border-top-left-radius').includes('10px'), true);
    assert.equal(ser(ellip, 'border-top-left-radius').includes('20px'), true);

    const style = new CSSStyleDeclaration();
    style.setProperty('border-radius', '1px 2px 3px 4px / 5px');
    assert.equal(style.getPropertyValue('border-top-left-radius').includes('1px'), true);
    const contracted = style.getPropertyValue('border-radius');
    assert.equal(contracted.includes('/'), true);

    assert.equal(SHORTHANDS['border-radius'].contract({
      'border-top-left-radius': comps('inherit'),
      'border-top-right-radius': comps('initial'),
      'border-bottom-right-radius': comps('inherit'),
      'border-bottom-left-radius': comps('inherit'),
    }), null);
    assert.equal(SHORTHANDS['border-radius'].contract({ 'border-top-left-radius': comps('1px') }), null);
  });

  test('expandAll / contractAll css-wide and var, reject other values', () => {
    assert.equal(SHORTHANDS['all'].expand(comps('')), null);
    assert.equal(SHORTHANDS['all'].expand(comps('red')), null);

    const inherit = SHORTHANDS['all'].expand(comps('inherit'));
    assert.ok(inherit);
    assert.equal(ser(inherit, 'color'), 'inherit');

    const withVar = SHORTHANDS['all'].expand(comps('var(--x)'));
    assert.ok(withVar);
    assert.equal(ser(withVar, 'color').includes('var('), true);

    const style = new CSSStyleDeclaration();
    style.setProperty('color', 'red');
    style.setProperty('all', 'unset');
    assert.equal(style.getPropertyValue('color'), 'unset');

    style.setProperty('all', 'not-wide');
    assert.equal(style.getPropertyValue('color'), 'unset');
  });
});
