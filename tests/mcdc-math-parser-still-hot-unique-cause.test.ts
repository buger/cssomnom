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
// Verifies: SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5
// Still-hot unique-cause for src/math-parser.ts leftovers that
// tests/mcdc-math-parser-leftover-unique-cause.test.ts,
// tests/mcdc-hotspot-math-walk.test.ts,
// tests/mcdc-hotspot-math-simplify-leftover.test.ts, and
// tests/mcdc-simplify-unique-cause.test.ts do not isolate:
// consumeValue unary-minus distribution over mixed leftover sums
// (grandchild unit F / CSSMathNegate T), combineSumTerms negate whose
// value is not a CSSUnitValue, combineProductTerms nested CSSMathProduct
// flatten, simplify double-negate of leftover min, simplify negate-of-sum
// leftover negate unwrap, simplifyMinMax nested leftover max flatten.
// Drive CSSNumericValue.parse / CSSStyleValue.parse / simplify. css-values-4
// § 10.1 #funcdef-calc / § 10.2 #funcdef-min / #funcdef-max /
// § 10.7 #calc-simplification. parseMathFunction / parseMathExpressionTokens
// are not used: public parse reaches combineProductTerms flatten. simplify()
// is kept because CSSStyleValue.parse keeps leftover nested max unflattened
// and CSSNumericValue.parse keeps leftover double-negate; leftover negate-of-sum
// unique-cause uses constructed trees that parse-time unit cases would fold.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { simplify } from '../src/math-parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathMin,
  CSSMathMax,
  CSSStyleValue,
} from '../src/typed-om.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function leftoverMin(): CSSNumericValue {
  const node = CSSNumericValue.parse('min(1px, 2em)');
  assert.ok(node instanceof CSSMathMin);
  return node;
}

function leftoverMax(): CSSNumericValue {
  const node = CSSNumericValue.parse('max(1px, 2em)');
  assert.ok(node instanceof CSSMathMax);
  return node;
}

function hasUnit(nodes: CSSNumericValue[], unitName: string, value?: number): boolean {
  return nodes.some(
    (n) => n instanceof CSSUnitValue && n.unit === unitName && (value === undefined || n.value === value),
  );
}

describe('MC/DC still-hot unique-cause: consumeValue unary-minus distribution (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('grandchild instanceof CSSUnitValue F: leftover min/max inside the negated sum', () => {
    // Leftover `calc(- (1px + 2em))` unique-caused unit T on both grandchildren.
    // Mixed leftover function is unit F then CSSMathNegate wrap (not unwrap).
    const minChild = parse('calc(- (1px + min(1px, 2em)))');
    assert.ok(minChild instanceof CSSMathSum);
    assert.equal(minChild.values.length, 2);
    assert.ok(hasUnit([...minChild.values], 'px', -1));
    assert.ok([...minChild.values].some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMin));

    const maxChild = parse('calc(- (min(1px, 2em) + max(1px, 2em)))');
    assert.ok(maxChild instanceof CSSMathSum);
    assert.equal(maxChild.values.length, 2);
    assert.ok([...maxChild.values].every((c) => c instanceof CSSMathNegate));
    assert.ok([...maxChild.values].some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMin));
    assert.ok([...maxChild.values].some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMax));

    const width = CSSStyleValue.parse('width', 'calc(- (1px + min(1px, 2em)))');
    assert.ok(width instanceof CSSMathSum);
    assert.ok(hasUnit([...(width as CSSMathSum).values], 'px', -1));
  });

  test('grandchild instanceof CSSMathNegate T: unary minus unwraps an inner minus term', () => {
    // Parse-time distribution sees CSSMathNegate(2em) before simplify folds it to -2em.
    const unwrapped = parse('calc(- (1px - 2em))');
    assert.ok(unwrapped instanceof CSSMathSum);
    assert.equal(unwrapped.values.length, 2);
    assert.ok(hasUnit([...unwrapped.values], 'px', -1));
    assert.ok(hasUnit([...unwrapped.values], 'em', 2));

    // Inner minus of leftover min: unwrap returns the min itself (value is not a unit).
    const unwrapMin = parse('calc(- (1px - min(1px, 2em)))');
    assert.ok(unwrapMin instanceof CSSMathSum);
    assert.ok(hasUnit([...unwrapMin.values], 'px', -1));
    assert.ok([...unwrapMin.values].some((c) => c instanceof CSSMathMin));

    const width = CSSStyleValue.parse('width', 'calc(- (1px - 2em))');
    assert.ok(width instanceof CSSMathSum);
    assert.ok(hasUnit([...(width as CSSMathSum).values], 'em', 2));
  });
});

