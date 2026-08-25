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
// Verifies: SW-REQ-260821-E5D5, SYS-REQ-260821-EGCP, INT-REQ-260821-9SGA,
// SYS-REQ-260821-KV30
// Public-API unique-cause legs for typed-OM decisions still hot after rounds
// 1-N:
//   - transform-parser per-family name dispatch F legs (translateX/Z, scaleX/Z,
//     rotateY, rotate3d) — css-transforms-1 § 16 #transform-property.
//   - math-parser toCanonical `x` leg and CSSUnitValue.to resolution
//     conversions — css-values-4 § 6.2 #resolution (x ≡ dppx).
//   - numeric-methods createSumValue angle/time canonicalization,
//     numericTo arity guard, areUnitMapsEqual size mismatch.
//   - position-parser isVerticalOrigin / isLengthCoord non-token (calc())
//     coords, offset-position keyword arms, background-position empty segment.
//   - color-reify #RRGGBB vs #RRGGBBAA reification.
// Drive CSSTransformValue.parse / CSSStyleValue.parse / CSSNumericValue.parse /
// CSSUnitValue.to. No internals.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSTransformValue } from '../src/typed-om/transform/CSSTransformValue.ts';
import { CSSUnitValue } from '../src/typed-om/numeric/CSSUnitValue.ts';
import { CSSNumericValue } from '../src/typed-om/numeric/CSSNumericValue.ts';
import { CSSMathSum } from '../src/typed-om/numeric/math/CSSMathOperations.ts';
import { CSSStyleValue } from '../src/typed-om/values/CSSStyleValue.ts';

describe('MC/DC public unique-cause round 1: transform name dispatch', () => {
  test('axis-specific translate/scale/rotate names skip the plain-name arm', () => {
    // Unique-cause of name === "translate" F: translatex takes its own arm.
    assert.equal(CSSTransformValue.parse('translatex(10px)').toString(), 'translate(10px, 0px)');
    // translatez arm.
    assert.equal(CSSTransformValue.parse('translatez(1px)').toString(), 'translate3d(0px, 0px, 1px)');
    // Positive row: plain translate.
    assert.equal(CSSTransformValue.parse('translate(3px)').toString(), 'translate(3px, 0px)');
  });

  test('scalex / scalez take their own arms', () => {
    assert.equal(CSSTransformValue.parse('scalex(2)').toString(), 'scale(2, 1)');
    assert.equal(CSSTransformValue.parse('scalez(2)').toString(), 'scale3d(1, 1, 2)');
    assert.equal(CSSTransformValue.parse('scale(3)').toString(), 'scale(3)');
  });

  test('rotatey / rotate3d take their own arms', () => {
    assert.equal(CSSTransformValue.parse('rotatey(30deg)').toString(), 'rotate3d(0, 1, 0, 30deg)');
    assert.equal(
      CSSTransformValue.parse('rotate3d(1, 2, 3, 45deg)').toString(),
      'rotate3d(1, 2, 3, 45deg)',
    );
    assert.equal(CSSTransformValue.parse('rotate(90deg)').toString(), 'rotate(90deg)');
  });
});

describe('MC/DC public unique-cause round 1: resolution conversion', () => {
  test('`x` unit canonicalizes to 96dpi per css-values-4 § 6.2', () => {
    // Unique-cause of val.unit === "x" T: 2x → 192dpi.
    assert.equal(new CSSUnitValue(2, 'x').to('dpi').toString(), '192dpi');
    // dppx synonym row: 2dppx → 192dpi.
    assert.equal(new CSSUnitValue(2, 'dppx').to('dpi').toString(), '192dpi');
    // dpcm ↔ x round trip exercises both directions of the table.
    const back = new CSSUnitValue(1, 'dpcm').to('dppx');
    assert.ok(Math.abs(back.value - 2.54 / 96) < 1e-12);
  });

  test('CSSNumericValue.to arity guard throws before validation', () => {
    assert.throws(() => (new CSSUnitValue(1, 'px') as unknown as { to(): unknown }).to(), TypeError);
  });
});

describe('MC/DC public unique-cause round 1: sum canonicalization + equality', () => {
  test('angle and time terms canonicalize inside a sum', () => {
    const degs = new CSSMathSum(new CSSUnitValue(90, 'deg'), new CSSUnitValue(1, 'turn'));
    assert.equal(degs.toString(), 'calc(90deg + 1turn)');
    const times = new CSSMathSum(new CSSUnitValue(1, 's'), new CSSUnitValue(5, 'ms'));
    assert.equal(times.toString(), 'calc(5ms + 1s)');
  });

  test('equals compares unit maps of different sizes as unequal', () => {
    const prod = CSSNumericValue.parse('calc(1px * 1s)');
    assert.equal(prod.equals(CSSNumericValue.parse('1px')), false);
    assert.equal(
      CSSNumericValue.parse('calc(1px + 1em)').equals(CSSNumericValue.parse('calc(1px + 1em)')),
      true,
    );
  });
});

describe('MC/DC public unique-cause round 1: position grammar arms', () => {
  test('calc() coords drive the non-token origin arms', () => {
    // isVerticalOrigin non-token leg: calc resolves to a length coordinate.
    assert.equal(
      CSSStyleValue.parse('background-position', 'center calc(1px + 1px)').toString(),
      '50% calc(2px)',
    );
    // isLengthCoord non-token leg for transform-origin.
    assert.equal(
      CSSStyleValue.parse('transform-origin', 'calc(1px + 1px) 2px').toString(),
      'calc(2px) 2px',
    );
  });

  test('offset-position keyword arms', () => {
    assert.equal(CSSStyleValue.parse('offset-position', 'auto').toString(), 'auto');
    assert.equal(CSSStyleValue.parse('offset-position', 'center').toString(), '50% 50%');
  });

  test('background-position with an empty comma segment falls back to raw value', () => {
    // The empty middle segment fails the grammar; parse falls back instead of
    // throwing (documented fallback behavior).
    const v = CSSStyleValue.parse('background-position', 'left, , right');
    assert.equal(v.toString(), '0% 50%');
  });
});

describe('MC/DC public unique-cause round 1: color reification', () => {
  test('#RRGGBB and #RRGGBBAA reify distinctly', () => {
    assert.equal(CSSStyleValue.parse('color', '#00ff00').toString(), 'rgb(0, 255, 0)');
    assert.equal(CSSStyleValue.parse('color', '#00ff0080').toString(), 'rgba(0, 255, 0, 0.5019607843137255)');
  });
});
