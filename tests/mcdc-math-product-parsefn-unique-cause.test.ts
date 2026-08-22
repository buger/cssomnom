/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 *
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
// Leftover unique-cause for src/math-parser.ts combineProductTerms (12/18 D)
// and parseMathFunction (32/38 D) after
// tests/mcdc-math-parser-leftover-unique-cause.test.ts and
// tests/mcdc-math-parser-still-hot-unique-cause.test.ts.
// Drive CSSNumericValue.parse / CSSStyleValue.parse.
// Pairable leftovers unique-caused here (tokenizer cannot emit them;
// successive-read keys/getters — same pattern as
// tests/mcdc-parseall-round7-unique-cause.test.ts and
// tests/mcdc-simplify-still-hot3-unique-cause.test.ts):
//   combineProductTerms L175 otherChildren.length > 0 F (A=T,B=F)
//   combineProductTerms L211 matchingChild F + targetBase length|angle|time|else
//   combineProductTerms L234 otherChildren.length === 1 T
//   parseMathFunction L409 token.type === "comma" F + L419 leftover T
//   parseMathFunction L451 type !== "comma" T
//   parseMathFunction L492 token.type === "comma" F
//   parseMathFunction L522 token.type === "comma" F + L532 leftover T
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import {
  CSSNumericValue,
  CSSNumericArray,
  CSSUnitValue,
  CSSMathSum,
  CSSMathProduct,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathRound,
  CSSMathFunction,
  CSSMathInvert,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { CSSUnit } from '../src/data/gen/units.ts';
import type { ComponentValue, CSSFunction } from '../src/types.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
}

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function sumUnit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSMathSum, `expected CSSMathSum wrap, got ${node.constructor.name} (${node.toString()})`);
  assert.equal(node.values.length, 1);
  return unit(node.values[0] as CSSNumericValue);
}