describe('MC/DC still-hot unique-cause: combineSumTerms negate-of-non-unit (css-values-4 § 10.1 #funcdef-calc)', { concurrency: false }, () => {
  test('t.value instanceof CSSUnitValue F: minus of leftover min stays in otherTerms', () => {
    // Unique-cause of the AND: negate T, value-is-unit F (leftover tests used 1px - 2em, both units).
    const minusMin = parse('calc(1px - min(1px, 2em))');
    assert.ok(minusMin instanceof CSSMathSum);
    assert.equal(minusMin.values.length, 2);
    assert.ok(hasUnit([...minusMin.values], 'px', 1));
    assert.ok([...minusMin.values].some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMin));

    // `-min` tokenizes as a dashed ident; space keeps unary minus + function.
    const plusNegMin = parse('calc(- min(1px, 2em) + 10px)');
    assert.ok(plusNegMin instanceof CSSMathSum);
    assert.ok(hasUnit([...plusNegMin.values], 'px', 10));
    assert.ok([...plusNegMin.values].some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMin));

    // Double-negate term: CSSMathNegate whose value is another negate, not a unit.
    const doubleNegTerm = parse('calc(1px - - min(1px, 2em))');
    assert.ok(doubleNegTerm instanceof CSSMathSum);
    assert.ok([...doubleNegTerm.values].some(
      (c) => c instanceof CSSMathNegate && c.value instanceof CSSMathNegate && c.value.value instanceof CSSMathMin,
    ));

    const width = CSSStyleValue.parse('width', 'calc(1px - min(1px, 2em))');
    assert.ok(width instanceof CSSMathSum);
    assert.ok([...(width as CSSMathSum).values].some((c) => c instanceof CSSMathNegate));
  });
});

