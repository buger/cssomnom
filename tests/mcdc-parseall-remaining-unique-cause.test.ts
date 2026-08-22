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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
// Remaining unique-cause leftovers for src/typed-om/values/style-value-parser.ts _parseAll
// after tests/mcdc-hotspot-parse-all.test.ts, tests/mcdc-hotspot-parse-all-more.test.ts,
// tests/mcdc-parseall-unique-cause.test.ts, and tests/mcdc-parseall-still-hot-unique-cause.test.ts.
// Hottest leftover (latest.json): L351 color-OR unique-cause of invert/none/syntax/includes.
// Drive CSSStyleValue.parse / parseAll. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSPositionValue,
} from '../src/typed-om.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { COLOR_PROPERTIES } from '../src/typed-om/style-map/style-validation.ts';
import { SUPPORTED_PROPERTIES } from '../src/data/gen/property-list.ts';
import { STANDARD_PROPERTIES_SYNTAX } from '../src/data/gen/standard-syntax.ts';
import type { ComponentValue, FunctionToken } from '../src/types.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

const COLOR_UC = 'mcdc-parseall4-color';
const COLOR_NOSYN = 'mcdc-parseall4-nosyntax';
const COLOR_UC_SYNTAX = '<color> | invert | none | leftover-kw | auto';

function installColorUniqueCauseTables(): void {
  COLOR_PROPERTIES.add(COLOR_UC);
  COLOR_PROPERTIES.add(COLOR_NOSYN);
  SUPPORTED_PROPERTIES.add(COLOR_UC);
  SUPPORTED_PROPERTIES.add(COLOR_NOSYN);
  STANDARD_PROPERTIES_SYNTAX[COLOR_UC] = COLOR_UC_SYNTAX;
}

function uninstallColorUniqueCauseTables(): void {
  COLOR_PROPERTIES.delete(COLOR_UC);
  COLOR_PROPERTIES.delete(COLOR_NOSYN);
  SUPPORTED_PROPERTIES.delete(COLOR_UC);
  SUPPORTED_PROPERTIES.delete(COLOR_NOSYN);
  delete STANDARD_PROPERTIES_SYNTAX[COLOR_UC];
}

function withComponentValues(values: ComponentValue[], fn: () => void): void {
  const original = ParseHooks.parseComponentValues;
  ParseHooks.parseComponentValues = () => values;
  try {
    fn();
  } finally {
    ParseHooks.parseComponentValues = original;
  }
}

