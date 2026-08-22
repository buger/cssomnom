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
// Still-hot unique-cause leftovers for src/typed-om/position/position-parser.ts
// tryParsePosition after tests/mcdc-hotspot-url-position.test.ts and
// tests/mcdc-hotspot-position-leftover.test.ts. Drive public CSSStyleValue.parse
// for object-position / background-position / transform-origin plus remaining
// POSITION_PROPERTIES. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSPositionValue,
  CSSUnitValue,
  CSSKeywordValue,
  CSSNumericValue,
  CSSMathSum,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
} from '../src/typed-om.ts';

function parsePos(property: string, css: string): CSSPositionValue {
  const v = CSSStyleValue.parse(property, css);
  assert.ok(
    v instanceof CSSPositionValue,
    `expected CSSPositionValue for ${property}: ${JSON.stringify(css)}, got ${v?.constructor?.name} ${String(v)}`,
  );
  return v;
}

function unit(v: CSSNumericValue, expected: number, unitName: string, label: string): void {
  assert.ok(v instanceof CSSUnitValue, `${label}: expected CSSUnitValue, got ${v?.constructor?.name} ${String(v)}`);
  assert.equal(v.value, expected, `${label} value`);
  assert.equal(v.unit, unitName, `${label} unit`);
}

function fromEdge(v: CSSNumericValue, label: string): void {
  assert.ok(
    v instanceof CSSMathSum,
    `${label}: expected CSSMathSum (100% - offset), got ${v?.constructor?.name} ${String(v)}`,
  );
  assert.ok(String(v).includes('100'), `${label}: ${String(v)}`);
}

function mathLen(v: CSSNumericValue, label: string): void {
  assert.ok(
    v instanceof CSSMathSum ||
      v instanceof CSSMathMin ||
      v instanceof CSSMathMax ||
      v instanceof CSSMathClamp,
    `${label}: expected math length, got ${v?.constructor?.name} ${String(v)}`,
  );
}

