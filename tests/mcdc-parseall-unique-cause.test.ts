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
// Unique-cause leftovers for src/typed-om/values/style-value-parser.ts _parseAll
// not covered by tests/mcdc-hotspot-parse-all.test.ts or tests/mcdc-hotspot-parse-all-more.test.ts.
// Drive public CSSStyleValue.parse / parseAll only. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSTransformValue,
  CSSTranslate,
  CSSRotate,
  CSSScale,
  CSSColorValue,
  CSSRGB,
  CSSHSL,
  CSSHWB,
  CSSLab,
  CSSOKLCH,
  CSSColor,
} from '../src/typed-om.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

describe('MC/DC unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue / css-transforms-1 #transform-property
  test('transform ident that is not none falls through to CSSTransformValue.parse', () => {
    // Unique-cause: trimmed is a single ident whose value !== 'none' (NONE still lowercases).
    const noneUpper = parseAll('transform', 'NONE');
    assert.ok(noneUpper[0] instanceof CSSKeywordValue);
    assert.equal((noneUpper[0] as CSSKeywordValue).value.toLowerCase(), 'none');

    const commented = parseAll('transform', '/* skip */ none /* skip */');
    assert.ok(commented[0] instanceof CSSKeywordValue);

    assert.throws(() => parseAll('transform', 'auto'), TypeError);
    assert.throws(() => parseAll('transform', 'matrix'), TypeError);
    assert.throws(() => parseAll('transform', 'foo'), TypeError);

    const matrix = parseAll('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    assert.ok(matrix[0] instanceof CSSTransformValue);
  });

  // css-transforms-2 #individual-transforms
  test('translate/rotate/scale comma-only is zero args; commas are filtered', () => {
    // Unique-cause: args.length < 1 (existing tests only used length > 3).
    assert.throws(() => parseAll('translate', ','), TypeError);
    assert.throws(() => parseAll('translate', ' , '), TypeError);
    assert.throws(() => parseAll('scale', ','), TypeError);
    assert.throws(() => parseAll('rotate', ','), TypeError);

    const translated = parseAll('translate', '10px, 20px, 30px');
    assert.ok(translated[0] instanceof CSSTranslate);
    const scaled = parseAll('scale', '2, 3');
    assert.ok(scaled[0] instanceof CSSScale);
    const rotated = parseAll('rotate', '1, 0, 0, 45deg');
    assert.ok(rotated[0] instanceof CSSRotate);

    // `none` is an ident, not a missing arg list — scale maps it; rotate/translate reject.
    assert.ok(parseAll('scale', 'none')[0] instanceof CSSScale);
    assert.throws(() => parseAll('rotate', 'none'), TypeError);
    assert.throws(() => parseAll('translate', 'none'), TypeError);
  });

  test('supported properties with no STANDARD_PROPERTIES_SYNTAX skip the syntax gate', () => {
    // Unique-cause: syntax is missing and property does not start with '--'.
    // -webkit-box-* are in SUPPORTED_PROPERTIES but not STANDARD_PROPERTIES_SYNTAX.
    const align = parseAll('-webkit-box-align', 'center');
    assert.equal(align.length, 1);
    assert.ok(align[0] instanceof CSSKeywordValue);
    assert.equal((align[0] as CSSKeywordValue).value, 'center');

    const flex = parseAll('-webkit-box-flex', '1');
    assert.ok(flex[0] instanceof CSSUnitValue);
    assert.equal((flex[0] as CSSUnitValue).value, 1);

    const orient = parseAll('-webkit-box-orient', 'horizontal');
    assert.ok(orient[0] instanceof CSSKeywordValue);

    const pack = parseAll('-webkit-box-pack', 'end');
    assert.ok(pack[0] instanceof CSSKeywordValue);

    const ordinal = parseAll('-webkit-box-ordinal-group', '2');
    assert.ok(ordinal[0] instanceof CSSUnitValue);

    assert.ok(parseAll('-webkit-box-flex', 'var(--x)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('-webkit-box-align', 'inherit')[0] instanceof CSSKeywordValue);

    const mixed = parseAll('-Webkit-Box-Align', 'stretch');
    assert.ok(mixed[0] instanceof CSSKeywordValue);
  });

  // css-typed-om-1 § 3.6 #colorvalue-objects / css-color-4 #typedef-color
  test('color leftover: system colors, functions, remaining longhands, integer syntax miss', () => {
    // Unique-cause all-F row for the named|currentcolor|transparent|auto|invert|none|syntax OR:
    // `canvas` is a system color, not a named color, then CSSColorValue.parse succeeds.
    const canvas = parseAll('color', 'canvas');
    assert.ok(canvas[0] instanceof CSSKeywordValue);
    assert.equal((canvas[0] as CSSKeywordValue).value.toLowerCase(), 'canvas');

    const buttonFace = parseAll('color', 'ButtonFace');
    assert.ok(buttonFace[0] instanceof CSSKeywordValue);
    assert.equal((buttonFace[0] as CSSKeywordValue).value.toLowerCase(), 'buttonface');

    // Newer system color is rejected by generated <color> syntax before reify.
    assert.throws(() => parseAll('color', 'accentcolor'), TypeError);

    const rgb = parseAll('color', 'rgb(0, 0, 0)');
    assert.ok(rgb[0] instanceof CSSRGB);
    const rgbSpace = parseAll('color', 'rgb(0 0 0 / 50%)');
    assert.ok(rgbSpace[0] instanceof CSSRGB);
    const hsl = parseAll('color', 'hsl(0 100% 50%)');
    assert.ok(hsl[0] instanceof CSSHSL);
    const hwb = parseAll('color', 'hwb(0 0% 0%)');
    assert.ok(hwb[0] instanceof CSSHWB);
    const lab = parseAll('color', 'lab(50% 40 20)');
    assert.ok(lab[0] instanceof CSSLab);
    const oklch = parseAll('color', 'oklch(0.5 0.1 30)');
    assert.ok(oklch[0] instanceof CSSOKLCH);
    const colorFn = parseAll('color', 'color(srgb 1 0 0)');
    assert.ok(colorFn[0] instanceof CSSColor);

    assert.throws(() => parseAll('color', 'light-dark(red, blue)'), TypeError);
    assert.throws(() => parseAll('color', 'red blue'), TypeError);
    assert.throws(() => parseAll('outline-color', 'invert'), TypeError);
    assert.throws(() => parseAll('fill', 'none'), TypeError);

    // Remaining COLOR_PROPERTIES longhands (not color / background-color / outline / caret / fill).
    assert.ok(parseAll('border-left-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-inline-start-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-block-start-color', 'blue')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('text-decoration-color', 'blue')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('column-rule-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('stroke', 'currentcolor')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('fill', 'transparent')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-top-color', 'transparent')[0] instanceof CSSKeywordValue);

    // Syntax allows <integer> so matchesSyntax passes; CSSColorValue.parse then throws.
    assert.throws(() => parseAll('column-rule-color', '1'), TypeError);

    const mixedCase = parseAll('Color', 'rebeccapurple');
    assert.ok(mixedCase[0] instanceof CSSKeywordValue);
    const hexShort = parseAll('color', '#fff');
    assert.ok(hexShort[0] instanceof CSSColorValue || hexShort[0] instanceof CSSRGB);
  });

  test('non-position properties whose ident is a <position> keyword still reify as keywords', () => {
    // Unique-cause: isPositionKeyword T while isPositionProperty is F (position props return earlier).
    const flt = parseAll('float', 'left');
    assert.ok(flt[0] instanceof CSSKeywordValue);
    assert.equal((flt[0] as CSSKeywordValue).value, 'left');

    const clear = parseAll('clear', 'right');
    assert.ok(clear[0] instanceof CSSKeywordValue);
    assert.equal((clear[0] as CSSKeywordValue).value, 'right');

    const caption = parseAll('caption-side', 'top');
    assert.ok(caption[0] instanceof CSSKeywordValue);

    const bottom = parseAll('caption-side', 'bottom');
    assert.ok(bottom[0] instanceof CSSKeywordValue);
  });

  test('width math leftovers and individual transform commas vs spaces', () => {
    const min = parseAll('width', 'min(1px, 2em)');
    assert.equal(min.length, 1);
    assert.equal(min[0].toString().includes('min('), true);

    const max = parseAll('width', 'max(1px, 2em)');
    assert.equal(max[0].toString().includes('max('), true);

    const clamp = parseAll('width', 'clamp(1px, 50%, 2em)');
    assert.equal(clamp[0].toString().includes('clamp('), true);

    assert.ok(parseAll('width', 'calc(var(--x) + 1px)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('margin', 'var(--m)')[0] instanceof CSSUnparsedValue);

    const rotateTrail = parseAll('rotate', '45deg,');
    assert.ok(rotateTrail[0] instanceof CSSRotate);
  });
});
