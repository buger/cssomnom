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
// MC/DC witness (typed-om round): unique-cause rows for
//   - CSSVariableReferenceValue fallback !== undefined = F (css-typed-om-1
//     § 3.4 #variablereferencevalue): an explicit undefined fallback keeps
//     the null default.
//   - transform-parser name === 'translate'/'scale'/'rotate' F rows
//     (css-transforms-1 § 8 #transform-functions): variant names take the
//     non-base arms of each family check.
//   - position-parser isVerticalOrigin isToken = F and isLengthCoord
//     isToken/ident rows (css-transforms-1 § 5 #transform-origin-property,
//     css-values-4 § 10.1 #position).
//   - position-parser matchesPositionPropertyGrammar isIdentKeyword = F for
//     offset-position (css-motion-1 #offset-position-property).
//   - position-parser background/mask-position empty-segment row
//     (css-backgrounds-3 #background-position).
//   - CSSNumericType.addTypesForSum hasPercent rows via CSSMathSum
//     percent+length and incompatible px+deg (css-values-4 § 10.4 #calc-type).
//   - CSSMathClamp constructor lower/upper compatibility rows
//     (css-values-4 § 10.5 #clamp-func).
//   - parser-api cssomAtRuleFromFields r.name = F (css-animations-1
//     #CSSKeyframesRule): an empty animation name yields no prelude token.
//   - PropertyRegistry.validate nameTokens[1].type !== 'EOF' F row
//     (css-properties-values-api-1 § 3 #registerProperty): a valid
//     dashed-ident name passes the whole chain.
//   - DOMMatrix parseMatrixInit !init / typeof rows and
//     fromFloat64Array length rows (geometry-1 #DOMMatrix).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSStyleValue,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathClamp,
  CSSVariableReferenceValue,
} from '../src/typed-om.ts';
import { CSSKeyframesRule } from '../src/CSSOM.ts';
import { CSSParserAtRule, CSSParserQualifiedRule, toParserRule } from '../src/parser-api.ts';
import { parse } from '../src/parser.ts';
import { DOMMatrix, DOMMatrixReadOnly } from '../src/DOMMatrix.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';

