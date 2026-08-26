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
// MC/DC witness (cascade round): unique-cause rows for
//   - rule-filter determinePreferredTitle preferredTitleFound = T
//     (cssom-1 § 7.2 #alternative-style-sheets): a titled persistent sheet
//     found in the styleSheets pass makes the second (style-tags) pass return
//     immediately.
//   - rule-filter resolveUrlsInValue val.includes('url(') = T with a base URL
//     (css-values-4 #urls): the disjunction's false row proceeds to rewrite.
//   - value-processor processStandardDeclarations prop.startsWith('--') = T
//     (css-variables-1 § 3): custom-property declarations skip the /**/
//     marker rewrite applied to standard declarations.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

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

describe('MC/DC witness: cascade preferred-title, url base, custom-prop rows', () => {
  // cssom-1 § 7.2: a persistent (titled, non-alternate) stylesheet in the
  // document's styleSheets sets preferredTitleFound during the first
  // determinePreferredTitle pass; the second pass over <style> tags then
  // returns immediately (preferredTitleFound = T row).
  test('titled persistent sheet makes second title pass skip', () => {
    const html = `<html><head>
      <style title="main">.t { color: red }</style>
      <style title="alt2" rel="alternate">.t { color: blue }</style>
    </head><body><p class="t"></p></body></html>`;
    const el = target(html);
    // The preferred title wins: red persists, the alternate stays disabled.
    assert.equal(pv(el, 'color'), 'rgb(255, 0, 0)');
  });

  // css-values-4 #urls: with a document base URL set and a url() present in
  // the value, !val.includes('url(') is false and the rewrite proceeds
  // (the [baseURL-set, url(-present] row of the disjunction); a non-url
  // property against the same base keeps its text (url( absent row).
  test('url() value against a base URL reaches the rewrite arm', () => {
    const html = `<html><head><style>
      .t { background-image: url(a.png); color: rgb(1, 2, 3) }
    </style></head><body><div class="t"></div></body></html>`;
    const el = target(html);
    const doc = (el as { ownerDocument?: object }).ownerDocument!;
    const prev = Object.getOwnPropertyDescriptor(doc, 'baseURI');
    Object.defineProperty(doc, 'baseURI', {
      configurable: true,
      value: 'https://wit.example/dir/page.html',
    });
    try {
      assert.equal(pv(el, 'background-image'), 'url("https://wit.example/dir/a.png")');
      assert.equal(pv(el, 'color'), 'rgb(1, 2, 3)');
    } finally {
      if (prev) Object.defineProperty(doc, 'baseURI', prev);
      else delete (doc as { baseURI?: string }).baseURI;
    }
  });

  // css-variables-1 § 3: substituted custom-property declarations keep their
  // substituted text verbatim (prop.startsWith('--') = T row of the ternary),
  // while a standard property rewrites /**/ markers to spaces.
  test('custom property declaration skips the marker rewrite', () => {
    const html = `<html><head><style>
      .t { --wit-custom: 1px 2px; margin-top: var(--wit-custom) }
    </style></head><body><div class="t"></div></body></html>`;
    const el = target(html);
    assert.equal(pv(el, 'margin-top'), '1px 2px');
    const style = getCascadedStyle(el);
    assert.ok(style instanceof CSSStyleDeclaration);
    assert.equal(style.getPropertyValue('--wit-custom'), '1px 2px');
  });
});
