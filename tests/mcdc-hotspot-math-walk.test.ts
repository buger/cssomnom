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
// Verifies: SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, SW-REQ-260821-FWNH, INT-REQ-260821-HJVC
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parse, parseStyleSheet, parseRuleInBlock } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { getCascadedStyle } from '../src/cascade.ts';
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
  CSSMathClamp,
  CSSMathRound,
  CSSMathFunction,
  CSSKeywordValue,
  CSSStyleValue,
} from '../src/typed-om.ts';
import {
  CSSRule,
  CSSStyleSheet,
  CSSStyleRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSNestedDeclarations,
  CSSPageRule,
  CSSMarginRule,
  CSSStartingStyleRule,
  CSSContainerRule,
  CSSImportRule,
  CSSNamespaceRule,
  CSSFontFaceRule,
  CSSKeyframesRule,
  CSSScopeRule,
} from '../src/CSSOM.ts';
import type { ASTAtRule, ComponentValue, Rule } from '../src/types.ts';

function unit(node: CSSNumericValue): CSSUnitValue {
  assert.ok(node instanceof CSSUnitValue, `expected CSSUnitValue, got ${node.constructor.name} (${node.toString()})`);
  return node;
}

function assertBase(node: CSSNumericValue, base: 'angle' | 'time'): void {
  const u = unit(node).unit;
  if (base === 'angle') {
    assert.ok(u === 'deg' || u === 'rad' || u === 'grad' || u === 'turn', `expected angle unit, got ${u}`);
  } else {
    assert.ok(u === 's' || u === 'ms', `expected time unit, got ${u}`);
  }
}

function parseSimplify(css: string): CSSNumericValue {
  return simplify(CSSNumericValue.parse(css));
}

function makeDiv(html = '<html><body><div class="t" title="a,b" data-note="hello, world"></div></body></html>'): {
  document: Document;
  el: Element;
} {
  const { document } = parseHTML(html);
  const el = document.querySelector('div');
  assert.ok(el);
  return { document, el };
}

