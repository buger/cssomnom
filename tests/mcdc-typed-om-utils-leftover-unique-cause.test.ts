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
// Verifies: SW-REQ-260821-7AKJ, SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, INT-REQ-260821-JTY2
// Leftover unique-cause for src/typed-om/utils/{formatting,type-guards,validation}.ts.
// src/index.ts and src/typed-om.ts are barrel re-exports (0 decisions).
// src/typed-om/index.ts try/catch is the transform-list hook (not a JS MC/DC
// instrumented function). src/browser-entry.ts is tsconfig-excluded and not
// in the cssomnom-src 57-file MC/DC set. Drive CSSMath*.toString / CSSRGB /
// CSSPositionValue / CSSTranslate / StylePropertyMap / DOMMatrix plus direct
// helpers for pairs public Typed OM cannot emit.
// css-typed-om-1 § 4.1 #numeric-typing / § 4.2 #unitvalue-objects /
// § 4.4 #mathvalue-objects / § 5.2 #csstranslate / § 6 #positionvalue-objects /
// § 8.1 #rectify-a-csscolorpercent, css-typed-om-2 § 2 #colorvalue-objects,
// geometry-1 #dom-dommatrix-dommatrix, css-syntax-3 § 5.4.8 #consume-a-function.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSNumericValue,
  CSSUnitValue,
  CSSKeywordValue,
  CSSMathValue,
  CSSMathSum,
  CSSMathNegate,
  CSSMathInvert,
  CSSMathMin,
  CSSRGB,
  CSSColor,
  CSSTranslate,
  CSSScale,
  CSSRotate,
  CSSPositionValue,
  StylePropertyMap,
  CSSStyleValue,
  DOMMatrix,
} from '../src/typed-om.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import {
  createUnitValue,
  createKeywordValue,
  ensureNumeric,
  stripOuterParens,
  isAlphaUnity,
  formatAlpha,
} from '../src/typed-om/utils/formatting.ts';
import {
  isNumericValue,
  isKeywordValue,
  matchesLength,
  matchesPercentage,
  matchesLengthPercentage,
  matchesNumber,
  matchesAngle,
  matchesTime,
  matchesFrequency,
  matchesResolution,
  matchesFlex,
  isLengthPercentage,
} from '../src/typed-om/utils/type-guards.ts';
import {
  validateProperty,
  compareStrings,
  checkBrand,
  isToken,
  isCSSFunction,
  hasVarFunction,
} from '../src/typed-om/utils/validation.ts';
import type { CSSNumericType } from '../src/typed-om/numeric/CSSNumericType.ts';
import type { ComponentValue, CSSFunction, SimpleBlock, Token } from '../src/types.ts';

const g = globalThis as unknown as Record<string, unknown>;

function withGlobal(name: string, value: unknown, fn: () => void): void {
  const had = Object.prototype.hasOwnProperty.call(g, name);
  const prev = g[name];
  try {
    if (value === undefined) delete g[name];
    else g[name] = value;
    fn();
  } finally {
    if (had) g[name] = prev;
    else delete g[name];
  }
}

class OpenParenNumeric extends CSSNumericValue {
  serialize(): string {
    return '(unclosed';
  }
  type(): CSSNumericType {
    return { length: 1 };
  }
}

class HintedNumeric extends CSSNumericValue {
  private readonly t: CSSNumericType;
  constructor(t: CSSNumericType) {
    super();
    this.t = t;
  }
  serialize(): string {
    return '0px';
  }
  type(): CSSNumericType {
    return this.t;
  }
}

class CustomMath extends CSSMathValue {
  private readonly s: string;
  private readonly op: string;
  constructor(s: string, op: string) {
    super();
    this.s = s;
    this.op = op;
  }
  serialize(): string {
    return this.s;
  }
  override type(): CSSNumericType {
    return {};
  }
  get operator(): string {
    return this.op;
  }
}

function nt(partial: Record<string, unknown>): CSSNumericType {
  return partial as CSSNumericType;
}

