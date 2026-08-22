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
// Still-hot unique-cause for src/cascade/rule-filter.ts leftovers that
// tests/mcdc-collect-stylesheets-leftover.test.ts does not isolate:
// addSheetRules (typeof textContent === "string" && trim !== ""),
// getRuleBaseURL (element && typeof === "object", href / baseURI /
// CSSImportRule parent sheet URL), recurse L723 simple.argument shapes.
// Drive only through getCascadedStyle (omit the rules argument so collection
// walks document / shadow sheets). css-cascade-5 § 2 #filtering,
// cssom-1 § 6.1 #the-cssstylesheet-interface / § 6.4.3 #dom-cssimportrule-href /
// § 7.3 #the-document-or-shadow-root-interface, css-values-4 #urls,
// css-nesting-1 § 4 #nesting-selector, selectors-4 :is() / :not() / :has().
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSImportRule, CSSStyleSheet } from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function zSheet(n: number): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(`.t { z-index: ${n}; }`);
  return sheet;
}

function urlSheet(css: string, extra?: { baseURL?: string; href?: string }): CSSStyleSheet {
  const sheet = extra?.baseURL ? new CSSStyleSheet({ baseURL: extra.baseURL }) : new CSSStyleSheet();
  sheet.replaceSync(css);
  if (extra?.href !== undefined) {
    Object.defineProperty(sheet, 'href', { configurable: true, get() { return extra.href; } });
  }
  return sheet;
}

function host(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    isConnected: true,
    ...extra,
  };
}

function pv(element: unknown, prop: string): string {
  const style = getCascadedStyle(element);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

function target(html: string, selector = '.t'): Element {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el);
  return el;
}

