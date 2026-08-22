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
// Verifies: SW-REQ-260821-FWNH, SW-REQ-260821-RPSA, INT-REQ-260821-HJVC
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import {
  CSSComputedStyleDeclaration,
  getCascadedStyle,
} from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { Declaration } from '../src/types.ts';

function d(name: string, value: string, extra: Partial<Declaration> = {}): Declaration {
  return { type: 'declaration', name, value: tokenize(value), important: false, ...extra };
}

function computed(
  decls: Declaration[] = [],
  parentStyle: CSSStyleDeclaration | null = null,
  element: unknown = null,
): CSSComputedStyleDeclaration {
  return new CSSComputedStyleDeclaration(decls, true, parentStyle, element);
}

function specified(props: Record<string, string>): CSSStyleDeclaration {
  const style = new CSSStyleDeclaration();
  for (const [name, value] of Object.entries(props)) {
    style.setProperty(name, value);
  }
  return style;
}

function cascade(html: string, css: string, selector: string): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  return getCascadedStyle(el, parseStyleSheet(css));
}

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue custom properties', () => {
  test('missing custom property is empty; raw and serialize arms unique-cause empty vs non-empty', () => {
    // css-variables-1 § 4.2 #serializing-custom-props
    const css = cascade(
      '<div class="t"></div>',
      '.t { --theme: coral; --empty: ; --ws:   ; }',
      '.t',
    );
    assert.equal(css.getPropertyValue('--theme'), 'coral');
    assert.equal(css.getPropertyValue('--empty'), ' ');
    assert.equal(css.getPropertyValue('--ws'), ' ');
    assert.equal(css.getPropertyValue('--missing'), '');

    const noRaw = computed([d('--plain', 'hello')]);
    assert.equal(noRaw.getPropertyValue('--plain'), 'hello');
    const emptySer = computed([{ type: 'declaration', name: '--blank', value: [], important: false }]);
    assert.equal(emptySer.getPropertyValue('--blank'), ' ');
    const wsSer = computed([d('--spaces', '   ')]);
    assert.equal(wsSer.getPropertyValue('--spaces'), ' ');
  });
});

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue logical properties', () => {
  test('logical names remap from writing-mode and direction; writing-mode and direction themselves do not remap', () => {
    // css-logical-1 § 2 #logical-prop-mapping
    const css = cascade(
      '<div class="t"></div>',
      '.t { writing-mode: vertical-rl; direction: rtl; margin-inline-start: 10px; inset-block-start: 4px; }',
      '.t',
    );
    assert.equal(css.getPropertyValue('writing-mode'), 'vertical-rl');
    assert.equal(css.getPropertyValue('direction'), 'rtl');
    assert.equal(css.getPropertyValue('margin-inline-start'), '10px');
    assert.equal(css.getPropertyValue('margin-bottom'), '10px');
    assert.equal(css.getPropertyValue('margin-top'), '');
    assert.equal(css.getPropertyValue('inset-block-start'), '4px');
    assert.equal(css.getPropertyValue('right'), '4px');

    const ltr = cascade(
      '<div class="t"></div>',
      '.t { margin-inline-start: 8px; }',
      '.t',
    );
    assert.equal(ltr.getPropertyValue('margin-left'), '8px');
    assert.equal(ltr.getPropertyValue('marginInlineStart'), '8px');
  });
});

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue shorthands', () => {
  test('border side synthesis, equal four-side contraction, and unique mixed-side failures', () => {
    // cssom-1 § 6.2 & § 6.4.3
    const match = cascade(
      '<div class="t"></div>',
      '.t { border: 2px solid green; }',
      '.t',
    );
    assert.equal(match.getPropertyValue('border'), '2px solid rgb(0, 128, 0)');
    assert.equal(match.getPropertyValue('border-top'), '2px solid rgb(0, 128, 0)');
    assert.equal(match.getPropertyValue('borderTop'), '2px solid rgb(0, 128, 0)');

    const bottomDiff = cascade(
      '<div class="t"></div>',
      '.t { border-top: 1px solid red; border-right: 1px solid red; border-bottom: 2px solid red; border-left: 1px solid red; }',
      '.t',
    );
    assert.equal(bottomDiff.getPropertyValue('border-top'), '1px solid rgb(255, 0, 0)');
    assert.equal(bottomDiff.getPropertyValue('border-right'), '1px solid rgb(255, 0, 0)');
    assert.equal(bottomDiff.getPropertyValue('border-bottom'), '2px solid rgb(255, 0, 0)');
    assert.equal(bottomDiff.getPropertyValue('border'), '');

    const leftDiff = cascade(
      '<div class="t"></div>',
      '.t { border-top: 1px solid red; border-right: 1px solid red; border-bottom: 1px solid red; border-left: 2px solid blue; }',
      '.t',
    );
    assert.equal(leftDiff.getPropertyValue('border'), '');

    const defaults = computed();
    assert.equal(defaults.getPropertyValue('border'), '0px none rgb(0, 0, 0)');
    assert.equal(defaults.getPropertyValue('border-right'), '0px none rgb(0, 0, 0)');
    assert.equal(defaults.getPropertyValue('border-bottom'), '0px none rgb(0, 0, 0)');
    assert.equal(defaults.getPropertyValue('border-left'), '0px none rgb(0, 0, 0)');
  });

  test('background shorthand concatenates specified longhands and initial fallbacks', () => {
    // cssom-1 § 6.2
    const specifiedBg = cascade(
      '<div class="t"></div>',
      `.t {
        background-color: red;
        background-image: none;
        background-repeat: no-repeat;
        background-attachment: fixed;
        background-position: 10% 20%;
        background-size: cover;
        background-origin: content-box;
        background-clip: padding-box;
      }`,
      '.t',
    );
    assert.equal(
      specifiedBg.getPropertyValue('background'),
      'rgb(255, 0, 0) none no-repeat fixed 10% 20% / cover content-box padding-box',
    );

    const fallbacks = computed();
    assert.equal(
      fallbacks.getPropertyValue('background'),
      'rgba(0, 0, 0, 0) none repeat scroll 0% 0% / auto padding-box border-box',
    );
  });
});

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue offsets and auto margins', () => {
  test('left/right/top/bottom resolve 0, 0px, used length, relative auto, and static auto independently', () => {
    // cssom-1 § 6.8 #resolved-values
    const rel = cascade(
      '<div class="t"></div>',
      '.t { position: relative; left: auto; top: 0; right: 0px; bottom: 12px; }',
      '.t',
    );
    assert.equal(rel.getPropertyValue('left'), '0px');
    assert.equal(rel.getPropertyValue('top'), '0px');
    assert.equal(rel.getPropertyValue('right'), '0px');
    assert.equal(rel.getPropertyValue('bottom'), '12px');

    const stat = cascade(
      '<div class="t"></div>',
      '.t { position: static; left: auto; }',
      '.t',
    );
    assert.equal(stat.getPropertyValue('left'), 'auto');

    const abs = cascade(
      '<div class="t"></div>',
      '.t { position: absolute; left: auto; }',
      '.t',
    );
    assert.equal(abs.getPropertyValue('left'), 'auto');

    const zeroNumber = computed([d('left', '0')]);
    assert.equal(zeroNumber.getPropertyValue('left'), '0px');
  });

  test('margin-top/bottom auto compute to 0px; specified lengths are kept', () => {
    // cssom-1 § 6.8 & CSS 2.1 § 10.3.3
    const css = cascade(
      '<div class="t"></div>',
      '.t { margin-top: auto; margin-bottom: 5px; }',
      '.t',
    );
    assert.equal(css.getPropertyValue('margin-top'), '0px');
    assert.equal(css.getPropertyValue('margin-bottom'), '5px');
  });

  test('horizontal auto margins split remaining space, fill one side, or collapse when widths cannot resolve', () => {
    // CSS 2.1 § 10.3.3
    const html = `<div class="parent">
      <div class="both"></div>
      <div class="leftonly"></div>
      <div class="rightonly"></div>
      <div class="bigger"></div>
      <div class="pct"></div>
      <div class="autow"></div>
    </div>`;
    const css = `
      .parent { width: 400px; }
      .both { width: 100px; margin-left: auto; margin-right: auto; }
      .leftonly { width: 100px; margin-left: auto; margin-right: 10px; }
      .rightonly { width: 100px; margin-left: 10px; margin-right: auto; }
      .bigger { width: 500px; margin-left: auto; }
      .pct { width: 50%; margin-left: auto; }
      .autow { width: auto; margin-left: auto; }
    `;
    const { document } = parseHTML(html);
    const rules = parseStyleSheet(css);
    const styleOf = (sel: string) => getCascadedStyle(document.querySelector(sel), rules);

    assert.equal(styleOf('.both').getPropertyValue('margin-left'), '150px');
    assert.equal(styleOf('.both').getPropertyValue('margin-right'), '150px');
    assert.equal(styleOf('.leftonly').getPropertyValue('margin-left'), '300px');
    assert.equal(styleOf('.rightonly').getPropertyValue('margin-right'), '300px');
    assert.equal(styleOf('.rightonly').getPropertyValue('margin-left'), '10px');
    assert.equal(styleOf('.bigger').getPropertyValue('margin-left'), '0px');
    assert.equal(styleOf('.pct').getPropertyValue('margin-left'), '0px');
    assert.equal(styleOf('.autow').getPropertyValue('margin-left'), '0px');

    const parentPx = specified({ width: '400px' });
    const noElement = computed([d('margin-left', 'auto')], parentPx, null);
    assert.equal(noElement.getPropertyValue('margin-left'), 'auto');
    const primitiveElement = computed([d('margin-left', 'auto')], parentPx, 'div');
    assert.equal(primitiveElement.getPropertyValue('margin-left'), 'auto');
    const noParent = computed([d('margin-left', 'auto')], parentPx, { tagName: 'DIV' });
    assert.equal(noParent.getPropertyValue('margin-left'), '0px');
    const primitiveParent = computed(
      [d('margin-left', 'auto'), d('width', '100px')],
      parentPx,
      { parentElement: 7 },
    );
    assert.equal(primitiveParent.getPropertyValue('margin-left'), '0px');
    const viaParentNode = computed(
      [d('margin-left', 'auto'), d('margin-right', 'auto'), d('width', '100px')],
      parentPx,
      { parentElement: null, parentNode: {} },
    );
    assert.equal(viaParentNode.getPropertyValue('margin-left'), '150px');

    const emptyParentWidth = computed(
      [d('margin-left', 'auto'), d('width', '100px')],
      specified({}),
      { parentElement: {} },
    );
    assert.equal(emptyParentWidth.getPropertyValue('margin-left'), '0px');
    const parentAuto = computed(
      [d('margin-left', 'auto'), d('width', '100px')],
      specified({ width: 'auto' }),
      { parentElement: {} },
    );
    assert.equal(parentAuto.getPropertyValue('margin-left'), '0px');
    const parentPct = computed(
      [d('margin-left', 'auto'), d('width', '100px')],
      specified({ width: '50%' }),
      { parentElement: {} },
    );
    assert.equal(parentPct.getPropertyValue('margin-left'), '0px');
    const noChildWidth = computed(
      [d('margin-left', 'auto')],
      parentPx,
      { parentElement: {} },
    );
    assert.equal(noChildWidth.getPropertyValue('margin-left'), '0px');
    const childPct = computed(
      [d('margin-left', 'auto'), d('width', '50%')],
      parentPx,
      { parentElement: {} },
    );
    assert.equal(childPct.getPropertyValue('margin-left'), '0px');
    const equalWidths = computed(
      [d('margin-left', 'auto'), d('width', '400px')],
      parentPx,
      { parentElement: {} },
    );
    assert.equal(equalWidths.getPropertyValue('margin-left'), '0px');
    const noParentStyle = computed(
      [d('margin-left', 'auto'), d('width', '100px')],
      null,
      { parentElement: {} },
    );
    assert.equal(noParentStyle.getPropertyValue('margin-left'), '0px');
  });
});

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue min-size, keywords, and colors', () => {
  test('min-width and min-height unique-cause auto preservation vs 0px vs specified', () => {
    // css-sizing-3 § 3.4.2
    const html = `
      <div id="block"></div>
      <div id="aspect" style="aspect-ratio: 1/1"></div>
      <div id="aspect-auto" style="aspect-ratio: auto"></div>
      <div id="aspect-empty" style="aspect-ratio:;"></div>
      <div style="display: flex"><div id="flex"></div></div>
      <div style="display: inline-flex"><div id="inline-flex"></div></div>
      <div style="display: grid"><div id="grid"></div></div>
      <div style="display: inline-grid"><div id="inline-grid"></div></div>
      <div style="display: none"><div id="none" style="aspect-ratio: 1/1"></div></div>
    `;
    const { document } = parseHTML(html);
    const rules = parseStyleSheet('#sized { min-width: 10px; min-height: auto; }');
    assert.equal(getCascadedStyle(document.getElementById('block')).getPropertyValue('min-width'), '0px');
    assert.equal(getCascadedStyle(document.getElementById('aspect')).getPropertyValue('min-width'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('aspect')).getPropertyValue('min-height'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('aspect-auto')).getPropertyValue('min-width'), '0px');
    assert.equal(getCascadedStyle(document.getElementById('aspect-empty')).getPropertyValue('min-width'), '0px');
    assert.equal(getCascadedStyle(document.getElementById('flex')).getPropertyValue('min-width'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('inline-flex')).getPropertyValue('min-width'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('grid')).getPropertyValue('min-width'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('inline-grid')).getPropertyValue('min-width'), 'auto');
    assert.equal(getCascadedStyle(document.getElementById('none')).getPropertyValue('min-width'), '0px');

    const { document: sizedDoc } = parseHTML('<div id="sized"></div>');
    const sized = getCascadedStyle(sizedDoc.getElementById('sized'), rules);
    assert.equal(sized.getPropertyValue('min-width'), '10px');
    assert.equal(sized.getPropertyValue('min-height'), '0px');
    assert.equal(sized.getPropertyValue('minHeight'), '0px');

    const noEl = computed([d('min-width', 'auto')]);
    assert.equal(noEl.getPropertyValue('min-width'), '0px');
    const primitiveEl = computed([d('min-width', 'auto')], null, 1);
    assert.equal(primitiveEl.getPropertyValue('min-width'), '0px');
    const noAttr = computed([d('min-width', 'auto')], null, { parentElement: null });
    assert.equal(noAttr.getPropertyValue('min-width'), '0px');
    const nonObjectParent = computed(
      [d('min-width', 'auto')],
      null,
      { getAttribute: () => null, parentElement: 'not-object' },
    );
    assert.equal(nonObjectParent.getPropertyValue('min-width'), '0px');
  });

  test('inherit, initial, unset, and revert unique-cause parent vs initial/UA fallbacks', () => {
    // css-cascade-5 § 7.3.1 #initial, § 7.3.2 #inherit, § 7.3.3 #unset, § 6.2 #default
    const parent = specified({ color: 'red', visibility: '' });
    assert.equal(computed([d('color', 'inherit')], parent).getPropertyValue('color'), 'red');
    assert.equal(computed([d('color', 'inherit')]).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('visibility', 'inherit')], specified({})).getPropertyValue('visibility'), 'visible');

    assert.equal(computed([d('width', 'initial')]).getPropertyValue('width'), 'auto');
    assert.equal(computed([d('color', 'initial')]).getPropertyValue('color'), 'rgb(0, 0, 0)');

    assert.equal(computed([d('color', 'unset')], parent).getPropertyValue('color'), 'red');
    assert.equal(computed([d('color', 'unset')]).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('color', 'unset')], specified({})).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('width', 'unset')], parent).getPropertyValue('width'), 'auto');

    assert.equal(computed([d('color', 'revert')], parent).getPropertyValue('color'), 'red');
    assert.equal(computed([d('color', 'revert')]).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('width', 'revert')], parent).getPropertyValue('width'), 'auto');
    assert.equal(computed([d('color', 'revert-layer')], parent).getPropertyValue('color'), 'red');
    assert.equal(computed([d('display', 'revert-rule')], null, { tagName: 'DIV' }).getPropertyValue('display'), 'block');
    assert.equal(computed([d('color', 'revert-layer')]).getPropertyValue('color'), 'rgb(0, 0, 0)');
  });

  test('box-shadow normalizes system, named, transparent, and colorless tokens', () => {
    // css-color-4 § 6 #system-colors, § 15 #named-colors
    const red = cascade('<div class="t"></div>', '.t { box-shadow: 2px 2px red; }', '.t');
    assert.equal(red.getPropertyValue('box-shadow'), 'rgb(255, 0, 0) 2px 2px');
    const canvas = cascade('<div class="t"></div>', '.t { box-shadow: 1px 1px Canvas; }', '.t');
    assert.equal(canvas.getPropertyValue('box-shadow'), 'rgb(255, 255, 255) 1px 1px');
    const transparent = cascade('<div class="t"></div>', '.t { box-shadow: 1px 1px transparent; }', '.t');
    assert.equal(transparent.getPropertyValue('box-shadow'), 'rgba(0, 0, 0, 0) 1px 1px');
    const none = cascade('<div class="t"></div>', '.t { box-shadow: 2px 2px 4px; }', '.t');
    assert.equal(none.getPropertyValue('box-shadow'), '2px 2px 4px');
  });

  test('color properties, missing props, !important, and inherited parent values', () => {
    const html = `<div class="parent"><div class="child"></div></div>`;
    const css = `
      .parent { color: lime; }
      .child { color: blue; }
      .imp { color: red !important; }
      .imp { color: blue; }
    `;
    const { document } = parseHTML(html + '<div class="imp"></div>');
    const rules = parseStyleSheet(css);
    const child = getCascadedStyle(document.querySelector('.child'), rules);
    assert.equal(child.getPropertyValue('color'), 'rgb(0, 0, 255)');
    const parentColor = getCascadedStyle(document.querySelector('.parent'), parseStyleSheet('.parent { color: lime; }'));
    const inheritChild = getCascadedStyle(document.querySelector('.child'), parseStyleSheet('.parent { color: lime; }'));
    assert.equal(parentColor.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(inheritChild.getPropertyValue('color'), 'rgb(0, 255, 0)');
    const important = getCascadedStyle(document.querySelector('.imp'), rules);
    assert.equal(important.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const emptyParent = computed([], specified({}));
    assert.equal(emptyParent.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed().getPropertyValue('not-a-prop'), '');
    assert.equal(computed().getPropertyValue('column-width'), '');
    assert.equal(computed().getPropertyValue('caret-color'), '');
    assert.equal(computed().getPropertyValue('font-style'), 'normal');
    assert.equal(computed().getPropertyValue('backgroundColor'), 'rgba(0, 0, 0, 0)');
    assert.equal(computed().getPropertyValue('fill'), 'black');
  });
});