function ident(value: string): Token {
  return { type: 'ident', value };
}

function numberTok(value: number): Token {
  return { type: 'number', value, numberType: 'number', sign: null };
}

function fn(name: string, value: ComponentValue[]): CSSFunction {
  return { type: 'function', name, value };
}

function block(value: ComponentValue[]): SimpleBlock {
  return { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value };
}

let seq = 0;
function register(syntax: string, initialValue: string): string {
  seq += 1;
  const name = `--mcdc-tomu-${seq}`;
  CSS.registerProperty({ name, syntax, inherits: false, initialValue });
  return name;
}

describe('MC/DC leftover unique-cause: stripOuterParens (css-typed-om-1 § 4.4 #mathvalue-objects)', { concurrency: false }, () => {
  test('startsWith/endsWith OR unique-cause; depth-zero mid-string AND', () => {
    // Unique-cause: startsWith '(' F, endsWith ')' skipped — already '1px'.
    // Pair with startsWith F / endsWith T: ')'.
    assert.equal(stripOuterParens('1px'), '1px');
    assert.equal(stripOuterParens('1px)'), '1px)');
    assert.equal(stripOuterParens(')'), ')');
    assert.equal(new CSSMathNegate(CSS.px(3)).toString(), 'calc(-3px)');

    // Unique-cause: startsWith T, endsWith F (the leftover MC/DC condition).
    assert.equal(stripOuterParens('(1px'), '(1px');
    assert.equal(stripOuterParens('('), '(');
    const open = new CSSMathNegate(new OpenParenNumeric());
    assert.equal(open.toString(), 'calc(-(unclosed)');
    assert.equal(new CSSMathInvert(new OpenParenNumeric()).toString(), 'calc(1 / (unclosed)');

    // Unique-cause: startsWith T, endsWith T, overall F of the early return — strip.
    const mixed = new CSSMathSum(CSS.px(1), CSS.em(2));
    assert.equal(mixed.serialize().startsWith('('), true);
    assert.equal(mixed.serialize().endsWith(')'), true);
    assert.equal(mixed.toString().startsWith('calc('), true);
    assert.equal(mixed.toString().includes('1px'), true);
    assert.equal(stripOuterParens('(1px + 2em)'), '1px + 2em');
    assert.equal(stripOuterParens('()'), '');
    assert.equal(stripOuterParens('((1px))'), '(1px)');
    assert.equal(new CustomMath('()', 'sum').toString().startsWith('calc('), true);

    // Unique-cause: depth === 0 T && i < length-1 T — matching inner close, keep outer.
    assert.equal(stripOuterParens('(1px) + (2em)'), '(1px) + (2em)');
    assert.equal(stripOuterParens('())'), '())');
    assert.equal(new CustomMath('(1px) + (2em)', 'sum').toString().includes('1px'), true);

    // Unique-cause: s[i] === '(' F then === ')' F (inner ident/space); nested depth !== 0.
    assert.equal(stripOuterParens('(min(1px, 2px))'), 'min(1px, 2px)');
    const min = new CSSMathMin(CSS.px(1), CSS.px(2));
    assert.equal(min.toString().startsWith('min('), true);
  });
});

