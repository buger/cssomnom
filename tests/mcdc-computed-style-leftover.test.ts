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
// Leftover unique-cause for src/cascade/computed-style.ts not already in
// tests/mcdc-computed-style.test.ts. Drive CSSComputedStyleDeclaration
// getPropertyValue / cssText / setProperty / removeProperty,
// shouldPreserveAutoMinSize, and getCascadedStyle.
// cssom-1 § 6.8 #resolved-values / § 6.4.3 #the-cssstyledeclaration-interface,
// css-cascade-5 § 7.2 #computed-values / § 7.3 / § 6.2 #default,
// css-logical-1 § 2 #logical-prop-mapping, css-sizing-3 § 3.4.2,
// CSS 2.1 § 10.3.3, css-color-4 § 6 #system-colors / § 15 #named-colors.
// No //mcdc:ignore.
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import {
  CSSComputedStyleDeclaration,
  getCascadedStyle,
  shouldPreserveAutoMinSize,
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

function minAuto(element: unknown): string {
  return computed([d('min-width', 'auto')], null, element).getPropertyValue('min-width');
}

function cascadeHtml(html: string, css: string, selector = '.t'): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  return getCascadedStyle(el, parseStyleSheet(css));
}

function assertReadonly(style: CSSComputedStyleDeclaration): void {
  assert.equal(style.cssText, '');
  assert.equal(style.parentRule, null);
  assert.throws(
    () => {
      style.cssText = 'color: red';
    },
    (err: unknown) => err instanceof DOMException && err.name === 'NoModificationAllowedError',
  );
  assert.throws(
    () => {
      style.setProperty('color', 'red');
    },
    (err: unknown) => err instanceof DOMException && err.name === 'NoModificationAllowedError',
  );
  assert.throws(
    () => {
      style.removeProperty('color');
    },
    (err: unknown) => err instanceof DOMException && err.name === 'NoModificationAllowedError',
  );
}

