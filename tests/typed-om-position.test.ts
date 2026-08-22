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
import { test } from 'node:test';
import assert from 'node:assert';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSPositionValue,
  CSSUnitValue,
  CSSKeywordValue,
  CSSNumericValue
} from '../src/typed-om.ts';

test('CSSPositionValue constructor validation', () => {
  const x = new CSSUnitValue(50, 'percent');
  const y = new CSSUnitValue(50, 'percent');
  const pos = new CSSPositionValue(x, y);
  assert.strictEqual(pos.x, x);
  assert.strictEqual(pos.y, y);

  const newX = new CSSUnitValue(10, 'px');
  pos.x = newX;
  assert.strictEqual(pos.x, newX);

  const newY = new CSSUnitValue(0, 'percent');
  pos.y = newY;
  assert.strictEqual(pos.y, newY);

  // Invalid types must throw TypeError
  assert.throws(() => {
    new CSSPositionValue(50 as unknown as CSSNumericValue, y);
  }, TypeError);

  assert.throws(() => {
    new CSSPositionValue(x, new CSSKeywordValue('center') as unknown as CSSNumericValue);
  }, TypeError);

  // Invalid units (not <length-percentage>) must throw TypeError
  assert.throws(() => {
    new CSSPositionValue(new CSSUnitValue(90, 'deg'), y);
  }, TypeError);

  assert.throws(() => {
    new CSSPositionValue(x, new CSSUnitValue(2, 's'));
  }, TypeError);

  // Setting invalid values must throw TypeError
  assert.throws(() => {
    pos.x = new CSSUnitValue(90, 'deg');
  }, TypeError);

  assert.throws(() => {
    pos.y = new CSSKeywordValue('center') as unknown as CSSNumericValue;
  }, TypeError);
});

test('CSSPositionValue parsing and reification', () => {
  // background-position
  const bgPos = CSSStyleValue.parse('background-position', '10px 20%');
  assert.ok(bgPos instanceof CSSPositionValue);
  assert.ok(bgPos.x instanceof CSSUnitValue);
  assert.strictEqual((bgPos.x as CSSUnitValue).value, 10);
  assert.strictEqual((bgPos.x as CSSUnitValue).unit, 'px');
  assert.ok(bgPos.y instanceof CSSUnitValue);
  assert.strictEqual((bgPos.y as CSSUnitValue).value, 20);
  assert.strictEqual((bgPos.y as CSSUnitValue).unit, 'percent');

  // Single value: background-position: left
  const bgPosSingle = CSSStyleValue.parse('background-position', 'left');
  assert.ok(bgPosSingle instanceof CSSPositionValue);
  assert.ok(bgPosSingle.x instanceof CSSUnitValue);
  assert.strictEqual((bgPosSingle.x as CSSUnitValue).value, 0);
  assert.strictEqual((bgPosSingle.x as CSSUnitValue).unit, 'percent');
  assert.ok(bgPosSingle.y instanceof CSSUnitValue);
  assert.strictEqual((bgPosSingle.y as CSSUnitValue).value, 50);
  assert.strictEqual((bgPosSingle.y as CSSUnitValue).unit, 'percent');

  // object-position
  const objPos = CSSStyleValue.parse('object-position', 'center top');
  assert.ok(objPos instanceof CSSPositionValue);
  assert.ok(objPos.x instanceof CSSUnitValue);
  assert.strictEqual((objPos.x as CSSUnitValue).value, 50);
  assert.strictEqual((objPos.x as CSSUnitValue).unit, 'percent');
  assert.ok(objPos.y instanceof CSSUnitValue);
  assert.strictEqual((objPos.y as CSSUnitValue).value, 0);
  assert.strictEqual((objPos.y as CSSUnitValue).unit, 'percent');
});

test('CSSPositionValue serialization', () => {
  const pos = new CSSPositionValue(new CSSUnitValue(10, 'px'), new CSSUnitValue(100, 'percent'));
  assert.strictEqual(pos.serialize(), '10px 100%');
  assert.strictEqual(pos.toString(), '10px 100%');
});