describe('MC/DC still-hot unique-cause: combineProductTerms nested product flatten (css-values-4 § 10.1 #funcdef-calc)', { concurrency: false }, () => {
  test('t instanceof CSSMathProduct T: paren product of mixed bases is flattened', () => {
    // px*s cannot collapse, so the inner paren is a CSSMathProduct that flatten
    // lifts. Without flatten the outer product would still be a CSSMathProduct
    // with a nested product child — require no nested product and top-level
    // mixed-base units. (2px * 3) collapses to 6px before flatten sees a product.
    const nested = parse('calc((2px * 3s) * 4)');
    assert.ok(nested instanceof CSSMathProduct);
    const nestedKids = [...nested.values];
    assert.equal(nestedKids.length, 3);
    assert.equal(nestedKids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(hasUnit(nestedKids, 'px', 2));
    assert.ok(hasUnit(nestedKids, 's', 3));
    assert.ok(hasUnit(nestedKids, 'number', 4));

    const nestedLeftover = parse('calc((2px * 3s) * min(1px, 2em))');
    assert.ok(nestedLeftover instanceof CSSMathProduct);
    const leftoverKids = [...nestedLeftover.values];
    assert.equal(leftoverKids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(leftoverKids.some((c) => c instanceof CSSMathMin));
    assert.ok(hasUnit(leftoverKids, 'px', 2));
    assert.ok(hasUnit(leftoverKids, 's', 3));

    const inverted = parse('calc((10px / 2s) * 3)');
    assert.ok(inverted instanceof CSSMathProduct);
    const invKids = [...inverted.values];
    assert.equal(invKids.length, 3);
    assert.equal(invKids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(hasUnit(invKids, 'px', 10));
    assert.ok(hasUnit(invKids, 'number', 3));
    assert.ok(invKids.some(
      (c) => c instanceof CSSMathInvert && c.value instanceof CSSUnitValue && c.value.unit === 's' && c.value.value === 2,
    ));

    const width = CSSStyleValue.parse('width', 'calc((2px * 3s) * 4)');
    assert.ok(width instanceof CSSMathProduct);
    const widthKids = [...width.values];
    assert.equal(widthKids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(hasUnit(widthKids, 'px', 2));
    assert.ok(hasUnit(widthKids, 's', 3));
    assert.ok(hasUnit(widthKids, 'number', 4));

    const widthLeftover = CSSStyleValue.parse('width', 'calc((2px * 3s) * min(1px, 2em))');
    assert.ok(widthLeftover instanceof CSSMathProduct);
    const widthLeftoverKids = [...widthLeftover.values];
    assert.equal(widthLeftoverKids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(widthLeftoverKids.some((c) => c instanceof CSSMathMin));
    assert.ok(hasUnit(widthLeftoverKids, 'px', 2));
    assert.ok(hasUnit(widthLeftoverKids, 's', 3));
  });
});

describe('MC/DC still-hot unique-cause: simplify leftover negate (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('simplifiedChild instanceof CSSMathNegate T: double-negate of leftover min unwraps', () => {
    // Unique-cause test used Negate(Negate(8px)); inner folds to -8px so the outer never sees a negate.
    const leftover = leftoverMin();
    const unwrapped = simplify(new CSSMathNegate(new CSSMathNegate(leftover)));
    assert.ok(unwrapped instanceof CSSMathMin);
    assert.equal(unwrapped.values.length, 2);

    // `--min` would be a dashed ident; spaces keep two unary minuses.
    const parsed = parse('calc(- (- min(1px, 2em)))');
    assert.ok(parsed instanceof CSSMathNegate);
    assert.ok(parsed.value instanceof CSSMathNegate);
    const parsedSimplified = simplify(parsed);
    assert.ok(parsedSimplified instanceof CSSMathMin);

    const width = CSSStyleValue.parse('width', 'calc(- (- min(1px, 2em)))');
    assert.ok(width instanceof CSSMathMin);
  });

  test('grandchild instanceof CSSMathNegate T: distribute over sum whose inner negate is leftover min', () => {
    // math-walk used Negate(em) which simplify folds to -2em before distribution.
    const distributed = simplify(new CSSMathNegate(new CSSMathSum(
      CSS.px(3),
      new CSSMathNegate(leftoverMin()),
    )));
    assert.ok(distributed instanceof CSSMathSum);
    const kids = [...distributed.values];
    assert.ok(hasUnit(kids, 'px', -3));
    assert.ok(kids.some((c) => c instanceof CSSMathMin));
    assert.equal(kids.some((c) => c instanceof CSSMathNegate), false);

    const withUnit = simplify(new CSSMathNegate(new CSSMathSum(
      CSS.px(3),
      new CSSMathNegate(leftoverMin()),
      leftoverMax(),
    )));
    assert.ok(withUnit instanceof CSSMathSum);
    const mixed = [...withUnit.values];
    assert.ok(hasUnit(mixed, 'px', -3));
    assert.ok(mixed.some((c) => c instanceof CSSMathMin));
    assert.ok(mixed.some((c) => c instanceof CSSMathNegate && c.value instanceof CSSMathMax));
  });
});

describe('MC/DC still-hot unique-cause: simplifyMinMax nested leftover max (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  test('child instanceof CSSMathMax T: leftover nested max flattens; nested min inside max does not', () => {
    // Phase 91 unique-caused nested leftover min flatten; nested leftover max was never a child.
    const nestedMax = simplify(new CSSMathMax(
      new CSSMathMax(CSS.px(8), CSS.em(3)),
      CSS.vw(4),
    ));
    assert.ok(nestedMax instanceof CSSMathMax);
    assert.equal(nestedMax.values.length, 3);
    assert.ok(hasUnit([...nestedMax.values], 'px', 8));
    assert.ok(hasUnit([...nestedMax.values], 'em', 3));
    assert.ok(hasUnit([...nestedMax.values], 'vw', 4));

    const parsed = parse('max(max(1px, 2em), 3vw)');
    const flattened = simplify(parsed);
    assert.ok(flattened instanceof CSSMathMax);
    assert.equal(flattened.values.length, 3);

    // isMin F, instanceof CSSMathMax F: nested leftover min inside max stays nested.
    const maxOfMin = simplify(new CSSMathMax(leftoverMin(), CSS.vw(3)));
    assert.ok(maxOfMin instanceof CSSMathMax);
    assert.ok([...maxOfMin.values].some((c) => c instanceof CSSMathMin));

    // CSSStyleValue.parse('width') keeps the nested max; flatten is simplify()'s unique-cause.
    const width = CSSStyleValue.parse('width', 'max(max(1px, 2em), 3vw)');
    assert.ok(width instanceof CSSMathMax);
    assert.ok([...(width as CSSMathMax).values].some((c) => c instanceof CSSMathMax));
    const widthFlat = simplify(width as CSSMathMax);
    assert.ok(widthFlat instanceof CSSMathMax);
    assert.equal(widthFlat.values.length, 3);
  });
});