describe('MC/DC leftover unique-cause: createUnitValue / createKeywordValue / ensureNumeric', { concurrency: false }, () => {
  test('globalThis constructor AND vs local fallback; typeof number vs CSSNumericValue', () => {
    // typeof globalThis !== 'undefined' F is unpairable in Node (always bound).
    class TaggedUnit extends CSSUnitValue {}
    class TaggedKeyword extends CSSKeywordValue {}

    withGlobal('CSSUnitValue', TaggedUnit, () => {
      const v = createUnitValue(4, 'px');
      assert.ok(v instanceof TaggedUnit);
      assert.equal(v.value, 4);
      assert.equal(v.unit, 'px');
    });
    withGlobal('CSSUnitValue', undefined, () => {
      const v = createUnitValue(5, 'em');
      assert.ok(v instanceof CSSUnitValue);
      assert.equal(v instanceof TaggedUnit, false);
      assert.equal(v.unit, 'em');
    });
    withGlobal('CSSUnitValue', 0, () => {
      const v = createUnitValue(1, 'px');
      assert.equal(v.constructor, CSSUnitValue);
    });

    withGlobal('CSSKeywordValue', TaggedKeyword, () => {
      const k = createKeywordValue('auto');
      assert.ok(k instanceof TaggedKeyword);
      assert.equal(k.value, 'auto');
    });
    withGlobal('CSSKeywordValue', undefined, () => {
      const k = createKeywordValue('none');
      assert.ok(k instanceof CSSKeywordValue);
      assert.equal(k instanceof TaggedKeyword, false);
    });

    // Public: colorSpace string uses createKeywordValue; number add uses ensureNumeric.
    const color = new CSSColor('srgb', [0.1, 0.2, 0.3]);
    color.colorSpace = 'display-p3';
    assert.ok(color.colorSpace instanceof CSSKeywordValue);
    assert.equal(color.colorSpace.value, 'display-p3');

    const fromCtor = new CSSMathNegate(2);
    assert.ok(fromCtor.value instanceof CSSUnitValue);
    assert.equal(fromCtor.value.unit, 'number');
    assert.equal(fromCtor.value.value, 2);
    const same = CSS.px(1).add(CSS.px(4));
    assert.ok(same instanceof CSSUnitValue);
    assert.equal(same.value, 5);
    const summed = CSS.number(1).add(2);
    assert.ok(summed instanceof CSSUnitValue);
    assert.equal(summed.value, 3);

    const fromNum = ensureNumeric(7);
    assert.ok(fromNum instanceof CSSUnitValue);
    assert.equal(fromNum.unit, 'number');
    assert.equal(fromNum.value, 7);
    const em = CSS.em(2);
    const kept = ensureNumeric(em);
    assert.ok(kept === em);
    assert.ok(kept instanceof CSSUnitValue);
    assert.equal(kept.unit, 'em');
  });
});

describe('MC/DC leftover unique-cause: isAlphaUnity / formatAlpha (css-typed-om-1 § 8.1 #rectify-a-csscolorpercent)', { concurrency: false }, () => {
  test('instanceof F; percent/number AND unique-cause of unit and value', () => {
    const rgb = new CSSRGB(0, 0, 0, CSS.percent(100));
    assert.equal(rgb.toString().startsWith('rgb('), true);
    assert.equal(rgb.toString().startsWith('rgba('), false);

    // CSSColorPercent does not accept unitless CSS.number; ctor number 1 → 100%.
    const unityFromNumber = new CSSRGB(0, 0, 0, 1);
    assert.equal(unityFromNumber.toString().startsWith('rgb('), true);

    rgb.alpha = CSS.percent(50);
    assert.equal(rgb.toString().startsWith('rgba('), true);
    assert.equal(rgb.toString().includes('0.5'), true);

    const half = new CSSRGB(0, 0, 0, 0.5);
    assert.equal(half.toString().startsWith('rgba('), true);

    rgb.alpha = 'none';
    assert.equal(rgb.toString().startsWith('rgba('), true);
    assert.equal(rgb.toString().includes('none'), true);

    // Unique-cause of (unit === 'percent' && value === 100) || (unit === 'number' && value === 1).
    assert.equal(isAlphaUnity(CSS.percent(100)), true);
    assert.equal(isAlphaUnity(CSS.percent(1)), false);
    assert.equal(isAlphaUnity(CSS.number(1)), true);
    assert.equal(isAlphaUnity(CSS.number(100)), false);
    assert.equal(isAlphaUnity(CSS.px(1)), false);
    assert.equal(isAlphaUnity(CSS.px(100)), false);
    assert.equal(isAlphaUnity(new CSSKeywordValue('none')), false);

    assert.equal(formatAlpha(CSS.percent(50)), '0.5');
    assert.equal(formatAlpha(CSS.number(0.25)), '0.25');
    assert.equal(formatAlpha(new CSSKeywordValue('none')), 'none');
    assert.equal(formatAlpha(CSS.px(1)), '1px');
  });
});