describe('MC/DC leftover unique-cause: computed style read-only (cssom-1 § 6.4.3)', () => {
  test('cssText empty; setProperty/removeProperty/cssText throw even when readonlyFlag is false', () => {
    const locked = computed([d('color', 'blue')]);
    assertReadonly(locked);
    assert.equal(locked.getPropertyValue('color'), 'rgb(0, 0, 255)');

    const writableFlag = new CSSComputedStyleDeclaration([d('color', 'lime')], false);
    assertReadonly(writableFlag);
    assert.equal(writableFlag.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const defaults = new CSSComputedStyleDeclaration();
    assertReadonly(defaults);
    assert.equal(defaults.getPropertyValue('color'), 'rgb(0, 0, 0)');
  });
});

describe('MC/DC leftover unique-cause: shouldPreserveAutoMinSize (css-sizing-3 § 3.4.2)', () => {
  test('!element / typeof object leftover unique-cause of null vs function vs array', () => {
    // Unique-cause: !element T (null / undefined / 0 / false / '').
    assert.equal(shouldPreserveAutoMinSize(null), false);
    assert.equal(shouldPreserveAutoMinSize(undefined), false);
    assert.equal(shouldPreserveAutoMinSize(0), false);
    assert.equal(shouldPreserveAutoMinSize(false), false);
    assert.equal(shouldPreserveAutoMinSize(''), false);
    // Unique-cause: !element F, typeof !== 'object' T (function / symbol).
    assert.equal(shouldPreserveAutoMinSize(() => 0), false);
    assert.equal(shouldPreserveAutoMinSize(Symbol('el')), false);
    // Unique-cause: both F (array / object continue into the walk).
    assert.equal(shouldPreserveAutoMinSize([]), false);
    assert.equal(minAuto(null), '0px');
    assert.equal(minAuto(() => 0), '0px');
  });

  test('display:none regex unique-cause of styleAttr, ancestor walk, parentElement vs parentNode', () => {
    // Unique-cause: styleAttr T, /display\s*:\s*none\b/ F (not in mcdc-computed-style).
    const styledBlock = {
      getAttribute: (attr: string) => (attr === 'style' ? 'color: red; display: block' : null),
      parentElement: null,
    };
    assert.equal(shouldPreserveAutoMinSize(styledBlock), false);
    assert.equal(minAuto(styledBlock), '0px');

    // Unique-cause: display:none on self vs word-boundary miss vs ancestor via parentNode.
    const noneSelf = { getAttribute: () => 'display:none', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(noneSelf), false);
    const noneish = { getAttribute: () => 'display: noneish', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(noneish), false);
    const viaParentNode = {
      getAttribute: () => null,
      parentElement: null,
      parentNode: { getAttribute: () => 'DISPLAY: NONE', parentElement: null },
    };
    assert.equal(shouldPreserveAutoMinSize(viaParentNode), false);
    assert.equal(minAuto(viaParentNode), '0px');

    // Unique-cause: grandparent display:none after a non-none parent; missing getAttribute.
    const grand = {
      getAttribute: () => 'aspect-ratio: 1/1',
      parentElement: {
        parentNode: { getAttribute: () => 'display: none' },
      },
    };
    assert.equal(shouldPreserveAutoMinSize(grand), false);

    const noGetter = { parentElement: { getAttribute: () => 'display: none' } };
    assert.equal(shouldPreserveAutoMinSize(noGetter), false);
  });

  test('aspect-ratio leftover unique-cause of regex F, whitespace-only val !== "", and none/0', () => {
    // Unique-cause: styleAttr T && /aspect-ratio\s*:/ F (hotspot line 66).
    const noAspect = {
      getAttribute: () => 'color: red; display: block',
      parentElement: null,
    };
    assert.equal(shouldPreserveAutoMinSize(noAspect), false);
    assert.equal(minAuto(noAspect), '0px');

    // Unique-cause: val !== 'auto' T && val !== '' F (hotspot line 70; whitespace-only).
    const wsOnly = {
      getAttribute: () => 'aspect-ratio:   ; color: red',
      parentElement: null,
    };
    assert.equal(shouldPreserveAutoMinSize(wsOnly), false);
    assert.equal(minAuto(wsOnly), '0px');

    // Unique-cause: match F after aspect-ratio: with no capture (`[^;]+` fails).
    const bareColon = { getAttribute: () => 'aspect-ratio:', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(bareColon), false);

    // Unique-cause: val !== 'auto' T && val !== '' T leftover keywords (`none` / `0` / mixed case).
    const none = { getAttribute: () => 'aspect-ratio: none', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(none), true);
    assert.equal(minAuto(none), 'auto');
    const zero = { getAttribute: () => 'ASPECT-RATIO: 0', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(zero), true);
    const ratio = { getAttribute: () => 'aspect-ratio:16/9', parentElement: null };
    assert.equal(shouldPreserveAutoMinSize(ratio), true);
  });

  test('flex/grid parent leftover unique-cause of pStyle F vs regex F vs inline- vs word-boundary', () => {
    // Unique-cause: parent object T, pStyle F (missing getAttribute / empty / null).
    const noParentStyle = { getAttribute: () => null, parentElement: {} };
    assert.equal(shouldPreserveAutoMinSize(noParentStyle), false);
    const emptyParentStyle = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => '' },
    };
    assert.equal(shouldPreserveAutoMinSize(emptyParentStyle), false);
    const nullParentStyle = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => null },
    };
    assert.equal(shouldPreserveAutoMinSize(nullParentStyle), false);

    // Unique-cause: pStyle T, flex/grid regex F (hotspot line 84).
    const blockParent = {
      getAttribute: () => 'color: red',
      parentElement: { getAttribute: () => 'display: block; color: navy' },
    };
    assert.equal(shouldPreserveAutoMinSize(blockParent), false);
    assert.equal(minAuto(blockParent), '0px');
    const inlineParent = {
      getAttribute: () => null,
      parentNode: { getAttribute: () => 'display: inline' },
    };
    assert.equal(shouldPreserveAutoMinSize(inlineParent), false);
    const flexbox = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => 'display: flexbox' },
    };
    assert.equal(shouldPreserveAutoMinSize(flexbox), false);

    // Unique-cause: (?:inline-)? T/F and (?:flex|grid) T leftover mixed-case / no-space / grid-template `\b`.
    const flexTight = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => 'display:flex' },
    };
    assert.equal(shouldPreserveAutoMinSize(flexTight), true);
    assert.equal(minAuto(flexTight), 'auto');
    const gridCase = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => 'DISPLAY : GRID' },
    };
    assert.equal(shouldPreserveAutoMinSize(gridCase), true);
    const gridTemplate = {
      getAttribute: () => null,
      parentElement: { getAttribute: () => 'display: grid-template' },
    };
    assert.equal(shouldPreserveAutoMinSize(gridTemplate), true);

    // Unique-cause: parent typeof object F (parentElement primitive, parentNode object).
    const primitiveThenNode = {
      getAttribute: () => null,
      parentElement: 0,
      parentNode: { getAttribute: () => 'display: flex' },
    };
    assert.equal(shouldPreserveAutoMinSize(primitiveThenNode), true);
  });
});