function syntaxError(css: string): void {
  assert.throws(
    () => CSSNumericValue.parse(css),
    (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    css,
  );
}

function styleInvalidMath(property: string, css: string): void {
  assert.throws(
    () => CSSStyleValue.parse(property, css),
    (err: unknown) => err instanceof TypeError && String(err).includes('Invalid math function'),
    `${property}: ${css}`,
  );
}

const origParseComponentValues = ParseHooks.parseComponentValues;
const origNumericArrayIterator = CSSNumericArray.prototype[Symbol.iterator];

function restoreHooks(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
  CSSNumericArray.prototype[Symbol.iterator] = origNumericArrayIterator;
}

function withMappedComponentValues(map: (values: ComponentValue[]) => ComponentValue[], fn: () => void): void {
  ParseHooks.parseComponentValues = (tokens) => map(origParseComponentValues(tokens));
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

function walkValues(values: ComponentValue[], map: (v: ComponentValue) => ComponentValue): ComponentValue[] {
  return values.map((v) => {
    const mapped = map(v);
    if (mapped.type === 'function') {
      const fn = mapped as CSSFunction;
      return { ...fn, value: walkValues(fn.value, map) };
    }
    if (mapped.type === 'simple-block' && Array.isArray(mapped.value)) {
      return { ...mapped, value: walkValues(mapped.value as ComponentValue[], map) };
    }
    return mapped;
  });
}

/**
 * Access order on the first dimension unit during CSSNumericValue.parse of
 * calc(2em * 3) (probe-verified): 1 consumeValue `unit in unitToBase`,
 * 2 CSSUnitValue constructor, 3 combineProductTerms exponent base,
 * 4–5 toCanonical's temporary unit, 6 matchingChild find.
 * keep=3 leaves targetBase from the real unit and makes matchingChild miss.
 * css-values-4 § 10.7 #calc-simplification.
 */
function wrapFirstDimensionUnit(values: ComponentValue[], keep: number, real: CSSUnit, other: CSSUnit): ComponentValue[] {
  let wrapped = false;
  let n = 0;
  const key = {
    toString(): string {
      n += 1;
      return n <= keep ? real : other;
    },
  };
  return walkValues(values, (v) => {
    if (v.type === 'dimension' && !wrapped) {
      wrapped = true;
      return { ...v, unit: key } as ComponentValue;
    }
    return v;
  });
}

/**
 * parseMathFunction L378 filter reads type twice (`!== whitespace` then
 * `!== EOF`); consumeArg L386 is the third; L409/L445/L451/L492/L522 is the
 * fourth. keep=3 unique-causes comma F at that if. css-values-4 § 10.2.
 */
function wrapCommaTypeAt(values: ComponentValue[], commaIndex: number, keep: number, later: string): ComponentValue[] {
  let i = 0;
  return walkValues(values, (v) => {
    if (v.type !== 'comma') return v;
    const my = i;
    i += 1;
    if (my !== commaIndex) return v;
    let n = 0;
    return {
      ...v,
      get type() {
        n += 1;
        return n <= keep ? 'comma' : later;
      },
    } as ComponentValue;
  });
}

/**
 * First CSSNumericArray iteration during parse of calc((2px * 3s) * …) is
 * combineProductTerms flatten of the inner mixed-base product (probe-verified).
 * Emptying that spread unique-causes 1-child flatten from terms.length > 1.
 * CSSStyleValue.parse calls parseMathFunction twice (validate + reify), so
 * emptyCount=2. css-values-4 § 10.1 #funcdef-calc.
 */
function withEmptyProductFlatten<T>(emptyCount: number, fn: () => T): T {
  let n = 0;
  CSSNumericArray.prototype[Symbol.iterator] = function (this: CSSNumericArray) {
    n += 1;
    if (n <= emptyCount) return origNumericArrayIterator.call(new CSSNumericArray([]));
    return origNumericArrayIterator.call(this);
  };
  try {
    return fn();
  } finally {
    CSSNumericArray.prototype[Symbol.iterator] = origNumericArrayIterator;
  }
}

describe('MC/DC leftover unique-cause: combineProductTerms matchingChild F (css-values-4 § 10.7 #calc-simplification)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('matchingChild F: targetBase length|angle|time fallbacks and else number', () => {
    // Existing row: matchingChild T (net exponent 1 always has a non-inverted
    // child of that base). Unique-cause of F: synthetic unit key whose later
    // toString no longer maps to targetBase. keep=3 is probe-verified.
    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'em', 'fr'), () => {
      const em = sumUnit(parse('calc(2em * 3)'));
      assert.equal(em.value, 6);
      assert.equal(em.unit, 'px');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'px', 'fr'), () => {
      assert.equal(sumUnit(parse('calc(2px * 3)')).unit, 'px');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'grad', 'fr'), () => {
      const grad = sumUnit(parse('calc(2grad * 3)'));
      assert.equal(grad.value, 6);
      assert.equal(grad.unit, 'deg');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'ms', 'fr'), () => {
      const ms = sumUnit(parse('calc(2ms * 3)'));
      assert.equal(ms.value, 6);
      assert.equal(ms.unit, 's');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'fr', 'px'), () => {
      const fr = sumUnit(parse('calc(2fr * 3)'));
      assert.equal(fr.value, 6);
      assert.equal(fr.unit, 'number');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'dpi', 'px'), () => {
      assert.equal(sumUnit(parse('calc(2dpi * 3)')).unit, 'number');
    });

    withMappedComponentValues((values) => wrapFirstDimensionUnit(values, 3, 'hz', 'px'), () => {
      assert.equal(sumUnit(parse('calc(2hz * 3)')).unit, 'number');
    });

    // Contrast matchingChild T: product keeps the child's unit.
    assert.equal(sumUnit(parse('calc(2em * 3)')).unit, 'em');
    assert.equal(sumUnit(parse('calc(2em * 3)')).value, 6);
    assert.equal(sumUnit(parse('calc(2grad * 3)')).unit, 'grad');
    assert.equal(sumUnit(parse('calc(2ms * 3)')).unit, 'ms');
    assert.equal(sumUnit(parse('calc(2fr * 3)')).unit, 'fr');
    assert.equal(sumUnit(parse('calc(2dpi * 3)')).unit, 'dpi');
    assert.equal(sumUnit(parse('calc(2hz * 3)')).unit, 'hz');

    const width = CSSStyleValue.parse('width', 'calc(2em * 3)');
    assert.ok(width instanceof CSSMathSum);
    assert.equal(sumUnit(width).value, 6);
    assert.equal(sumUnit(width).unit, 'em');
  });
});