describe('MC/DC leftover unique-cause: isNumericValue / isKeywordValue (css-typed-om-1 § 4.1 #numericvalue-objects / § 3.1 #keywordvalue-objects)', { concurrency: false }, () => {
  test('!val / typeof object unique-cause; global Cls && instanceof; duck-type AND', () => {
    assert.equal(isNumericValue(null), false);
    assert.equal(isNumericValue(undefined), false);
    assert.equal(isNumericValue(0), false);
    assert.equal(isNumericValue('1px'), false);
    assert.equal(isNumericValue(true), false);
    assert.equal(isNumericValue(() => 0), false);
    assert.equal(isNumericValue(CSS.px(1)), true);
    assert.throws(() => new CSSPositionValue(1 as unknown as CSSNumericValue, CSS.px(1)), TypeError);

    const duckOk = { type() { return { length: 1 }; }, toSum() { return null; } };
    const duckNoToSum = { type() { return { length: 1 }; } };
    const duckNoType = { toSum() { return null; } };
    assert.equal(isNumericValue(duckOk), true);
    assert.equal(isNumericValue(duckNoToSum), false);
    assert.equal(isNumericValue(duckNoType), false);
    const viaDuck = new CSSPositionValue(duckOk as unknown as CSSNumericValue, CSS.px(1));
    assert.equal(viaDuck.x, duckOk as unknown as CSSNumericValue);
    assert.equal(viaDuck.x.type().length, 1);

    withGlobal('CSSNumericValue', CSSNumericValue, () => {
      assert.equal(isNumericValue(CSS.px(2)), true);
      assert.equal(isNumericValue(duckOk), true);
      assert.equal(isNumericValue({ type: 1, toSum() { return null; } }), false);
    });
    class OtherNumeric {}
    withGlobal('CSSNumericValue', OtherNumeric, () => {
      // Unique-cause: Cls T && instanceof T vs instanceof F (then duck).
      assert.equal(isNumericValue(new OtherNumeric()), true);
      assert.equal(isNumericValue(CSS.px(3)), true);
      assert.equal(isNumericValue({ type: 1, toSum() { return null; } }), false);
    });

    assert.equal(isKeywordValue(null), false);
    assert.equal(isKeywordValue(undefined), false);
    assert.equal(isKeywordValue('auto'), false);
    assert.equal(isKeywordValue(1), false);
    assert.equal(isKeywordValue(new CSSKeywordValue('auto')), true);
    assert.equal(isKeywordValue(CSS.px(1)), false);

    const kwDuck = { value: 'auto', constructor: { name: 'CSSKeywordValue' } };
    const kwWrongName = { value: 'auto', constructor: { name: 'Nope' } };
    const kwNonString = { value: 1, constructor: { name: 'CSSKeywordValue' } };
    const kwNoCtor = Object.assign(Object.create(null), { value: 'auto' });
    assert.equal(isKeywordValue(kwDuck), true);
    assert.equal(isKeywordValue(kwWrongName), false);
    assert.equal(isKeywordValue(kwNonString), false);
    assert.equal(isKeywordValue(kwNoCtor), false);

    withGlobal('CSSKeywordValue', CSSKeywordValue, () => {
      assert.equal(isKeywordValue(new CSSKeywordValue('none')), true);
      assert.equal(isKeywordValue(kwDuck), true);
      assert.equal(isKeywordValue(CSS.px(1)), false);
    });
    class OtherKeyword {}
    withGlobal('CSSKeywordValue', OtherKeyword, () => {
      assert.equal(isKeywordValue(new OtherKeyword()), true);
      assert.equal(isKeywordValue(new CSSKeywordValue('inherit')), true);
      assert.equal(isKeywordValue({ value: 1, constructor: { name: 'Nope' } }), false);
    });
  });
});