describe('MC/DC leftover unique-cause: custom and logical getPropertyValue', () => {
  test('custom-property leftover unique-cause of raw 0 vs serialize vs name miss', () => {
    // css-variables-1 § 4.2 #serializing-custom-props
    const rawZero = computed([d('--zero', '1', { raw: '0' })]);
    assert.equal(rawZero.getPropertyValue('--zero'), '0');
    assert.equal(rawZero.getPropertyValue('--missing'), '');
    assert.equal(rawZero.getPropertyValue('---'), '');
    const serZero = computed([d('--zero', '0')]);
    assert.equal(serZero.getPropertyValue('--zero'), '0');
    const commentRaw = computed([d('--c', 'x', { raw: ' /*x*/ ' })]);
    assert.equal(commentRaw.getPropertyValue('--c'), '/*x*/');
  });

  test('logical remap leftover unique-cause of vertical-lr, empty wm/dir, and more names', () => {
    // css-logical-1 § 2 #logical-prop-mapping
    const vlr = cascadeHtml(
      '<div class="t"></div>',
      '.t { writing-mode: vertical-lr; direction: ltr; margin-inline-start: 9px; inset-block-start: 3px; }',
    );
    assert.equal(vlr.getPropertyValue('writing-mode'), 'vertical-lr');
    assert.equal(vlr.getPropertyValue('margin-inline-start'), '9px');
    assert.equal(vlr.getPropertyValue('margin-top'), '9px');
    assert.equal(vlr.getPropertyValue('inset-block-start'), '3px');
    assert.equal(vlr.getPropertyValue('left'), '3px');

    // Unique-cause: writing-mode/direction || fallback F (empty) vs specified T.
    // Logical getters remap to physical longhands stored on the declaration.
    const emptyWm = computed([d('margin-right', '6px')]);
    assert.equal(emptyWm.getPropertyValue('margin-inline-end'), '6px');
    assert.equal(emptyWm.getPropertyValue('marginInlineEnd'), '6px');
    const specifiedWm = computed([d('margin-right', '6px'), d('writing-mode', 'horizontal-tb'), d('direction', 'ltr')]);
    assert.equal(specifiedWm.getPropertyValue('margin-inline-end'), '6px');

    const pad = computed([d('padding-right', '2px'), d('height', '10px')]);
    assert.equal(pad.getPropertyValue('padding-inline-end'), '2px');
    assert.equal(pad.getPropertyValue('block-size'), '10px');
    assert.equal(pad.getPropertyValue('paddingInlineEnd'), '2px');
  });
});