describe('MC/DC still-hot unique-cause: rule-filter addSheetRules / getRuleBaseURL / recurse', { concurrency: false }, () => {
  // css-cascade-5 § 2 #filtering, cssom-1 § 6.1 / § 7.3
  // linkedom document.styleSheets is missing, so collection uses querySelectorAll('style').
  // Simple <style> has .sheet.cssRules (addSheetRules recurse). @layer/nesting makes
  // linkedom style.sheet throw, then L174 typeof string && trim !== "" parses textContent.
  test('linkedom style/link/empty/comment/whitespace/inline unique-cause via document walk', () => {
    const el = target(`<html><head>
      <link rel="stylesheet" href="https://example.com/missing.css">
      <style></style>
      <style>   </style>
      <style>/* comment only */</style>
      <style>.t { z-index: 3; order: 1; }</style>
      <style>@layer a { .t { z-index: 4; } }</style>
    </head><body><div class="t" style="cursor: pointer"></div></body></html>`);

    assert.equal(pv(el, 'z-index'), '3', 'unlayered style.cssRules wins over @layer textContent parse');
    assert.equal(pv(el, 'order'), '1');
    assert.equal(pv(el, 'cursor'), 'pointer', 'style= attribute still collected when rules omitted');

    const emptyOnly = target(`<html><head>
      <style></style>
      <style>   \n\t</style>
      <style>/* comment only */</style>
      <link rel="stylesheet" href="https://example.com/x.css">
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(emptyOnly, 'z-index'), '', 'empty/whitespace/comment-only/link-without-sheet add no rules');

    const layerOnly = target(`<html><head>
      <style>@layer a { .t { z-index: 8; } }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(layerOnly, 'z-index'), '8', 'linkedom sheet throw unique-cause falls through to L174 parse');
  });

  test('addSheetRules string vs CSSStyleSheet vs element textContent unique-cause', () => {
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [zSheet(21)] }) }), 'z-index'),
      '21',
    );
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: ['.t { z-index: 22; }'] }) }), 'z-index'),
      '',
      'string sheet has no cssRules/textContent so L174 typeof string is F',
    );
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [{ textContent: '.t { z-index: 23; }' }] }) }), 'z-index'),
      '23',
    );

    const mixed = host({
      getRootNode: () => ({
        styleSheets: [
          '.t { z-index: 1; }',
          zSheet(24),
          { textContent: '.t { z-index: 25; }' },
        ],
      }),
    });
    assert.equal(pv(mixed, 'z-index'), '25', 'later element textContent still parses after CSSStyleSheet cssRules');
  });

  test('addSheetRules textContent typeof string and trim unique-cause', () => {
    const viaQuery = (items: unknown[]) => host({
      getRootNode: () => ({
        styleSheets: [],
        querySelectorAll: () => items,
      }),
    });

    assert.equal(pv(viaQuery([{ textContent: '.t { z-index: 31; }' }]), 'z-index'), '31');
    assert.equal(pv(viaQuery([{ textContent: '  .t { z-index: 32; }  ' }]), 'z-index'), '32', 'trim T after surrounding whitespace');
    assert.equal(pv(viaQuery([{ textContent: '' }]), 'z-index'), '', 'typeof T trim F empty');
    assert.equal(pv(viaQuery([{ textContent: ' \n\t ' }]), 'z-index'), '', 'typeof T trim F whitespace');
    assert.equal(pv(viaQuery([{ textContent: '/* only comment */' }]), 'z-index'), '', 'typeof T trim T but no style rule');
    assert.equal(pv(viaQuery([{ textContent: 1 }]), 'z-index'), '', 'typeof F number');
    assert.equal(pv(viaQuery([{ textContent: { trim: () => '.t { z-index: 99; }' } }]), 'z-index'), '', 'typeof F object with trim');
    assert.equal(pv(viaQuery([{}]), 'z-index'), '', 'typeof F missing textContent');

    assert.equal(
      pv(viaQuery([
        { textContent: '' },
        { textContent: '   ' },
        { textContent: 0 },
        { textContent: { trim: () => '.t { z-index: 99; }' } },
        { textContent: '/* only */' },
        { textContent: '.t { z-index: 33; }' },
      ]), 'z-index'),
      '33',
    );
  });

  test('addSheetRules nested sheet, throw, cssRules holes, disabled, falsy sheet', () => {
    const inner = zSheet(41);
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [],
          querySelectorAll: () => [{ sheet: inner, textContent: '.t { z-index: 99; }' }],
        }),
      }), 'z-index'),
      '41',
      's.sheet.cssRules T recurses and ignores sibling textContent',
    );
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [],
          querySelectorAll: () => [{ sheet: {}, textContent: '.t { z-index: 42; }' }],
        }),
      }), 'z-index'),
      '42',
      's.sheet T and cssRules F unique-cause falls through to L174',
    );
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [],
          querySelectorAll: () => [{
            get sheet() {
              throw new Error('linkedom modern css');
            },
            textContent: '.t { z-index: 43; }',
          }],
        }),
      }), 'z-index'),
      '43',
    );

    const live = zSheet(44).cssRules[0];
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [{ cssRules: [null, live], textContent: '.t { z-index: 99; }' }],
        }),
      }), 'z-index'),
      '44',
      'if (r) F hole then T rule; length defined skips textContent',
    );
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [{ cssRules: { 0: live }, textContent: '.t { z-index: 45; }' }],
        }),
      }), 'z-index'),
      '45',
      'cssRules T and length === undefined unique-cause falls through to L174',
    );
    assert.equal(
      pv(host({
        getRootNode: () => ({
          styleSheets: [{ cssRules: { length: 0 }, textContent: '.t { z-index: 99; }' }],
        }),
      }), 'z-index'),
      '',
    );

    const off = zSheet(46);
    off.disabled = true;
    assert.equal(pv(host({ getRootNode: () => ({ styleSheets: [off] }) }), 'z-index'), '');
    const on = zSheet(47);
    on.disabled = false;
    assert.equal(pv(host({ getRootNode: () => ({ styleSheets: [on] }) }), 'z-index'), '47');

    assert.equal(
      pv(host({
        getRootNode: () => ({}),
        shadowRoot: { styleSheets: [null, undefined, 0, '', zSheet(48)] },
      }), 'z-index'),
      '48',
      '!sheet unique-cause via shadowRoot.styleSheets (document path would title-read null)',
    );
  });

  // css-values-4 #urls, cssom-1 § 6.4.3 #dom-cssimportrule-href
  // getCascadedStyle guards !element || typeof !== "object" before collection, so
  // getRuleBaseURL L290 F rows stay behind that public-API gate (same pairing as
  // collectStyleSheetsAndRules leftover). Inner unique-cause is ownerDocument /
  // href / _baseURL / import URL.
  test('getRuleBaseURL element/object unique-cause vs href/baseURI/import URL', () => {
    assert.equal(pv(null, 'background-image'), '');
    assert.equal(pv(undefined, 'background-image'), '');
    assert.equal(pv('div', 'background-image'), '');
    assert.equal(pv(1, 'background-image'), '');
    assert.equal(pv(true, 'background-image'), '');

    const css = '.t { background-image: url(a.png); }';
    const both = urlSheet(css, { baseURL: 'https://base.example/dir/', href: 'https://href.example/other.css' });
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [both] }) }), 'background-image'),
      'url("https://base.example/dir/a.png")',
      '_baseURL T unique-cause wins over href',
    );

    const hrefOnly = urlSheet(css, { href: 'https://href.example/sheet.css' });
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [hrefOnly] }) }), 'background-image'),
      'url("https://href.example/a.png")',
    );

    const imported = urlSheet(css);
    const importRule = new CSSImportRule('https://imported.example/dir/sheet.css');
    Object.defineProperty(imported, 'href', { configurable: true, get() { return importRule.href; } });
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [imported] }) }), 'background-image'),
      'url("https://imported.example/dir/a.png")',
      'CSSImportRule parent sheet URL unique-cause',
    );

    const noSheetUrl = urlSheet(css);
    assert.equal(
      pv(host({
        ownerDocument: { baseURI: 'https://doc.example/path/' },
        getRootNode: () => ({ styleSheets: [noSheetUrl] }),
      }), 'background-image'),
      'url("https://doc.example/path/a.png")',
    );
    assert.equal(
      pv(host({
        ownerDocument: { defaultView: { location: { href: 'https://win.example/app/' } } },
        getRootNode: () => ({ styleSheets: [noSheetUrl] }),
      }), 'background-image'),
      'url("https://win.example/app/a.png")',
    );
    assert.equal(
      pv(host({
        ownerDocument: 'https://nope.example/',
        getRootNode: () => ({ styleSheets: [noSheetUrl] }),
      }), 'background-image'),
      'url("a.png")',
      'ownerDocument non-object unique-cause skips baseURI/location',
    );
    assert.equal(
      pv(host({ getRootNode: () => ({ styleSheets: [noSheetUrl] }) }), 'background-image'),
      'url("a.png")',
      'element present/object T but no ownerDocument/global base leaves url unresolved',
    );

    const withBase = target(`<html><head>
      <base href="https://style-base.example/dir/">
      <style>.t { background-image: url(b.png); }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(withBase, 'background-image'), 'url("https://style-base.example/dir/b.png")');

    const noBase = target(`<html><head>
      <style>.t { background-image: url(c.png); }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(noBase, 'background-image'), 'url("c.png")');
  });

  // css-nesting-1 § 4 #nesting-selector, selectors-4 :is() / :not() / :has()
  // Nested CSS makes linkedom style.sheet throw (L174) then resolveNestedSelector
  // recurse visits argument F, selector-list objects, and token-array (no type).
  test('recurse argument F vs selector-list vs object without type via nested :is/:not/:has', () => {
    const el = target(`<html><head><style>
      .t {
        :is(&) { z-index: 11; }
        :not(&.no) { order: 12; }
        &:has(span) { opacity: 0.4; }
        &:is(:lang(en)) { column-count: 3; }
        :where(&) { z-index: 10; }
        &:lang(en) { flex-grow: 4; }
        &:nth-child(1) { flex-shrink: 5; }
        &:dir(ltr) { flex-basis: 6px; }
        &:hover { order: 99; }
        &:is() { counter-reset: n 1; }
        &:is(:nth-child(odd)) { counter-increment: n 2; }
        ::slotted(span) { z-index: 8; }
      }
    </style></head><body><div class="t" lang="en" dir="ltr"><span></span></div></body></html>`);

    assert.equal(pv(el, 'z-index'), '11', ':is(&) selector-list argument recurse + nesting-selector');
    assert.equal(pv(el, 'order'), '12', ':not(&.no) selector-list; :hover argument F does not win');
    assert.equal(pv(el, 'opacity'), '0.4', ':has() selector-list argument');
    assert.equal(pv(el, 'column-count'), '3', ':is(:lang(en)) nested selector-list wrapping array argument');
    assert.equal(pv(el, 'flex-grow'), '4', ':lang(en) argument is token array (object without type)');
    assert.equal(pv(el, 'flex-shrink'), '5', ':nth-child argument is token array (object without type)');
    assert.equal(pv(el, 'flex-basis'), '6px', ':dir(ltr) argument is token array (object without type)');
    assert.equal(pv(el, 'counter-increment'), 'n 2', ':is(:nth-child(odd)) selector-list wrapping array argument');
    assert.equal(pv(el, 'counter-reset'), '', ':is() empty selector-list argument does not match');
  });
});