describe('MC/DC leftover unique-cause: matches* numeric typing (css-typed-om-1 § 4.1 #numeric-typing)', { concurrency: false }, () => {
  test('matchesLength each conjunct + percentHint OR; CSSTranslate.z public path', () => {
    const t2 = new CSSTranslate(CSS.px(1), CSS.percent(50));
    t2.z = CSS.px(3);
    const z = t2.z;
    assert.ok(z instanceof CSSUnitValue);
    assert.equal(z.unit, 'px');
    assert.throws(() => { t2.z = CSS.percent(1); }, TypeError);
    assert.throws(() => { t2.z = CSS.deg(1); }, TypeError);
    t2.x = CSS.percent(10);
    t2.y = CSS.px(2);
    assert.throws(() => { t2.x = CSS.deg(1); }, TypeError);

    assert.equal(matchesLength({ length: 1 }), true);
    assert.equal(matchesLength({ length: 0 }), false);
    assert.equal(matchesLength({}), false);
    assert.equal(matchesLength({ length: 2 }), false);
    assert.equal(matchesLength({ length: 1, angle: 0 }), true);
    assert.equal(matchesLength({ length: 1, angle: 1 }), false);
    assert.equal(matchesLength({ length: 1, time: 1 }), false);
    assert.equal(matchesLength({ length: 1, frequency: 1 }), false);
    assert.equal(matchesLength({ length: 1, resolution: 1 }), false);
    assert.equal(matchesLength({ length: 1, flex: 1 }), false);
    assert.equal(matchesLength({ length: 1, percent: 1 }), false);
    assert.equal(matchesLength(nt({ length: 1, percentHint: null })), true);
    assert.equal(matchesLength({ length: 1, percentHint: undefined }), true);
    assert.equal(matchesLength({ length: 1, percentHint: 'length' }), true);
    assert.equal(matchesLength({ length: 1, percentHint: 'angle' }), false);
    assert.equal(matchesLength(CSS.px(1).type()), true);
    assert.equal(matchesLength(CSS.percent(1).type()), false);
  });

  test('matchesPercentage/Number/Angle/Time/Frequency/Resolution/Flex leftover unique-cause', () => {
    assert.equal(matchesPercentage({ percent: 1 }), true);
    assert.equal(matchesPercentage({ percent: 0 }), false);
    assert.equal(matchesPercentage({ percent: 1, length: 1 }), false);
    assert.equal(matchesPercentage({ percent: 1, angle: 1 }), false);
    assert.equal(matchesPercentage({ percent: 1, time: 1 }), false);
    assert.equal(matchesPercentage({ percent: 1, frequency: 1 }), false);
    assert.equal(matchesPercentage({ percent: 1, resolution: 1 }), false);
    assert.equal(matchesPercentage({ percent: 1, flex: 1 }), false);
    assert.equal(matchesPercentage(nt({ percent: 1, percentHint: null })), true);
    assert.equal(matchesPercentage({ percent: 1, percentHint: 'length' }), false);

    assert.equal(matchesNumber({}), true);
    assert.equal(matchesNumber({ length: 0, angle: 0, time: 0, frequency: 0, resolution: 0, flex: 0, percent: 0 }), true);
    assert.equal(matchesNumber({ length: 1 }), false);
    assert.equal(matchesNumber({ angle: 1 }), false);
    assert.equal(matchesNumber({ time: 1 }), false);
    assert.equal(matchesNumber({ frequency: 1 }), false);
    assert.equal(matchesNumber({ resolution: 1 }), false);
    assert.equal(matchesNumber({ flex: 1 }), false);
    assert.equal(matchesNumber({ percent: 1 }), false);
    assert.equal(matchesNumber({ percentHint: 'length' }), false);
    assert.equal(matchesNumber(nt({ percentHint: null })), true);

    assert.equal(matchesAngle({ angle: 1 }), true);
    assert.equal(matchesAngle({ angle: 0 }), false);
    assert.equal(matchesAngle({ angle: 1, length: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, time: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, frequency: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, resolution: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, flex: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, percent: 1 }), false);
    assert.equal(matchesAngle({ angle: 1, percentHint: 'angle' }), true);
    assert.equal(matchesAngle({ angle: 1, percentHint: 'length' }), false);

    assert.equal(matchesTime({ time: 1 }), true);
    assert.equal(matchesTime({ time: 1, length: 1 }), false);
    assert.equal(matchesTime({ time: 1, angle: 1 }), false);
    assert.equal(matchesTime({ time: 1, frequency: 1 }), false);
    assert.equal(matchesTime({ time: 1, resolution: 1 }), false);
    assert.equal(matchesTime({ time: 1, flex: 1 }), false);
    assert.equal(matchesTime({ time: 1, percent: 1 }), false);
    assert.equal(matchesTime({ time: 1, percentHint: 'time' }), true);
    assert.equal(matchesTime({ time: 1, percentHint: 'length' }), false);

    assert.equal(matchesFrequency({ frequency: 1 }), true);
    assert.equal(matchesFrequency({ frequency: 1, length: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, angle: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, time: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, resolution: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, flex: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, percent: 1 }), false);
    assert.equal(matchesFrequency({ frequency: 1, percentHint: 'frequency' }), true);
    assert.equal(matchesFrequency({ frequency: 1, percentHint: 'length' }), false);

    assert.equal(matchesResolution({ resolution: 1 }), true);
    assert.equal(matchesResolution({ resolution: 1, length: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, angle: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, time: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, frequency: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, flex: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, percent: 1 }), false);
    assert.equal(matchesResolution({ resolution: 1, percentHint: 'resolution' }), true);
    assert.equal(matchesResolution({ resolution: 1, percentHint: 'length' }), false);

    assert.equal(matchesFlex({ flex: 1 }), true);
    assert.equal(matchesFlex({ flex: 1, length: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, angle: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, time: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, frequency: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, resolution: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, percent: 1 }), false);
    assert.equal(matchesFlex({ flex: 1, percentHint: 'flex' }), true);
    assert.equal(matchesFlex({ flex: 1, percentHint: 'length' }), false);

    const scale = new CSSScale(2, 3);
    const sx = scale.x;
    assert.ok(sx instanceof CSSUnitValue);
    assert.equal(sx.value, 2);
    assert.throws(() => { scale.x = CSS.px(1); }, TypeError);
    const rot = new CSSRotate(CSS.deg(90));
    rot.angle = CSS.rad(1);
    assert.throws(() => { rot.angle = CSS.px(1); }, TypeError);

    const style = new CSSStyleDeclaration();
    const map = new StylePropertyMap(style);
    const timeName = register('<time>', '0s');
    map.set(timeName, CSS.s(1));
    const timeVal = map.get(timeName);
    assert.ok(timeVal instanceof CSSUnitValue);
    assert.equal(timeVal.unit, 's');
    assert.throws(() => map.set(timeName, CSS.px(1)), TypeError);
    map.set('animation-delay', CSS.s(1));
    assert.throws(() => map.set('animation-delay', CSS.Hz(1)), TypeError);
    const resName = register('<resolution>', '1dppx');
    map.set(resName, CSS.dpi(96));
    assert.throws(() => map.set(resName, CSS.px(1)), TypeError);
    map.set('image-resolution', CSS.dppx(2));
    const flexName = register('<flex> | none', 'none');
    map.set(flexName, CSS.fr(1));
    assert.throws(() => map.set(flexName, CSS.number(1)), TypeError);
    map.set('grid-template-columns', CSS.fr(1));
  });

  test('matchesLengthPercentage OR unique-cause of length vs percent', () => {
    assert.equal(matchesLengthPercentage({ length: 1 }), true);
    assert.equal(matchesLengthPercentage({ percent: 1 }), true);
    assert.equal(matchesLengthPercentage({ angle: 1 }), false);
    assert.equal(matchesLengthPercentage({}), false);
    assert.equal(matchesLengthPercentage({ length: 1, percent: 1 }), false);
  });
});

