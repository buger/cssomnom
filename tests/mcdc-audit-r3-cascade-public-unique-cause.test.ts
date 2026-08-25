/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// MC/DC audit round 3, cascade component unique-cause legs:
//   - collectSvgPresentationAttributes / collectInlineDeclarations null-element
//     guards and empty SVG attribute values
//     (css-cascade-5 § 3 #cascade-origins, svg-2 § 6.2 #presentation-attributes).
//   - getMatchingSpecificity invalid-selector skip and non-matching complexes
//     (selectors-4 § 4 #specificity-rules).
//   - resolveUrlsInValue empty url() fragment against a base URL
//     (css-values-4 #urls).
//   - alternate-stylesheet title grouping (cssom-1 § 7.2 #alternative-style-sheets).
//   - normalizePseudoElement legacy single-colon alias via getCascadedStyle
//     (css-pseudo-4 #legacy-selectors, cssom-1 #parsing-selectors).
//   - compareLayerOrder / scanLayers layer statement vs block rules
//     (css-cascade-5 § 6.4 #layer-ordering).
//   - getUaDefault / getInitialValue -webkit- prefixed fallbacks
//     (css-cascade-5 § 6.4 #default-values).
//   - normalizeComputedColor non-string / blank / transparent inputs,
//     formatAlpha clamps (css-color-4 § 4 #resolving-color-values, § 15).
//   - CSSStyleDeclaration important-replacement, css-wide shorthand getters,
//     winning-declaration priority flips, cssText contraction arms
//     (cssom-1 § 6.6 #dom-cssstyledeclaration).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  collectSvgPresentationAttributes,
  collectInlineDeclarations,
  getMatchingSpecificity,
} from '../src/cascade/rule-filter.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { getUaDefault, getInitialValue } from '../src/cascade/value-processor.ts';
import { normalizeComputedColor, formatAlpha } from '../src/cascade/color-resolver.ts';
import { compareLayerOrder, getLayerDeclarationOrder } from '../src/cascade/layer-manager.ts';

function target(html: string, selector = '.t') {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  return el;
}

