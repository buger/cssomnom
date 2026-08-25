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

// Acceptance tests for stakeholder criteria previously stamped `witness_deferred`
// during the spec-model repair batch. Each test exercises its criterion
// end-to-end on the integrated public API (src/index.ts), mirroring the shape of
// tests/acceptance-stk.test.ts.
//
// Criteria whose remaining clauses are blocked by open known-issue tripwires
// (proof/evidence/ki-*.yaml) stay deferred in specs/stakeholder/requirements/
// with sharpened per-clause reasons; only fully-satisfied criteria are
// witnessed here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as CSSOM from '../src/index.ts';

// STK-REQ-260821-AMK6:AC-004:acceptance
// css-typed-om-1 § 3.3 #positionvalue-objects; css-values-4 § <position> accepts
// 1 to 4 components. Reification must produce a CSSPositionValue without throwing.
test('AC-004 1-to-4 component position reifies as CSSPositionValue without throwing', function acAmk6004() {
  const cases: Array<[string, string, number]> = [
    // [property, css text, component count]
    ['object-position', 'center', 1],
    ['object-position', 'left', 1],
    ['object-position', 'top', 1],
    ['object-position', '25px', 1],
    ['background-position', 'left top', 2],
    ['transform-origin', '20px 80%', 2],
    ['background-position', 'left 10px top', 3],
    ['background-position', 'right 10px bottom 20px', 4]
  ];
  for (const [property, value, componentCount] of cases) {
    let reified: unknown;
    assert.doesNotThrow(
      () => {
        reified = CSSOM.CSSStyleValue.parse(property, value);
      },
      `CSSStyleValue.parse(${property}, ${JSON.stringify(value)}) threw`
    );
    assert.ok(
      reified instanceof CSSOM.CSSPositionValue,
      `${componentCount}-component position ${JSON.stringify(value)} must reify as CSSPositionValue, got ${
        (reified as object)?.constructor?.name
      }`
    );
  }
  const four = CSSOM.CSSStyleValue.parse(
    'background-position',
    'right 10px bottom 20px'
  ) as CSSOM.CSSPositionValue;
  assert.ok(four.x instanceof CSSOM.CSSNumericValue);
  assert.ok(four.y instanceof CSSOM.CSSNumericValue);
});

// STK-REQ-260821-D7WX:AC-004:acceptance
// css-color-4 § HSL color conversion via the cascade resolver
// (src/cascade/color-resolver.ts parseHslComponents): chroma goes to red below
// 60 degrees, to green from 60 through 180 degrees, and to blue from 180 through
// 300 degrees for 3- or 4-component lists; other arities are rejected.
test('AC-004 cascade HSL converter assigns chroma by hue sector and rejects other arities', function acD7wx004() {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('div');
  assert.ok(el);

  function cascadedColor(colorText: string): string {
    const sheet = CSSOM.parse(`.t { color: ${colorText}; }`);
    const style = CSSOM.getCascadedStyle(el!, sheet.cssRules);
    return style.getPropertyValue('color');
  }

  function channels(rgbText: string): [number, number, number] {
    const m = /^rgba?\((\d+), (\d+), (\d+)/.exec(rgbText);
    assert.ok(m, `expected an rgb() serialization, got ${JSON.stringify(rgbText)}`);
    return [Number(m![1]), Number(m![2]), Number(m![3])];
  }

  // Red sector: hue below 60 degrees carries the chroma on the red channel.
  assert.equal(cascadedColor('hsl(0deg 100% 50%)'), 'rgb(255, 0, 0)');
  assert.equal(cascadedColor('hsl(30deg 100% 50%)'), 'rgb(255, 128, 0)');
  const [r59, g59] = channels(cascadedColor('hsl(59deg 100% 50%)'));
  assert.equal(r59, 255);
  assert.ok(r59 > g59, 'hue 59 must keep red strictly dominant');

  // Green sector: from 60 through 180 degrees (inclusive bounds).
  const [r60, g60, b60] = channels(cascadedColor('hsl(60deg 100% 50%)'));
  assert.equal(g60, 255);
  assert.ok(g60 >= r60 && g60 >= b60, 'hue 60 boundary belongs to green');
  assert.equal(cascadedColor('hsl(120deg 100% 50%)'), 'rgb(0, 255, 0)');
  const [, g179, b179] = channels(cascadedColor('hsl(179deg 100% 50%)'));
  assert.equal(g179, 255);
  assert.ok(g179 > b179, 'hue 179 must stay green-dominant');

  // Blue sector: from 180 through 300 degrees.
  const [, g181, b181] = channels(cascadedColor('hsl(181deg 100% 50%)'));
  assert.equal(b181, 255);
  assert.ok(b181 > g181, 'hue 181 must be blue-dominant');
  assert.equal(cascadedColor('hsl(240deg 100% 37%)'), 'rgb(0, 0, 189)');
  const [r299, , b299] = channels(cascadedColor('hsl(299deg 100% 50%)'));
  assert.equal(b299, 255);
  assert.ok(b299 >= r299, 'hue 299 stays inside the blue sector');

  // 4-component list parses and preserves alpha.
  assert.equal(cascadedColor('hsl(120deg 100% 50% / 0.5)'), 'rgba(0, 255, 0, 0.5)');
  assert.equal(cascadedColor('hsl(0 100% 50% / 1)'), 'rgb(255, 0, 0)');

  // Component lists of other lengths are rejected: no rgb() conversion is
  // produced from a wrong-arity hsl() (the converter's arity gate returns null).
  for (const bad of ['hsl(0deg 100%)', 'hsl(0deg)', 'hsl(0, 100%, 50%, 0.5, 1)']) {
    const color = cascadedColor(bad);
    assert.match(
      color,
      /^hsl\(/,
      `wrong-arity ${JSON.stringify(bad)} must not be converted, got ${JSON.stringify(color)}`
    );
    assert.notEqual(color, 'rgb(255, 0, 0)');
  }
});

// STK-REQ-260821-D7WX:AC-005:acceptance
// selectors-4 § :enabled / :disabled pseudo-classes; the matcher must return a
// non-empty match for elements they apply to.
test('AC-005 matcher returns non-empty match for disabled or enabled elements', function acD7wx005() {
  const { document } = parseHTML(
    '<html><body><button id="b1" disabled>b</button><fieldset id="f1" disabled></fieldset><input id="i1"><select id="s1"><option>o</option></select></body></html>'
  );
  const disabledButton = document.getElementById('b1');
  const disabledFieldset = document.getElementById('f1');
  const enabledInput = document.getElementById('i1');
  const enabledSelect = document.getElementById('s1');
  assert.ok(disabledButton && disabledFieldset && enabledInput && enabledSelect);

  assert.equal(CSSOM.matches(disabledButton, ':disabled'), true);
  assert.equal(CSSOM.matches(disabledFieldset, ':disabled'), true);
  assert.equal(CSSOM.matches(enabledInput, ':enabled'), true);
  assert.equal(CSSOM.matches(enabledSelect, ':enabled'), true);
  assert.equal(CSSOM.matches(enabledInput, ':disabled'), false);
  assert.equal(CSSOM.matches(disabledButton, ':enabled'), false);

  assert.equal(CSSOM.querySelectorAll(document.body, 'button:disabled').length, 1);
  assert.equal(CSSOM.querySelectorAll(document.body, 'input:enabled').length, 1);
  assert.ok(CSSOM.querySelectorAll(document.body, ':disabled').length >= 2);
  assert.ok(CSSOM.querySelectorAll(document.body, ':enabled').length >= 2);
});