describe('MC/DC hotspot: math-parser simplify via CSSNumericValue.parse / calc', { concurrency: false }, () => {
  test('calc sums flatten nested sums and canonicalise absolute units', () => {
    // css-values-4 § 10.7 #calc-simplification
    const parsed = CSSNumericValue.parse('calc((1px + 2px) + 1in)');
    const simplified = simplify(parsed);
    assert.equal(unit(simplified).value, 99);
    assert.equal(unit(simplified).unit, 'px');

    const mixedAbs = parseSimplify('calc(1px + 1cm + 1mm + 1pt + 1pc + 1q)');
    assert.equal(unit(mixedAbs).unit, 'px');
    assert.ok(unit(mixedAbs).value > 1);

    const relativeKept = parseSimplify('calc(10px + 5em + 1vh)');
    assert.ok(relativeKept instanceof CSSMathSum);
    assert.equal((relativeKept as CSSMathSum).values.length, 3);

    const angles = parseSimplify('calc(90deg + 100grad + 0.25turn + 1rad)');
    assert.equal(unit(angles).unit, 'deg');
    assert.ok(unit(angles).value > 90);

    const times = parseSimplify('calc(1s + 500ms)');
    assert.equal(unit(times).value, 1.5);
    assert.equal(unit(times).unit, 's');

    const numbers = parseSimplify('calc(2 + 3)');
    assert.equal(unit(numbers).value, 5);
    assert.equal(unit(numbers).unit, 'number');

    const percents = parseSimplify('calc(10% + 15%)');
    assert.equal(unit(percents).value, 25);
    assert.equal(unit(percents).unit, 'percent');

    const dpi = parseSimplify('calc(96dpi + 1dppx + 1x + 1dpcm)');
    assert.equal(unit(dpi).unit, 'dpi');
    assert.ok(Math.abs(unit(dpi).value - (96 + 96 + 96 + 2.54)) < 1e-9);

    const flex = parseSimplify('calc(1fr + 2fr)');
    assert.equal(unit(flex).value, 3);
    assert.equal(unit(flex).unit, 'fr');

    const hz = simplify(new CSSMathSum(CSS.Hz(10), CSS.Hz(20)));
    assert.equal(unit(hz).value, 30);
    assert.equal(unit(hz).unit, 'hz');

    const emOnly = parseSimplify('calc(1em + 2em)');
    assert.equal(unit(emOnly).value, 3);
    assert.equal(unit(emOnly).unit, 'em');
  });

  test('CSSStyleValue.parse calc() runs simplify and wraps a unit in CSSMathSum', () => {
    const width = CSSStyleValue.parse('width', 'calc(1px + 1in)');
    assert.ok(width instanceof CSSMathSum);
    const inner = (width as CSSMathSum).values[0];
    assert.equal(unit(inner).value, 97);
    assert.equal(unit(inner).unit, 'px');

    const distributed = CSSStyleValue.parse('width', 'calc(2 * (1px + 2px))');
    assert.ok(distributed instanceof CSSMathSum);
    assert.equal(unit((distributed as CSSMathSum).values[0]).value, 6);

    const leftover = CSSStyleValue.parse('width', 'calc(10px + 2em)');
    assert.ok(leftover instanceof CSSMathSum);
    assert.equal((leftover as CSSMathSum).values.length, 2);
  });

  test('calc products flatten, cancel units, distribute numbers over sums, and keep mixed dimensions', () => {
    const cancel = parseSimplify('calc(10px * 2 / 4px)');
    assert.equal(unit(cancel).value, 5);
    assert.equal(unit(cancel).unit, 'number');

    const scaled = parseSimplify('calc(2px * 3)');
    assert.equal(unit(scaled).value, 6);
    assert.equal(unit(scaled).unit, 'px');

    const distributed = parseSimplify('calc(2 * (1px + 3px))');
    assert.equal(unit(distributed).value, 8);
    assert.equal(unit(distributed).unit, 'px');

    const mixedDist = parseSimplify('calc(2 * (1px + 1em))');
    assert.ok(mixedDist instanceof CSSMathSum);
    const terms = [...(mixedDist as CSSMathSum).values];
    assert.equal(terms.length, 2);
    assert.ok(terms.some((t) => t instanceof CSSUnitValue && t.unit === 'px' && t.value === 2));
    assert.ok(terms.some((t) => t instanceof CSSUnitValue && t.unit === 'em' && t.value === 2));

    const area = parseSimplify('calc(2px * 3px)');
    assert.ok(area instanceof CSSMathProduct);

    const nestedProd = simplify(new CSSMathProduct(
      new CSSMathProduct(CSS.px(2), CSS.number(3)),
      CSS.number(4),
    ));
    assert.equal(unit(nestedProd).value, 24);
    assert.equal(unit(nestedProd).unit, 'px');

    const identity = simplify(new CSSMathProduct(
      CSS.number(1),
      CSSNumericValue.parse('min(1px, 2em)'),
    ));
    assert.ok(identity instanceof CSSMathMin);

    const scaledMin = simplify(new CSSMathProduct(
      CSS.number(2),
      CSSNumericValue.parse('min(1px, 2em)'),
    ));
    assert.ok(scaledMin instanceof CSSMathProduct);
    assert.ok((scaledMin as CSSMathProduct).values[0] instanceof CSSUnitValue);
    assert.equal(unit((scaledMin as CSSMathProduct).values[0] as CSSNumericValue).value, 2);

    const dimTimesFn = simplify(new CSSMathProduct(
      CSS.px(2),
      CSSNumericValue.parse('min(1em, 2em)'),
    ));
    assert.ok(dimTimesFn instanceof CSSMathProduct);

    const twoFns = simplify(new CSSMathProduct(
      CSS.number(1),
      CSSNumericValue.parse('min(1px, 2em)'),
      CSSNumericValue.parse('max(1px, 2em)'),
    ));
    assert.ok(twoFns instanceof CSSMathProduct);
    assert.equal((twoFns as CSSMathProduct).values.length, 2);

    const invertNumber = parseSimplify('calc(1 / 4)');
    assert.equal(unit(invertNumber).value, 0.25);

    const angleFromRad = parseSimplify('calc(1rad * 1)');
    assertBase(angleFromRad, 'angle');

    const timeFromMs = parseSimplify('calc(1000ms * 1)');
    assertBase(timeFromMs, 'time');
  });

  test('negation unwraps double negate, folds units, and distributes over sums', () => {
    const doubleNeg = parseSimplify('calc(-(-8px))');
    assert.equal(unit(doubleNeg).value, 8);
    assert.equal(unit(doubleNeg).unit, 'px');

    const unitNeg = parseSimplify('calc(-10px)');
    assert.equal(unit(unitNeg).value, -10);

    const dist = parseSimplify('calc(-(1px + 2em))');
    assert.ok(dist instanceof CSSMathSum);
    const kids = [...(dist as CSSMathSum).values];
    assert.ok(kids.some((k) => k instanceof CSSUnitValue && k.unit === 'px' && k.value === -1));
    assert.ok(kids.some((k) => k instanceof CSSUnitValue && k.unit === 'em' && k.value === -2));

    const negateOfNegateTerm = simplify(new CSSMathNegate(new CSSMathSum(
      CSS.px(3),
      new CSSMathNegate(CSS.em(2)),
      CSSNumericValue.parse('min(1px, 2em)'),
    )));
    assert.ok(negateOfNegateTerm instanceof CSSMathSum);
    const nKids = [...(negateOfNegateTerm as CSSMathSum).values];
    assert.ok(nKids.some((k) => k instanceof CSSUnitValue && k.unit === 'px' && k.value === -3));
    assert.ok(nKids.some((k) => k instanceof CSSUnitValue && k.unit === 'em' && k.value === 2));
    assert.ok(nKids.some((k) => k instanceof CSSMathNegate));

    const negMin = simplify(new CSSMathNegate(CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(negMin instanceof CSSMathNegate);
  });

  test('invert unwraps double invert, folds numbers, and throws on zero', () => {
    const doubleInv = parseSimplify('calc(1 / (1 / 8))');
    assert.equal(unit(doubleInv).value, 8);

    const invPx = parseSimplify('calc(1 / 2px)');
    assert.ok(invPx instanceof CSSMathInvert || invPx instanceof CSSMathProduct);

    const zeroMin = CSSNumericValue.parse('min(0px, 0px)');
    assert.throws(
      () => simplify(new CSSMathInvert(zeroMin)),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );

    const invFn = simplify(new CSSMathInvert(CSSNumericValue.parse('min(1px, 2em)')));
    assert.ok(invFn instanceof CSSMathInvert);
  });

  test('min/max flatten nested comparison functions and fold same-unit arguments', () => {
    const minFold = parseSimplify('min(10px, 20px, 5px)');
    assert.equal(unit(minFold).value, 5);
    assert.equal(unit(minFold).unit, 'px');

    const maxFold = parseSimplify('max(10px, 20px, 5px)');
    assert.equal(unit(maxFold).value, 20);

    const nestedMin = simplify(new CSSMathMin(
      CSSNumericValue.parse('min(8px, 3px)'),
      CSS.px(4),
    ));
    assert.equal(unit(nestedMin).value, 3);

    const nestedMax = simplify(new CSSMathMax(
      CSSNumericValue.parse('max(8px, 3px)'),
      CSS.px(9),
    ));
    assert.equal(unit(nestedMax).value, 9);

    const mixedMin = parseSimplify('min(10px, 2em, 4px)');
    assert.ok(mixedMin instanceof CSSMathMin);
    assert.equal((mixedMin as CSSMathMin).values.length, 2);
  });

  test('clamp folds compatible units and preserves none keywords', () => {
    const high = parseSimplify('clamp(10px, 25px, 20px)');
    assert.equal(unit(high).value, 20);

    const low = parseSimplify('clamp(10px, 2px, 20px)');
    assert.equal(unit(low).value, 10);

    const mid = parseSimplify('clamp(10px, 15px, 20px)');
    assert.equal(unit(mid).value, 15);

    const mixedUnits = parseSimplify('clamp(1px, 1in, 200px)');
    assert.equal(unit(mixedUnits).unit, 'in');
    assert.ok(Math.abs(unit(mixedUnits).value - 1) < 1e-9 || unit(mixedUnits).value > 0);

    const none = CSSNumericValue.parse('clamp(none, 10px, 20px)');
    const noneSimplified = simplify(none);
    assert.ok(noneSimplified instanceof CSSMathClamp);
    assert.ok((noneSimplified as CSSMathClamp).lower instanceof CSSKeywordValue);

    const bothNone = simplify(new CSSMathClamp(new CSSKeywordValue('none'), CSS.px(10), new CSSKeywordValue('none')));
    assert.ok(bothNone instanceof CSSMathClamp);

    const mixedRel = simplify(new CSSMathClamp(CSS.px(1), CSS.em(2), CSS.px(3)));
    assert.ok(mixedRel instanceof CSSMathClamp);
  });

  test('round applies nearest/up/down/to-zero and leaves unmatched strategy or zero step', () => {
    assert.equal(unit(parseSimplify('round(nearest, 15px, 10px)')).value, 20);
    assert.equal(unit(parseSimplify('round(up, 11px, 10px)')).value, 20);
    assert.equal(unit(parseSimplify('round(down, 19px, 10px)')).value, 10);
    assert.equal(unit(parseSimplify('round(to-zero, -19px, 10px)')).value, -10);
    assert.equal(unit(parseSimplify('round(15px, 10px)')).value, 20);

    const numberStep = simplify(new CSSMathRound('nearest', CSS.number(15), CSS.number(10)));
    assert.equal(unit(numberStep).value, 20);

    const zeroStep = simplify(new CSSMathRound('nearest', CSS.px(15), CSS.px(0)));
    assert.equal(unit(zeroStep).value, 15);

    const lineWidth = simplify(new CSSMathRound('line-width', CSS.px(15), CSS.px(10)));
    assert.equal(unit(lineWidth).value, 15);

    const mixedRound = simplify(new CSSMathRound('nearest', CSSNumericValue.parse('min(15px, 2em)'), CSS.px(10)));
    assert.ok(mixedRound instanceof CSSMathRound);
  });

  test('math functions fold abs/hypot/trig/exp/log/sign/mod/rem/pow/sqrt/atan2', () => {
    assert.equal(unit(parseSimplify('abs(-12px)')).value, 12);
    assert.equal(unit(parseSimplify('hypot(3px, 4px)')).value, 5);

    const hypotMixed = parseSimplify('hypot(3cm, 40mm)');
    assert.ok(hypotMixed instanceof CSSUnitValue);
    assert.equal(unit(hypotMixed).unit, 'px');

    const hypotRel = parseSimplify('hypot(3px, 4em)');
    assert.ok(hypotRel instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('sin(0deg)')).value, 0);
    assert.ok(Math.abs(unit(parseSimplify('cos(0rad)')).value - 1) < 1e-12);
    assert.equal(unit(parseSimplify('tan(0grad)')).value, 0);
    assert.equal(unit(parseSimplify('sin(0turn)')).value, 0);
    assert.equal(unit(parseSimplify('sin(0)')).value, 0);
    const sinPx = simplify(new CSSMathFunction('sin', CSS.px(1)));
    assert.ok(sinPx instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('asin(0)')).unit, 'deg');
    assert.equal(unit(parseSimplify('acos(1)')).value, 0);
    assert.equal(unit(parseSimplify('atan(0)')).value, 0);
    const asinPx = simplify(new CSSMathFunction('asin', CSS.px(1)));
    assert.ok(asinPx instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('sqrt(9)')).value, 3);
    const sqrtNeg = parseSimplify('sqrt(-1)');
    assert.ok(sqrtNeg instanceof CSSMathFunction);
    const sqrtPx = simplify(new CSSMathFunction('sqrt', CSS.px(9)));
    assert.ok(sqrtPx instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('pow(2, 3)')).value, 8);
    const powMixed = simplify(new CSSMathFunction('pow', CSS.px(2), CSS.number(3)));
    assert.ok(powMixed instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('atan2(10px, 10px)')).value, 45);
    const atan2Rel = parseSimplify('atan2(10px, 10em)');
    assert.ok(atan2Rel instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('mod(10px, 3px)')).value, 1);
    const modNeg = parseSimplify('mod(-10px, 3px)');
    assert.equal(unit(modNeg).value, 2);
    assert.equal(unit(parseSimplify('rem(10px, 3px)')).value, 1);
    const remNeg = parseSimplify('rem(-10px, 3px)');
    assert.equal(unit(remNeg).value, -1);
    const modRel = parseSimplify('mod(10px, 3em)');
    assert.ok(modRel instanceof CSSMathFunction);

    assert.ok(Math.abs(unit(parseSimplify('exp(0)')).value - 1) < 1e-12);
    const expPx = simplify(new CSSMathFunction('exp', CSS.px(1)));
    assert.ok(expPx instanceof CSSMathFunction);

    assert.equal(unit(parseSimplify('log(1)')).value, 0);
    assert.equal(unit(parseSimplify('log(8, 2)')).value, 3);
    const logPx = simplify(new CSSMathFunction('log', CSS.px(10)));
    assert.ok(logPx instanceof CSSMathFunction);
    const logMixed = simplify(new CSSMathFunction('log', CSS.number(10), CSS.px(10)));
    assert.ok(logMixed instanceof CSSMathFunction);

    assert.equal(unit(simplify(new CSSMathFunction('sign', CSS.px(-8)))).value, -1);
    assert.equal(unit(simplify(new CSSMathFunction('sign', CSS.number(0)))).value, 0);

    const unknown = simplify(new CSSMathFunction('calc', CSS.px(1)));
    assert.ok(unknown instanceof CSSMathFunction);

    const passthrough = simplify(CSS.px(42));
    assert.equal(unit(passthrough).value, 42);
  });
});