describe('MC/DC leftover unique-cause: combineProductTerms L175/L234 flatten (css-values-4 § 10.1 #funcdef-calc)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('otherChildren.length > 0 F with numericChildren.length === 1: nested product spread is empty', () => {
    // Existing rows: F- (2+ numerics, B skipped) and TT (1 numeric + leftover min).
    // Unique-cause of B: A held T, B flips. terms.length > 1 flattens to 1
    // numeric only when the inner mixed-base product contributes 0 children.
    const tf = withEmptyProductFlatten(1, () => parse('calc((2px * 3s) * 4)'));
    const four = sumUnit(tf);
    assert.equal(four.value, 4);
    assert.equal(four.unit, 'number');

    const widthTf = withEmptyProductFlatten(2, () => CSSStyleValue.parse('width', 'calc((2px * 3s) * 4)'));
    assert.ok(widthTf instanceof CSSMathSum);
    assert.equal(sumUnit(widthTf).value, 4);

    // Contrast TT: 1 numeric + leftover min, early-return product.
    const tt = parse('calc(2 * min(1px, 2em))');
    assert.ok(tt instanceof CSSMathProduct);
    assert.equal(tt.values.length, 2);
    assert.ok(tt.values[0] instanceof CSSUnitValue);
    assert.equal((tt.values[0] as CSSUnitValue).value, 2);
    assert.equal((tt.values[0] as CSSUnitValue).unit, 'number');
    assert.ok(tt.values[1] instanceof CSSMathMin);

    const pxMin = parse('calc(2px * min(1px, 2em))');
    assert.ok(pxMin instanceof CSSMathProduct);
    assert.ok([...pxMin.values].some((c) => c instanceof CSSUnitValue && c.unit === 'px' && c.value === 2));
    assert.ok([...pxMin.values].some((c) => c instanceof CSSMathMin));

    // Contrast A=F: two numerics skip the 1-numeric early return.
    const mixed = parse('calc(2px * 3s)');
    assert.ok(mixed instanceof CSSMathProduct);
    assert.equal(mixed.values.length, 2);

    const twoNumLeftover = parse('calc(2 * 3 * min(1px, 2em))');
    assert.ok(twoNumLeftover instanceof CSSMathProduct);
    assert.equal(twoNumLeftover.toString(), 'calc(6 * min(1px, 2em))');

    const widthTt = CSSStyleValue.parse('width', 'calc(2 * min(1px, 2em))');
    assert.ok(widthTt instanceof CSSMathProduct);
    assert.ok([...(widthTt as CSSMathProduct).values].some((c) => c instanceof CSSMathMin));
  });

  test('otherChildren.length === 1 T: nested product spread empty leaves one leftover min', () => {
    // Existing row: F only (two leftover functions, or mixed-base numerics).
    // Unique-cause of T: flatten yields a single non-numeric child.
    const unwrapped = withEmptyProductFlatten(1, () => parse('calc((2px * 3s) * min(1px, 2em))'));
    assert.ok(unwrapped instanceof CSSMathMin);
    assert.equal(unwrapped.values.length, 2);

    const widthUnwrapped = withEmptyProductFlatten(
      2,
      () => CSSStyleValue.parse('width', 'calc((2px * 3s) * min(1px, 2em))'),
    );
    assert.ok(widthUnwrapped instanceof CSSMathMin);

    // Contrast F: two leftover functions stay a product.
    const twoFns = parse('calc(min(1px, 2em) / max(1px, 2em))');
    assert.ok(twoFns instanceof CSSMathProduct);
    assert.equal(twoFns.values.length, 2);
    assert.ok(twoFns.values[0] instanceof CSSMathMin);
    assert.ok(twoFns.values[1] instanceof CSSMathInvert);

    const nestedKept = parse('calc((2px * 3s) * min(1px, 2em))');
    assert.ok(nestedKept instanceof CSSMathProduct);
    const kids = [...nestedKept.values];
    assert.equal(kids.some((c) => c instanceof CSSMathProduct), false);
    assert.ok(kids.some((c) => c instanceof CSSMathMin));
    assert.ok(kids.some((c) => c instanceof CSSUnitValue && c.unit === 'px'));
    assert.ok(kids.some((c) => c instanceof CSSUnitValue && c.unit === 's'));
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction min/max leftover comma F (css-values-4 § 10.2 #funcdef-min)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('token.type === "comma" F then index < tokens.length T: leftover after first arg', () => {
    // Existing row: comma T (min/max 2-arg). consumeArg always stops on comma
    // or EOF, so tokenizer leftover is never a non-comma. Unique-cause of F:
    // comma type flips after consumeArg (keep=3, probe-verified).
    withMappedComponentValues((values) => wrapCommaTypeAt(values, 0, 3, 'ident'), () => {
      syntaxError('min(1px, 2px)');
      syntaxError('max(1px, 2em)');
      styleInvalidMath('width', 'min(1px, 2px)');
      styleInvalidMath('width', 'max(1px, 2em)');
    });

    const minTwo = parse('min(1px, 2px)');
    assert.ok(minTwo instanceof CSSMathMin);
    assert.equal(minTwo.values.length, 2);

    const maxTwo = parse('max(1px, 2em)');
    assert.ok(maxTwo instanceof CSSMathMax);
    assert.equal(maxTwo.values.length, 2);

    const minOne = parse('min(1px)');
    assert.ok(minOne instanceof CSSMathMin);
    assert.equal(minOne.values.length, 1);

    const width = CSSStyleValue.parse('width', 'min(1px, 2px)');
    assert.ok(width instanceof CSSMathMin);
    assert.equal((width as CSSMathMin).values.length, 2);
  });
});

