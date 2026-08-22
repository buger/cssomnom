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
// Round-2 leftover unique-cause for src/math-parser.ts parseMathFunction
// after tests/mcdc-math-parser-leftover-unique-cause.test.ts,
// tests/mcdc-math-parser-still-hot-unique-cause.test.ts, and
// tests/mcdc-math-product-parsefn-unique-cause.test.ts.
// Last recapture: 32/38 decisions, 43/49 conditions, 6 incomplete.
// Hottest seam: L409 token.type === "comma" (min/max; T only), plus
// L419 leftover F only, L451 type !== comma skipped, L492/L522 comma T only,
// L532 leftover F only.
// keep=N comma type getters in the product-parsefn file did not unique-cause
// under instrumentation (extra type reads exhaust keep before L409, so
// consumeArg eats the leftover and L404 firstArg-null still SyntaxError).
// consumeArg always stops on comma or EOF (nesting is never incremented;
// nested commas live inside function/block .value). Tokenizer leftover after
// a successful arg is therefore only comma. Real CSS unique-causes the
// analog leftover on ident-shortcut paths (clamp(none 10px, 20px) L445,
// round(up 15px) L479) because those skip consumeArg.
// Delayed leftover: ParseHooks wraps the function .value so tokens.length
// grows only after consumeArg returns (stack includes consumeArg). Extra
// tokens `+ 2px, 30px` (or `+ 1, 2`) would parse as more args if eaten —
// SyntaxError is then the unique-cause tripwire, not firstArg-null.
// Drive CSSNumericValue.parse / CSSStyleValue.parse. css-values-4 § 10.2
// #funcdef-min / #funcdef-clamp / § 10.6 #round-func / § 10.4 #exponent-funcs.
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokenize } from '../src/tokenizer.ts';
import { MATH_FUNCTIONS } from '../src/data/gen/math-functions.ts';
import {
  CSSNumericValue,
  CSSUnitValue,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSMathRound,
  CSSMathFunction,
  CSSStyleValue,
} from '../src/typed-om.ts';
import type { ComponentValue, CSSFunction } from '../src/types.ts';

function parse(css: string): CSSNumericValue {
  return CSSNumericValue.parse(css);
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
const DELAY_TARGETS = new Set<string>(['min', 'max', 'clamp', 'round', ...MATH_FUNCTIONS]);

function restoreHooks(): void {
  ParseHooks.parseComponentValues = origParseComponentValues;
}

function extraTokens(css: string): ComponentValue[] {
  return origParseComponentValues(tokenize(css)).filter(
    (v) => v.type !== 'whitespace' && v.type !== 'EOF',
  );
}

function inConsumeArg(): boolean {
  return (new Error().stack ?? '').includes('consumeArg');
}

/**
 * tokens.length is the real arg list while consumeArg is on the stack, then
 * `extra` appears at the leftover index. css-values-4 § 10.2: a successful
 * arg is comma-separated; leftover that is not a comma must fail the parse.
 */
function delayLeftover(backing: ComponentValue[], extra: ComponentValue[]): ComponentValue[] {
  return new Proxy(backing, {
    get(target, prop) {
      if (prop === 'filter') {
        return (pred: (v: ComponentValue, i: number, arr: ComponentValue[]) => unknown) =>
          delayLeftover(
            target.filter((v, i, arr) => Boolean(pred(v, i, arr))),
            extra,
          );
      }
      if (prop === 'length') {
        return inConsumeArg() ? target.length : target.length + extra.length;
      }
      if (typeof prop === 'string' && /^\d+$/.test(prop)) {
        const i = Number(prop);
        return i < target.length ? target[i] : extra[i - target.length];
      }
      return Reflect.get(target, prop);
    },
  }) as ComponentValue[];
}

function wrapDelayedFns(values: ComponentValue[], extra: ComponentValue[]): ComponentValue[] {
  return values.map((v) => {
    if (v.type !== 'function') return v;
    const fn = v as CSSFunction;
    const inner = wrapDelayedFns(fn.value as ComponentValue[], extra);
    const name = fn.name.toLowerCase();
    if (name === 'calc') return { ...fn, value: inner };
    if (DELAY_TARGETS.has(name)) return { ...fn, value: delayLeftover(inner, extra) };
    return { ...fn, value: inner };
  });
}

function withDelayedLeftover(extraCss: string, fn: () => void): void {
  const extra = extraTokens(extraCss);
  ParseHooks.parseComponentValues = (tokens) => wrapDelayedFns(origParseComponentValues(tokens), extra);
  try {
    fn();
  } finally {
    restoreHooks();
  }
}

describe('MC/DC round2 unique-cause: parseMathFunction min/max leftover comma F (css-values-4 § 10.2 #funcdef-min)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('L409 comma F then L419 leftover T: delayed leftover after first arg', () => {
    // Real CSS cannot leave a non-comma after consumeArg (eats through EOF).
    // Extra `+ 2px, 30px` would become min(3px, 30px) if eaten — throw is the
    // unique-cause tripwire. Contrast T: unwrapped comma / 1-arg EOF.
    withDelayedLeftover('+ 2px, 30px', () => {
      syntaxError('min(1px)');
      syntaxError('max(1px)');
      styleInvalidMath('width', 'min(1px)');
      styleInvalidMath('width', 'max(1px)');
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

    const eatenWouldSucceed = parse('min(1px + 2px, 30px)');
    assert.ok(eatenWouldSucceed instanceof CSSMathMin);
    assert.equal(eatenWouldSucceed.values.length, 2);
    assert.equal(eatenWouldSucceed.toString(), 'min(3px, 30px)');

    syntaxError('min(1px 2px)');
    syntaxError('min(1px; 2px)');
    syntaxError('min(1px, 2px,)');

    const width = CSSStyleValue.parse('width', 'min(1px, 2px)');
    assert.ok(width instanceof CSSMathMin);
    assert.equal((width as CSSMathMin).values.length, 2);
  });
});