describe('MC/DC hotspot: cascade walkRules via getCascadedStyle', { concurrency: false }, () => {
  test('nested style rules, comma lists, strings, and :is() all match', () => {
    const { el } = makeDiv(`<html><body><div class="t" title="a,b" data-note="hello, world"><span class="inner"></span></div></body></html>`);
    const sheet = parse(`
      span, .nope { z-index: 1; }
      :is(div, span).t { z-index: 2; }
      [title="a,b"] { opacity: 0.5; }
      [data-note="hello, world"] { order: 7; }
      div {
        z-index: 0;
        .inner { z-index: 9; }
      }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '2');
    assert.equal(style.getPropertyValue('opacity'), '0.5');
    assert.equal(style.getPropertyValue('order'), '7');

    const inner = el.querySelector('.inner');
    assert.ok(inner);
    const nested = getCascadedStyle(inner, sheet.cssRules);
    assert.equal(nested.getPropertyValue('z-index'), '9');
  });

  test('pseudo-element matching covers legacy aliases, non-legacy, and element skip', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t { z-index: 1; }
      .t::before { z-index: 2; content: "b"; }
      .t:before { opacity: 0.2; }
      .t::after { z-index: 3; }
      .t::first-line { z-index: 4; }
      .t::first-letter { z-index: 5; }
      .t::marker { z-index: 6; }
      .t::before, .missing::before { order: 8; }
    `);

    assert.equal(getCascadedStyle(el, sheet.cssRules).getPropertyValue('z-index'), '1');
    assert.equal(getCascadedStyle(el, sheet.cssRules).getPropertyValue('content'), '');

    const before = getCascadedStyle(el, sheet.cssRules, '::before');
    assert.equal(before.getPropertyValue('z-index'), '2');
    assert.equal(before.getPropertyValue('opacity'), '0.2');
    assert.equal(before.getPropertyValue('order'), '8');

    const single = getCascadedStyle(el, sheet.cssRules, ':before');
    assert.equal(single.getPropertyValue('z-index'), '2');

    assert.equal(getCascadedStyle(el, sheet.cssRules, '::after').getPropertyValue('z-index'), '3');
    assert.equal(getCascadedStyle(el, sheet.cssRules, '::first-line').getPropertyValue('z-index'), '4');
    assert.equal(getCascadedStyle(el, sheet.cssRules, '::first-letter').getPropertyValue('z-index'), '5');
    assert.equal(getCascadedStyle(el, sheet.cssRules, '::marker').getPropertyValue('z-index'), '6');
    assert.equal(getCascadedStyle(el, sheet.cssRules, '::after').getPropertyValue('order'), '');
  });

  test('@layer named, nested, anonymous, and unlayered winners', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      @layer base, special;
      @layer base {
        .t { z-index: 1; }
        @layer deep {
          .t { z-index: 2; }
        }
      }
      @layer special {
        .t { z-index: 3; }
      }
      @layer {
        .t { opacity: 0.3; }
      }
      .t { z-index: 9; }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '9');
    assert.equal(style.getPropertyValue('opacity'), '0.3');

    const layeredOnly = parse(`
      @layer a {
        @layer {
          .t { z-index: 4; }
        }
      }
      @layer a.b {
        .t { z-index: 5; }
      }
    `);
    assert.equal(getCascadedStyle(el, layeredOnly.cssRules).getPropertyValue('z-index'), '5');
  });

  test('@media matching, failing, window metrics, and iframe size', () => {
    const { el, document } = makeDiv();
    const sheet = parse(`
      .t { z-index: 1; }
      @media not all { .t { z-index: 99; } }
      @media all { .t { z-index: 2; } }
      @media (min-width: 0px) { .t { opacity: 0.4; } }
      @media (min-width: 10000px) { .t { opacity: 0.9; } }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '2');
    assert.equal(style.getPropertyValue('opacity'), '0.4');

    const win = document.defaultView as Window & {
      innerWidth: number;
      innerHeight: number;
      frameElement: unknown;
    };
    const originalWidth = Object.getOwnPropertyDescriptor(win, 'innerWidth');
    const originalHeight = Object.getOwnPropertyDescriptor(win, 'innerHeight');
    const originalFrame = Object.getOwnPropertyDescriptor(win, 'frameElement');
    try {
      Object.defineProperty(win, 'innerWidth', { configurable: true, value: 320 });
      Object.defineProperty(win, 'innerHeight', { configurable: true, value: 800 });
      Object.defineProperty(win, 'frameElement', {
        configurable: true,
        value: { style: { width: '500px', height: '200px' } },
      });
      const mq = parse(`
        .t { z-index: 0; }
        @media (max-width: 600px) { .t { z-index: 7; } }
        @media (orientation: landscape) { .t { order: 1; } }
        @media (orientation: portrait) { .t { order: 2; } }
      `);
      const sized = getCascadedStyle(el, mq.cssRules);
      assert.equal(sized.getPropertyValue('z-index'), '7');
      assert.equal(sized.getPropertyValue('order'), '1');

      Object.defineProperty(win, 'innerWidth', { configurable: true, value: Number.NaN });
      Object.defineProperty(win, 'innerHeight', { configurable: true, value: 'tall' });
      Object.defineProperty(win, 'frameElement', {
        configurable: true,
        value: {
          width: 0,
          height: 'nope',
          getAttribute(name: string) {
            return name === 'width' ? '0' : 'abc';
          },
        },
      });
      const fallback = parse(`@media all { .t { z-index: 11; } }`);
      assert.equal(getCascadedStyle(el, fallback.cssRules).getPropertyValue('z-index'), '11');

      Object.defineProperty(win, 'frameElement', {
        configurable: true,
        value: { width: 640, height: 480 },
      });
      const numericFrame = parse(`@media (min-width: 600px) { .t { z-index: 12; } }`);
      assert.equal(getCascadedStyle(el, numericFrame.cssRules).getPropertyValue('z-index'), '12');
    } finally {
      if (originalWidth) Object.defineProperty(win, 'innerWidth', originalWidth);
      else delete (win as { innerWidth?: number }).innerWidth;
      if (originalHeight) Object.defineProperty(win, 'innerHeight', originalHeight);
      else delete (win as { innerHeight?: number }).innerHeight;
      if (originalFrame) Object.defineProperty(win, 'frameElement', originalFrame);
      else delete (win as { frameElement?: unknown }).frameElement;
    }
  });

  test('@supports matching vs failing conditions', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t { z-index: 1; display: block; }
      @supports (display: grid) { .t { z-index: 2; display: grid; } }
      @supports (display: not-a-real-value) { .t { z-index: 9; } }
      @supports not (display: block) { .t { order: 8; } }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '2');
    assert.equal(style.getPropertyValue('display'), 'grid');
    assert.equal(style.getPropertyValue('order'), '');
  });

  test('@scope start match, closest ancestor, implied scope, and non-match', () => {
    const { document } = parseHTML(`
      <html><body>
        <div class="card"><p class="inner"></p></div>
        <p class="outer"></p>
      </body></html>
    `);
    const inner = document.querySelector('.inner');
    const outer = document.querySelector('.outer');
    const card = document.querySelector('.card');
    assert.ok(inner && outer && card);

    const sheet = parse(`
      @scope (.card) {
        .inner { z-index: 3; }
        .outer { z-index: 8; }
      }
      @scope {
        .inner { opacity: 0.5; }
      }
      @scope (.missing) {
        .inner { z-index: 99; }
      }
    `);
    const innerStyle = getCascadedStyle(inner, sheet.cssRules);
    assert.equal(innerStyle.getPropertyValue('z-index'), '3');
    assert.equal(innerStyle.getPropertyValue('opacity'), '0.5');
    assert.equal(getCascadedStyle(outer, sheet.cssRules).getPropertyValue('z-index'), '');
  });

  test('nested @media/@supports/@layer declarations and other grouping rules', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t {
        z-index: 1;
        @media (min-width: 0px) {
          z-index: 2;
          opacity: 0.2;
        }
        @supports (display: grid) {
          display: grid;
        }
        @layer nested {
          order: 4;
        }
        @starting-style {
          caret-color: rgb(0, 128, 0);
        }
      }
      @container (min-width: 1px) {
        .t { isolation: isolate; }
      }
      @starting-style {
        .t { caret-color: rgb(255, 0, 0); }
      }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '2');
    assert.equal(style.getPropertyValue('opacity'), '0.2');
    assert.equal(style.getPropertyValue('display'), 'grid');
    assert.equal(style.getPropertyValue('order'), '4');
    assert.equal(style.getPropertyValue('isolation'), 'isolate');
    assert.equal(style.getPropertyValue('caret-color'), 'rgb(255, 0, 0)');
    const host = sheet.cssRules[0] as CSSStyleRule;
    assert.ok([...host.cssRules].some((r) => r instanceof CSSMediaRule));
    assert.ok([...host.cssRules].some((r) => r instanceof CSSSupportsRule));
    assert.ok([...host.cssRules].some((r) => r instanceof CSSLayerBlockRule));
  });

  test('nested declarations honour parent pseudo and skip when pseudo mismatches', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t::before {
        z-index: 1;
        content: "x";
        @media all {
          opacity: 0.4;
        }
      }
      .t {
        z-index: 8;
        @media all {
          order: 3;
        }
      }
    `);
    const before = getCascadedStyle(el, sheet.cssRules, '::before');
    assert.equal(before.getPropertyValue('z-index'), '1');
    assert.equal(before.getPropertyValue('opacity'), '0.4');
    assert.equal(before.getPropertyValue('order'), '');

    const element = getCascadedStyle(el, sheet.cssRules);
    assert.equal(element.getPropertyValue('z-index'), '8');
    assert.equal(element.getPropertyValue('order'), '3');
    assert.equal(element.getPropertyValue('content'), '');
  });

  test('url() resolution uses stylesheet baseURL and leaves data/blob/hash/invalid alone', () => {
    const { el } = makeDiv();
    const sheet = new CSSStyleSheet({ baseURL: 'https://example.com/css/' });
    sheet.replaceSync(`
      .t {
        background-image: url(img/a.png);
        list-style-image: url("data:image/gif;base64,AAAA");
        border-image-source: url("#frag");
        cursor: url(blob:abc);
        quotes: url(http://[);
      }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('background-image'), 'url("https://example.com/css/img/a.png")');
    assert.equal(style.getPropertyValue('list-style-image'), 'url("data:image/gif;base64,AAAA")');
    assert.equal(style.getPropertyValue('border-image-source'), 'url("#frag")');
    assert.equal(style.getPropertyValue('cursor'), 'url("blob:abc")');
    assert.match(style.getPropertyValue('quotes'), /url\(/);
  });

  test('!important, mixed selector specificity, and AST dual-representation rules', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t { z-index: 1; opacity: 0.1; }
      div.t { z-index: 2; }
      .t { z-index: 3 !important; }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '3');

    const astDecls: Rule = {
      type: 'style-rule',
      selectorText: 'div',
      style: {
        declarations: [
          { type: 'declaration', name: 'order', value: [{ type: 'number', value: 6 } as ComponentValue], important: false },
          { type: 'declaration', name: 'isolation', value: [{ type: 'ident', value: 'isolate' } as ComponentValue], important: true },
        ],
      },
    } as unknown as Rule;
    const astStyle = getCascadedStyle(el, [astDecls]);
    assert.equal(astStyle.getPropertyValue('order'), '6');
    assert.equal(astStyle.getPropertyValue('isolation'), 'isolate');

    const prelude = tokenize('div').filter((t) => t.type !== 'EOF');
    const blockTokens = tokenize('z-index: 4;').filter((t) => t.type !== 'EOF');
    const qualified: Rule = {
      type: 'qualified-rule',
      prelude,
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: blockTokens },
    } as unknown as Rule;
    assert.equal(getCascadedStyle(el, [qualified]).getPropertyValue('z-index'), '4');

    const indexStyle: Rule = {
      type: CSSRule.STYLE_RULE,
      selectorText: 'div',
      style: {
        length: 2,
        0: 'order',
        1: '',
        order: '9',
      },
    } as unknown as Rule;
    assert.equal(getCascadedStyle(el, [indexStyle]).getPropertyValue('order'), '9');

    const astMedia: ASTAtRule = {
      type: 'at-rule',
      name: 'media',
      prelude: tokenize('all').filter((t) => t.type !== 'EOF'),
      childRules: [
        {
          type: 'style-rule',
          selectorText: 'div',
          style: {
            declarations: [
              { type: 'declaration', name: 'z-index', value: [{ type: 'number', value: 14 } as ComponentValue], important: false },
            ],
          },
        } as unknown as Rule,
      ],
    };
    assert.equal(getCascadedStyle(el, [astMedia]).getPropertyValue('z-index'), '14');

    const astSupports: ASTAtRule = {
      type: 'at-rule',
      name: 'supports',
      prelude: tokenize('(display: grid)').filter((t) => t.type !== 'EOF'),
      childRules: [
        {
          type: 'style-rule',
          selectorText: 'div',
          style: {
            declarations: [
              { type: 'declaration', name: 'display', value: [{ type: 'ident', value: 'grid' } as ComponentValue], important: false },
            ],
          },
        } as unknown as Rule,
      ],
    };
    assert.equal(getCascadedStyle(el, [astSupports]).getPropertyValue('display'), 'grid');

    const astLayer: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('extra').filter((t) => t.type !== 'EOF'),
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: [] },
      childRules: [
        {
          type: 'style-rule',
          selectorText: 'div',
          style: {
            declarations: [
              { type: 'declaration', name: 'opacity', value: [{ type: 'number', value: 0.7 } as ComponentValue], important: false },
            ],
          },
        } as unknown as Rule,
      ],
    };
    assert.equal(getCascadedStyle(el, [astLayer]).getPropertyValue('opacity'), '0.7');
  });

  test('parseStyleSheet AST/CSSOM mix still walks nested grouping', () => {
    const { el } = makeDiv();
    const rules = parseStyleSheet(`
      @media all {
        @supports (color: red) {
          .t { z-index: 5; }
        }
      }
      @layer {
        .t { opacity: 0.6; }
      }
    `);
    const style = getCascadedStyle(el, rules);
    assert.equal(style.getPropertyValue('z-index'), '5');
    assert.equal(style.getPropertyValue('opacity'), '0.6');
    assert.ok(rules.some((r) => r instanceof CSSMediaRule));
    assert.ok(rules.some((r) => r instanceof CSSLayerBlockRule));
  });

  test('nested declarations instance and empty nested rule lists are skipped', () => {
    const { el } = makeDiv();
    const emptyNested = parse(`div.t { z-index: 1; span { } }`);
    assert.equal(getCascadedStyle(el, emptyNested.cssRules).getPropertyValue('z-index'), '1');

    const withNestedDecls = parse(`
      .t {
        z-index: 1;
        @media all { }
        order: 2;
      }
    `);
    const style = getCascadedStyle(el, withNestedDecls.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '1');
    assert.equal(style.getPropertyValue('order'), '2');
    const styleRule = withNestedDecls.cssRules[0] as CSSStyleRule;
    assert.ok([...styleRule.cssRules].some((r) => r instanceof CSSNestedDeclarations));
    assert.ok([...styleRule.cssRules].some((r) => r instanceof CSSMediaRule));
  });

  test('@page descriptors and margin rules skip the element; nested grouping still walks', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      @page {
        margin: 1in;
        z-index: 99;
        @top-left { content: "header"; }
        @media all {
          .t { order: 3; isolation: isolate; }
        }
      }
      @page :first { z-index: 88; }
      @page { }
      .t { z-index: 1; }
    `);
    const rules = [...sheet.cssRules];
    assert.ok(rules[0] instanceof CSSPageRule);
    assert.ok([...rules[0].cssRules].some((r) => r instanceof CSSMarginRule));
    assert.ok([...rules[0].cssRules].some((r) => r instanceof CSSMediaRule));
    assert.ok(rules[1] instanceof CSSPageRule);
    assert.equal((rules[1] as CSSPageRule).selectorText, ':first');

    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '1');
    assert.equal(style.getPropertyValue('content'), '');
    assert.notEqual(style.getPropertyValue('margin-top'), '1in');
    assert.equal(style.getPropertyValue('order'), '3');
    assert.equal(style.getPropertyValue('isolation'), 'isolate');
  });

  test('@starting-style remaining: nested declarations, nested grouping, and top-level style rules', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      .t {
        z-index: 1;
        @starting-style {
          caret-color: rgb(0, 128, 0);
          isolation: isolate;
        }
      }
      @starting-style {
        .t { order: 4; }
        @supports (display: grid) {
          .t { opacity: 0.3; }
        }
        @media not all {
          .t { z-index: 99; }
        }
      }
    `);
    const host = sheet.cssRules[0] as CSSStyleRule;
    assert.ok(host.cssRules[0] instanceof CSSStartingStyleRule);
    assert.ok((host.cssRules[0] as CSSStartingStyleRule).cssRules[0] instanceof CSSNestedDeclarations);
    assert.ok(sheet.cssRules[1] instanceof CSSStartingStyleRule);

    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '1');
    assert.equal(style.getPropertyValue('caret-color'), 'rgb(0, 128, 0)');
    assert.equal(style.getPropertyValue('isolation'), 'isolate');
    assert.equal(style.getPropertyValue('order'), '4');
    assert.equal(style.getPropertyValue('opacity'), '0.3');

    const before = getCascadedStyle(el, sheet.cssRules, '::before');
    assert.equal(before.getPropertyValue('caret-color'), '');
    assert.equal(before.getPropertyValue('order'), '');
  });

  test('CSSNestedDeclarations leftover: :scope, @scope spec 0, !important, legacy :before parent, strip to :scope', () => {
    const { el, document } = makeDiv();

    const leftoverSheet = parse(`
      .t {
        z-index: 1;
        @media all { }
        order: 2 !important;
      }
    `);
    const leftoverStyle = getCascadedStyle(el, leftoverSheet.cssRules);
    assert.equal(leftoverStyle.getPropertyValue('z-index'), '1');
    assert.equal(leftoverStyle.getPropertyValue('order'), '2');
    const leftoverHost = leftoverSheet.cssRules[0] as CSSStyleRule;
    const leftoverDecl = [...leftoverHost.cssRules].find((r) => r instanceof CSSNestedDeclarations) as CSSNestedDeclarations;
    assert.ok(leftoverDecl);
    assert.equal(leftoverDecl.style.getPropertyPriority('order'), 'important');

    const scoped = parse(`
      @scope (.t) {
        z-index: 4;
        order: 6 !important;
      }
      .t { z-index: 1; }
    `);
    assert.ok(scoped.cssRules[0] instanceof CSSScopeRule);
    assert.ok((scoped.cssRules[0] as CSSScopeRule).cssRules[0] instanceof CSSNestedDeclarations);
    const scopedStyle = getCascadedStyle(el, scoped.cssRules);
    assert.equal(scopedStyle.getPropertyValue('z-index'), '1');
    assert.equal(scopedStyle.getPropertyValue('order'), '6');
    assert.equal(getCascadedStyle(document.body, scoped.cssRules).getPropertyValue('order'), '');

    const topDecls = ParseHooks.parseStyleAttribute(tokenize('z-index: 7 !important; opacity: 0.5'));
    const topNested = new CSSNestedDeclarations(topDecls.declarations);
    const htmlStyle = getCascadedStyle(document.documentElement, [topNested]);
    assert.equal(htmlStyle.getPropertyValue('z-index'), '7');
    assert.equal(htmlStyle.getPropertyValue('opacity'), '0.5');
    assert.equal(getCascadedStyle(el, [topNested]).getPropertyValue('z-index'), '');

    const hostDecls = ParseHooks.parseStyleAttribute(tokenize('z-index: 1; content: "x"')).declarations;
    const nestedOpacity = new CSSNestedDeclarations(
      ParseHooks.parseStyleAttribute(tokenize('opacity: 0.25 !important')).declarations,
    );
    const legacyBefore = new CSSStyleRule('.t:before', hostDecls, [nestedOpacity], parseRuleInBlock);
    const before = getCascadedStyle(el, [legacyBefore], '::before');
    assert.equal(legacyBefore.selectorText, '.t:before');
    assert.equal(before.getPropertyValue('z-index'), '1');
    assert.equal(before.getPropertyValue('opacity'), '0.25');
    assert.equal(getCascadedStyle(el, [legacyBefore]).getPropertyValue('z-index'), '');
    assert.equal(getCascadedStyle(el, [legacyBefore], '::after').getPropertyValue('z-index'), '');
    assert.equal(getCascadedStyle(el, [legacyBefore], '::after').getPropertyValue('content'), '');

    const bareBefore = new CSSStyleRule('::before', hostDecls, [nestedOpacity], parseRuleInBlock);
    const htmlBefore = getCascadedStyle(document.documentElement, [bareBefore], '::before');
    assert.equal(htmlBefore.getPropertyValue('z-index'), '1');
    assert.equal(htmlBefore.getPropertyValue('opacity'), '0.25');
    assert.equal(getCascadedStyle(el, [bareBefore], '::before').getPropertyValue('z-index'), '');
  });

  test('@container style() grouping walks without evaluating the style query', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      @container style(--theme: dark) {
        .t { z-index: 2; }
      }
      @container card style(--theme: light) {
        .t { opacity: 0.4; }
      }
      @container style((color: red) and (background-color: blue)) {
        .t { order: 5; }
      }
      @container style(--unused: 1) { }
    `);
    const rules = [...sheet.cssRules];
    assert.equal(rules.length, 4);
    assert.ok(rules.every((r) => r instanceof CSSContainerRule));
    assert.match((rules[0] as CSSContainerRule).conditionText, /style\(--theme:\s*dark\)/);
    assert.equal((rules[1] as CSSContainerRule).containerName, 'card');
    assert.match((rules[1] as CSSContainerRule).conditionText, /style\(--theme:\s*light\)/);
    assert.match((rules[2] as CSSContainerRule).conditionText, /style\(\(color:\s*red\)/);
    assert.equal((rules[3] as CSSContainerRule).cssRules.length, 0);

    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '2');
    assert.equal(style.getPropertyValue('opacity'), '0.4');
    assert.equal(style.getPropertyValue('order'), '5');
  });

  test(':host selectors are walked and do not match a light-tree element', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      :host { z-index: 1; caret-color: rgb(255, 0, 0); }
      :host(.t) { z-index: 2; isolation: isolate; }
      :host-context(body) { order: 8; }
      .t { z-index: 9; }
    `);
    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '9');
    assert.equal(style.getPropertyValue('caret-color'), '');
    assert.equal(style.getPropertyValue('isolation'), 'auto');
    assert.equal(style.getPropertyValue('order'), '');
  });

  test('empty sheets and empty rule lists yield no author declarations', () => {
    const { el } = makeDiv();
    const emptyParse = parse('');
    assert.equal(emptyParse.cssRules.length, 0);
    assert.equal(getCascadedStyle(el, emptyParse.cssRules).getPropertyValue('z-index'), '');

    const comments = parse('/* only a comment */ @charset "utf-8";');
    assert.equal(comments.cssRules.length, 0);
    assert.equal(getCascadedStyle(el, comments.cssRules).getPropertyValue('order'), '');

    const constructed = new CSSStyleSheet();
    assert.equal(constructed.cssRules.length, 0);
    assert.equal(getCascadedStyle(el, constructed.cssRules).getPropertyValue('z-index'), '');

    assert.equal(getCascadedStyle(el, []).getPropertyValue('z-index'), '');
  });

  test('duplicate @layer names share one order; later same-layer wins; unlayered still beats both', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      @layer a, a, b;
      @layer a { .t { z-index: 1; opacity: 0.1; } }
      @layer a { .t { z-index: 2; } }
      @layer b { .t { z-index: 3; } }
      .t { z-index: 9; }
    `);
    const rules = [...sheet.cssRules];
    assert.ok(rules[0] instanceof CSSLayerStatementRule);
    assert.deepEqual([...(rules[0] as CSSLayerStatementRule).nameList], ['a', 'a', 'b']);
    assert.ok(rules[1] instanceof CSSLayerBlockRule);
    assert.ok(rules[2] instanceof CSSLayerBlockRule);
    assert.equal((rules[1] as CSSLayerBlockRule).name, 'a');
    assert.equal((rules[2] as CSSLayerBlockRule).name, 'a');

    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '9');
    assert.equal(style.getPropertyValue('opacity'), '0.1');

    const sameLayer = parse(`
      @layer a { .t { z-index: 1; } }
      @layer a { .t { z-index: 2; } }
    `);
    assert.equal(getCascadedStyle(el, sameLayer.cssRules).getPropertyValue('z-index'), '2');

    const importantSame = parse(`
      @layer a { .t { z-index: 1 !important; } }
      @layer a { .t { z-index: 2 !important; } }
    `);
    assert.equal(getCascadedStyle(el, importantSame.cssRules).getPropertyValue('z-index'), '2');
  });

  test('@import, @namespace, @font-face, and @keyframes are skipped by walkRules', () => {
    const { el } = makeDiv();
    const sheet = parse(`
      @import url("https://example.com/a.css");
      @import url("b.css") layer(foo) supports(display: grid);
      @namespace svg url("http://www.w3.org/2000/svg");
      @font-face { font-family: skip; src: url(skip.woff); }
      @keyframes spin {
        from { z-index: 99; opacity: 0; }
        to { z-index: 98; }
      }
      .t { z-index: 1; }
    `);
    const rules = [...sheet.cssRules];
    assert.ok(rules[0] instanceof CSSImportRule);
    assert.ok(rules[1] instanceof CSSImportRule);
    assert.equal((rules[0] as CSSImportRule).href, 'https://example.com/a.css');
    assert.equal((rules[1] as CSSImportRule).styleSheet, null);
    assert.ok(rules[2] instanceof CSSNamespaceRule);
    assert.ok(rules[3] instanceof CSSFontFaceRule);
    assert.ok(rules[4] instanceof CSSKeyframesRule);
    assert.ok(rules[5] instanceof CSSStyleRule);

    const style = getCascadedStyle(el, sheet.cssRules);
    assert.equal(style.getPropertyValue('z-index'), '1');
    assert.notEqual(style.getPropertyValue('z-index'), '99');
    assert.notEqual(style.getPropertyValue('font-family'), 'skip');
    assert.equal(style.getPropertyValue('opacity'), '1');
  });
});