describe('MC/DC leftover unique-cause: border mixed sides and offset/margin leftovers', () => {
  test('border unique-cause of top === right F; leftover side synthesis specified vs empty', () => {
    // cssom-1 § 6.2 & § 6.4.3
    const topRightDiff = cascadeHtml(
      '<div class="t"></div>',
      '.t { border-top: 1px solid red; border-right: 2px solid red; border-bottom: 1px solid red; border-left: 1px solid red; }',
    );
    assert.equal(topRightDiff.getPropertyValue('border-top'), '1px solid rgb(255, 0, 0)');
    assert.equal(topRightDiff.getPropertyValue('border-right'), '2px solid rgb(255, 0, 0)');
    assert.equal(topRightDiff.getPropertyValue('border'), '');

    const onlyTop = computed([d('border-top-width', '4px'), d('border-top-style', 'dashed')]);
    assert.equal(onlyTop.getPropertyValue('border-top'), '4px dashed rgb(0, 0, 0)');
    assert.equal(onlyTop.getPropertyValue('border-right'), '0px none rgb(0, 0, 0)');
  });

  test('left/right/top/bottom leftover unique-cause of !direct, sticky, fixed, and missing position', () => {
    // cssom-1 § 6.8 #resolved-values
    assert.equal(computed().getPropertyValue('left'), 'auto');
    assert.equal(computed().getPropertyValue('right'), 'auto');
    assert.equal(computed().getPropertyValue('top'), 'auto');
    assert.equal(computed().getPropertyValue('bottom'), 'auto');

    const sticky = computed([d('left', 'auto'), d('position', 'sticky')]);
    assert.equal(sticky.getPropertyValue('left'), 'auto');
    const fixed = computed([d('top', 'auto'), d('position', 'fixed')]);
    assert.equal(fixed.getPropertyValue('top'), 'auto');
    const emptyPos = computed([d('right', 'auto')]);
    assert.equal(emptyPos.getPropertyValue('right'), 'auto');
    const used = computed([d('bottom', '8em')]);
    assert.equal(used.getPropertyValue('bottom'), '8em');
  });

  test('margin-bottom auto unique-cause; leftover some() auto vs winning 10px', () => {
    // cssom-1 § 6.8 & CSS 2.1 § 10.3.3
    assert.equal(computed([d('margin-bottom', 'auto')]).getPropertyValue('margin-bottom'), '0px');
    assert.equal(computed([d('margin-top', '5px')]).getPropertyValue('margin-top'), '5px');

    const parentPx = specified({ width: '400px' });
    const el = { parentElement: {} };
    // Unique-cause: getPropertyValue('margin-left') F, declarations.some name+serialize auto T.
    // Constructor _addDeclaration replaces same-name winners; the public declarations list
    // is the array some() walks.
    const leftoverAuto = computed(
      [d('margin-right', 'auto'), d('width', '100px')],
      parentPx,
      el,
    );
    leftoverAuto.declarations.push(d('margin-left', 'auto'));
    leftoverAuto.declarations.push(d('margin-left', '10px'));
    assert.equal(leftoverAuto.getPropertyValue('margin-left'), '10px');
    assert.equal(leftoverAuto.getPropertyValue('margin-right'), '150px');

    // Unique-cause: some() name === 'margin-left' F (margin-top: auto does not set leftAuto).
    const topAuto = computed(
      [d('margin-top', 'auto'), d('margin-right', 'auto'), d('width', '100px')],
      parentPx,
      el,
    );
    assert.equal(topAuto.getPropertyValue('margin-right'), '300px');
    assert.equal(topAuto.getPropertyValue('margin-top'), '0px');

    // Unique-cause: pw/ew endsWith('px') T via 'px' without digits → parseFloat NaN, >= F.
    const nanPx = computed(
      [d('margin-left', 'auto'), d('width', 'px')],
      specified({ width: 'px' }),
      el,
    );
    assert.equal(nanPx.getPropertyValue('margin-left'), '0px');
    const emWidth = computed(
      [d('margin-right', 'auto'), d('width', '10em')],
      specified({ width: '10em' }),
      el,
    );
    assert.equal(emWidth.getPropertyValue('margin-right'), '0px');
    const upperPx = computed(
      [d('margin-left', 'auto'), d('width', '100PX')],
      specified({ width: '400PX' }),
      el,
    );
    assert.equal(upperPx.getPropertyValue('margin-left'), '0px');
  });
});