// Reproduces: KI-3
test('CSSPositionValue invalid position syntax throws TypeError', () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue: invalid <position> throws TypeError
  assert.throws(() => {
    CSSStyleValue.parse('background-position', 'top 10px');
  }, TypeError);

  assert.throws(() => {
    CSSStyleValue.parse('background-position', '10px left');
  }, TypeError);

  assert.throws(() => {
    CSSStyleValue.parse('object-position', 'not-a-position');
  }, TypeError);

  assert.throws(() => {
    CSSStyleValue.parse('object-position', 'top 10px');
  }, TypeError);
});

test('CSSStyleValue.parse does not throw when grammar is valid but CSSPositionValue cannot reify', () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue vs § 3.3 #positionvalue-objects:
  // parse throws only when the *property grammar* fails; failed CSSPositionValue
  // reification of a still-valid value returns CSSKeywordValue / CSSStyleValue.

  const list = CSSStyleValue.parse('background-position', '0 0, 10px 10px');
  assert.ok(list instanceof CSSStyleValue);
  assert.ok(!(list instanceof CSSKeywordValue));
  const listAll = CSSStyleValue.parseAll('background-position', '0 0, 10px 10px');
  assert.strictEqual(listAll.length, 2);
  assert.ok(listAll[0] instanceof CSSPositionValue);
  assert.ok(listAll[1] instanceof CSSPositionValue);

  const offsetPos = CSSStyleValue.parse('offset-position', 'auto');
  assert.ok(offsetPos instanceof CSSKeywordValue);
  assert.strictEqual((offsetPos as CSSKeywordValue).value, 'auto');

  const offsetAnchor = CSSStyleValue.parse('offset-anchor', 'auto');
  assert.ok(offsetAnchor instanceof CSSKeywordValue);
  assert.strictEqual((offsetAnchor as CSSKeywordValue).value, 'auto');

  const origin3 = CSSStyleValue.parse('transform-origin', '10px 20px 5px');
  assert.ok(origin3 instanceof CSSStyleValue);
  assert.ok(!(origin3 instanceof CSSPositionValue));
  assert.ok(!(origin3 instanceof CSSKeywordValue));
});

// Reproduces: KI-11
test('transform-origin grammar is checked before CSSPositionValue reification', () => {
  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue: TypeError only when property grammar fails.
  // css-transforms-1 § 5 #transform-origin-property:
  //   [ left | center | right | top | bottom | <length-percentage> ]
  //   | [ left | center | right | <length-percentage> ]
  //     [ top | center | bottom | <length-percentage> ] <length>?
  //   | [ [ center | left | right ] && [ center | top | bottom ] ] <length>?
  // css-typed-om-1 § 3.3 #positionvalue-objects: CSSPositionValue is 2D <position>; z is not dropped.

  const leftTopZ = CSSStyleValue.parse('transform-origin', 'left top 5px');
  assert.ok(leftTopZ instanceof CSSStyleValue);
  assert.ok(!(leftTopZ instanceof CSSPositionValue), '3-value transform-origin must not reify as CSSPositionValue (z dropped)');
  assert.ok(!(leftTopZ instanceof CSSKeywordValue));
  assert.ok(leftTopZ.toString().includes('5px'), `z offset lost: ${leftTopZ.toString()}`);

  assert.doesNotThrow(() => {
    CSSStyleValue.parse('transform-origin', 'top left 5px');
  }, 'valid && + z transform-origin must not throw');
  const topLeftZ = CSSStyleValue.parse('transform-origin', 'top left 5px');
  assert.ok(topLeftZ instanceof CSSStyleValue);
  assert.ok(!(topLeftZ instanceof CSSPositionValue));
  assert.ok(!(topLeftZ instanceof CSSKeywordValue));
  assert.ok(topLeftZ.toString().includes('5px'), `z offset lost: ${topLeftZ.toString()}`);

  assert.throws(() => {
    CSSStyleValue.parse('transform-origin', 'left 10px top 20px');
  }, TypeError, '4-value <position> is invalid transform-origin');
});

