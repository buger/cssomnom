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
// Public-API unique-cause for src/cascade/rule-filter.ts
// isSheetEnabledForSet `preferredTitleFound && preferredTitle !== null`
// (css-cascade-5 § 2 #filtering, cssom-1 #dom-stylesheet-title,
// html #attr-style-title / #alternate-style-sheets). Drive getCascadedStyle
// without a rules argument so collection walks linkedom <style title> /
// rel=alternate. preferredTitle !== null F is UNREACHABLE: found is only
// set together with a truthy title.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function pv(html: string, prop: string): string {
  const { document } = parseHTML(html);
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  const style = getCascadedStyle(el);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

const PREFERRED = `<html><head>
  <style title="setA">.t { color: red; z-index: 1; }</style>
  <style title="setB">.t { z-index: 2; }</style>
  <style>.t { order: 3; }</style>
  <style title="setA" rel="alternate stylesheet">.t { column-count: 5; }</style>
  <style title="setB" rel="alternate stylesheet">.t { flex-grow: 6; }</style>
</head><body><div class="t"></div></body></html>`;

describe('MC/DC public unique-cause: isSheetEnabledForSet preferredTitle', { concurrency: false }, () => {
  test('preferredTitleFound T: matching titled set enabled, mismatch disabled', () => {
    // Unique-cause: preferredTitleFound T and preferredTitle !== null T
    // then title === preferredTitle T (setA) vs F (setB).
    assert.equal(pv(PREFERRED, 'color'), 'rgb(255, 0, 0)');
    assert.equal(pv(PREFERRED, 'z-index'), '1');
    assert.equal(pv(PREFERRED, 'order'), '3', 'untitled persistent still applies at L145');
    assert.equal(pv(PREFERRED, 'column-count'), '5', 'alternate whose title matches preferred');
    assert.equal(pv(PREFERRED, 'flex-grow'), '', 'alternate setB title mismatch disabled');
  });

  test('preferredTitleFound F: only-alternate and untitled-plus-alternate', () => {
    // Unique-cause: no titled non-alternate sheet, so preferredTitleFound F
    // at L148. Alternates fall through to return !isAlternate (disabled).
    const onlyAlt = `<html><head>
      <style title="setA" rel="alternate stylesheet">.t { z-index: 7; column-count: 4; color: red; }</style>
      <style title="setB" rel="alternate stylesheet">.t { flex-grow: 8; }</style>
    </head><body><div class="t"></div></body></html>`;
    assert.equal(pv(onlyAlt, 'z-index'), '');
    assert.equal(pv(onlyAlt, 'column-count'), '');
    assert.equal(pv(onlyAlt, 'flex-grow'), '');

    const untitledPlusAlt = `<html><head>
      <style>.t { z-index: 3; }</style>
      <style title="setA" rel="alternate stylesheet">.t { z-index: 9; column-count: 4; }</style>
    </head><body><div class="t"></div></body></html>`;
    assert.equal(pv(untitledPlusAlt, 'z-index'), '3', 'untitled persistent applies');
    assert.equal(pv(untitledPlusAlt, 'column-count'), '', 'alternate disabled without preferred');
  });

  test('later titled persistent becomes preferred after leading alternate', () => {
    const altThenTitled = `<html><head>
      <style title="setA" rel="alternate stylesheet">.t { color: red; z-index: 1; }</style>
      <style title="setB">.t { color: blue; z-index: 8; }</style>
    </head><body><div class="t"></div></body></html>`;
    assert.equal(pv(altThenTitled, 'color'), 'rgb(0, 0, 255)');
    assert.equal(pv(altThenTitled, 'z-index'), '8');

    const onlyPersistent = `<html><head>
      <style>.t { z-index: 11; }</style>
    </head><body><div class="t"></div></body></html>`;
    assert.equal(pv(onlyPersistent, 'z-index'), '11');
  });
});