describe('MC/DC leftover unique-cause: isLengthPercentage (css-typed-om-1 § 6 #positionvalue-objects)', { concurrency: false }, () => {
  test('disallowed-key AND unique-cause; percentHint AND; length+percent === 1', () => {
    const pos = new CSSPositionValue(CSS.px(1), CSS.percent(50));
    pos.x = CSS.percent(10);
    pos.y = CSS.px(2);
    assert.throws(() => { pos.x = CSS.deg(1); }, TypeError);
    assert.throws(() => { pos.y = CSS.number(1); }, TypeError);
    assert.throws(() => new CSSPositionValue(CSS.deg(1), CSS.px(1)), TypeError);

    const hintedLen = new HintedNumeric({ length: 1, percentHint: 'length' });
    const okHint = new CSSPositionValue(hintedLen, CSS.px(1));
    assert.equal(okHint.x, hintedLen);
    assert.throws(() => new CSSPositionValue(new HintedNumeric({ length: 1, percentHint: 'angle' }), CSS.px(1)), TypeError);

    // Unique-cause: !includes && !== 0 && !== undefined.
    assert.equal(isLengthPercentage({ length: 1 }), true);
    assert.equal(isLengthPercentage({ percent: 1 }), true);
    assert.equal(isLengthPercentage({ length: 1, angle: 1 }), false);
    assert.equal(isLengthPercentage({ length: 1, angle: 0 }), true);
    assert.equal(isLengthPercentage(nt({ length: 1, angle: undefined })), true);
    assert.equal(isLengthPercentage({ length: 1, time: 1 }), false);
    assert.equal(isLengthPercentage({ length: 1, time: 0, flex: 0 }), true);

    assert.equal(isLengthPercentage({ length: 1, percentHint: undefined }), true);
    assert.equal(isLengthPercentage({ length: 1, percentHint: 'length' }), true);
    assert.equal(isLengthPercentage({ length: 1, percentHint: 'angle' }), false);
    assert.equal(isLengthPercentage({ percent: 1, percentHint: 'length' }), true);
    assert.equal(isLengthPercentage(nt({ length: 1, percentHint: null })), false);

    assert.equal(isLengthPercentage({ length: 1, percent: 0 }), true);
    assert.equal(isLengthPercentage({ length: 0, percent: 1 }), true);
    assert.equal(isLengthPercentage({ length: 1, percent: 1 }), false);
    assert.equal(isLengthPercentage({}), false);
    assert.equal(isLengthPercentage({ length: 2 }), false);
  });
});