function pv(el: unknown, prop: string): string {
  const style = getCascadedStyle(el);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

describe('MC/DC round 3: cascade unique-cause legs', () => {

  // svg-2 § 6.2: presentation attributes ride at UA level; a null element or
  // an empty attribute value contributes nothing.
  test('collectSvgPresentationAttributes null element and empty value legs', () => {
    assert.deepEqual(collectSvgPresentationAttributes(null, 0), []);
    assert.deepEqual(collectSvgPresentationAttributes(undefined, 3), []);
    const empty = { getAttribute: (n: string) => (n === 'fill' ? '' : null) };
    assert.deepEqual(collectSvgPresentationAttributes(empty, 0), []);
    const filled = { getAttribute: (n: string) => (n === 'fill' ? 'red' : null) };
    const decls = collectSvgPresentationAttributes(filled, 0);
    assert.equal(decls.length, 1);
    assert.equal(decls[0].name, 'fill');
    assert.equal(decls[0].value, 'red');
  });

  // css-cascade-5 § 6.2: inline style attribute collection tolerates a null
  // element (no declarations) while the style-attribute string form parses.
  test('collectInlineDeclarations null element leg', () => {
    assert.deepEqual(collectInlineDeclarations(null, 5).declarations, []);
    assert.equal(collectInlineDeclarations(null, 5).nextSourceOrder, 5);
    const viaString = collectInlineDeclarations(
      { getAttribute: (n: string) => (n === 'style' ? 'color: red' : null) } as unknown as Element,
      0
    );
    assert.equal(viaString.declarations.length, 1);
    assert.equal(viaString.declarations[0].name, 'color');
  });

  // selectors-4 § 4: invalid complexes are skipped, non-matching complexes do
  // not contribute specificity, matching ones do.
  test('getMatchingSpecificity invalid-selector and match-failure legs', () => {
    const el = target('<html><body><p class="t"></p></body></html>', 'p');
    assert.deepEqual(getMatchingSpecificity(el, 'p, <'), [0, 0, 1]);
    assert.deepEqual(getMatchingSpecificity(el, '.t'), [0, 1, 0]);
    assert.deepEqual(getMatchingSpecificity(el, 'div.t'), [0, 0, 0]);
    assert.deepEqual(getMatchingSpecificity(el, '.nope'), [0, 0, 0]);
  });

  // css-values-4 #urls: an empty url() against a document base stays empty;
  // relative url() resolves against the base.
  test('resolveUrlsInValue empty-url and base-resolved legs', () => {
    const html = `<html><head><style>
      .t { background-image: url(); list-style-image: url(a.png) }
    </style></head><body><div class="t"></div></body></html>`;
    const el = target(html);
    const doc = (el as { ownerDocument?: object }).ownerDocument!;
    const prev = Object.getOwnPropertyDescriptor(doc, 'baseURI');
    Object.defineProperty(doc, 'baseURI', {
      configurable: true,
      value: 'https://r3.example/dir/page.html',
    });
    try {
      assert.equal(pv(el, 'background-image'), 'url("")');
      assert.equal(pv(el, 'list-style-image'), 'url("https://r3.example/dir/a.png")');
    } finally {
      if (prev) Object.defineProperty(doc, 'baseURI', prev);
      else delete (doc as { baseURI?: string }).baseURI;
    }
  });

  // cssom-1 § 7.2: sheets carrying both a title and rel=alternate belong to
  // the preferred-title group instead of enabling unconditionally.
  test('titled alternate stylesheet follows preferred-title group', () => {
    const makeSheet = (title: string | null, rel: string | null) => ({
      disabled: false,
      ownerNode: {
        getAttribute: (attr: string) =>
          attr === 'title' ? title : attr === 'rel' ? rel : null,
      },
      cssRules: [],
    });
    const el = {
      nodeType: 1,
      isConnected: true,
      localName: 'div',
      tagName: 'DIV',
      ownerDocument: {
        styleSheets: [
          makeSheet('main', 'stylesheet'),
          makeSheet('fancy', 'alternate stylesheet'),
          makeSheet(null, 'alternate stylesheet'),
        ],
      },
    };
    const style = getCascadedStyle(el);
    assert.ok(style instanceof CSSStyleDeclaration);
    assert.equal(style.length, 0);
  });

  // css-pseudo-4 #legacy-selectors: ':before' normalizes to '::before' when
  // resolving pseudo-element styles.
  test('legacy single-colon pseudo alias via getCascadedStyle', () => {
    const html = `<html><head><style>
      .t::before { content: "x"; color: red }
    </style></head><body><div class="t"></div></body></html>`;
    const el = target(html);
    const before = getCascadedStyle(el, undefined, ':before');
    assert.ok(before instanceof CSSStyleDeclaration);
    assert.equal(before.getPropertyValue('content'), '"x"');
    const after = getCascadedStyle(el, undefined, '::after');
    assert.ok(after instanceof CSSStyleDeclaration);
  });

  // css-cascade-5 § 6.4 #layer-ordering: statement rules register declaration
  // order only; block rules register and recurse into their children.
  // compareLayerOrder inverts under !important per § 6.4.
  test('layer statement/block scan and compareLayerOrder arms', () => {
    assert.equal(compareLayerOrder(2, 2, false), 0);
    assert.equal(compareLayerOrder(2, 2, true), 0);
    assert.equal(compareLayerOrder(1, 2, false), -1);
    assert.equal(compareLayerOrder(2, 1, false), 1);
    assert.equal(compareLayerOrder(1, 2, true), 1);
    assert.equal(compareLayerOrder(2, 1, true), -1);

    const statement = {
      type: 'at-rule',
      name: 'layer',
      block: false,
      nameList: ['x'],
    };
    const block = {
      type: 'at-rule',
      name: 'layer',
      block: true,
      value: [
        { type: 'qualified-rule', prelude: [], value: [] },
      ],
    };
    const order = getLayerDeclarationOrder([statement, block] as never);
    assert.equal(order.has('x'), true);
    assert.equal(order.has('layer'), true);
  });

  // css-cascade-5 § 6.4: UA defaults fall back through the -webkit- prefix
  // strip to the unprefixed table entry, or miss entirely.
  test('getUaDefault/getInitialValue -webkit fallback hit and miss', () => {
    assert.equal(getUaDefault('-webkit-border-radius', {}), getUaDefault('border-radius', {}));
    assert.equal(getUaDefault('-webkit-not-a-real-property', {}), '');
    assert.equal(getInitialValue('-webkit-text-stroke-width', {}), '0px');
    assert.equal(getInitialValue('-webkit-definitely-not-a-property', {}), '');
    assert.notEqual(getInitialValue('color', {}), '');
  });

  // css-color-4 § 15/§ 4: named colors with explicit sub-unity alpha re-emit
  // rgba(); junk types and blank strings are rejected; formatAlpha clamps at
  // both ends.
  test('normalizeComputedColor/formatAlpha input arms', () => {
    assert.equal(normalizeComputedColor(42 as unknown as string), '');
    assert.equal(normalizeComputedColor(null as unknown as string), '');
    assert.equal(normalizeComputedColor('   '), '');
    assert.equal(normalizeComputedColor('transparent'), 'rgba(0, 0, 0, 0)');
    assert.equal(normalizeComputedColor('red'), 'rgb(255, 0, 0)');
    assert.equal(formatAlpha(1), '1');
    assert.equal(formatAlpha(0), '0');
    assert.equal(formatAlpha(0.5), '0.5');
  });

  // cssom-1 § 6.6.1: within one declaration block, a shorthand expansion
  // cannot overwrite a longhand that carries !important.
  test('_addDeclaration keeps existing important longhand over expansion', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'border-top-color: red !important; border-top: 1px solid blue;';
    assert.equal(style.getPropertyValue('border-top-color'), 'red');
    assert.equal(style.getPropertyPriority('border-top-color'), 'important');
    assert.notEqual(style.getPropertyValue('border-top-width'), '');

    const replaced = new CSSStyleDeclaration();
    replaced.cssText = 'border-top-color: red; border-top: 1px solid blue;';
    assert.equal(replaced.getPropertyValue('border-top-color'), 'blue');
  });

  // cssom-1 § 6.6.2/#dom-cssstyledeclaration-getpropertypriority: a shorthand
  // whose longhands all share one CSS-wide keyword reads back that keyword.
  test('shorthand getter returns shared css-wide keyword', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin', 'inherit');
    assert.equal(style.getPropertyValue('margin'), 'inherit');
    assert.equal(style.getPropertyPriority('margin'), '');
    const fresh = new CSSStyleDeclaration();
    assert.equal(fresh.getPropertyValue('margin'), '');
  });

  // css-cascade-5 § 6.3/§ 6.2: important flags flip the winning declaration
  // whether arriving before or after the competitor.
  test('winning-declaration importance flips', () => {
    const lateImportant = new CSSStyleDeclaration();
    lateImportant.setProperty('color', 'blue');
    lateImportant.setProperty('color', 'red', 'important');
    assert.equal(lateImportant.getPropertyValue('color'), 'red');
    assert.equal(lateImportant.getPropertyPriority('color'), 'important');

    const shorthandImportant = new CSSStyleDeclaration();
    shorthandImportant.setProperty('margin', '1px');
    shorthandImportant.setProperty('margin-left', '2px !important');
    assert.equal(shorthandImportant.getPropertyValue('margin-left'), '2px !important');

    // An important shorthand suppresses a later non-important longhand for
    // the synthesized shorthand getter (css-cascade-5 § 6.3 #importance).
    const exactAfterShorthand = new CSSStyleDeclaration();
    exactAfterShorthand.setProperty('margin', '1px !important');
    exactAfterShorthand.setProperty('margin-left', '2px');
    assert.equal(exactAfterShorthand.getPropertyValue('margin'), '');
    assert.equal(exactAfterShorthand.getPropertyValue('margin-left'), '2px');
  });

  // cssom-1 § 6.6.1 #dom-cssstyledeclaration-csstext: contractable longhand
  // sets serialize through the shorthand; a var() shorthand is stored raw
  // (no expansion) and reads back unexpanded.
  test('cssText contraction and passthrough arms', () => {
    const contractible = new CSSStyleDeclaration();
    contractible.cssText = 'margin-top: 4px; margin-right: 4px; margin-bottom: 4px; margin-left: 4px;';
    assert.ok(contractible.cssText.includes('margin'));

    const spread = new CSSStyleDeclaration();
    spread.cssText = 'margin-top: 1px; margin-right: 2px; margin-bottom: 3px; margin-left: 4px;';
    assert.ok(spread.cssText.includes('1px 2px 3px 4px'));

    const raw = new CSSStyleDeclaration();
    raw.cssText = 'margin: var(--gap);';
    assert.ok(raw.cssText.includes('var(--gap)'));
  });
});
