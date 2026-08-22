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
// Round-7 unique-cause leftovers for src/typed-om/values/style-value-parser.ts
// _parseAll after tests/mcdc-hotspot-parse-all.test.ts,
// tests/mcdc-hotspot-parse-all-more.test.ts, tests/mcdc-parseall-unique-cause.test.ts,
// tests/mcdc-parseall-still-hot-unique-cause.test.ts,
// tests/mcdc-parseall-remaining-unique-cause.test.ts,
// tests/mcdc-parseall-round5-unique-cause.test.ts, and
// tests/mcdc-parseall-round6-unique-cause.test.ts.
// Last recapture: 48/57 decisions, 9 incomplete.
// Drive CSSStyleValue.parse / parseAll only. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
} from '../src/typed-om.ts';
import { CSSURLImageValue } from '../src/typed-om/values/CSSImageValue.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { POSITION_PROPERTIES } from '../src/typed-om/style-map/style-validation.ts';
import type { ComponentValue, CSSFunction, IdentToken } from '../src/types.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

const origParseComponentValues = ParseHooks.parseComponentValues;
const origPositionHas = POSITION_PROPERTIES.has;

function restoreHooks(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
  POSITION_PROPERTIES.has = origPositionHas;
}

function withComponentValues(values: ComponentValue[], fn: () => void): void {
  ParseHooks.parseComponentValues = () => values;
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

/**
 * L180 reads ident.value first; L275/L277 read it again. A getter that flips
 * after the css-wide check unique-causes L276 includes T (css-syntax-3 § 5.4.4
 * #ident-token / css-cascade-5 #defaulting-keywords).
 */
function identValueFlip(first: string, rest: string): IdentToken {
  let n = 0;
  return {
    type: 'ident',
    get value() {
      n += 1;
      return n === 1 ? first : rest;
    },
  } as IdentToken;
}

/**
 * Access order on a lone CSSFunction (probe-verified):
 * 1 validateMathFunctions, 2 L193 hasVarFunction, 3 L281 fnName,
 * then L302 / L312 / L322 hasVarFunction if that gate runs, else L379.
 * Early reads stay a non-var function so L193/L282 do not return.
 */
function functionNameByAccess(early: string, rest: string, fourth?: string): CSSFunction {
  let n = 0;
  return {
    type: 'function',
    value: [],
    get name() {
      n += 1;
      if (n === 4 && fourth !== undefined) return fourth;
      return n <= 3 ? early : rest;
    },
  } as CSSFunction;
}

/**
 * L204 POSITION_PROPERTIES.has returns; L372 is the second has(). Restoring
 * after the first call unique-causes isPositionProperty T at L373.
 */
function withPositionHasSkippedOnce(fn: () => void): void {
  POSITION_PROPERTIES.has = ((_key: string) => {
    POSITION_PROPERTIES.has = origPositionHas;
    return false;
  }) as Set<string>['has'];
  try {
    fn();
  } finally {
    POSITION_PROPERTIES.has = origPositionHas;
  }
}

describe('MC/DC round7 unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  // css-cascade-5 #defaulting-keywords
  test('L276 css-wide includes T via ident value flip after L180 F', () => {
    // Unique-cause: L276 includes T. L180 already returned when the ident is
    // inherit on every read; the getter keeps L180 F then flips for L276.
    withComponentValues([identValueFlip('block', 'inherit')], () => {
      const flipped = parseAll('display', 'block');
      assert.equal(flipped.length, 1);
      assert.ok(flipped[0] instanceof CSSKeywordValue);
      assert.equal((flipped[0] as CSSKeywordValue).value, 'inherit');
      const first = CSSStyleValue.parse('display', 'block');
      assert.ok(first instanceof CSSKeywordValue);
      assert.equal((first as CSSKeywordValue).value, 'inherit');
    });

    withComponentValues([identValueFlip('flex', 'unset')], () => {
      const unset = parseAll('display', 'flex');
      assert.ok(unset[0] instanceof CSSKeywordValue);
      assert.equal((unset[0] as CSSKeywordValue).value, 'unset');
    });

    // Unique-cause: L276 includes F (normal ident; css-wide T already returned at L180).
    const block = parseAll('display', 'block');
    assert.ok(block[0] instanceof CSSKeywordValue);
    assert.equal((block[0] as CSSKeywordValue).value, 'block');
    const inherit = parseAll('display', 'inherit');
    assert.ok(inherit[0] instanceof CSSKeywordValue);
    assert.equal((inherit[0] as CSSKeywordValue).value, 'inherit');
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue / css-variables-1 #using-variables
  test('L302/L312/L322 !hasVarFunction F via name flip after L193 F', () => {
    // Unique-cause: shorthand T && hasVarFunction T (L302). Early name reads
    // are url so L193/L282 stay F; access 4 is L302.
    withComponentValues([functionNameByAccess('url', 'var')], () => {
      const margin = parseAll('margin', 'url(x)');
      assert.equal(margin.length, 1);
      assert.ok(margin[0] instanceof CSSUnparsedValue);
      const parsed = CSSStyleValue.parse('margin', 'url(x)');
      assert.ok(parsed instanceof CSSUnparsedValue);
    });

    // Unique-cause: SHORTHANDS_DATA T && hasVarFunction T (L312). gap is not
    // in SHORTHANDS[], so access 4 is L312.
    withComponentValues([functionNameByAccess('url', 'var')], () => {
      const gap = parseAll('gap', 'url(x)');
      assert.ok(gap[0] instanceof CSSUnparsedValue);
    });

    // Unique-cause: syntax T && hasVarFunction T (L322). width/opacity skip
    // both shorthand gates.
    withComponentValues([functionNameByAccess('url', 'var')], () => {
      const width = parseAll('width', 'url(x)');
      assert.ok(width[0] instanceof CSSUnparsedValue);
      const opacity = parseAll('opacity', 'url(x)');
      assert.ok(opacity[0] instanceof CSSUnparsedValue);
    });

    // Unique-cause: !hasVarFunction T (no stub).
    const marginOk = parseAll('margin', '1px');
    assert.equal(marginOk[0].constructor, CSSStyleValue);
    const gapOk = parseAll('gap', '10px');
    assert.equal(gapOk[0].constructor, CSSStyleValue);
    assert.ok(parseAll('opacity', '0.5')[0] instanceof CSSUnitValue);

    // hasVarFunction at L193 returns before L302/L312/L322.
    assert.ok(parseAll('margin', 'var(--m)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('gap', 'var(--g)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('opacity', 'var(--o)')[0] instanceof CSSUnparsedValue);
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects
  test('L373 isPositionProperty T via skip-once has; auto/normal are not position keywords', () => {
    // Unique-cause: isPositionProperty T && isPositionKeyword T. Public
    // parseAll returns at L204; skip-once has() keeps L204 F.
    withPositionHasSkippedOnce(() => {
      const left = parseAll('offset-position', 'left');
      assert.equal(left.length, 1);
      assert.ok(left[0] instanceof CSSPositionValue);
      const first = CSSStyleValue.parse('offset-position', 'left');
      assert.ok(first instanceof CSSPositionValue);
    });
    withPositionHasSkippedOnce(() => {
      const obj = parseAll('object-position', 'left');
      assert.ok(obj[0] instanceof CSSPositionValue);
    });

    // Unique-cause: isPositionProperty T && isPositionKeyword F. offset-position
    // syntax lists auto/normal; those are not left/right/center/top/bottom.
    withPositionHasSkippedOnce(() => {
      const auto = parseAll('offset-position', 'auto');
      assert.ok(auto[0] instanceof CSSKeywordValue);
      assert.equal((auto[0] as CSSKeywordValue).value, 'auto');
    });
    withPositionHasSkippedOnce(() => {
      const normal = parseAll('offset-position', 'normal');
      assert.ok(normal[0] instanceof CSSKeywordValue);
      assert.equal((normal[0] as CSSKeywordValue).value, 'normal');
    });

    // Unique-cause: isPositionProperty F (isPositionKeyword skipped by
    // `!(A && B)` when A is F). isPositionProperty T without the stub
    // returns at L204.
    const flt = parseAll('float', 'left');
    assert.ok(flt[0] instanceof CSSKeywordValue);
    assert.equal((flt[0] as CSSKeywordValue).value, 'left');
    const display = parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    const pos = parseAll('object-position', 'left');
    assert.ok(pos[0] instanceof CSSPositionValue);
  });

  // css-typed-om-1 § 3.4 #unparsedvalue-objects / css-variables-1 #using-variables
  test('L379 fn.name === var T and L381 styleValue T/F via name flip', () => {
    // Unique-cause: L379 T && L381 T. -webkit-box-align has no generated
    // syntax, so access 4 is L379 (L302/L312/L322 skipped). createCSSStyleValue
    // then sees var() with empty args and returns CSSUnparsedValue.
    withComponentValues([functionNameByAccess('url', 'var')], () => {
      const unparsed = parseAll('-webkit-box-align', 'url(x)');
      assert.equal(unparsed.length, 1);
      assert.ok(unparsed[0] instanceof CSSUnparsedValue);
      const first = CSSStyleValue.parse('-webkit-box-align', 'url(x)');
      assert.ok(first instanceof CSSUnparsedValue);
    });

    // Unique-cause: L379 T && L381 F. Access 4 is var (L379 T); later reads
    // are a non-var/non-url/non-gradient name so createCSSStyleValue returns
    // null and L404 reifies generic CSSStyleValue.
    withComponentValues([functionNameByAccess('url', 'url-nope', 'var')], () => {
      const raw = parseAll('-webkit-box-align', 'url(x)');
      assert.equal(raw.length, 1);
      assert.equal(raw[0].constructor, CSSStyleValue);
      assert.ok(!(raw[0] instanceof CSSUnparsedValue));
      assert.ok(!(raw[0] instanceof CSSKeywordValue));
    });

    // Unique-cause: L379 F (public function that is not var()).
    const calc = parseAll('width', 'calc(1px + 1px)');
    assert.equal(calc.length, 1);
    assert.ok(calc[0].toString().includes('px'));
    const clip = parseAll('clip-path', 'url(clip.svg#c)');
    assert.ok(clip[0] instanceof CSSURLImageValue);
    const webkitUrl = parseAll('-webkit-box-align', 'url(x)');
    assert.ok(webkitUrl[0] instanceof CSSURLImageValue);
  });

  test('L159 property-name OR F-side; T is parseAllStyleValues L141 first', () => {
    // Unique-cause: === '--' F, startsWith('--') F.
    assert.throws(() => parseAll('-', 'auto'), TypeError);
    const color = parseAll('color', 'red');
    assert.ok(color[0] instanceof CSSKeywordValue);
    // Unique-cause: startsWith('--') T && length < 3 F. `'--'` T never reaches
    // _parseAll (parseAllStyleValues throws the same check first).
    const custom = parseAll('--mcdc-parseall7', 'hello');
    assert.ok(custom[0] instanceof CSSUnparsedValue);
    assert.throws(() => parseAll('--', 'auto'), TypeError);

    // Unique-cause: kw === 'transparent' cannot flip independently of
    // `kw in NAMED_COLORS` (transparent is a key; did not delete).
    const transparent = parseAll('color', 'transparent');
    assert.ok(transparent[0] instanceof CSSKeywordValue);
    assert.equal((transparent[0] as CSSKeywordValue).value.toLowerCase(), 'transparent');
    assert.ok(parseAll('color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('color', 'currentcolor')[0] instanceof CSSKeywordValue);
  });
});
