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

describe('MC/DC leftover: tryParsePosition via CSSStyleValue.parse', () => {
  // css-values-4 § 10.1 #position 1-value: [ left | center | right | top | bottom | <length-percentage> ]
  // css-typed-om-1 § 3.3 #positionvalue-objects: omitted axis is 50%.
  test('1-value remaining keywords and length-percentage', () => {
    const objRight = parsePos('object-position', 'right');
    unit(objRight.x, 100, 'percent', 'object-position right x');
    unit(objRight.y, 50, 'percent', 'object-position right y');

    const objBottom = parsePos('object-position', 'bottom');
    unit(objBottom.x, 50, 'percent', 'object-position bottom x');
    unit(objBottom.y, 100, 'percent', 'object-position bottom y');

    const objPct = parsePos('object-position', '50%');
    unit(objPct.x, 50, 'percent', 'object-position 50% x');
    unit(objPct.y, 50, 'percent', 'object-position 50% y default');

    const objZero = parsePos('object-position', '0');
    unit(objZero.x, 0, 'px', 'object-position 0 → 0px');
    unit(objZero.y, 50, 'percent', 'object-position 0 y default');

    const bgTop = parsePos('background-position', 'top');
    unit(bgTop.x, 50, 'percent', 'background-position top x');
    unit(bgTop.y, 0, 'percent', 'background-position top y');

    const bgRight = parsePos('background-position', 'right');
    unit(bgRight.x, 100, 'percent', 'background-position right x');
    unit(bgRight.y, 50, 'percent', 'background-position right y');

    const bgBottom = parsePos('background-position', 'bottom');
    unit(bgBottom.x, 50, 'percent', 'background-position bottom x');
    unit(bgBottom.y, 100, 'percent', 'background-position bottom y');

    const bgCenter = parsePos('background-position', 'center');
    unit(bgCenter.x, 50, 'percent', 'background-position center x');
    unit(bgCenter.y, 50, 'percent', 'background-position center y');

    const bgPx = parsePos('background-position', '10px');
    unit(bgPx.x, 10, 'px', 'background-position 10px x');
    unit(bgPx.y, 50, 'percent', 'background-position 10px y default');

    const bgPct = parsePos('background-position', '25%');
    unit(bgPct.x, 25, 'percent', 'background-position 25% x');
    unit(bgPct.y, 50, 'percent', 'background-position 25% y default');

    const originLeft = parsePos('transform-origin', 'left');
    unit(originLeft.x, 0, 'percent', 'transform-origin left x');
    unit(originLeft.y, 50, 'percent', 'transform-origin left y');

    const originRight = parsePos('transform-origin', 'right');
    unit(originRight.x, 100, 'percent', 'transform-origin right x');
    unit(originRight.y, 50, 'percent', 'transform-origin right y');

    const originTop = parsePos('transform-origin', 'top');
    unit(originTop.x, 50, 'percent', 'transform-origin top x');
    unit(originTop.y, 0, 'percent', 'transform-origin top y');

    const originBottom = parsePos('transform-origin', 'bottom');
    unit(originBottom.x, 50, 'percent', 'transform-origin bottom x');
    unit(originBottom.y, 100, 'percent', 'transform-origin bottom y');

    const originCenter = parsePos('transform-origin', 'center');
    unit(originCenter.x, 50, 'percent', 'transform-origin center x');
    unit(originCenter.y, 50, 'percent', 'transform-origin center y');

    const originPx = parsePos('transform-origin', '10px');
    unit(originPx.x, 10, 'px', 'transform-origin 10px x');
    unit(originPx.y, 50, 'percent', 'transform-origin 10px y default');

    const originPct = parsePos('transform-origin', '50%');
    unit(originPct.x, 50, 'percent', 'transform-origin 50% x');
    unit(originPct.y, 50, 'percent', 'transform-origin 50% y default');
  });

  // css-values-4 § 2.2 #comb-all / § 10.1 #position:
  // [ left | center | right ] && [ top | center | bottom ]
  // css-transforms-1 § 5 #transform-origin-property: same && pair for 2-value keywords.
  test('2-value remaining && keyword orders', () => {
    const horizThenVert: Array<[string, string, number, number]> = [
      ['left', 'center', 0, 50],
      ['left', 'bottom', 0, 100],
      ['center', 'center', 50, 50],
      ['center', 'bottom', 50, 100],
      ['right', 'top', 100, 0],
      ['right', 'center', 100, 50],
      ['right', 'bottom', 100, 100],
    ];
    for (const [a, b, x, y] of horizThenVert) {
      const css = `${a} ${b}`;
      const obj = parsePos('object-position', css);
      unit(obj.x, x, 'percent', `object-position ${css} x`);
      unit(obj.y, y, 'percent', `object-position ${css} y`);
    }

    const vertThenHoriz: Array<[string, string, number, number, string]> = [
      ['top', 'left', 0, 0, 'object-position'],
      ['top', 'center', 50, 0, 'background-position'],
      ['center', 'right', 100, 50, 'transform-origin'],
      ['bottom', 'left', 0, 100, 'object-position'],
      ['bottom', 'center', 50, 100, 'background-position'],
      ['bottom', 'right', 100, 100, 'transform-origin'],
    ];
    for (const [a, b, x, y, prop] of vertThenHoriz) {
      const css = `${a} ${b}`;
      const v = parsePos(prop, css);
      unit(v.x, x, 'percent', `${prop} ${css} x`);
      unit(v.y, y, 'percent', `${prop} ${css} y`);
    }

    const originLeftTop = parsePos('transform-origin', 'left top');
    unit(originLeftTop.x, 0, 'percent', 'transform-origin left top x');
    unit(originLeftTop.y, 0, 'percent', 'transform-origin left top y');

    const originTopLeft = parsePos('transform-origin', 'top left');
    unit(originTopLeft.x, 0, 'percent', 'transform-origin top left x');
    unit(originTopLeft.y, 0, 'percent', 'transform-origin top left y');

    const bgLeftCenter = parsePos('background-position', 'left center');
    unit(bgLeftCenter.x, 0, 'percent', 'background-position left center x');
    unit(bgLeftCenter.y, 50, 'percent', 'background-position left center y');
  });

  // css-values-4 § 10.1 #position:
  // [ left | center | right | <length-percentage> ] [ top | center | bottom | <length-percentage> ]
  test('2-value remaining keyword+length and length+keyword', () => {
    const leftPx = parsePos('object-position', 'left 10px');
    unit(leftPx.x, 0, 'percent', 'object-position left 10px x');
    unit(leftPx.y, 10, 'px', 'object-position left 10px y');

    const pxTop = parsePos('object-position', '10px top');
    unit(pxTop.x, 10, 'px', 'object-position 10px top x');
    unit(pxTop.y, 0, 'percent', 'object-position 10px top y');

    const centerPct = parsePos('object-position', 'center 20%');
    unit(centerPct.x, 50, 'percent', 'object-position center 20% x');
    unit(centerPct.y, 20, 'percent', 'object-position center 20% y');

    const pctBottom = parsePos('background-position', '50% bottom');
    unit(pctBottom.x, 50, 'percent', 'background-position 50% bottom x');
    unit(pctBottom.y, 100, 'percent', 'background-position 50% bottom y');

    const rightZero = parsePos('background-position', 'right 0');
    unit(rightZero.x, 100, 'percent', 'background-position right 0 x');
    unit(rightZero.y, 0, 'px', 'background-position right 0 y');

    const originLeftPx = parsePos('transform-origin', 'left 10px');
    unit(originLeftPx.x, 0, 'percent', 'transform-origin left 10px x');
    unit(originLeftPx.y, 10, 'px', 'transform-origin left 10px y');

    const originPxBottom = parsePos('transform-origin', '10px bottom');
    unit(originPxBottom.x, 10, 'px', 'transform-origin 10px bottom x');
    unit(originPxBottom.y, 100, 'percent', 'transform-origin 10px bottom y');

    const bgPxCenter = parsePos('background-position', '10px center');
    unit(bgPxCenter.x, 10, 'px', 'background-position 10px center x');
    unit(bgPxCenter.y, 50, 'percent', 'background-position 10px center y');
  });

  test('2-value leftover invalid orders throw', () => {
    // css-values-4 § 10.1 #position: vertical keyword cannot precede a length;
    // a length cannot precede a horizontal keyword.
    assert.throws(() => CSSStyleValue.parse('object-position', 'bottom 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '10px right'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left left'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left right'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'top bottom'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', '10px right'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'top 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', '10px left'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'bottom 20%'), TypeError);
  });

  // css-values-4 § 10.1 #position 4-value:
  // [ [ left | right ] <length-percentage> ] && [ [ top | bottom ] <length-percentage> ]
  test('4-value remaining unique-cause left/right × top/bottom', () => {
    const leftBottom = parsePos('object-position', 'left 10px bottom 20px');
    unit(leftBottom.x, 10, 'px', 'left 10px bottom 20px x (=== right false)');
    fromEdge(leftBottom.y, 'left 10px bottom 20px y (=== bottom true)');

    const rightTop = parsePos('object-position', 'right 10px top 20px');
    fromEdge(rightTop.x, 'right 10px top 20px x (=== right true)');
    unit(rightTop.y, 20, 'px', 'right 10px top 20px y (=== bottom false)');

    const topRight = parsePos('background-position', 'top 10px right 20px');
    fromEdge(topRight.x, 'top 10px right 20px x (=== right true)');
    unit(topRight.y, 10, 'px', 'top 10px right 20px y (=== bottom false)');

    const bottomLeft = parsePos('background-position', 'bottom 10px left 20px');
    unit(bottomLeft.x, 20, 'px', 'bottom 10px left 20px x (=== right false)');
    fromEdge(bottomLeft.y, 'bottom 10px left 20px y (=== bottom true)');

    const bottomRight = parsePos('object-position', 'bottom 5px right 6px');
    fromEdge(bottomRight.x, 'bottom 5px right 6px x');
    fromEdge(bottomRight.y, 'bottom 5px right 6px y');

    const rightTopBg = parsePos('background-position', 'right 3px top 4px');
    fromEdge(rightTopBg.x, 'background-position right 3px top 4px x');
    unit(rightTopBg.y, 4, 'px', 'background-position right 3px top 4px y');

    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px center 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'center 10px top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left top top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px center 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left center top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'top 10px left 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('transform-origin', 'right 10px bottom 20px'), TypeError);
  });

  // css-values-4 § 10.1 #position: generic <position> is 1-/2-/4-value only
  // (csswg-drafts#2140). object-position uses <position>.
  test('invalid 3-value object-position throws TypeError', () => {
    const threeValue = [
      'left 10px top',
      'left 10px bottom',
      'right 10px top',
      'right 10px bottom',
      'right 10px center',
      'left top 10px',
      'left bottom 10px',
      'right top 10px',
      'right bottom 10px',
      'center top 10px',
      'center bottom 8px',
      'top 10px left',
      'top 10px center',
      'bottom 4px center',
      'bottom 10px left',
      'bottom 10px right',
      '10px 20px 5px',
      'left top 5px',
      'top left 5px',
      'center left 5px',
    ];
    for (const css of threeValue) {
      assert.throws(
        () => CSSStyleValue.parse('object-position', css),
        TypeError,
        `object-position 3-value must TypeError: ${css}`,
      );
    }
  });

  // css-backgrounds-3 #background-position: 3-value <bg-position> is valid.
  // Unique-cause left vs right / top vs bottom / center in tryParsePosition 3-value cases.
  test('background-position remaining 3-value reification unique-cause', () => {
    const leftOffTop = parsePos('background-position', 'left 10px top');
    unit(leftOffTop.x, 10, 'px', 'bg left 10px top x');
    unit(leftOffTop.y, 0, 'percent', 'bg left 10px top y');

    const rightOffTop = parsePos('background-position', 'right 10px top');
    fromEdge(rightOffTop.x, 'bg right 10px top x');
    unit(rightOffTop.y, 0, 'percent', 'bg right 10px top y');

    const leftOffBottom = parsePos('background-position', 'left 10px bottom');
    unit(leftOffBottom.x, 10, 'px', 'bg left 10px bottom x');
    unit(leftOffBottom.y, 100, 'percent', 'bg left 10px bottom y');

    const leftOffCenter = parsePos('background-position', 'left 10px center');
    unit(leftOffCenter.x, 10, 'px', 'bg left 10px center x');
    unit(leftOffCenter.y, 50, 'percent', 'bg left 10px center y');

    const rightOffCenter = parsePos('background-position', 'right 10px center');
    fromEdge(rightOffCenter.x, 'bg right 10px center x');
    unit(rightOffCenter.y, 50, 'percent', 'bg right 10px center y');

    const leftTopOff = parsePos('background-position', 'left top 10px');
    unit(leftTopOff.x, 0, 'percent', 'bg left top 10px x');
    unit(leftTopOff.y, 10, 'px', 'bg left top 10px y');

    const leftBottomOff = parsePos('background-position', 'left bottom 10px');
    unit(leftBottomOff.x, 0, 'percent', 'bg left bottom 10px x');
    fromEdge(leftBottomOff.y, 'bg left bottom 10px y');

    const rightBottomOffKw = parsePos('background-position', 'right bottom 10px');
    unit(rightBottomOffKw.x, 100, 'percent', 'bg right bottom 10px x');
    fromEdge(rightBottomOffKw.y, 'bg right bottom 10px y');

    const rightTopOff = parsePos('background-position', 'right top 10px');
    unit(rightTopOff.x, 100, 'percent', 'bg right top 10px x');
    unit(rightTopOff.y, 10, 'px', 'bg right top 10px y');

    const centerTopOff = parsePos('background-position', 'center top 10px');
    unit(centerTopOff.x, 50, 'percent', 'bg center top 10px x');
    unit(centerTopOff.y, 10, 'px', 'bg center top 10px y');

    const centerBottomOff = parsePos('background-position', 'center bottom 8px');
    unit(centerBottomOff.x, 50, 'percent', 'bg center bottom 8px x');
    fromEdge(centerBottomOff.y, 'bg center bottom 8px y');

    const topOffLeft = parsePos('background-position', 'top 10px left');
    unit(topOffLeft.x, 0, 'percent', 'bg top 10px left x');
    unit(topOffLeft.y, 10, 'px', 'bg top 10px left y');

    const topOffRight = parsePos('background-position', 'top 10px right');
    unit(topOffRight.x, 100, 'percent', 'bg top 10px right x');
    unit(topOffRight.y, 10, 'px', 'bg top 10px right y');

    const topOffCenter = parsePos('background-position', 'top 10px center');
    unit(topOffCenter.x, 50, 'percent', 'bg top 10px center x');
    unit(topOffCenter.y, 10, 'px', 'bg top 10px center y');

    const bottomOffLeft = parsePos('background-position', 'bottom 10px left');
    unit(bottomOffLeft.x, 0, 'percent', 'bg bottom 10px left x');
    fromEdge(bottomOffLeft.y, 'bg bottom 10px left y');

    const bottomOffRight = parsePos('background-position', 'bottom 10px right');
    unit(bottomOffRight.x, 100, 'percent', 'bg bottom 10px right x');
    fromEdge(bottomOffRight.y, 'bg bottom 10px right y');

    // Case 4: [ top | bottom | center ] [ left | right ] <length-percentage>
    const topLeftOff = parsePos('background-position', 'top left 10px');
    unit(topLeftOff.x, 10, 'px', 'bg top left 10px x');
    unit(topLeftOff.y, 0, 'percent', 'bg top left 10px y');

    const bottomRightOff = parsePos('background-position', 'bottom right 10px');
    fromEdge(bottomRightOff.x, 'bg bottom right 10px x');
    unit(bottomRightOff.y, 100, 'percent', 'bg bottom right 10px y');

    const centerLeftOff = parsePos('background-position', 'center left 10px');
    unit(centerLeftOff.x, 10, 'px', 'bg center left 10px x');
    unit(centerLeftOff.y, 50, 'percent', 'bg center left 10px y');

    const centerRightOff = parsePos('background-position', 'center right 10px');
    fromEdge(centerRightOff.x, 'bg center right 10px x');
    unit(centerRightOff.y, 50, 'percent', 'bg center right 10px y');

    assert.throws(() => CSSStyleValue.parse('background-position', '10px 20px 5px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left foo top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', '10px top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left top center'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'top center 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left center 10px'), TypeError);
  });

  // css-transforms-1 § 5 #transform-origin-property: 1/2-value reify as CSSPositionValue;
  // 3-value is x y <length> z — tryParsePosition returns null so z is not dropped.
  test('transform-origin remaining 1/2-value reify; 3-value does not drop z', () => {
    const two = parsePos('transform-origin', 'right bottom');
    unit(two.x, 100, 'percent', 'transform-origin right bottom x');
    unit(two.y, 100, 'percent', 'transform-origin right bottom y');

    const centerRight = parsePos('transform-origin', 'center right');
    unit(centerRight.x, 100, 'percent', 'transform-origin center right x');
    unit(centerRight.y, 50, 'percent', 'transform-origin center right y');

    const leftCenter = parsePos('transform-origin', 'left center');
    unit(leftCenter.x, 0, 'percent', 'transform-origin left center x');
    unit(leftCenter.y, 50, 'percent', 'transform-origin left center y');

    const z = CSSStyleValue.parse('transform-origin', 'right bottom 5px');
    assert.equal(z.constructor, CSSStyleValue);
    assert.ok(!(z instanceof CSSPositionValue), '3-value transform-origin must not reify as CSSPositionValue');
    assert.ok(!(z instanceof CSSKeywordValue));
    assert.ok(z.toString().includes('5px'), `z offset lost: ${z.toString()}`);

    const mixedZ = CSSStyleValue.parse('Transform-Origin', 'Right Bottom 5px');
    assert.equal(mixedZ.constructor, CSSStyleValue);
    assert.ok(!(mixedZ instanceof CSSPositionValue), 'mixed-case transform-origin 3-value must not drop z');
    assert.ok(mixedZ.toString().toLowerCase().includes('5px'), `z offset lost: ${mixedZ.toString()}`);

    const origin4 = () => CSSStyleValue.parse('transform-origin', 'left 10px bottom 20px');
    assert.throws(origin4, TypeError);
  });

  test('mixed-case property and keywords still reify', () => {
    const obj = parsePos('OBJECT-POSITION', 'RIGHT');
    unit(obj.x, 100, 'percent', 'OBJECT-POSITION RIGHT x');
    unit(obj.y, 50, 'percent', 'OBJECT-POSITION RIGHT y');

    const pair = parsePos('Object-Position', 'Center Right');
    unit(pair.x, 100, 'percent', 'Object-Position Center Right x');
    unit(pair.y, 50, 'percent', 'Object-Position Center Right y');

    const bg = parsePos('Background-Position', 'LEFT BOTTOM');
    unit(bg.x, 0, 'percent', 'Background-Position LEFT BOTTOM x');
    unit(bg.y, 100, 'percent', 'Background-Position LEFT BOTTOM y');

    const origin = parsePos('Transform-Origin', 'Bottom');
    unit(origin.x, 50, 'percent', 'Transform-Origin Bottom x');
    unit(origin.y, 100, 'percent', 'Transform-Origin Bottom y');

    const four = parsePos('object-position', 'Right 10px Top 20px');
    fromEdge(four.x, 'Right 10px Top 20px x');
    unit(four.y, 20, 'px', 'Right 10px Top 20px y');
  });

  test('whitespace and comments between components are skipped', () => {
    const commented = parsePos('object-position', 'left /*x*/ bottom');
    unit(commented.x, 0, 'percent', 'left /*x*/ bottom x');
    unit(commented.y, 100, 'percent', 'left /*x*/ bottom y');

    const padded = parsePos('object-position', '  right  ');
    unit(padded.x, 100, 'percent', 'padded right x');
    unit(padded.y, 50, 'percent', 'padded right y');

    const four = parsePos('background-position', 'top /*a*/ 10px /*b*/ right /*c*/ 20px');
    fromEdge(four.x, 'commented 4-value x');
    unit(four.y, 10, 'px', 'commented 4-value y');

    const origin = parsePos('transform-origin', 'center /* */ right');
    unit(origin.x, 100, 'percent', 'transform-origin center /* */ right x');
    unit(origin.y, 50, 'percent', 'transform-origin center /* */ right y');
  });
});
