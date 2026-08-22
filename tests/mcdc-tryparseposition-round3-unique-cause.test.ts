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
// Round-3 unique-cause leftovers for src/typed-om/position/position-parser.ts
// tryParsePosition after tests/mcdc-hotspot-url-position.test.ts,
// tests/mcdc-hotspot-position-leftover.test.ts, and
// tests/mcdc-position-still-hot-unique-cause.test.ts.
// Last recapture: 34/40 decisions, 64/72 conditions, 6 incomplete / 8 missing
// (L108, L120, L155, L167, L179, L191). Drive CSSStyleValue.parse for
// position properties. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
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

function rawStyle(property: string, css: string, label: string): CSSStyleValue {
  const v = CSSStyleValue.parse(property, css);
  assert.equal(
    v.constructor,
    CSSStyleValue,
    `${label}: expected raw CSSStyleValue for ${property}: ${JSON.stringify(css)}, got ${v?.constructor?.name} ${String(v)}`,
  );
  assert.ok(!(v instanceof CSSPositionValue), `${label}: must not reify as CSSPositionValue`);
  assert.ok(!(v instanceof CSSKeywordValue), `${label}: must not reify as CSSKeywordValue`);
  return v;
}

const keywordAccessors = (() => {
  const desc = Object.getOwnPropertyDescriptor(CSSKeywordValue.prototype, 'value');
  if (!desc || typeof desc.get !== 'function' || typeof desc.set !== 'function') {
    throw new TypeError('CSSKeywordValue.value accessor missing');
  }
  return { desc, get: desc.get, set: desc.set };
})();

function restoreKeywordValue(): void {
  Object.defineProperty(CSSKeywordValue.prototype, 'value', keywordAccessors.desc);
}

/**
 * Ident gates read the token; xCoord/yCoord/vert/horiz read CSSKeywordValue.value
 * (css-typed-om-1 § 3.1 #keywordvalue-objects). Remapping the getter unique-causes
 * toPositionCoord F while left|right|center|top|bottom gates stay T.
 */
function withKeywordValueRemap(remap: (k: string) => string, fn: () => void): void {
  Object.defineProperty(CSSKeywordValue.prototype, 'value', {
    configurable: true,
    enumerable: keywordAccessors.desc.enumerable,
    get(this: CSSKeywordValue) {
      return remap(keywordAccessors.get.call(this));
    },
    set(this: CSSKeywordValue, v: string) {
      keywordAccessors.set.call(this, v);
    },
  });
  try {
    fn();
  } finally {
    restoreKeywordValue();
  }
}

function hideHoriz(k: string): string {
  return ['left', 'right', 'center'].includes(k.toLowerCase()) ? 'auto' : k;
}

function hideLeftRight(k: string): string {
  return ['left', 'right'].includes(k.toLowerCase()) ? 'auto' : k;
}

function hideTopBottom(k: string): string {
  return ['top', 'bottom'].includes(k.toLowerCase()) ? 'auto' : k;
}

function hideCenter(k: string): string {
  return k.toLowerCase() === 'center' ? 'auto' : k;
}

function hideVert(k: string): string {
  return ['top', 'bottom', 'center'].includes(k.toLowerCase()) ? 'auto' : k;
}