describe('MC/DC leftover unique-cause: isToken / isCSSFunction / hasVarFunction (css-syntax-3 § 5.4.8 #consume-a-function)', { concurrency: false }, () => {
  test('typeof value string vs number vs neither; function AND unique-cause; var recursion', () => {
    assert.equal(isToken(ident('auto')), true);
    assert.equal(isToken(numberTok(1)), true);
    assert.equal(isToken(fn('var', [ident('--x')])), false);
    assert.equal(isToken(block([])), false);
    assert.equal(isToken({ type: 'ident' } as Token), false);

    const parsed = CSSStyleValue.parse('color', 'red');
    assert.ok(parsed instanceof CSSKeywordValue);
    const unparsed = CSSStyleValue.parse('color', 'var(--x)');
    assert.equal(unparsed.toString().includes('var(--x)'), true);

    assert.equal(isCSSFunction(fn('var', [])), true);
    assert.equal(isCSSFunction(ident('var')), false);
    assert.equal(isCSSFunction(1 as unknown as ComponentValue), false);
    assert.equal(isCSSFunction(null as unknown as ComponentValue), false);
    assert.equal(isCSSFunction({} as ComponentValue), false);
    assert.equal(isCSSFunction({ type: 'simple-block', name: 'var', value: [] } as unknown as ComponentValue), false);
    assert.equal(isCSSFunction({ type: 'function', value: [] } as unknown as ComponentValue), false);
    assert.equal(isCSSFunction({ type: 'function', name: 'var', value: 'x' } as unknown as ComponentValue), false);

    assert.equal(hasVarFunction([]), false);
    assert.equal(hasVarFunction([ident('red')]), false);
    assert.equal(hasVarFunction([fn('var', [ident('--x')])]), true);
    assert.equal(hasVarFunction([fn('VAR', [ident('--x')])]), true);
    assert.equal(hasVarFunction([fn('calc', [numberTok(1)])]), false);
    assert.equal(hasVarFunction([fn('calc', [fn('var', [ident('--y')])])]), true);
    assert.equal(hasVarFunction([block([ident('x')])]), false);
    assert.equal(hasVarFunction([block([fn('var', [ident('--z')])])]), true);
    assert.equal(hasVarFunction([fn('calc', [block([fn('var', [ident('--w')])])])]), true);
  });
});