describe('MC/DC still-hot unique-cause: tryParsePosition via CSSStyleValue.parse', () => {
  // css-values-4 § 10.1 #position 1-value <length-percentage> includes calc()/min()/max()/clamp().
  // Unique-cause of L73 isToken(c0) F (function / simple-block / url, not a Token).
  // Leftover tests only sampled isToken T (ident vs dimension/percentage).
  test('1-value isToken F: calc/min/clamp reify; url/attr/block/angle-calc throw', () => {
    const calc = parsePos('object-position', 'calc(10px)');
    mathLen(calc.x, 'object-position calc(10px) x');
    assert.ok(String(calc.x).includes('10px'), `calc x: ${String(calc.x)}`);
    unit(calc.y, 50, 'percent', 'object-position calc(10px) y default');

    const mixed = parsePos('object-position', 'calc(10px + 5%)');
    mathLen(mixed.x, 'object-position calc(10px + 5%) x');
    unit(mixed.y, 50, 'percent', 'object-position calc(10px + 5%) y default');

    const minV = parsePos('background-position', 'min(10px, 20px)');
    mathLen(minV.x, 'background-position min() x');
    unit(minV.y, 50, 'percent', 'background-position min() y default');

    const clampV = parsePos('transform-origin', 'clamp(1px, 2px, 3px)');
    mathLen(clampV.x, 'transform-origin clamp() x');
    unit(clampV.y, 50, 'percent', 'transform-origin clamp() y default');

    const mixedCase = parsePos('object-position', 'Calc(10px)');
    mathLen(mixedCase.x, 'object-position Calc(10px) x');
    unit(mixedCase.y, 50, 'percent', 'object-position Calc(10px) y default');

    assert.throws(() => CSSStyleValue.parse('object-position', 'url(x)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'attr(x)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '(10px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'calc(90deg)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'calc(1s)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'url(x)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', '(10px)'), TypeError);
  });

  // css-values-4 § 10.1 #position 2-value:
  // Unique-cause of isToken F on c0 / c1 in L104 (vert-then-horiz), L116 (center + left|right),
  // L127 (top|bottom then length rejected), L130 (length then left|right rejected).
  test('2-value isToken F unique-cause of Option B / center / reject / Option A', () => {
    // L104 C0 isToken(c0) F, Option A success: function then vertical keyword.
    const calcTop = parsePos('object-position', 'calc(10px) top');
    mathLen(calcTop.x, 'calc(10px) top x');
    unit(calcTop.y, 0, 'percent', 'calc(10px) top y');

    const calcBottom = parsePos('background-position', 'min(1px, 2px) bottom');
    mathLen(calcBottom.x, 'min() bottom x');
    unit(calcBottom.y, 100, 'percent', 'min() bottom y');

    // L104 C3 isToken(c1) F after c0 is top|bottom: vertical keyword cannot precede a length.
    assert.throws(() => CSSStyleValue.parse('object-position', 'top calc(10px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom min(1px, 2px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'top calc(10px)'), TypeError);

    // L116 C3 isToken(c1) F after c0 is center: falls through to Option A (center + length).
    const centerCalc = parsePos('object-position', 'center calc(10px)');
    unit(centerCalc.x, 50, 'percent', 'center calc(10px) x');
    mathLen(centerCalc.y, 'center calc(10px) y');

    // L116 / L130: length then horizontal keyword is invalid.
    assert.throws(() => CSSStyleValue.parse('object-position', 'calc(10px) left'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'calc(10px) right'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'calc(10px) left'), TypeError);

    // L130 isToken(c1) F after c0 is horizontal keyword: Option A success.
    const leftCalc = parsePos('object-position', 'left calc(10px)');
    unit(leftCalc.x, 0, 'percent', 'left calc(10px) x');
    mathLen(leftCalc.y, 'left calc(10px) y');

    const bothCalc = parsePos('object-position', 'calc(10px) calc(20%)');
    mathLen(bothCalc.x, 'calc calc x');
    mathLen(bothCalc.y, 'calc calc y');

    const minMax = parsePos('background-position', 'min(1px, 2px) max(3px, 4px)');
    mathLen(minMax.x, 'min max x');
    mathLen(minMax.y, 'min max y');

    const originCalc = parsePos('transform-origin', 'calc(10px) 20px');
    mathLen(originCalc.x, 'transform-origin calc(10px) 20px x');
    unit(originCalc.y, 20, 'px', 'transform-origin calc(10px) 20px y');
  });

  // L138 coord1 && coord2: leftover / url-position only sampled T,T.
  // Unique-cause coord2 F (`left foo`, `10px 90deg`) and coord1 F (`foo top`, `90deg 10px`).
  test('2-value coord1/coord2 unique-cause F after Option A guards', () => {
    assert.throws(() => CSSStyleValue.parse('object-position', 'left foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '10px foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '10px 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'foo top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'foo 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '90deg top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '90deg 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'auto center'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'left foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', '90deg top'), TypeError);
  });

  // css-backgrounds-3 #background-position Case 4:
  // [ top | bottom | center ] [ left | right ] <length-percentage>
  // L191 yCoord && off: leftover only sampled T,T (`top left 10px`). Unique-cause off F.
  test('3-value Case 4 unique-cause off F vs calc offset T', () => {
    assert.throws(() => CSSStyleValue.parse('background-position', 'top left foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top left 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top left auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom right 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center left auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center left 90deg'), TypeError);

    const topLeftCalc = parsePos('background-position', 'top left calc(10px)');
    mathLen(topLeftCalc.x, 'top left calc(10px) x');
    unit(topLeftCalc.y, 0, 'percent', 'top left calc(10px) y');

    const bottomRightCalc = parsePos('background-position', 'bottom right calc(6px)');
    fromEdge(bottomRightCalc.x, 'bottom right calc(6px) x');
    unit(bottomRightCalc.y, 100, 'percent', 'bottom right calc(6px) y');

    const centerLeftClamp = parsePos('background-position', 'center left clamp(1px, 2px, 3px)');
    mathLen(centerLeftClamp.x, 'center left clamp() x');
    unit(centerLeftClamp.y, 50, 'percent', 'center left clamp() y');

    const mixed = parsePos('Background-Position', 'TOP LEFT calc(10px)');
    mathLen(mixed.x, 'TOP LEFT calc(10px) x');
    unit(mixed.y, 0, 'percent', 'TOP LEFT calc(10px) y');
  });

  // 3-value Case 1/2/3: leftover used dimension offsets. Unique-cause parseOffsetCoord
  // isToken F (function) while the case still matches.
  test('3-value Case 1/2/3 remaining function offsets', () => {
    const leftCalcTop = parsePos('background-position', 'left calc(10px) top');
    mathLen(leftCalcTop.x, 'left calc(10px) top x');
    unit(leftCalcTop.y, 0, 'percent', 'left calc(10px) top y');

    const rightPctCenter = parsePos('background-position', 'right calc(10%) center');
    unit(rightPctCenter.x, 90, 'percent', 'right calc(10%) center x folded');
    unit(rightPctCenter.y, 50, 'percent', 'right calc(10%) center y');

    const leftMinCenter = parsePos('background-position', 'left min(1px, 2px) center');
    mathLen(leftMinCenter.x, 'left min() center x');
    unit(leftMinCenter.y, 50, 'percent', 'left min() center y');

    const centerTopCalc = parsePos('background-position', 'center top calc(10px)');
    unit(centerTopCalc.x, 50, 'percent', 'center top calc(10px) x');
    mathLen(centerTopCalc.y, 'center top calc(10px) y');

    const centerBottomCalc = parsePos('background-position', 'center bottom calc(8px)');
    unit(centerBottomCalc.x, 50, 'percent', 'center bottom calc(8px) x');
    fromEdge(centerBottomCalc.y, 'center bottom calc(8px) y');

    const topCalcRight = parsePos('background-position', 'top calc(10px) right');
    unit(topCalcRight.x, 100, 'percent', 'top calc(10px) right x');
    mathLen(topCalcRight.y, 'top calc(10px) right y');

    const bottomCalcCenter = parsePos('background-position', 'bottom calc(4px) center');
    unit(bottomCalcCenter.x, 50, 'percent', 'bottom calc(4px) center x');
    fromEdge(bottomCalcCenter.y, 'bottom calc(4px) center y');

    const leftZeroTop = parsePos('background-position', 'left 0 top');
    unit(leftZeroTop.x, 0, 'px', 'left 0 top x');
    unit(leftZeroTop.y, 0, 'percent', 'left 0 top y');

    assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px calc(10px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center min(1px, 2px) left'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top foo left'), TypeError);
  });

  // css-values-4 § 10.1 #position 4-value Case B:
  // [ top | bottom ] <offset1> [ left | right ] <offset2>
  // L223 isIdentKeyword(c2, left|right): leftover only sampled F-skip (c0 not top|bottom)
  // and T,T. Unique-cause T,F: c0 is top|bottom, c2 is not left|right.
  test('4-value Case B unique-cause second keyword F', () => {
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px center 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px foo 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'bottom 10px bottom 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px center 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom 10px foo 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('perspective-origin', 'top 10px center 20px'), TypeError);
  });

  // L226 off1 && off2: leftover / url-position only sampled T,T for Case B.
  // Unique-cause off1 F (`top foo left 20px`) and off2 F (`top 10px left foo`).
  test('4-value Case B unique-cause off1 F and off2 F vs calc T,T', () => {
    assert.throws(() => CSSStyleValue.parse('object-position', 'top foo left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 90deg left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top auto left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'bottom calc(1s) left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px left foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px left 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top 10px left auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top foo left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px left foo'), TypeError);

    const bothCalc = parsePos('object-position', 'top calc(10px) left calc(20px)');
    mathLen(bothCalc.x, 'top calc left calc x');
    mathLen(bothCalc.y, 'top calc left calc y');

    const caseACalc = parsePos('object-position', 'left calc(10px) top calc(20px)');
    mathLen(caseACalc.x, 'left calc top calc x');
    mathLen(caseACalc.y, 'left calc top calc y');

    const neg = parsePos('object-position', 'right calc(-10px) top calc(-20px)');
    fromEdge(neg.x, 'right calc(-10px) x');
    mathLen(neg.y, 'top calc(-20px) y');
  });

  // css-transforms-1 § 5 #transform-origin-property: 3-value is x y <length> z.
  // tryParsePosition returns null so z is not dropped. Leftover used ident keywords;
  // still-hot unique-cause is function x/y with z.
  test('transform-origin calc 3-value does not drop z', () => {
    const z = CSSStyleValue.parse('transform-origin', 'calc(10px) 20px 5px');
    assert.equal(z.constructor, CSSStyleValue);
    assert.ok(!(z instanceof CSSPositionValue), '3-value transform-origin must not reify as CSSPositionValue');
    assert.ok(!(z instanceof CSSKeywordValue));
    assert.ok(z.toString().includes('5px'), `z offset lost: ${z.toString()}`);
    assert.ok(z.toString().toLowerCase().includes('calc'), `calc x lost: ${z.toString()}`);

    assert.throws(() => CSSStyleValue.parse('transform-origin', 'top calc(10px) left calc(20px)'), TypeError);
  });

  // Leftover tests drove object-position / background-position / transform-origin.
  // Remaining POSITION_PROPERTIES still call tryParsePosition for 1/2/4-value.
  test('remaining POSITION_PROPERTIES still-hot 1/2/4-value reify', () => {
    const persp1 = parsePos('perspective-origin', 'right');
    unit(persp1.x, 100, 'percent', 'perspective-origin right x');
    unit(persp1.y, 50, 'percent', 'perspective-origin right y');

    const persp2 = parsePos('perspective-origin', 'top left');
    unit(persp2.x, 0, 'percent', 'perspective-origin top left x');
    unit(persp2.y, 0, 'percent', 'perspective-origin top left y');

    const persp4 = parsePos('perspective-origin', 'top 10px right 20px');
    fromEdge(persp4.x, 'perspective-origin top 10px right 20px x');
    unit(persp4.y, 10, 'px', 'perspective-origin top 10px right 20px y');

    const persp4b = parsePos('perspective-origin', 'right 10px bottom 20px');
    fromEdge(persp4b.x, 'perspective-origin right 10px bottom 20px x');
    fromEdge(persp4b.y, 'perspective-origin right 10px bottom 20px y');

    assert.throws(() => CSSStyleValue.parse('perspective-origin', '10px 20px 5px'), TypeError);

    const offPos = parsePos('offset-position', 'left 10px top 20px');
    unit(offPos.x, 10, 'px', 'offset-position 4-value x');
    unit(offPos.y, 20, 'px', 'offset-position 4-value y');

    const offPair = parsePos('offset-position', 'center left');
    unit(offPair.x, 0, 'percent', 'offset-position center left x');
    unit(offPair.y, 50, 'percent', 'offset-position center left y');

    const offAnchor = parsePos('offset-anchor', 'left 10px top 20px');
    unit(offAnchor.x, 10, 'px', 'offset-anchor 4-value x');
    unit(offAnchor.y, 20, 'px', 'offset-anchor 4-value y');

    const mask4 = parsePos('mask-position', 'left 10px top 20px');
    unit(mask4.x, 10, 'px', 'mask-position 4-value x');
    unit(mask4.y, 20, 'px', 'mask-position 4-value y');

    const webkit = parsePos('-webkit-mask-position', 'center right');
    unit(webkit.x, 100, 'percent', '-webkit-mask-position center right x');
    unit(webkit.y, 50, 'percent', '-webkit-mask-position center right y');

    // css-values-4 #position: 3-value is not generic <position> (csswg-drafts#2140).
    assert.throws(() => CSSStyleValue.parse('mask-position', 'left 10px top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('perspective-origin', 'left 10px top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('offset-position', 'top left 10px'), TypeError);
  });
});