describe('MC/DC leftover unique-cause: parseMathFunction clamp/round/math leftover comma (css-values-4 § 10.2 #funcdef-clamp / § 10.6 #round-func / § 10.4)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('clamp L451 type !== "comma" T: second comma flips after value consumeArg', () => {
    // Existing rows: index >= length T (missing third comma) and FF (success).
    // Unique-cause of type !== comma T: first comma stays a comma so L445
    // passes; second comma keep=3 is ident at L451.
    withMappedComponentValues((values) => wrapCommaTypeAt(values, 1, 3, 'ident'), () => {
      syntaxError('clamp(10px, 20px, 30px)');
      styleInvalidMath('width', 'clamp(10px, 20px, 30px)');
    });

    syntaxError('clamp(10px, 20px)');
    const ok = parse('clamp(10px, 20px, 30px)');
    assert.ok(ok instanceof CSSMathClamp);
    assert.ok(ok.lower instanceof CSSUnitValue);
    assert.ok(ok.upper instanceof CSSUnitValue);

    const width = CSSStyleValue.parse('width', 'clamp(10px, 20px, 30px)');
    assert.ok(width instanceof CSSMathClamp);
  });

  test('round L492 comma F; hypot/log L522 comma F then L532 leftover T', () => {
    withMappedComponentValues((values) => wrapCommaTypeAt(values, 0, 3, 'ident'), () => {
      syntaxError('round(15px, 10px)');
      syntaxError('hypot(1px, 2px)');
      syntaxError('log(8, 2)');
    });

    const omitted = parse('round(15px)');
    assert.ok(omitted instanceof CSSMathRound);
    assert.equal(omitted.precisionOmitted, true);

    const withPrec = parse('round(15px, 10px)');
    assert.ok(withPrec instanceof CSSMathRound);
    assert.equal(withPrec.precisionOmitted, false);

    const hypot1 = parse('hypot(1px)');
    assert.ok(hypot1 instanceof CSSMathFunction);
    assert.equal(hypot1.values.length, 1);

    const hypot2 = parse('hypot(1px, 2px)');
    assert.ok(hypot2 instanceof CSSMathFunction);
    assert.equal(hypot2.values.length, 2);

    const log2 = parse('log(8, 2)');
    assert.ok(log2 instanceof CSSMathFunction);
    assert.equal(log2.values.length, 2);

    const widthRound = CSSStyleValue.parse('width', 'round(15px, 10px)');
    assert.ok(widthRound instanceof CSSStyleValue);
    const widthHypot = CSSStyleValue.parse('width', 'calc(hypot(1px, 2px))');
    assert.ok(widthHypot instanceof CSSMathSum);
  });
});