describe('MC/DC: CSSComputedStyleDeclaration.getPropertyValue UA defaults and border/outline keywords', () => {
  test('display and margin UA defaults unique-cause element, tagName, nodeName, and missing tag', () => {
    assert.equal(computed([], null, { tagName: 'DIV' }).getPropertyValue('display'), 'block');
    assert.equal(computed([], null, { nodeName: 'span' }).getPropertyValue('display'), 'inline');
    assert.equal(computed([], null, { tagName: 'BODY' }).getPropertyValue('margin'), '8px');
    assert.equal(computed([], null, { tagName: 'DIV' }).getPropertyValue('margin'), '0px');
    assert.equal(computed([], null, {}).getPropertyValue('margin'), '');
    assert.equal(computed().getPropertyValue('margin'), '');
    assert.equal(computed().getPropertyValue('display'), 'inline');
  });

  test('border/outline width keywords and missing-width style none/hidden/solid unique-cause 0px/1px/3px/5px', () => {
    const thin = cascade('<div class="t"></div>', '.t { outline-width: thin; outline-style: solid; }', '.t');
    assert.equal(thin.getPropertyValue('outline-width'), '1px');
    const thick = cascade('<div class="t"></div>', '.t { border-right-width: thick; border-right-style: solid; }', '.t');
    assert.equal(thick.getPropertyValue('border-right-width'), '5px');
    const zero = cascade('<div class="t"></div>', '.t { border-top-width: 0; border-top-style: solid; }', '.t');
    assert.equal(zero.getPropertyValue('border-top-width'), '0px');
    const mediumSolid = cascade('<div class="t"></div>', '.t { outline-width: medium; outline-style: dotted; }', '.t');
    assert.equal(mediumSolid.getPropertyValue('outline-width'), '3px');
    const mediumHidden = cascade('<div class="t"></div>', '.t { outline-width: medium; outline-style: hidden; }', '.t');
    assert.equal(mediumHidden.getPropertyValue('outline-width'), '0px');
    const mediumNone = cascade('<div class="t"></div>', '.t { border-bottom-width: medium; }', '.t');
    assert.equal(mediumNone.getPropertyValue('border-bottom-width'), '0px');
    const pxWidth = cascade('<div class="t"></div>', '.t { outline-width: 2px; outline-style: solid; }', '.t');
    assert.equal(pxWidth.getPropertyValue('outline-width'), '2px');

    assert.equal(computed([d('outline-style', 'hidden')]).getPropertyValue('outline-width'), '0px');
    assert.equal(computed([d('border-top-style', 'solid')]).getPropertyValue('border-top-width'), '3px');
    assert.equal(computed().getPropertyValue('outline-width'), '0px');
    assert.equal(computed().getPropertyValue('outline-style'), 'none');
    assert.equal(computed().getPropertyValue('border-left-style'), 'none');
    assert.equal(computed().getPropertyValue('outline-color'), 'rgb(0, 0, 0)');
    assert.equal(computed().getPropertyValue('border-top-color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('border-top-style', 'none')]).getPropertyValue('border-top-width'), '0px');
  });
});
