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
// MC/DC witness (CSSOM round): unique-cause rows for
//   - CSSStyleDeclaration._addDeclaration existing.important && !d.important
//     with d.important = T (cssom-1 § 6.7.1 #set-a-css-declaration): an
//     important shorthand overrides a prior important one.
//   - CSSStyleDeclaration.getPropertyValue allMatch && allCssWide &&
//     allSamePriority with allCssWide = F: a uniform non-keyword shorthand
//     contracts through the else path.
//   - CSSStyleDeclaration._getWinningDeclaration exact && !exact.important &&
//     !shDecl.important all-true row: a later unimportant shorthand after an
//     unimportant longhand takes over (css-cascade-4 § 6.4).
//   - cssText shorthand expansion expanded = T row (margin: inherit) against
//     the expanded = F row (grid: none keeps the shorthand).
//   - StylePropertyMapReadOnly d.name.startsWith('--') = T rows for has() and
//     _getAllRaw (css-typed-om-1 § 3.2 #the-stylepropertymap).
//   - StylePropertyMapReadOnly shorthand.longhands.every(...) = F row: mixed
//     css-wide and concrete longhand values skip keyword contraction.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
// Import the read-only map module first so its instrumented class is the one
// cached before any Babel-fallback graph loads the mutable subclass.
import { StylePropertyMapReadOnly } from '../src/typed-om/style-map/StylePropertyMapReadOnly.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { StylePropertyMap } from '../src/typed-om/style-map/StylePropertyMap.ts';

function ruleStyle(css: string): CSSStyleDeclaration {
  const sheet = parse(css);
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSStyleRule, css);
  return rule.style;
}

