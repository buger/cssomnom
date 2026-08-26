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
// Obligation witnesses for the cascade sorter boundary behavior
// (SW-REQ-260821-FWNH): the compareCascadeDeclarations sort key reaches its
// tie boundary at equal (importance, layer, origin, specificity), where the
// later declaration in document order wins, and crosses it when specificity
// increases — both edges of the winning-decision comparison, driven only
// through the public getCascadedStyle surface.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function cascade(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

// SW-REQ-260821-FWNH:boundary:nominal
test('equal-specificity tie at the sort boundary is broken by document order', () => {
  // Two .t rules tie on every sort key except position: the later one wins.
  const tie = cascade('.t { color: red; } .t { color: blue; }');
  assert.equal(tie.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// SW-REQ-260821-FWNH:boundary:nominal
test('crossing the specificity edge wins over earlier document order', () => {
  // body .t (specificity 0,0,2) crosses the boundary above the earlier plain
  // .t (0,0,1) and wins; the unrelated #x rule does not match .t at all.
  const spec = cascade('#x { color: green; } .t { color: red; } body .t { color: blue; }');
  assert.equal(spec.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// SW-REQ-260821-FWNH:boundary:negative
test('no matching declarations leaves the boundary unreachable and the style empty', () => {
  const empty = cascade('.other { color: red; }');
  assert.equal(empty.length, 0);
  assert.equal(empty.cssText, '');
});