describe('MC/DC leftover unique-cause: revert parentVal F, colors, UA, SVG', () => {
  test('revert/revert-layer/revert-rule leftover unique-cause of parentVal F with inherited parent', () => {
    // css-cascade-5 § 6.2 #default — hotspot line 293: parentVal F.
    const emptyParent = specified({});
    assert.equal(computed([d('color', 'revert')], emptyParent).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('color', 'revert-layer')], emptyParent).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('color', 'revert-rule')], emptyParent).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('visibility', 'revert')], emptyParent).getPropertyValue('visibility'), 'visible');
    assert.equal(computed([d('font-size', 'revert-layer')], emptyParent).getPropertyValue('font-size'), '16px');
    assert.equal(computed([d('width', 'revert')], emptyParent).getPropertyValue('width'), 'auto');

    const visParent = specified({ visibility: '' });
    assert.equal(computed([d('visibility', 'unset')], visParent).getPropertyValue('visibility'), 'visible');
    assert.equal(computed([d('font-size', 'inherit')], specified({ 'font-size': '20px' })).getPropertyValue('font-size'), '20px');
  });

  test('box-shadow leftover system/currentcolor/inset/rgba; COLOR_PROPERTIES leftover longhands', () => {
    // css-color-4 § 6 #system-colors, § 15 #named-colors
    const canvasText = cascadeHtml('<div class="t"></div>', '.t { box-shadow: 1px 1px CanvasText; }');
    assert.equal(canvasText.getPropertyValue('box-shadow'), 'rgb(0, 0, 0) 1px 1px');
    const button = cascadeHtml('<div class="t"></div>', '.t { box-shadow: 2px 2px ButtonFace inset; }');
    assert.equal(button.getPropertyValue('box-shadow'), 'rgb(240, 240, 240) 2px 2px inset');
    const current = computed([d('box-shadow', 'currentcolor 1px 1px')]);
    assert.equal(current.getPropertyValue('box-shadow'), 'currentcolor 1px 1px');
    const alreadyRgb = computed([d('box-shadow', 'rgba(1, 2, 3, 0.5) 4px 4px')]);
    assert.equal(alreadyRgb.getPropertyValue('box-shadow'), 'rgba(1, 2, 3, 0.5) 4px 4px');
    const mixed = computed([d('box-shadow', 'RED 1px 2px')]);
    assert.equal(mixed.getPropertyValue('box-shadow'), 'rgb(255, 0, 0) 1px 2px');

    assert.equal(computed([d('caret-color', 'red')]).getPropertyValue('caret-color'), 'rgb(255, 0, 0)');
    assert.equal(computed([d('flood-color', 'lime')]).getPropertyValue('flood-color'), 'rgb(0, 255, 0)');
    assert.equal(computed([d('column-rule-color', 'blue')]).getPropertyValue('column-rule-color'), 'rgb(0, 0, 255)');
    assert.equal(computed([d('text-emphasis-color', 'navy')]).getPropertyValue('text-emphasis-color'), 'rgb(0, 0, 128)');
    assert.equal(computed().getPropertyValue('flood-color'), 'black');
  });

  test('border-image-width medium leftover; missing-width style; SVG ?? empty vs default', () => {
    const imgMed = computed([d('border-image-width', 'medium'), d('border-image-style', 'solid')]);
    assert.equal(imgMed.getPropertyValue('border-image-width'), '3px');
    const imgNone = computed([d('border-image-width', 'medium')]);
    assert.equal(imgNone.getPropertyValue('border-image-width'), '0px');
    const imgMissing = computed([d('border-image-style', 'dotted')]);
    assert.equal(imgMissing.getPropertyValue('border-image-width'), '3px');

    assert.equal(computed([d('column-width', '10px')]).getPropertyValue('column-width'), '10px');
    assert.equal(computed().getPropertyValue('column-width'), '');
    assert.equal(computed([d('min-width', 'min-content')]).getPropertyValue('min-width'), 'min-content');
    assert.equal(computed([d('outline-width', 'thin'), d('outline-style', 'dashed')]).getPropertyValue('outline-width'), '1px');
    assert.equal(computed([d('border-left-width', 'thick'), d('border-left-style', 'inset')]).getPropertyValue('border-left-width'), '5px');
    assert.equal(computed([d('border-right-style', 'groove')]).getPropertyValue('border-right-width'), '3px');
    assert.equal(computed().getPropertyValue('list-style'), '');

    // Unique-cause: SVG_PRESENTATION_ATTRIBUTES T, DEFAULT_PROPERTY_VALUES ?? '' (missing key).
    assert.equal(computed().getPropertyValue('kerning'), '');
    assert.equal(computed().getPropertyValue('mask'), '');
    assert.equal(computed().getPropertyValue('color-rendering'), '');
    assert.equal(computed().getPropertyValue('glyph-orientation-horizontal'), '');
    assert.equal(computed().getPropertyValue('text-decoration'), '');
    // Unique-cause: SVG T, default present.
    assert.equal(computed().getPropertyValue('fill-opacity'), '1');
    assert.equal(computed().getPropertyValue('stroke-opacity'), '1');
    assert.equal(computed().getPropertyValue('clip-rule'), 'nonzero');
  });

  test('UA display/margin leftover unique-cause of empty tagName vs nodeName BODY/SPAN', () => {
    assert.equal(computed([], null, { tagName: '', nodeName: 'BODY' }).getPropertyValue('margin'), '8px');
    assert.equal(computed([], null, { tagName: '', nodeName: 'body' }).getPropertyValue('display'), 'block');
    assert.equal(computed([], null, { tagName: 'SPAN' }).getPropertyValue('display'), 'inline');
    assert.equal(computed([], null, { tagName: 'P' }).getPropertyValue('display'), 'block');
    assert.equal(computed([], null, { nodeName: 'BODY' }).getPropertyValue('margin'), '8px');
    assert.equal(computed([], null, {}).getPropertyValue('display'), 'inline');
    assert.equal(computed([], null, { tagName: 'DIV' }).getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(computed([d('background-clip', 'content-box')]).getPropertyValue('background-clip'), 'content-box');
  });
});