describe('MC/DC leftover unique-cause: validateProperty / compareStrings / checkBrand', { concurrency: false }, () => {
  test('custom vs standard vs unknown; a===b / a<b unique-cause; Illegal invocation', () => {
    validateProperty('--x');
    validateProperty('color');
    validateProperty('COLOR');
    assert.throws(() => validateProperty('not-a-prop'), TypeError);
    assert.throws(() => validateProperty('totally-unknown-property'), TypeError);

    const style = new CSSStyleDeclaration();
    const map = new StylePropertyMap(style);
    map.set('--b', '1');
    map.set('--a', '2');
    map.set('width', '1px');
    map.set('color', 'red');
    map.set('-webkit-appearance', 'none');
    const keys = [...map.keys()];
    assert.deepEqual(keys.slice(0, 2), ['color', 'width']);
    assert.ok(keys.includes('--a'));
    assert.ok(keys.indexOf('--a') < keys.indexOf('--b'));

    assert.equal(compareStrings('a', 'a'), 0);
    assert.equal(compareStrings('a', 'b'), -1);
    assert.equal(compareStrings('b', 'a'), 1);
    assert.equal(compareStrings('', ''), 0);
    assert.equal(compareStrings('', 'a'), -1);

    const rgb = new CSSRGB(0, 0, 0);
    assert.equal(rgb.r.toString().includes('%') || rgb.r.toString() === '0', true);
    const desc = Object.getOwnPropertyDescriptor(CSSRGB.prototype, 'r');
    assert.ok(desc);
    assert.equal(typeof desc.get, 'function');
    const getter = desc.get;
    assert.ok(getter);
    assert.throws(() => getter.call({}), TypeError);
    assert.throws(() => getter.call(null), TypeError);
    checkBrand(rgb, CSSRGB);
    assert.throws(() => checkBrand({}, CSSRGB), TypeError);
    assert.throws(() => checkBrand(rgb, CSSKeywordValue), TypeError);
  });
});

describe('MC/DC leftover unique-cause: typed-om/index transform-list hook (geometry-1 #dom-dommatrix-dommatrix)', { concurrency: false }, () => {
  test('hook try success vs catch SyntaxError unique-cause', () => {
    const ok = new DOMMatrix('translate(1px, 2px)');
    assert.equal(ok.is2D, true);
    assert.ok(Number.isFinite(ok.e));
    assert.ok(Number.isFinite(ok.f));

    const rotate = new DOMMatrix('rotate(90deg)');
    assert.equal(rotate.is2D, true);

    assert.throws(
      () => new DOMMatrix('not-a-transform'),
      (err: unknown) =>
        err instanceof DOMException &&
        err.name === 'SyntaxError' &&
        String(err.message).includes('Failed to parse transform list'),
    );
    assert.throws(
      () => new DOMMatrix('translate('),
      (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    );
  });
});
