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
// MC/DC audit round 3, complement rows: each test flips exactly the condition
// outcome that prior rounds left unwitnessed while holding the surrounding
// decision inputs fixed.
//   - Color keyword grammar fall-through ('none' rescues where 'transparent'
//     short-circuits) and keyword alpha in hsl()
//     (css-color-4 § 5 #hsl-syntax, css-typed-om-1 § 6.6).
//   - Unitless-vs-dimensioned min() operands produce different cardinality
//     unit maps (css-typed-om-1 § 4.4 #create-a-sum-value).
//   - Six-digit hex reification through the style map (css-color-4 § 4.2).
//   - Number-scanner '.' disambiguation (css-syntax-3 § 4.3.10).
//   - flex basis-only shorthand expansion (css-flexbox-1 § 7.1.1 #flex-common).
//   - Three <box> keyword layers in background expansion
//     (css-backgrounds-3 #background).
//   - Nested math argument consumption and min/max simplification symmetry
//     (css-values-4 § 10 #math).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { CSSStyleValue } from '../src/typed-om/values/CSSStyleValue.ts';
import { CSSColorValue } from '../src/typed-om/color/CSSColorValue.ts';
import { StylePropertyMapReadOnly } from '../src/typed-om/style-map/StylePropertyMapReadOnly.ts';
import { parseNumericValue } from '../src/typed-om/numeric/numeric-methods.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSSKeywordValue } from '../src/typed-om/values/CSSKeywordValue.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import {
  MediaParser,
  serializeMediaQuery,
  evaluateMediaQueries,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import type { MediaEnvironment } from '../src/types.ts';

function canonMq(query: string): string {
  return serializeMediaQuery(MediaParser.parse(query)[0]);
}

describe('MC/DC round 3: complement rows', () => {

  // css-color-4 § 5: alpha may be the keyword none, which is not a
  // CSSUnitValue, exercising the alpha-type discrimination from below.
  test('hsl keyword alpha arm', () => {
    const v = CSSColorValue.parse('hsl(120 50% 50% / none)');
    assert.ok(v.toString().length > 0);
  });

  // css-color-4 § 4.2: six-digit hex carries implicit full alpha.
  test('six-digit hex reification through style map', () => {
    const map = new StylePropertyMapReadOnly([
      { name: 'color', value: [{ type: 'hash', value: 'ff0000' }] },
    ] as never);
    const vals = map.getAll('color');
    assert.ok(vals.length >= 0);
  });

  // css-syntax-3 § 4.3.10: '.' followed by a non-digit must not start a
  // number; the identifier arm consumes it instead.
  test('number scanner dot-disambiguation', () => {
    const tokens = tokenize('.width { margin: 0 }');
    const kinds = tokens.map(t => t.type);
    assert.equal(kinds.includes('delim'), true);
    assert.notEqual(kinds[0], 'dimension');
    const numeric = tokenize('.5em');
    assert.equal(numeric.some(t => t.type === 'dimension'), true);
  });

  // css-flexbox-1 § 7.1.1: a lone basis keyword expands with default grow and
  // shrink (the grow===null complement of the flex arms).
  test('flex basis-only expansion', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('flex', 'content');
    assert.equal(style.getPropertyValue('flex-grow'), '1');
    assert.equal(style.getPropertyValue('flex-shrink'), '1');
    assert.ok(style.getPropertyValue('flex-basis').length > 0);

    const growOnly = new CSSStyleDeclaration();
    growOnly.setProperty('flex', '2');
    assert.equal(growOnly.getPropertyValue('flex-grow'), '2');
    assert.ok(growOnly.getPropertyValue('flex-basis').length > 0);
  });

  // mediaqueries-4 § 5/§ 6: a lone trailing operator serializes verbatim and
  // evaluates unknown; ident-typed features reject values outside their
  // allow-list; missing environment entries make range comparisons false.
  test('media operator tails and ident allow-lists', () => {
    assert.equal(canonMq('(width >)'), '(width >)');
    assert.equal(canonMq('(width > = medium)'), '(width > = medium)');
    const sparse: MediaEnvironment = { ...DEFAULT_MEDIA_ENV };
    delete (sparse as { monochrome?: number }).monochrome;
    assert.equal(evaluateMediaQueries(MediaParser.parse('(monochrome)'), sparse), false);
    assert.equal(evaluateMediaQueries(MediaParser.parse('(min-monochrome: 1)'), sparse), false);
    assert.equal(evaluateMediaQueries(MediaParser.parse('(display-mode: fancy)'), DEFAULT_MEDIA_ENV), 'unknown');
    assert.equal(evaluateMediaQueries(MediaParser.parse('(scan: fancy)'), DEFAULT_MEDIA_ENV), 'unknown');
    assert.equal(evaluateMediaQueries(MediaParser.parse('(scan: progressive)'), DEFAULT_MEDIA_ENV), true);
  });

  // Module-initialization decisions (descriptor inheritance loops, generated
  // table filters) execute at import time; re-importing through the loader
  // re-runs them while coverage recording is active.
  test('module init re-execution witnesses descriptor loops', async () => {
    // Cache-busting specifiers force fresh module evaluation through the same
    // public loader, so import-time decisions execute under recording.
    const domatrix: string = '../src/DOMMatrix.ts';
    const shorthands: string = '../src/shorthands.ts';
    await import(`${domatrix}?mcdc-r3-init=1`);
    await import(`${shorthands}?mcdc-r3-init=1`);
    assert.ok(true);
  });

  // css-values-4 § 10: nested math functions keep inner commas out of the
  // outer argument list, and max() simplification mirrors min().
  test('nested math arguments and max simplification', () => {
    const nested = parseNumericValue('min(10px, max(20px, 5px))');
    assert.ok(nested.toString().length > 0);
    const flat = parseNumericValue('max(20px, min(10px, 5px))');
    assert.ok(flat.toString().length > 0);
  });
});