describe('MC/DC round2 unique-cause: parseMathFunction clamp third comma (css-values-4 § 10.2 #funcdef-clamp)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('L451 type !== comma T: delayed leftover after value consumeArg', () => {
    // L445 type !== comma T is real CSS `clamp(none 10px, 20px)` (ident-none
    // skips consumeArg). Value is always consumeArg, so L451 needs delayed
    // leftover. Extra `+ 2px, 30px` would become clamp(10px, 22px, 30px) if
    // eaten. Contrast: missing third comma (index >= length T) vs 3-arg FF.
    withDelayedLeftover('+ 2px, 30px', () => {
      syntaxError('clamp(10px, 20px)');
      styleInvalidMath('width', 'clamp(10px, 20px)');
    });

    syntaxError('clamp(10px, 20px)');
    syntaxError('clamp(none 10px, 20px)');
    syntaxError('clamp(10px, 20px 30px)');

    const ok = parse('clamp(10px, 20px, 30px)');
    assert.ok(ok instanceof CSSMathClamp);
    assert.ok(ok.lower instanceof CSSUnitValue);
    assert.ok(ok.upper instanceof CSSUnitValue);

    const eatenWouldSucceed = parse('clamp(10px, 20px + 2px, 30px)');
    assert.ok(eatenWouldSucceed instanceof CSSMathClamp);
    assert.equal(eatenWouldSucceed.toString(), 'clamp(10px, 22px, 30px)');

    const width = CSSStyleValue.parse('width', 'clamp(10px, 20px, 30px)');
    assert.ok(width instanceof CSSMathClamp);
  });
});

describe('MC/DC round2 unique-cause: parseMathFunction round/math leftover comma (css-values-4 § 10.6 #round-func / § 10.4)', { concurrency: false }, () => {
  afterEach(() => {
    restoreHooks();
  });

  test('round L492 comma F: delayed leftover after value consumeArg', () => {
    // L479 type !== comma T is real CSS `round(up 15px)` (strategy ident skips
    // consumeArg). Precision leftover after consumeArg needs delay. Extra
    // `+ 2px, 30px` would become round(17px, 30px) if eaten.
    withDelayedLeftover('+ 2px, 30px', () => {
      syntaxError('round(15px)');
      // validateMathFunctions only gates calc/min/max/clamp; wrap in calc so
      // style-value reify still calls parseMathFunction('round', …).
      styleInvalidMath('width', 'calc(round(15px))');
    });

    syntaxError('round(up 15px)');
    syntaxError('round(15px 10px)');
    syntaxError('round(15px,)');

    const omitted = parse('round(15px)');
    assert.ok(omitted instanceof CSSMathRound);
    assert.equal(omitted.precisionOmitted, true);

    const withPrec = parse('round(15px, 10px)');
    assert.ok(withPrec instanceof CSSMathRound);
    assert.equal(withPrec.precisionOmitted, false);

    const eatenWouldSucceed = parse('round(15px + 2px, 30px)');
    assert.ok(eatenWouldSucceed instanceof CSSMathRound);
    assert.equal(eatenWouldSucceed.precisionOmitted, false);
    assert.equal(eatenWouldSucceed.toString(), 'round(17px, 30px)');

    const width = CSSStyleValue.parse('width', 'round(15px, 10px)');
    assert.ok(width instanceof CSSStyleValue);
  });

  test('hypot/log L522 comma F then L532 leftover T: delayed leftover after first arg', () => {
    withDelayedLeftover('+ 2px, 30px', () => {
      syntaxError('hypot(1px)');
      styleInvalidMath('width', 'calc(hypot(1px))');
    });
    withDelayedLeftover('+ 1, 2', () => {
      syntaxError('log(8)');
    });

    const hypot1 = parse('hypot(1px)');
    assert.ok(hypot1 instanceof CSSMathFunction);
    assert.equal(hypot1.values.length, 1);

    const hypot2 = parse('hypot(1px, 2px)');
    assert.ok(hypot2 instanceof CSSMathFunction);
    assert.equal(hypot2.values.length, 2);

    const log1 = parse('log(8)');
    assert.ok(log1 instanceof CSSMathFunction);
    assert.equal(log1.values.length, 1);

    const log2 = parse('log(8, 2)');
    assert.ok(log2 instanceof CSSMathFunction);
    assert.equal(log2.values.length, 2);

    const eatenHypot = parse('hypot(1px + 2px, 30px)');
    assert.ok(eatenHypot instanceof CSSMathFunction);
    assert.equal(eatenHypot.values.length, 2);

    const eatenLog = parse('log(8 + 1, 2)');
    assert.ok(eatenLog instanceof CSSMathFunction);
    assert.equal(eatenLog.values.length, 2);

    syntaxError('hypot(1px 2px)');
    syntaxError('log(8 2)');
    syntaxError('sin(0deg extra)');

    const widthHypot = CSSStyleValue.parse('width', 'calc(hypot(1px, 2px))');
    assert.ok(widthHypot instanceof CSSStyleValue);
  });
});