describe('MC/DC round3 unique-cause: tryParsePosition via CSSStyleValue.parse', { concurrency: false }, () => {
  afterEach(() => {
    restoreKeywordValue();
  });

  // css-values-4 § 10.1 #position Option B: [ top | bottom ] [ left | right | center ]
  // L108 xCoord && yCoord: leftover / still-hot only sampled T,T. Ident gates ⊆
  // toPositionCoord keywords, so F rows need the keyword-value split.
  test('2-value Option B L108 xCoord/yCoord unique-cause F via keyword-value split', () => {
    const topLeft = parsePos('object-position', 'top left');
    unit(topLeft.x, 0, 'percent', 'top left x T,T');
    unit(topLeft.y, 0, 'percent', 'top left y T,T');

    const bottomRight = parsePos('background-position', 'bottom right');
    unit(bottomRight.x, 100, 'percent', 'bottom right x T,T');
    unit(bottomRight.y, 100, 'percent', 'bottom right y T,T');

    const origin = parsePos('transform-origin', 'top center');
    unit(origin.x, 50, 'percent', 'transform-origin top center x T,T');
    unit(origin.y, 0, 'percent', 'transform-origin top center y T,T');

    // Unique-cause xCoord F, yCoord T (c1 left|right|center → auto).
    // isKeywordAndPair still T on the tokens, so grammar holds and reify falls back.
    withKeywordValueRemap(hideHoriz, () => {
      rawStyle('object-position', 'top left', 'L108 xCoord F top left');
      rawStyle('object-position', 'bottom center', 'L108 xCoord F bottom center');
      rawStyle('background-position', 'TOP RIGHT', 'L108 xCoord F mixed-case');
      rawStyle('transform-origin', 'top left', 'L108 xCoord F transform-origin');
      rawStyle('perspective-origin', 'bottom right', 'L108 xCoord F perspective-origin');
    });

    // Unique-cause yCoord F, xCoord T (c0 top|bottom → auto).
    withKeywordValueRemap(hideTopBottom, () => {
      rawStyle('object-position', 'top left', 'L108 yCoord F top left');
      rawStyle('object-position', 'bottom right', 'L108 yCoord F bottom right');
      rawStyle('offset-position', 'top center', 'L108 yCoord F offset-position');
    });
  });

  // css-values-4 § 2.2 #comb-all / § 10.1 #position:
  // center is in both && groups, so center left|right is vertical-then-x.
  test('2-value L120 center + left|right xCoord/yCoord unique-cause F', () => {
    const centerLeft = parsePos('object-position', 'center left');
    unit(centerLeft.x, 0, 'percent', 'center left x T,T');
    unit(centerLeft.y, 50, 'percent', 'center left y T,T');

    const centerRight = parsePos('perspective-origin', 'center right');
    unit(centerRight.x, 100, 'percent', 'center right x T,T');
    unit(centerRight.y, 50, 'percent', 'center right y T,T');

    // Unique-cause xCoord F, yCoord T (c1 left|right → auto; center stays).
    withKeywordValueRemap(hideLeftRight, () => {
      rawStyle('object-position', 'center left', 'L120 xCoord F center left');
      rawStyle('object-position', 'center right', 'L120 xCoord F center right');
      rawStyle('Object-Position', 'Center Left', 'L120 xCoord F mixed-case');
      rawStyle('-webkit-mask-position', 'center right', 'L120 xCoord F webkit');
    });

    // Unique-cause yCoord F, xCoord T (center → auto; left|right stay).
    withKeywordValueRemap(hideCenter, () => {
      rawStyle('object-position', 'center left', 'L120 yCoord F center left');
      rawStyle('transform-origin', 'center right', 'L120 yCoord F transform-origin');
      rawStyle('offset-anchor', 'center left', 'L120 yCoord F offset-anchor');
    });
  });

  // css-backgrounds-3 #background-position 3-value. Grammar is tryParsePosition
  // itself, so keyword-value F is TypeError (not a raw CSSStyleValue).
  test('3-value Case 1/4 L155 vert F and L191 yCoord F vs T,T', () => {
    const leftOffTop = parsePos('background-position', 'left 10px top');
    unit(leftOffTop.x, 10, 'px', 'left 10px top x T,T');
    unit(leftOffTop.y, 0, 'percent', 'left 10px top y T,T');

    const topLeftOff = parsePos('background-position', 'top left 10px');
    unit(topLeftOff.x, 10, 'px', 'top left 10px x T,T');
    unit(topLeftOff.y, 0, 'percent', 'top left 10px y T,T');

    // Unique-cause L155 vert F with off T (c2 top|bottom|center → auto).
    withKeywordValueRemap(hideVert, () => {
      assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px top'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'right 10px center'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'left 10px bottom'), TypeError);
      assert.throws(() => CSSStyleValue.parse('Background-Position', 'LEFT 10px TOP'), TypeError);
    });

    // Unique-cause L191 yCoord F with off T (c0 top|bottom|center → auto).
    withKeywordValueRemap(hideVert, () => {
      assert.throws(() => CSSStyleValue.parse('background-position', 'top left 10px'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'bottom right calc(6px)'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'center left 10px'), TypeError);
    });
  });

  test('3-value Case 2/3 L167/L179 horiz F with off T', () => {
    const leftTopOff = parsePos('background-position', 'left top 10px');
    unit(leftTopOff.x, 0, 'percent', 'left top 10px x T,T');
    unit(leftTopOff.y, 10, 'px', 'left top 10px y T,T');

    const topOffLeft = parsePos('background-position', 'top 10px left');
    unit(topOffLeft.x, 0, 'percent', 'top 10px left x T,T');
    unit(topOffLeft.y, 10, 'px', 'top 10px left y T,T');

    // Unique-cause L167 horiz F with off T (c0 left|right|center → auto).
    withKeywordValueRemap(hideHoriz, () => {
      assert.throws(() => CSSStyleValue.parse('background-position', 'left top 10px'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'right bottom 10px'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'center top calc(10px)'), TypeError);
    });

    // Unique-cause L179 horiz F with off T (c2 left|right|center → auto).
    withKeywordValueRemap(hideHoriz, () => {
      assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px left'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'bottom 4px center'), TypeError);
      assert.throws(() => CSSStyleValue.parse('background-position', 'top calc(10px) right'), TypeError);
    });
  });

  // 1-value ident not in left|right|top|bottom|center: L73 T then L93 coord F.
  // object-position grammar rejects these; offset-* grammar accepts auto/normal.
  test('1-value L93 coord F on grammar-valid offset-* keywords vs max() T', () => {
    const offAuto = CSSStyleValue.parse('offset-position', 'auto');
    assert.ok(offAuto instanceof CSSKeywordValue);
    assert.equal(offAuto.value, 'auto');

    const offNormal = CSSStyleValue.parse('offset-position', 'normal');
    assert.ok(offNormal instanceof CSSKeywordValue);
    assert.equal(offNormal.value, 'normal');

    const mixed = CSSStyleValue.parse('Offset-Position', 'Normal');
    assert.ok(mixed instanceof CSSKeywordValue);
    assert.equal(mixed.value, 'Normal');

    const anchor = CSSStyleValue.parse('offset-anchor', 'auto');
    assert.ok(anchor instanceof CSSKeywordValue);
    assert.equal(anchor.value, 'auto');

    const offLeft = parsePos('offset-position', 'left');
    unit(offLeft.x, 0, 'percent', 'offset-position left x');
    unit(offLeft.y, 50, 'percent', 'offset-position left y default');

    const maxV = parsePos('object-position', 'max(1px, 2px)');
    assert.ok(maxV.x instanceof CSSMathMax, `max() x: ${maxV.x?.constructor?.name}`);
    unit(maxV.y, 50, 'percent', 'object-position max() y default');

    assert.throws(() => CSSStyleValue.parse('object-position', 'auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'normal'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'hypot(3px, 4px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'abs(10px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', '1'), TypeError);
    assert.throws(() => CSSStyleValue.parse('offset-position', 'auto 10px'), TypeError);
  });

  // isIdentKeyword = isToken && type===ident && includes. leftover/still-hot
  // sampled ident/dimension; unique-cause isToken F (function) as the keyword.
  test('3-value isIdentKeyword isToken F unique-cause of Case 1-4 keywords', () => {
    assert.throws(() => CSSStyleValue.parse('background-position', 'calc(10px) 10px top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'min(1px, 2px) 10px bottom'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', '10px 10px top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center 10px top'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'foo 10px top'), TypeError);

    assert.throws(() => CSSStyleValue.parse('background-position', 'left calc(10px) 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'center min(1px, 2px) 10px'), TypeError);

    assert.throws(() => CSSStyleValue.parse('background-position', 'top 10px calc(10px)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom 10px min(1px, 2px)'), TypeError);

    assert.throws(() => CSSStyleValue.parse('background-position', 'top calc(10px) 10px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'bottom max(1px, 2px) 10px'), TypeError);

    const calcCenter = parsePos('object-position', 'calc(10px) center');
    assert.ok(
      calcCenter.x instanceof CSSMathSum || calcCenter.x instanceof CSSMathMin || calcCenter.x instanceof CSSMathMax,
      `calc(10px) center x: ${calcCenter.x?.constructor?.name}`,
    );
    unit(calcCenter.y, 50, 'percent', 'calc(10px) center y');
  });

  // css-values-4 § 10.1 #position 4-value Case A:
  // leftover / url-position unique-caused off1/off2 F via direct tokens.
  test('4-value Case A off1 F and off2 F via parse vs 0/percent T,T', () => {
    assert.throws(() => CSSStyleValue.parse('object-position', 'left foo top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 90deg top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left auto top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'right calc(1s) top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px top foo'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px top 90deg'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px top auto'), TypeError);
    assert.throws(() => CSSStyleValue.parse('background-position', 'left foo top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('perspective-origin', 'left 10px top foo'), TypeError);

    assert.throws(() => CSSStyleValue.parse('object-position', 'calc(10px) 10px top 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px calc(10px) 20px'), TypeError);
    assert.throws(() => CSSStyleValue.parse('object-position', 'left 10px top 20px center'), TypeError);

    const zeros = parsePos('object-position', 'left 0 top 0');
    unit(zeros.x, 0, 'px', 'left 0 top 0 x');
    unit(zeros.y, 0, 'px', 'left 0 top 0 y');

    const folded = parsePos('object-position', 'right 10% bottom 20%');
    unit(folded.x, 90, 'percent', 'right 10% bottom 20% x folded');
    unit(folded.y, 80, 'percent', 'right 10% bottom 20% y folded');

    const neg = parsePos('background-position', 'right -10px bottom');
    fromEdge(neg.x, 'right -10px bottom x');
    unit(neg.y, 100, 'percent', 'right -10px bottom y');
  });

  // mask-position / -webkit-mask-position split commas in the grammar gate only.
  // tryParsePosition sees the whole list (length > 4) and returns null; reify is raw.
  test('comma-list length>4 tryParsePosition null vs transform-origin z=0', () => {
    rawStyle('mask-position', '10px 20px, 30px 40px', 'mask-position comma list');
    rawStyle('-webkit-mask-position', 'left, right', '-webkit-mask-position comma list');

    const allMask = CSSStyleValue.parseAll('mask-position', '10px 20px, 30px 40px');
    assert.equal(allMask.length, 1);
    assert.equal(allMask[0].constructor, CSSStyleValue);

    const bgFirst = parsePos('background-position', 'left 10px top, right 20px bottom');
    unit(bgFirst.x, 10, 'px', 'background-position comma 3-value first x');
    unit(bgFirst.y, 0, 'percent', 'background-position comma 3-value first y');

    const bgAll = CSSStyleValue.parseAll('background-position', 'left 10px top, right 20px bottom');
    assert.equal(bgAll.length, 2);
    assert.ok(bgAll[0] instanceof CSSPositionValue);
    assert.ok(bgAll[1] instanceof CSSPositionValue);
    fromEdge(bgAll[1].x, 'background-position comma 3-value second x');
    unit(bgAll[1].y, 100, 'percent', 'background-position comma 3-value second y');

    const z0 = CSSStyleValue.parse('transform-origin', '10px 20px 0');
    assert.equal(z0.constructor, CSSStyleValue);
    assert.ok(!(z0 instanceof CSSPositionValue), 'transform-origin z=0 must not drop z');
    assert.ok(z0.toString().includes('0'), `z lost: ${z0.toString()}`);
  });
});