// Reproduces: KI-11
test('transform-origin && overlapping center: center left / center left 5px parse', () => {
  // css-transforms-1 § 5 #transform-origin-property:
  // [ [ center | left | right ] && [ center | top | bottom ] ] <length>?
  // css-values-4 § 2.2 #comb-all: && is order-independent; both groups include center.

  assert.doesNotThrow(() => {
    CSSStyleValue.parse('transform-origin', 'center left');
  }, 'center left is a valid && keyword pair');
  const centerLeft = CSSStyleValue.parse('transform-origin', 'center left');
  assert.ok(centerLeft instanceof CSSStyleValue);
  assert.ok(!(centerLeft instanceof CSSKeywordValue));

  assert.doesNotThrow(() => {
    CSSStyleValue.parse('transform-origin', 'center left 5px');
  }, 'center left 5px is valid && + z');
  const centerLeftZ = CSSStyleValue.parse('transform-origin', 'center left 5px');
  assert.ok(centerLeftZ instanceof CSSStyleValue);
  assert.ok(!(centerLeftZ instanceof CSSPositionValue), '3-value transform-origin must not reify as CSSPositionValue');
  assert.ok(!(centerLeftZ instanceof CSSKeywordValue));
  assert.ok(centerLeftZ.toString().includes('5px'), `z offset lost: ${centerLeftZ.toString()}`);

  assert.doesNotThrow(() => {
    CSSStyleValue.parse('transform-origin', 'center right 5px');
  }, 'center right 5px is valid && + z');
  const centerRightZ = CSSStyleValue.parse('transform-origin', 'center right 5px');
  assert.ok(centerRightZ instanceof CSSStyleValue);
  assert.ok(!(centerRightZ instanceof CSSPositionValue));
  assert.ok(!(centerRightZ instanceof CSSKeywordValue));
  assert.ok(centerRightZ.toString().includes('5px'), `z offset lost: ${centerRightZ.toString()}`);

  const objCenterLeft = CSSStyleValue.parse('object-position', 'center left');
  assert.ok(objCenterLeft instanceof CSSPositionValue, 'center left is valid <position> (css-values-4 #position)');
  assert.ok(objCenterLeft.x instanceof CSSUnitValue);
  assert.strictEqual((objCenterLeft.x as CSSUnitValue).value, 0);
  assert.strictEqual((objCenterLeft.x as CSSUnitValue).unit, 'percent');
  assert.ok(objCenterLeft.y instanceof CSSUnitValue);
  assert.strictEqual((objCenterLeft.y as CSSUnitValue).value, 50);
  assert.strictEqual((objCenterLeft.y as CSSUnitValue).unit, 'percent');

  const perspCenterLeft = CSSStyleValue.parse('perspective-origin', 'center left');
  assert.ok(perspCenterLeft instanceof CSSStyleValue);
  assert.ok(!(perspCenterLeft instanceof CSSKeywordValue));

  assert.throws(() => {
    CSSStyleValue.parse('transform-origin', 'left 10px top 20px');
  }, TypeError, '4-value <position> is still invalid transform-origin');
});

// Reproduces: KI-11
test('perspective-origin is <position> including 4-value, not transform-origin z', () => {
  // css-transforms-2 #perspective-origin-property: Value is <position>.
  // css-values-4 § 10.1 #position: 1-/2-/4-value only. 3-value is not generic
  // <position> (csswg-drafts#2140; WPT perspective-origin-invalid.html).

  assert.doesNotThrow(() => {
    CSSStyleValue.parse('perspective-origin', 'left 10px top 20px');
  }, '4-value <position> must parse as perspective-origin');
  const four = CSSStyleValue.parse('perspective-origin', 'left 10px top 20px');
  assert.ok(four instanceof CSSPositionValue, '4-value perspective-origin reifies as CSSPositionValue');
  assert.ok(four.x instanceof CSSUnitValue);
  assert.strictEqual((four.x as CSSUnitValue).value, 10);
  assert.strictEqual((four.x as CSSUnitValue).unit, 'px');
  assert.ok(four.y instanceof CSSUnitValue);
  assert.strictEqual((four.y as CSSUnitValue).value, 20);
  assert.strictEqual((four.y as CSSUnitValue).unit, 'px');

  assert.throws(() => {
    CSSStyleValue.parse('perspective-origin', 'left 10px top');
  }, TypeError, '3-value is invalid <position> (css-values-4 #position; WPT perspective-origin-invalid.html)');

  assert.throws(() => {
    CSSStyleValue.parse('perspective-origin', '10px 20px 5px');
  }, TypeError, 'z is invalid for perspective-origin (css-transforms-2 #perspective-origin-property)');

  assert.throws(() => {
    CSSStyleValue.parse('transform-origin', 'left 10px top 20px');
  }, TypeError, '4-value <position> remains invalid transform-origin');
});

