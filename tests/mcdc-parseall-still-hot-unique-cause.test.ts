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
// Still-hot unique-cause leftovers for src/typed-om/values/style-value-parser.ts _parseAll
// not covered by tests/mcdc-hotspot-parse-all.test.ts,
// tests/mcdc-hotspot-parse-all-more.test.ts, or tests/mcdc-parseall-unique-cause.test.ts.
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
  CSSScale,
  CSSColorValue,
  CSSRGB,
  CSSLCH,
  CSSOKLab,
  CSSPositionValue,
  CSS,
} from '../src/typed-om.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

describe('MC/DC still-hot unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue — SHORTHANDS_DATA path
  test('SHORTHANDS_DATA parseStyleAttribute empty declarations vs junk reify', () => {
    // Unique-cause: parsed.declarations.length === 0 T. `}{` aborts the
    // synthesized `property: css` declaration list; a lone `)` still yields
    // one declaration so the same path reifies generic CSSStyleValue.
    assert.throws(() => parseAll('gap', '}{'), TypeError);
    assert.throws(() => parseAll('gap', '1px }{'), TypeError);
    assert.throws(() => parseAll('grid', '}{'), TypeError);
    assert.throws(() => parseAll('box-shadow', '}{'), TypeError);
    assert.throws(() => parseAll('mask', '}{'), TypeError);
    assert.throws(() => parseAll('columns', '}{'), TypeError);
    assert.throws(() => parseAll('place-self', '}{'), TypeError);
    assert.throws(() => parseAll('animation-range', '}{'), TypeError);
    assert.throws(() => parseAll('vertical-align', '}{'), TypeError);

    const gapJunk = parseAll('gap', ')');
    assert.equal(gapJunk.length, 1);
    assert.equal(gapJunk[0].constructor, CSSStyleValue);

    // SHORTHANDS[] expand fails first; never reaches the SHORTHANDS_DATA empty check.
    assert.throws(() => parseAll('margin', '}{'), TypeError);
    assert.throws(() => parseAll('all', '}{'), TypeError);
  });

  // css-cascade-5 #all-shorthand
  test('all shorthand expand rejects every non-css-wide value', () => {
    // Unique-cause: SHORTHANDS['all'].expand returns null (css-wide already returned).
    assert.throws(() => parseAll('all', 'red'), TypeError);
    assert.throws(() => parseAll('all', 'initial, inherit'), TypeError);
    const unset = parseAll('all', 'unset');
    assert.ok(unset[0] instanceof CSSKeywordValue);
    assert.equal((unset[0] as CSSKeywordValue).value.toLowerCase(), 'unset');
    assert.ok(parseAll('all', 'INHERIT')[0] instanceof CSSKeywordValue);
  });

  // css-typed-om-1 § 3.6 #colorvalue-objects / css-backgrounds-3 #propdef-border-block-color
  test('color properties: <image> functions pass syntax then CSSColorValue.parse throws', () => {
    // Unique-cause: COLOR_PROPERTIES + trimmed.length === 1 + type !== ident (function),
    // after generated syntax `<color> | <image>` / `| auto` accepts the image function.
    // Existing parseAll files used hash (`#fff`) and integer (`column-rule-color: 1`).
    assert.throws(() => parseAll('outline-color', 'url(x.png)'), TypeError);
    assert.throws(() => parseAll('outline-color', 'linear-gradient(red, blue)'), TypeError);
    assert.throws(() => parseAll('border-block-color', 'url(x.png)'), TypeError);
    assert.throws(() => parseAll('border-block-color', 'linear-gradient(red, blue)'), TypeError);
    assert.throws(() => parseAll('border-inline-color', 'url(frame.png)'), TypeError);

    // Unique-cause: kw === 'auto' T on outline-color (syntax extra `| auto`).
    const outlineAuto = parseAll('outline-color', 'auto');
    assert.ok(outlineAuto[0] instanceof CSSKeywordValue);
    assert.equal((outlineAuto[0] as CSSKeywordValue).value, 'auto');

    // invert / none still fail matchesSyntax before the color-OR (unpairable T).
    assert.throws(() => parseAll('outline-color', 'invert'), TypeError);
    assert.throws(() => parseAll('outline-color', 'none'), TypeError);
    assert.throws(() => parseAll('border-block-color', 'none'), TypeError);
    assert.throws(() => parseAll('color', 'rgb()'), TypeError);
    assert.throws(() => parseAll('color', 'hwb(none none none)'), TypeError);
  });

  // css-color-4 #css-system-colors / css-typed-om-1 § 3.6 #colorvalue-objects
  test('color leftover: remaining system colors and lch/oklab/rgba/8-digit hex', () => {
    // Unique-cause all-F color-OR then CSSColorValue.parse (not canvas/ButtonFace).
    for (const kw of ['CanvasText', 'LinkText', 'VisitedText', 'Highlight', 'GrayText']) {
      const parsed = parseAll('color', kw);
      assert.equal(parsed.length, 1);
      assert.ok(parsed[0] instanceof CSSKeywordValue);
      assert.equal((parsed[0] as CSSKeywordValue).value.toLowerCase(), kw.toLowerCase());
    }
    assert.throws(() => parseAll('color', 'ActiveText'), TypeError);
    assert.throws(() => parseAll('color', 'FieldText'), TypeError);
    assert.throws(() => parseAll('color', 'AccentColor'), TypeError);
    assert.throws(() => parseAll('color', 'Mark'), TypeError);

    const lch = parseAll('color', 'lch(50% 40 20)');
    assert.ok(lch[0] instanceof CSSLCH);
    const oklab = parseAll('color', 'oklab(0.5 0.1 0.1)');
    assert.ok(oklab[0] instanceof CSSOKLab);
    const rgba = parseAll('color', 'rgba(0, 0, 0, 0)');
    assert.ok(rgba[0] instanceof CSSRGB);
    const hex8 = parseAll('color', '#ffffffff');
    assert.ok(hex8[0] instanceof CSSColorValue || hex8[0] instanceof CSSRGB);

    const first = CSSStyleValue.parse('color', 'lch(50% 40 20)');
    assert.ok(first instanceof CSSLCH);
  });

  test('remaining COLOR_PROPERTIES longhands vs color-like properties not in the set', () => {
    assert.ok(parseAll('border-right-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-bottom-color', 'blue')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-inline-end-color', 'green')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('border-block-end-color', 'yellow')[0] instanceof CSSKeywordValue);

    // border-color is SHORTHANDS[] not LOGICAL_2VAL: expand succeeds and returns
    // generic CSSStyleValue before the COLOR_PROPERTIES ident-OR.
    const borderColor = parseAll('border-color', 'red');
    assert.equal(borderColor[0].constructor, CSSStyleValue);
    const two = parseAll('border-color', 'red blue');
    assert.equal(two[0].constructor, CSSStyleValue);

    // LOGICAL_2VAL color: expand succeeds then generated syntax is a 1-token union.
    assert.throws(() => parseAll('border-inline-color', 'red blue'), TypeError);
    assert.throws(() => parseAll('border-block-color', 'red transparent'), TypeError);

    // Unique-cause: COLOR_PROPERTIES.has F — these parse as ordinary idents.
    assert.ok(parseAll('flood-color', 'canvas')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('stop-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('-webkit-text-fill-color', 'red')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('-webkit-text-stroke-color', 'blue')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('scrollbar-color', 'auto')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('scrollbar-color', 'red')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('scrollbar-color', 'red blue'), TypeError);
  });

  // css-backgrounds-3 / css-logical-1 — leftover SHORTHANDS_DATA-only families
  test('remaining SHORTHANDS_DATA-only families reify generic CSSStyleValue', () => {
    assert.equal(parseAll('mask', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('mask', 'url(m.png)')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('place-self', 'center')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('offset', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('text-decoration', 'underline')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('flex-flow', 'row wrap')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('overscroll-behavior', 'auto')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('contain-intrinsic-size', 'none')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('white-space', 'nowrap')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('text-align', 'center')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('caret', 'auto')[0].constructor, CSSStyleValue);
    assert.equal(parseAll('container', 'none')[0].constructor, CSSStyleValue);

    // Unique-cause: LOGICAL_2VAL F on a 1-token SHORTHANDS_DATA shorthand
    // (margin-block: 1px falls through to CSSUnitValue).
    const scrollMargin = parseAll('scroll-margin-block', '1px');
    assert.equal(scrollMargin[0].constructor, CSSStyleValue);

    const vertical = parseAll('vertical-align', 'top');
    assert.equal(vertical[0].constructor, CSSStyleValue);

    const fontSys = parseAll('font', 'status-bar');
    assert.equal(fontSys[0].constructor, CSSStyleValue);
    assert.equal(parseAll('font', 'caption')[0].constructor, CSSStyleValue);

    const padding = parseAll('padding', '1px 2px 3px 4px');
    assert.equal(padding[0].constructor, CSSStyleValue);
    const inset = parseAll('inset', '1px 2px');
    assert.equal(inset[0].constructor, CSSStyleValue);
    const border = parseAll('border', 'none');
    assert.equal(border[0].constructor, CSSStyleValue);
    const flex = parseAll('flex', '1 1 0%');
    assert.equal(flex[0].constructor, CSSStyleValue);
    const overflow = parseAll('overflow', 'visible hidden');
    assert.equal(overflow[0].constructor, CSSStyleValue);
  });

  // css-transforms-1 #transform-property / css-transforms-2 #individual-transforms
  test('transform leftover functions and individual-transform arity after commas', () => {
    const m3d = parseAll('transform', 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)');
    assert.ok(m3d[0] instanceof CSSTransformValue);
    const persp = parseAll('transform', 'perspective(10px)');
    assert.ok(persp[0] instanceof CSSTransformValue);
    assert.throws(() => parseAll('transform', 'none scale(1)'), TypeError);

    // Unique-cause: rotate args.length === 2 (existing tests used 3 space-separated).
    assert.throws(() => parseAll('rotate', '1, 45deg'), TypeError);
    assert.throws(() => parseAll('rotate', '45deg, 1'), TypeError);

    const percent = parseAll('translate', '10%');
    assert.ok(percent[0] instanceof CSSTranslate);
    const mixed = parseAll('translate', '10px 20%');
    assert.ok(mixed[0] instanceof CSSTranslate);
    const trail = parseAll('translate', '10px,');
    assert.ok(trail[0] instanceof CSSTranslate);
    assert.throws(() => parseAll('translate', '0'), TypeError);

    assert.ok(parseAll('scale', '0')[0] instanceof CSSScale);
    assert.ok(parseAll('scale', '-1')[0] instanceof CSSScale);
    assert.ok(parseAll('scale', '2,')[0] instanceof CSSScale);
    assert.throws(() => parseAll('rotate', '0'), TypeError);
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects
  test('position leftover: perspective-origin, transform-origin 3-value, background-position-x', () => {
    // Not in the parseAll hotspot files (those used object/background/offset/mask-position).
    const persp = parseAll('perspective-origin', 'center');
    assert.ok(persp[0] instanceof CSSPositionValue);
    const persp2 = parseAll('perspective-origin', 'left top');
    assert.ok(persp2[0] instanceof CSSPositionValue);

    const origin = parseAll('transform-origin', 'left');
    assert.ok(origin[0] instanceof CSSPositionValue);
    const originLen = parseAll('transform-origin', '10px');
    assert.ok(originLen[0] instanceof CSSPositionValue);
    // 3-value transform-origin is not a CSSPositionValue; reify raw CSSStyleValue.
    const origin3 = parseAll('transform-origin', 'left top 10px');
    assert.equal(origin3[0].constructor, CSSStyleValue);

    // Unique-cause: position keyword on a property that is not POSITION_PROPERTIES.
    const bgX = parseAll('background-position-x', 'left');
    assert.ok(bgX[0] instanceof CSSKeywordValue);
    assert.equal((bgX[0] as CSSKeywordValue).value, 'left');
    const bgY = parseAll('background-position-y', 'top');
    assert.ok(bgY[0] instanceof CSSKeywordValue);

    assert.ok(parseAll('offset-path', 'none')[0] instanceof CSSKeywordValue);
  });

  // css-properties-values-api-1 #dom-css-registerproperty
  test('registered custom syntax leftover: color, auto|length, hash list, case', () => {
    CSS.registerProperty({
      name: '--mcdc-stillhot-color',
      syntax: '<color>',
      inherits: false,
      initialValue: 'red',
    });
    const blue = parseAll('--mcdc-stillhot-color', 'blue');
    assert.ok(blue[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('--mcdc-stillhot-color', 'not-a-color'), TypeError);
    assert.ok(parseAll('--mcdc-stillhot-color', 'canvas')[0] instanceof CSSKeywordValue);

    CSS.registerProperty({
      name: '--mcdc-stillhot-auto',
      syntax: '<length> | auto',
      inherits: false,
      initialValue: '0px',
    });
    assert.ok(parseAll('--mcdc-stillhot-auto', 'auto')[0] instanceof CSSKeywordValue);
    const px = parseAll('--mcdc-stillhot-auto', '1px');
    assert.ok(px[0] instanceof CSSUnitValue);
    assert.throws(() => parseAll('--mcdc-stillhot-auto', 'red'), TypeError);

    CSS.registerProperty({
      name: '--mcdc-stillhot-hash',
      syntax: '<length>#',
      inherits: false,
      initialValue: '0px',
    });
    const one = parseAll('--mcdc-stillhot-hash', '1px');
    assert.ok(one[0] instanceof CSSUnitValue);
    // Unique-cause: LIST_PROPERTIES.has F with top-level commas (custom is not a list
    // property) so L259 does not split; `<length>#` matches the whole value.
    const hashed = parseAll('--mcdc-stillhot-hash', '1px, 2px');
    assert.equal(hashed.length, 1);
    assert.equal(hashed[0].constructor, CSSStyleValue);

    // Registry lookup is case-sensitive; mixed-case is an unregistered custom.
    const wrongCase = parseAll('--Mcdc-Stillhot-Color', 'blue');
    assert.ok(wrongCase[0] instanceof CSSUnparsedValue);
  });

  // css-values-4 § 10 #math / css-sizing-3 #width-height-keywords
  test('nested math simple-block, leftover width keywords, revert-rule', () => {
    // Unique-cause: validateMathFunctions recurse into a simple-block.
    const nested = parseAll('width', 'calc((1px + 2px))');
    assert.equal(nested.length, 1);
    assert.equal(nested[0].toString().includes('px'), true);

    assert.throws(() => parseAll('width', 'min(1px, calc(1 +))'), TypeError);

    assert.ok(parseAll('width', 'min-content')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('width', 'max-content')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('width', 'fit-content')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('width', 'auto')[0] instanceof CSSKeywordValue);

    // revert-rule is not in the css-wide list used by _parseAll.
    assert.throws(() => parseAll('width', 'revert-rule'), TypeError);
    assert.throws(() => parseAll('color', 'revert-rule'), TypeError);

    const inheritMix = parseAll('width', 'INHERIT');
    assert.ok(inheritMix[0] instanceof CSSKeywordValue);
    const revertLayer = parseAll('width', 'Revert-Layer');
    assert.ok(revertLayer[0] instanceof CSSKeywordValue);

    const quotedName = parseAll('animation-name', '"spin"');
    assert.equal(quotedName.length, 1);
    assert.equal(quotedName[0].constructor, CSSStyleValue);
    assert.equal(parseAll('content', 'counters(a, ".")')[0].constructor, CSSStyleValue);
  });

  test('will-change comma list of auto and contents still falls back', () => {
    // Unique-cause: valueLower !== 'auto' && !== 'contents' T when both keywords
    // are present in one comma list (each keyword alone skips the fallback).
    const both = parseAll('will-change', 'contents, auto');
    assert.equal(both[0].constructor, CSSStyleValue);
    const reversed = parseAll('will-change', 'auto, contents');
    assert.equal(reversed[0].constructor, CSSStyleValue);

    const z = parseAll('z-index', 'auto');
    assert.ok(z[0] instanceof CSSKeywordValue);
    const zNum = parseAll('z-index', '1');
    assert.ok(zNum[0] instanceof CSSUnitValue);
    const opacity = parseAll('opacity', '0.5');
    assert.ok(opacity[0] instanceof CSSUnitValue);
    assert.ok(parseAll('appearance', 'none')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('object-fit', 'cover')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('contain', 'strict')[0] instanceof CSSKeywordValue);
    assert.ok(parseAll('position', 'static')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('position', 'left'), TypeError);
  });
});