describe('MC/DC remaining unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  afterEach(() => {
    uninstallColorUniqueCauseTables();
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue / § 3.6 #colorvalue-objects
  // css-ui-3 #outline-color (invert is a CSS2 outline-color keyword; generated
  // COLOR_PROPERTIES syntax never lists invert/none, so matchesSyntax rejects
  // them before the color-OR. leftover-kw is not in any generated union.)
  test('color-OR leftover: invert, none, syntax includes, inner syntax F', () => {
    installColorUniqueCauseTables();

    // Unique-cause: kw === 'invert' T / kw === 'none' T after named/currentcolor/
    // transparent/auto are F. Generated outline-color/fill syntax never reaches here.
    const invert = parseAll(COLOR_UC, 'invert');
    assert.ok(invert[0] instanceof CSSKeywordValue);
    assert.equal((invert[0] as CSSKeywordValue).value, 'invert');
    const none = parseAll(COLOR_UC, 'none');
    assert.ok(none[0] instanceof CSSKeywordValue);
    assert.equal((none[0] as CSSKeywordValue).value, 'none');

    // Unique-cause: syntax T && includes(kw) T. leftover-kw is not named/currentcolor/
    // transparent/auto/invert/none, so the last conjunct independently decides T.
    const leftover = parseAll(COLOR_UC, 'leftover-kw');
    assert.ok(leftover[0] instanceof CSSKeywordValue);
    assert.equal((leftover[0] as CSSKeywordValue).value, 'leftover-kw');
    const first = CSSStyleValue.parse(COLOR_UC, 'leftover-kw');
    assert.ok(first instanceof CSSKeywordValue);

    // Unique-cause: syntax T && includes(kw) F. canvas is <color> so matchesSyntax
    // passes; the split union does not list canvas, so the OR is all-F and parse wins.
    const canvas = parseAll(COLOR_UC, 'canvas');
    assert.ok(canvas[0] instanceof CSSKeywordValue);
    assert.equal((canvas[0] as CSSKeywordValue).value.toLowerCase(), 'canvas');

    assert.ok(parseAll(COLOR_UC, 'auto')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll(COLOR_UC, 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll(COLOR_UC, 'currentcolor')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll(COLOR_UC, 'transparent')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll(COLOR_UC, 'not-a-kw'), TypeError);
    // Mixed-case invert fails ident-literal matchesSyntax (case-sensitive) before the OR.
    assert.throws(() => parseAll(COLOR_UC, 'INVERT'), TypeError);

    // Unique-cause: inner STANDARD_PROPERTIES_SYNTAX[propLower] F (no generated
    // syntax). leftover-kw then has invert/none F and syntax F → color-parse throw.
    // invert still unique-causes kw === 'invert' T with syntax skipped.
    assert.throws(() => parseAll(COLOR_NOSYN, 'leftover-kw'), TypeError);
    const nosynInvert = parseAll(COLOR_NOSYN, 'invert');
    assert.ok(nosynInvert[0] instanceof CSSKeywordValue);
    assert.ok(parseAll(COLOR_NOSYN, 'none')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll(COLOR_NOSYN, 'red')[0] instanceof CSSKeywordValue);

    uninstallColorUniqueCauseTables();
  });

  // css-syntax-3 § 5.4.8 #parse-a-list-of-component-values / § 5.5.10 #consume-function
  test('function-token var() skips hasVarFunction and unique-causes fnName === var', () => {
    // Tokenizer FunctionToken is { type:'function', value:name } with no `name`.
    // parseComponentValues normally upgrades that to CSSFunction. Stub the upgrade
    // so hasVarFunction (isCSSFunction requires `name` + array value) is F, then
    // L280-L282 takes the `'value' in` arm with fnName === 'var' T.
    const fnVar: FunctionToken = { type: 'function', value: 'var' };
    withComponentValues([fnVar], () => {
      const width = parseAll('width', 'var(--x)');
      assert.equal(width.length, 1);
      assert.ok(width[0] instanceof CSSUnparsedValue);
      const color = parseAll('color', 'var(--accent)');
      assert.ok(color[0] instanceof CSSUnparsedValue);
      const mixed = parseAll('width', 'VAR(--x)');
      assert.ok(mixed[0] instanceof CSSUnparsedValue);
    });

    const fnVarUpper: FunctionToken = { type: 'function', value: 'VAR' };
    withComponentValues([fnVarUpper], () => {
      const parsed = parseAll('opacity', 'VAR(--x)');
      assert.ok(parsed[0] instanceof CSSUnparsedValue);
    });
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects
  test('position leftover: LIST_PROPERTIES F with commas; comment-only list throws', () => {
    // Unique-cause: POSITION T, LIST_PROPERTIES.has F so L207 does not split.
    // mask-position reifies the whole comma list as raw CSSStyleValue.
    const mask = parseAll('mask-position', 'left, right');
    assert.equal(mask.length, 1);
    assert.equal(mask[0].constructor, CSSStyleValue);
    const webkit = parseAll('-webkit-mask-position', 'center, 10px 10px');
    assert.equal(webkit[0].constructor, CSSStyleValue);

    // object-position / offset-* are position and not list: grammar fails as one value.
    assert.throws(() => parseAll('object-position', 'left, right'), TypeError);
    assert.throws(() => parseAll('offset-position', 'left, right'), TypeError);
    assert.throws(() => parseAll('offset-anchor', '10px 10px, 20px 20px'), TypeError);

    // Unique-cause: L222 values.length === 0 T when every comma segment is comment-only
    // (bare ',' already covered). Leading comma still drops the empty first segment.
    assert.throws(() => parseAll('background-position', '/* a */, /* b */'), TypeError);
    const leading = parseAll('background-position', ', left');
    assert.equal(leading.length, 1);
    assert.ok(leading[0] instanceof CSSPositionValue);
    const commented = parseAll('background-position', 'left, /* empty */, right');
    assert.equal(commented.length, 2);
    assert.ok(commented[0] instanceof CSSPositionValue);
    assert.ok(commented[1] instanceof CSSPositionValue);
  });

  // css-backgrounds-3 / css-animations-1 — leftover list comment-only segments
  test('non-position list leftover: comment-only comma segments are dropped', () => {
    const names = parseAll('animation-name', 'spin, /* only */, fade');
    assert.equal(names.length, 2);
    assert.ok(names[0] instanceof CSSKeywordValue);
    assert.ok(names[1] instanceof CSSKeywordValue);
    assert.equal((names[0] as CSSKeywordValue).value, 'spin');
    assert.equal((names[1] as CSSKeywordValue).value, 'fade');

    const shadows = parseAll('text-shadow', '1px, /* x */, 2px');
    assert.equal(shadows.length, 2);
    const family = parseAll('font-family', 'serif, /* skip */, sans-serif');
    assert.equal(family.length, 2);
  });

  // css-logical-1 #logical-shorthand-properties
  test('logical 2-value leftover: inset-block / margin-block vs SHORTHANDS_DATA-only', () => {
    // Unique-cause: LOGICAL_2VAL T then generated 1-token syntax fails (inset-block
    // 2-token was not in parse-all-more / still-hot).
    assert.throws(() => parseAll('inset-block', '1px 2px'), TypeError);
    assert.throws(() => parseAll('margin-block', 'auto auto'), TypeError);
    assert.ok(parseAll('inset-block', 'auto')[0] instanceof CSSKeywordValue);

    // Unique-cause: SHORTHANDS_DATA-only 2-token stays generic (LOGICAL_2VAL F).
    const pad = parseAll('scroll-padding-block', '1px 2px');
    assert.equal(pad[0].constructor, CSSStyleValue);
    const margin = parseAll('scroll-margin-inline', '1px');
    assert.equal(margin[0].constructor, CSSStyleValue);
  });

  // css-lists-3 / css-backgrounds-3 / css-text-decor-4 / css-ui-4 / css-overflow-3
  test('remaining SHORTHANDS_DATA-only families not in prior parseAll files', () => {
    assert.equal(parseAll('list-style', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('list-style', 'square url(a.png) inside')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('border-image', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('text-emphasis', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('column-rule', '1px solid red')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('font-variant', 'small-caps')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('outline', 'invert')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('outline', '1px solid invert')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('-webkit-text-stroke', '1px red')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('-webkit-mask', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('color-adjust', 'economy')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('marker', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('flex', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('flex', 'auto')[0].constructor, CSSStyleValue);

    assert.ok(parseAll('page-break-after', 'always')[0] instanceof CSSKeywordValue);
    assert.equal(CSSStyleValue.parse('list-style', 'none').constructor, CSSStyleValue);
  });
});
