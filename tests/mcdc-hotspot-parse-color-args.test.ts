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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ
// Leftover unique-cause rows for src/typed-om/color/color-spaces.ts parseColorArgs
// (css-typed-om-2 § 2 #colorvalue-objects, css-color-4 #rgb-functions / #the-hsl-notation
// / #the-hwb-notation / #lab-colors / #lch-colors / #ok-lab / #predefined).
// Driven only through CSSColorValue.parse and CSSStyleValue.parse('color', ...).
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSColorValue,
  CSSRGB,
  CSSHSL,
  CSSHWB,
  CSSLab,
  CSSLCH,
  CSSOKLab,
  CSSOKLCH,
  CSSColor,
  CSSUnitValue,
  CSSKeywordValue,
} from '../src/typed-om.ts';

function assertInvalidColor(css: string): void {
  assert.throws(
    () => CSSColorValue.parse(css),
    (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    css,
  );
}

function assertInvalidStyleColor(css: string): void {
  assert.throws(() => CSSStyleValue.parse('color', css), TypeError, css);
}

function unit(v: unknown, value: number, unitName: string): CSSUnitValue {
  assert.ok(v instanceof CSSUnitValue, `expected CSSUnitValue, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value, value);
  assert.equal(v.unit, unitName);
  return v;
}

function none(v: unknown): CSSKeywordValue {
  assert.ok(v instanceof CSSKeywordValue, `expected none keyword, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value.toLowerCase(), 'none');
  return v;
}

const FUNCTIONS = ['rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color'] as const;

describe('MC/DC leftover: parseColorArgs (css-color-4 color functions)', { concurrency: false }, () => {
  test('empty, whitespace-only, comment-only, and missing args reject every function', () => {
    // tokens.length === 0 (unique-cause T): rgb() / comments / spaces.
    for (const fn of FUNCTIONS) {
      assertInvalidColor(`${fn}()`);
      assertInvalidColor(`${fn}( )`);
      assertInvalidColor(`${fn}(/* only a comment */)`);
    }

    // extractedArgs.length !== 3 without slash, and color() length < 2.
    assertInvalidColor('rgb(255)');
    assertInvalidColor('rgb(255 0)');
    assertInvalidColor('rgba(1, 2)');
    assertInvalidColor('hsl(120)');
    assertInvalidColor('hsl(120 50%)');
    assertInvalidColor('hsla(120, 50%)');
    assertInvalidColor('hwb(120)');
    assertInvalidColor('hwb(120 10%)');
    assertInvalidColor('lab(50%)');
    assertInvalidColor('lab(50% 10)');
    assertInvalidColor('lch(50% 10)');
    assertInvalidColor('oklab(0.5)');
    assertInvalidColor('oklab(0.5 0.1)');
    assertInvalidColor('oklch(0.5 0.1)');
    assertInvalidColor('color()');
    assertInvalidColor('color(srgb)');
    assertInvalidColor('color(/ 0.5)');

    // Space-separated 4-arg without slash is not modern syntax (hasCommas=F, length=4).
    assertInvalidColor('rgb(255 0 0 0.5)');
    assertInvalidColor('hsl(120 50% 50% 0.5)');
  });

  test('slash alpha: first slash, double slash, slash not last, and arity', () => {
    // slashIndex !== -1 unique-cause T then F: first slash records, second slash returns null.
    const rgbSlash = CSSColorValue.parse('rgb(255 0 0 / 0.5)');
    assert.ok(rgbSlash instanceof CSSRGB);
    unit(rgbSlash.r, 255, 'number');
    unit(rgbSlash.alpha, 50, 'percent');

    const rgbTight = CSSColorValue.parse('rgb(0 128 255/0.25)');
    assert.ok(rgbTight instanceof CSSRGB);
    unit(rgbTight.alpha, 25, 'percent');

    assertInvalidColor('rgb(255 0 0 / / 0.5)');
    assertInvalidColor('rgb(255 0 0 / 0.5 / 0.2)');
    assertInvalidColor('hsl(120 50% 50% / 0.4 / none)');

    // slashIndex !== extractedArgs.length - 1 (slash in the middle).
    assertInvalidColor('rgb(255 / 0 0 0.5)');
    assertInvalidColor('hsl(120 / 50% 50% 0.5)');
    assertInvalidColor('lab(50% / 10 10 0.5)');

    // slash last but extractedArgs.length !== 4.
    assertInvalidColor('rgb(255 0 / 0.5)');
    assertInvalidColor('rgb(255 0 0 1 / 0.5)');
    assertInvalidColor('hsl(120 50% / 0.5)');
    assertInvalidColor('hwb(120 10% 20% 30% / 0.5)');
    assertInvalidColor('oklch(0.5 0.1 40 1 / none)');

    // Mixed comma + slash is rejected before extraction (hasCommas && slashIndex !== -1).
    assertInvalidColor('rgb(255, 0, 0 / 0.5)');
    assertInvalidColor('hsl(120, 50%, 50% / 0.5)');
    assertInvalidColor('color(srgb 0.1, 0.2 / 0.5)');
  });

  test('comma lists: 3-arg, 4-arg alpha, placement errors, trailing comma', () => {
    // hasCommas && extractedArgs.length === 4 unique-cause T.
    const rgb4 = CSSColorValue.parse('rgb(255, 0, 0, 0.5)');
    assert.ok(rgb4 instanceof CSSRGB);
    unit(rgb4.r, 255, 'number');
    unit(rgb4.alpha, 50, 'percent');

    const rgb3 = CSSColorValue.parse('rgb(1, 2, 3)');
    assert.ok(rgb3 instanceof CSSRGB);
    unit(rgb3.b, 3, 'number');
    unit(rgb3.alpha, 100, 'percent');

    const hsl4 = CSSColorValue.parse('hsl(120, 50%, 50%, 0.5)');
    assert.ok(hsl4 instanceof CSSHSL);
    unit(hsl4.alpha, 50, 'percent');

    // Trailing comma is an odd-index comma (i%2===1, type===comma) and still length 3.
    const trailing = CSSColorValue.parse('rgb(255, 0, 0,)');
    assert.ok(trailing instanceof CSSRGB);
    unit(trailing.r, 255, 'number');

    // Even-index comma (leading / doubled) and odd-index non-comma (mixed separators).
    assertInvalidColor('rgb(, 255, 0, 0)');
    assertInvalidColor('rgb(255,, 0, 0)');
    assertInvalidColor('rgb(255, 0 0)');
    assertInvalidColor('rgb(255 0, 0)');
    assertInvalidColor('hsl(120, 50% 50%)');
    assertInvalidColor('rgb(1, 2, 3, 0.5, 0.1)');
  });

  test('none components and slash-alpha none across rgb/hsl/hwb/lab/lch/oklab/oklch/color()', () => {
    // CSSKeywordValue unique-cause (constructor.name === CSSKeywordValue).
    const rgb = CSSColorValue.parse('rgb(none none none)') as CSSRGB;
    none(rgb.r);
    none(rgb.g);
    none(rgb.b);
    unit(rgb.alpha, 100, 'percent');

    const rgbComma = CSSColorValue.parse('rgb(none, none, none)') as CSSRGB;
    none(rgbComma.r);

    const rgbAlpha = CSSColorValue.parse('rgb(255 0 0 / none)') as CSSRGB;
    none(rgbAlpha.alpha);
    assert.equal(rgbAlpha.toString(), 'rgba(255, 0, 0, none)');

    const hsl = CSSColorValue.parse('hsl(none none none)') as CSSHSL;
    none(hsl.h);
    none(hsl.s);
    none(hsl.l);

    const hslAlpha = CSSColorValue.parse('hsla(none 50% 50% / none)') as CSSHSL;
    none(hslAlpha.h);
    none(hslAlpha.alpha);

    // css-typed-om-2 #csshwb: h is CSSNumericValue, so hue none cannot reify; w/b none can.
    assert.throws(() => CSSColorValue.parse('hwb(none 10% 20%)'), TypeError);
    const hwb = CSSColorValue.parse('hwb(120deg none none)') as CSSHWB;
    unit(hwb.h, 120, 'deg');
    none(hwb.w);
    none(hwb.b);

    const lab = CSSColorValue.parse('lab(none none none)') as CSSLab;
    none(lab.l);
    none(lab.a);
    none(lab.b);

    const lch = CSSColorValue.parse('lch(none none none)') as CSSLCH;
    none(lch.l);
    none(lch.c);
    none(lch.h);

    const oklab = CSSColorValue.parse('oklab(none none none)') as CSSOKLab;
    none(oklab.l);
    none(oklab.a);
    none(oklab.b);

    const oklch = CSSColorValue.parse('oklch(0.5 0.1 40 / none)') as CSSOKLCH;
    none(oklch.alpha);
    unit(oklch.l, 50, 'percent');

    const color = CSSColorValue.parse('color(srgb none none none)') as CSSColor;
    assert.equal(color.colorSpace.value, 'srgb');
    none(color.channels[0]);
    none(color.channels[1]);
    none(color.channels[2]);

    const colorAlpha = CSSColorValue.parse('color(srgb 0.1 0.2 0.3 / none)') as CSSColor;
    none(colorAlpha.alpha);
  });

  test('percentages, number/percent alpha, and unit conversion per function', () => {
    const rgbPct = CSSColorValue.parse('rgb(100% 0% 50%)') as CSSRGB;
    unit(rgbPct.r, 100, 'percent');
    unit(rgbPct.g, 0, 'percent');
    unit(rgbPct.b, 50, 'percent');

    const rgbCommaPct = CSSColorValue.parse('rgb(100%, 0%, 0%)') as CSSRGB;
    unit(rgbCommaPct.r, 100, 'percent');

    const rgbPctAlpha = CSSColorValue.parse('rgb(100% 0% 0% / 50%)') as CSSRGB;
    unit(rgbPctAlpha.alpha, 50, 'percent');

    const rgbaPct = CSSColorValue.parse('rgba(1 2 3 / 50%)') as CSSRGB;
    unit(rgbaPct.alpha, 50, 'percent');

    const hslDeg = CSSColorValue.parse('hsl(120deg 50% 40%)') as CSSHSL;
    unit(hslDeg.h, 120, 'deg');
    unit(hslDeg.s, 50, 'percent');
    unit(hslDeg.l, 40, 'percent');
    unit(hslDeg.alpha, 100, 'percent');

    const hslNumHue = CSSColorValue.parse('hsl(90 25% 75% / 0.2)') as CSSHSL;
    unit(hslNumHue.h, 90, 'deg');
    unit(hslNumHue.alpha, 20, 'percent');

    const hslaPct = CSSColorValue.parse('hsla(120 50% 50% / 40%)') as CSSHSL;
    unit(hslaPct.alpha, 40, 'percent');

    const hwb = CSSColorValue.parse('hwb(180 10% 20% / 0.8)') as CSSHWB;
    unit(hwb.h, 180, 'deg');
    unit(hwb.w, 10, 'percent');
    unit(hwb.b, 20, 'percent');
    unit(hwb.alpha, 80, 'percent');

    const hwbDeg = CSSColorValue.parse('hwb(45deg 0% 100%)') as CSSHWB;
    unit(hwbDeg.h, 45, 'deg');

    // lab: number L → percent; percent a/b → * 1.25 number; number a/b stay numbers.
    const labNum = CSSColorValue.parse('lab(50 10 20)') as CSSLab;
    unit(labNum.l, 50, 'percent');
    unit(labNum.a, 10, 'number');
    unit(labNum.b, 20, 'number');

    const labPct = CSSColorValue.parse('lab(50% 10% 20% / 0.5)') as CSSLab;
    unit(labPct.l, 50, 'percent');
    unit(labPct.a, 12.5, 'number');
    unit(labPct.b, 25, 'number');
    unit(labPct.alpha, 50, 'percent');

    const labPctAlpha = CSSColorValue.parse('lab(40% 1 2 / 25%)') as CSSLab;
    unit(labPctAlpha.alpha, 25, 'percent');

    // lch: number L → percent; number C → C/1.5 percent; percent C kept; number H → deg.
    const lchNum = CSSColorValue.parse('lch(50 10 40)') as CSSLCH;
    unit(lchNum.l, 50, 'percent');
    unit(lchNum.c, 10 / 1.5, 'percent');
    unit(lchNum.h, 40, 'deg');

    const lchPctC = CSSColorValue.parse('lch(50% 50% 40deg / 50%)') as CSSLCH;
    unit(lchPctC.l, 50, 'percent');
    unit(lchPctC.c, 50, 'percent');
    unit(lchPctC.h, 40, 'deg');
    unit(lchPctC.alpha, 50, 'percent');

    // oklab: number L * 100 percent; percent a/b * 0.004 number.
    const oklabNum = CSSColorValue.parse('oklab(0.5 0.1 -0.2)') as CSSOKLab;
    unit(oklabNum.l, 50, 'percent');
    unit(oklabNum.a, 0.1, 'number');
    unit(oklabNum.b, -0.2, 'number');

    const oklabPct = CSSColorValue.parse('oklab(50% 10% 20%)') as CSSOKLab;
    unit(oklabPct.l, 50, 'percent');
    unit(oklabPct.a, 0.04, 'number');
    unit(oklabPct.b, 0.08, 'number');

    const oklchNum = CSSColorValue.parse('oklch(0.5 0.1 40)') as CSSOKLCH;
    unit(oklchNum.l, 50, 'percent');
    unit(oklchNum.c, 0.1 / 0.004, 'percent');
    unit(oklchNum.h, 40, 'deg');

    const oklchPct = CSSColorValue.parse('oklch(50% 50% 40deg / 10%)') as CSSOKLCH;
    unit(oklchPct.l, 50, 'percent');
    unit(oklchPct.c, 50, 'percent');
    unit(oklchPct.h, 40, 'deg');
    unit(oklchPct.alpha, 10, 'percent');
  });

  test('color() space, missing args, slash alpha, percentages, and comma form', () => {
    const spaceOnlyChannel = CSSColorValue.parse('color(srgb 0.1)') as CSSColor;
    assert.equal(spaceOnlyChannel.colorSpace.value, 'srgb');
    assert.equal(spaceOnlyChannel.channels.length, 1);
    unit(spaceOnlyChannel.channels[0], 0.1, 'number');
    unit(spaceOnlyChannel.alpha, 1, 'number');

    const noAlpha = CSSColorValue.parse('color(display-p3 0.1 0.2 0.3)') as CSSColor;
    assert.equal(noAlpha.colorSpace.value, 'display-p3');
    unit(noAlpha.channels[0], 0.1, 'number');
    unit(noAlpha.alpha, 1, 'number');
    assert.equal(noAlpha.toString(), 'color(display-p3 0.1 0.2 0.3)');

    const slash = CSSColorValue.parse('color(srgb 0.1 0.2 0.3 / 0.5)') as CSSColor;
    unit(slash.alpha, 0.5, 'number');
    assert.equal(slash.toString(), 'color(srgb 0.1 0.2 0.3 / 0.5)');

    const pct = CSSColorValue.parse('color(srgb 10% 20% 30%)') as CSSColor;
    unit(pct.channels[0], 10, 'percent');
    unit(pct.channels[1], 20, 'percent');
    unit(pct.channels[2], 30, 'percent');

    const pctAlpha = CSSColorValue.parse('color(display-p3 1 0 0 / 50%)') as CSSColor;
    unit(pctAlpha.alpha, 50, 'percent');

    // slash with no extra channels: args=[space, alpha], channels slice empty.
    const spaceAlpha = CSSColorValue.parse('color(srgb / 0.5)') as CSSColor;
    assert.equal(spaceAlpha.colorSpace.value, 'srgb');
    assert.equal(spaceAlpha.channels.length, 0);
    unit(spaceAlpha.alpha, 0.5, 'number');

    const commas = CSSColorValue.parse('color(srgb, 0.1, 0.2)') as CSSColor;
    assert.equal(commas.channels.length, 2);
    unit(commas.channels[0], 0.1, 'number');

    // Function name is ASCII-case-insensitive (nameLower === 'color').
    const folded = CSSColorValue.parse('COLOR(sRGB 1 0 0)') as CSSColor;
    assert.equal(folded.colorSpace.value, 'sRGB');

    // First channel must be a keyword color space after parseColorArgs.
    assertInvalidColor('color(1 0.2 0.3)');
    assertInvalidColor('color(50% 0.2 0.3)');
  });

  test('rejected component types: string, hash, calc, var, url, non-slash delim', () => {
    // createCSSStyleValue → null (string / hash / delim) and non-unit/keyword (calc/var/url).
    assertInvalidColor('rgb("a" 2 3)');
    assertInvalidColor('rgb(1, 2, "a")');
    assertInvalidColor('rgb(#fff 0 0)');
    assertInvalidColor('rgb(1 + 2 3)');
    assertInvalidColor('rgb(calc(1) 2 3)');
    assertInvalidColor('rgb(var(--x) 2 3)');
    assertInvalidColor('hsl(url(x) 50% 50%)');
    assertInvalidColor('lab(50% min(1, 2) 10)');
    assertInvalidColor('color(srgb calc(0.1) 0.2 0.3)');
  });

  test('whitespace and comments are skipped; rgba/hsla aliases reify', () => {
    const commented = CSSColorValue.parse('rgb(255 /* mid */ 0 0)');
    assert.ok(commented instanceof CSSRGB);
    unit((commented as CSSRGB).g, 0, 'number');

    const padded = CSSColorValue.parse('rgb(  10   20   30  /   0.5  )');
    assert.ok(padded instanceof CSSRGB);
    unit((padded as CSSRGB).alpha, 50, 'percent');

    const trailingComment = CSSColorValue.parse('hsl(120 50% 50% /* end */)');
    assert.ok(trailingComment instanceof CSSHSL);

    const rgbaComma = CSSColorValue.parse('rgba(1, 2, 3, 0.5)') as CSSRGB;
    unit(rgbaComma.alpha, 50, 'percent');

    const rgbaSlash = CSSColorValue.parse('rgba(10 20 30 / 0.25)') as CSSRGB;
    unit(rgbaSlash.r, 10, 'number');
    unit(rgbaSlash.alpha, 25, 'percent');

    const hslaComma = CSSColorValue.parse('hsla(120, 50%, 50%, 0.5)') as CSSHSL;
    unit(hslaComma.h, 120, 'deg');
    unit(hslaComma.alpha, 50, 'percent');

    const hslaSlash = CSSColorValue.parse('hsla(90deg 40% 60% / 0.1)') as CSSHSL;
    unit(hslaSlash.h, 90, 'deg');
    unit(hslaSlash.s, 40, 'percent');
    unit(hslaSlash.alpha, 10, 'percent');
  });

  test("CSSStyleValue.parse('color', ...) routes functions, none, percentages, and rejects leftovers", () => {
    const rgb = CSSStyleValue.parse('color', 'rgb(255 0 0 / 0.5)');
    assert.ok(rgb instanceof CSSRGB);
    unit((rgb as CSSRGB).alpha, 50, 'percent');

    const hsl = CSSStyleValue.parse('color', 'hsl(120 50% 50%)');
    assert.ok(hsl instanceof CSSHSL);

    const hwb = CSSStyleValue.parse('color', 'hwb(180 10% 20% / 40%)');
    assert.ok(hwb instanceof CSSHWB);
    unit((hwb as CSSHWB).alpha, 40, 'percent');

    const lab = CSSStyleValue.parse('color', 'lab(50% 10 10)');
    assert.ok(lab instanceof CSSLab);

    const lch = CSSStyleValue.parse('color', 'lch(50% 10 40 / 0.5)');
    assert.ok(lch instanceof CSSLCH);
    unit((lch as CSSLCH).alpha, 50, 'percent');

    const oklab = CSSStyleValue.parse('color', 'oklab(0.5 10% 20%)');
    assert.ok(oklab instanceof CSSOKLab);
    unit((oklab as CSSOKLab).a, 0.04, 'number');

    const oklch = CSSStyleValue.parse('color', 'oklch(none none none)');
    assert.ok(oklch instanceof CSSOKLCH);
    none((oklch as CSSOKLCH).h);

    const color = CSSStyleValue.parse('color', 'color(srgb 10% 20% 30% / none)');
    assert.ok(color instanceof CSSColor);
    none((color as CSSColor).alpha);

    const noneRgb = CSSStyleValue.parse('color', 'rgb(none none none / none)');
    assert.ok(noneRgb instanceof CSSRGB);
    none((noneRgb as CSSRGB).r);
    none((noneRgb as CSSRGB).alpha);

    const pct = CSSStyleValue.parse('color', 'rgb(100% 0% 0%)');
    assert.ok(pct instanceof CSSRGB);
    unit((pct as CSSRGB).r, 100, 'percent');

    const parseAll = CSSStyleValue.parseAll('color', 'rgba(1 2 3 / 50%)');
    assert.equal(parseAll.length, 1);
    assert.ok(parseAll[0] instanceof CSSRGB);

    assertInvalidStyleColor('rgb()');
    assertInvalidStyleColor('rgb(255)');
    assertInvalidStyleColor('hsl(120 50%)');
    assertInvalidStyleColor('color(srgb)');
    assertInvalidStyleColor('rgb(255, 0, 0 / 0.5)');
    assertInvalidStyleColor('lab(50% calc(1) 2)');
  });
});