describe('MC/DC witness: typed-om numeric, transform, and matrix rows', () => {
  // css-typed-om-1 § 3.4: undefined fallback (not null) keeps _fallback null
  // — the fallback !== undefined = F row of the constructor guard.
  test('explicit undefined fallback stays null', () => {
    const ref = new CSSVariableReferenceValue('--wit', undefined as unknown as null);
    assert.equal(ref.fallback, null);
    assert.equal(String(ref), 'var(--wit)');
    const withFallback = new CSSVariableReferenceValue('--wit', null);
    assert.equal(withFallback.fallback, null);
  });

  // css-values-4 § 10.7: simplification flattens a nested min inside max
  // (isMin F with a CSSMathMin child) and a nested max inside max.
  test('max(min(...)) and max(max(...)) flatten through to()', () => {
    const nestedMin = CSSStyleValue.parse('width', 'max(min(1px, 2px), 3px)');
    assert.ok(nestedMin instanceof CSSNumericValue, `expected CSSNumericValue, got ${nestedMin.constructor.name}`);
    assert.equal(String(nestedMin.to('px')), '3px');
    const nestedMax = CSSStyleValue.parse('width', 'max(max(1px, 2px), 3px)');
    assert.ok(nestedMax instanceof CSSNumericValue, `expected CSSNumericValue, got ${nestedMax.constructor.name}`);
    assert.equal(String(nestedMax.to('px')), '3px');
    const minMax = CSSStyleValue.parse('width', 'min(max(1px, 2px), 3px)');
    assert.ok(minMax instanceof CSSNumericValue, `expected CSSNumericValue, got ${minMax.constructor.name}`);
    assert.equal(String(minMax.to('px')), '2px');
  });

  // css-values-4 § 10.7: transform arguments run simplify(), flattening a
  // max(min(...)) and max(max(...)) across operators into their bounds.
  test('transform argument simplification flattens nested min in max', () => {
    const t = CSSStyleValue.parse('transform', 'translate(max(min(1px, 2px), 3px), 0px)');
    assert.equal(String(t), 'translate(3px, 0px)');
    const s = CSSStyleValue.parse('transform', 'scale(max(min(1, 2), 3))');
    assert.equal(String(s), 'scale(3)');
    const m = CSSStyleValue.parse('transform', 'translate(max(max(1px, 2px), 3px), 0px)');
    assert.equal(String(m), 'translate(3px, 0px)');
  });

  // css-transforms-1 § 8: variant function names take the F side of the
  // base-name checks inside parseTranslate / parseScale / parseRotate.
  test('transform variant names take non-base arms', () => {
    const tx = CSSStyleValue.parse('transform', 'translatex(10px)');
    assert.equal(String(tx), 'translate(10px, 0px)');
    const sx = CSSStyleValue.parse('transform', 'scalex(2)');
    assert.equal(String(sx), 'scale(2, 1)');
    const rx = CSSStyleValue.parse('transform', 'rotatex(45deg)');
    assert.equal(String(rx), 'rotate3d(1, 0, 0, 45deg)');
  });

  // css-transforms-1 § 5: a calc() second coordinate drives isVerticalOrigin
  // through its non-token row; a calc() z offset drives isLengthCoord's
  // non-token row while an ident z offset drives its ident row.
  test('transform-origin calc and ident coordinate rows', () => {
    const calcY = CSSStyleValue.parse('transform-origin', '10px calc(20px + 1em)');
    assert.equal(calcY.constructor.name, 'CSSPositionValue');
    const calcZ = CSSStyleValue.parse('transform-origin', 'left top calc(10px)');
    assert.equal(String(calcZ), 'left top calc(10px)');
    assert.throws(
      () => CSSStyleValue.parse('transform-origin', 'left top foo'),
      TypeError
    );
  });

  // css-motion-1: a lone keyword that is not auto/normal falls through the
  // offset-position ident arm into the generic <position> grammar; the
  // offset-anchor arm mirrors it for its single-auto list.
  test('offset-position and offset-anchor lone keyword rows', () => {
    const pos = CSSStyleValue.parse('offset-position', 'left');
    assert.equal(pos.constructor.name, 'CSSPositionValue');
    assert.equal(String(pos), '0% 50%');
    const anchor = CSSStyleValue.parse('offset-anchor', 'left');
    assert.equal(anchor.constructor.name, 'CSSPositionValue');
    assert.equal(String(anchor), '0% 50%');
    const anchorPair = CSSStyleValue.parse('offset-anchor', '10px 20px');
    assert.equal(String(anchorPair), '10px 20px');
    const auto = CSSStyleValue.parse('offset-anchor', 'auto');
    assert.equal(String(auto), 'auto');
  });

  // css-backgrounds-3: a trailing empty comma segment fails the per-segment
  // grammar check for a non-list position property.
  test('mask-position trailing empty segment rejects', () => {
    assert.throws(() => CSSStyleValue.parse('mask-position', 'left,'), TypeError);
    const ok = CSSStyleValue.parse('mask-position', 'left, top');
    assert.ok(ok);
  });

  // css-values-4 § 10.4: percent + length sums pair the hasPercent legs via
  // the type() reducer; px + deg has neither percent and fails to sum.
  test('numeric type sum percent and incompatible rows', () => {
    const mixed = new CSSMathSum(new CSSUnitValue(10, 'px'), new CSSUnitValue(50, 'percent'));
    assert.equal(String(mixed), 'calc(50% + 10px)');
    const mixedType = mixed.type();
    assert.equal(mixedType.length, 1);
    assert.throws(
      () => new CSSMathSum(new CSSUnitValue(10, 'px'), new CSSUnitValue(3, 'deg')).type(),
      TypeError
    );
  });

  // css-values-4 § 10.5: a clamp whose lower/upper bases clash with a
  // percent value throws at the bound-versus-bound check, while a fully
  // compatible clamp constructs.
  test('clamp bound compatibility rows', () => {
    const ok = new CSSMathClamp(
      new CSSUnitValue(1, 'px'),
      new CSSUnitValue(50, 'percent'),
      new CSSUnitValue(10, 'px')
    );
    assert.equal(String(ok), 'clamp(1px, 50%, 10px)');
    assert.throws(
      () =>
        new CSSMathClamp(
          new CSSUnitValue(1, 'px'),
          new CSSUnitValue(50, 'percent'),
          new CSSUnitValue(10, 'deg')
        ),
      TypeError
    );
  });

  // css-animations-1: an empty keyframes name produces no prelude token,
  // via both the CSSKeyframesRule instance and the type-8 duck route.
  test('keyframes rule with empty name yields empty prelude', () => {
    const rule = toParserRule(new CSSKeyframesRule('', []));
    assert.ok(rule instanceof CSSParserAtRule, `expected CSSParserAtRule, got ${rule?.constructor.name}`);
    assert.equal(rule.name, 'keyframes');
    assert.deepEqual(rule.prelude, []);
    const duck = toParserRule({
      type: 8,
      keyText: '',
      style: { cssText: '', length: 0 },
    });
    assert.ok(duck instanceof CSSParserQualifiedRule, `expected CSSParserQualifiedRule, got ${duck?.constructor.name}`);
    assert.deepEqual(duck.prelude, []);
  });

  // css-properties-values-api-1 § 3: a valid dashed-ident registration passes
  // the whole token-shape chain (final !== 'EOF' leg false), via the public
  // PropertyRegistry.validate entry the @property rule parser calls.
  test('registerProperty accepts a valid dashed ident', () => {
    CSS.registerProperty({ name: '--wit-reg', syntax: '<length>', inherits: false, initialValue: '0px' });
    const sheet = parse('@property --wit-prop { syntax: "*"; inherits: false; }');
    assert.equal(sheet.cssRules.length, 1);
    PropertyRegistry.validate({ name: '--wit-prop', syntax: '*', inherits: false });
    assert.throws(
      () => PropertyRegistry.validate({ name: 'wit-no-dash', syntax: '*', inherits: false }),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError'
    );
  });

  // geometry-1: non-dictionary initializers throw from the guard (both the
  // falsy and the non-object rows).
  test('DOMMatrix init guard rows', () => {
    assert.throws(() => new DOMMatrix(5 as never), TypeError);
    assert.throws(() => new DOMMatrix(null as never), TypeError);
    const identity = new DOMMatrix();
    assert.equal(identity.isIdentity, true);
  });

  // geometry-1: fromFloat64Array validates the 16-element length both ways.
  test('fromFloat64Array length rows', () => {
    const ok = DOMMatrixReadOnly.fromFloat64Array(new Float64Array(16));
    assert.equal(ok.is2D, false);
    assert.throws(() => DOMMatrixReadOnly.fromFloat64Array(new Float64Array(6)), TypeError);
  });
});