describe('MC/DC witness: CSSStyleDeclaration priority and contraction rows', () => {
  // cssom-1 § 6.7.1: a second !important shorthand set through setProperty
  // (no cssText reset) replaces the first important one
  // (existing.important = T, d.important = T → no skip, replace).
  test('important shorthand overrides prior important shorthand', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('margin', '1px', 'important');
    style.setProperty('margin', '2px', 'important');
    assert.equal(style.getPropertyValue('margin-top'), '2px');
    assert.equal(style.getPropertyValue('margin'), '2px');
  });

  // allMatch = T with allCssWide = F: uniform concrete longhand values fall
  // through the css-wide contraction and serialize directly.
  test('uniform non-keyword margin contracts without the css-wide arm', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'margin: 10px';
    assert.equal(style.getPropertyValue('margin'), '10px');
    assert.equal(style.getPropertyValue('margin-top'), '10px');
  });

  // exact = T, !exact.important = T, !shDecl.important = T: an unimportant
  // shorthand declared after an unimportant longhand wins by source order.
  test('later unimportant shorthand beats earlier unimportant longhand', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'margin-top: 1px; margin: 2px';
    assert.equal(style.getPropertyValue('margin-top'), '2px');
  });

  // cssText shorthand expansion: only values parseStyleAttribute declines to
  // expand (var(), css-wide, grid) reach this loop's expand() call — its
  // null row keeps the shorthand whole while parsed values come pre-expanded.
  test('cssText shorthand expansion success and failure rows', () => {
    const lengths = new CSSStyleDeclaration();
    lengths.cssText = 'margin: 1px 2px';
    assert.equal(lengths.getPropertyValue('margin-top'), '1px');
    assert.equal(lengths.getPropertyValue('margin-right'), '2px');

    const inherit = new CSSStyleDeclaration();
    inherit.cssText = 'margin: inherit';
    assert.equal(inherit.getPropertyValue('margin-top'), 'inherit');

    const grid = new CSSStyleDeclaration();
    grid.cssText = 'grid: none';
    assert.equal(grid.getPropertyValue('grid'), 'none');
    assert.equal(grid.getPropertyValue('grid-template-rows'), '');
  });

  // css-cascade-4 § 6.4: an unimportant longhand declared after the
  // unexpandable grid shorthand still wins by source order — the
  // exact/shorthand priority row of _getWinningDeclaration.
  test('grid shorthand plus later longhand takes the source-order row', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'grid: none; grid-template-rows: 1fr';
    assert.equal(style.getPropertyValue('grid-template-rows'), '1fr');
  });

  // css-cascade-4 § 6.4: a var()-carrying margin stays a whole shorthand
  // declaration, so a later margin-top longhand competes with it through
  // _getWinningDeclaration's exact-versus-shorthand priority row.
  test('var margin plus later longhand takes the priority row', () => {
    const style = new CSSStyleDeclaration();
    style.cssText = 'margin: var(--x); margin-top: 2px';
    assert.equal(style.getPropertyValue('margin-top'), '2px');
  });

  // cssom-1 § 6.7.1: important longhands replace important longhands through
  // _addDeclaration — both the longhand-slot and name-slot guards.
  test('important longhand replaces prior important longhand', () => {
    const impLonghand = new CSSStyleDeclaration();
    impLonghand.cssText = 'margin-top: 1px !important; margin: 2px !important';
    assert.equal(impLonghand.getPropertyValue('margin-top'), '2px');
    const impShorthand = new CSSStyleDeclaration();
    impShorthand.cssText = 'margin-top: 2px !important; margin: var(--x) !important';
    assert.equal(impShorthand.getPropertyValue('margin-top'), '');
    assert.equal(impShorthand.getPropertyValue('margin'), 'var(--x)');
  });

  // css-typed-om-1 § 3.2: a declarations-backed map (array constructor) takes
  // the custom-property arm of the has()/getAll() name normalization ternaries.
  test('style map has/getAll custom-property declaration rows', () => {
    const sheet = parse('.a { --wit-x: 1px; color: red }');
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSStyleRule);
    const map = rule.styleMap;
    assert.ok(map);
    assert.equal(map.has('--wit-x'), true);
    assert.equal(map.has('color'), true);
    assert.deepEqual(map.getAll('--wit-x').map(String), ['1px']);
    assert.equal(map.has('--nope'), false);

    const declMap = new StylePropertyMapReadOnly([
      { type: 'declaration', name: '--wit-decl', value: [{ type: 'ident', value: 'auto', sign: null }], important: false },
      { type: 'declaration', name: 'margin-top', value: [{ type: 'dimension', value: 1, unit: 'px', sign: null, numberType: 'integer' }], important: false },
    ] as never);
    assert.equal(declMap.has('--wit-decl'), true);
    assert.deepEqual(declMap.getAll('--wit-decl').map(String), ['auto']);
    assert.equal(declMap.has('--absent'), false);
    assert.equal(declMap.has('margin-top'), true);
    assert.equal(declMap.getAll('margin-top').map(String).join(''), '1px');
  });

  // Mixed css-wide/concrete longhands with the shorthand itself unset (val
  // === ''): shorthand.longhands.every(...) = F so the keyword contraction is
  // skipped and the empty value falls through to []; the var() sibling arm
  // mirrors it for differing variable references.
  test('mixed longhand values skip keyword contraction', () => {
    const keys = ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'];
    const styleLike = {
      length: 4,
      getPropertyValue(p: string) {
        return { 'margin-top': 'initial', 'margin-right': '5px', 'margin-bottom': 'initial', 'margin-left': 'initial' }[p] ?? '';
      },
      item: (i: number) => keys[i],
    };
    const map = new StylePropertyMapReadOnly(styleLike as never);
    assert.deepEqual(map.getAll('margin'), []);
    assert.equal(map.has('margin'), true);

    const varStyleLike = {
      length: 4,
      getPropertyValue(p: string) {
        return { 'margin-top': 'var(--x)', 'margin-right': 'var(--y)', 'margin-bottom': 'var(--x)', 'margin-left': 'var(--x)' }[p] ?? '';
      },
      item: (i: number) => keys[i],
    };
    const varMap = new StylePropertyMapReadOnly(varStyleLike as never);
    assert.deepEqual(varMap.getAll('margin'), []);
  });
});
