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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ
// Leftover unique-cause for src/typed-om/color/*.ts (color-rectify, color-reify,
// CSSColorValue, color-spaces constructors/setters/toString/COLOR_REIFIERS)
// not already in tests/mcdc-hotspot-parse-color-args.test.ts.
// Drive CSSColorValue.parse / CSSStyleValue.parse('color', ...) / constructors /
// getters / setters / toString. css-typed-om-2 § 2 #colorvalue-objects,
// css-typed-om-1 § 8.1 #rectify-a-csscolorrgbcomp / #rectify-a-csscolorpercent /
// #rectify-a-csscolornumber / #rectify-a-csscolorangle, css-color-4 #hex-notation
// / #named-colors / #css-system-colors. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSStyleValue,
  CSSColorValue,
  CSSRGB,
  CSSHSL,
  CSSHWB,
  CSSLab,
  CSSLCH,
  CSSOKLab,
  CSSOKLCH,
  CSSColor,
  CSSUnitValue,
  CSSKeywordValue,
} from '../src/typed-om.ts';

function construct(Ctor: abstract new (...args: never[]) => unknown, ...args: unknown[]): unknown {
  return new (Ctor as unknown as new (...a: unknown[]) => unknown)(...args);
}

function assign(obj: object, key: string, val: unknown): void {
  Reflect.set(obj, key, val);
}

function assertSyntax(fn: () => unknown, css?: string): void {
  assert.throws(
    fn,
    (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError',
    css,
  );
}

function assertInvalidColor(css: string): void {
  assertSyntax(() => CSSColorValue.parse(css), css);
}

function unit(v: unknown, value: number, unitName: string): CSSUnitValue {
  assert.ok(v instanceof CSSUnitValue, `expected CSSUnitValue, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value, value);
  assert.equal(v.unit, unitName);
  return v;
}

function none(v: unknown, original = 'none'): CSSKeywordValue {
  assert.ok(v instanceof CSSKeywordValue, `expected none keyword, got ${v == null ? String(v) : (v as object).constructor.name}`);
  assert.equal(v.value.toLowerCase(), 'none');
  if (original !== 'none') assert.equal(v.value, original);
  return v;
}

describe('MC/DC leftover unique-cause: CSSColorValue constructor (css-typed-om-2 § 2 #colorvalue-objects)', { concurrency: false }, () => {
  test('direct CSSColorValue construction T vs subclass construction F', () => {
    // Unique-cause: this.constructor === CSSColorValue T.
    assert.throws(() => construct(CSSColorValue), (err: unknown) => {
      return err instanceof TypeError && err.message.includes('cannot be directly constructed');
    });
    // Unique-cause F: subclass constructors reach super() then continue.
    assert.ok(new CSSRGB(0, 0, 0) instanceof CSSColorValue);
    assert.ok(new CSSHSL(0, 1, 0.5) instanceof CSSColorValue);
  });
});

describe('MC/DC leftover unique-cause: rectifyColorRGBComp (css-typed-om-1 § 8.1 #rectify-a-csscolorrgbcomp)', { concurrency: false }, () => {
  test('number/percent unique-cause of matchesNumber||matchesPercentage; keyword string; instanceof Keyword F', () => {
    const rgb = new CSSRGB(CSS.percent(100), CSS.percent(0), CSS.percent(0));
    // Unique-cause: typeof number T → *100 percent.
    rgb.r = 0.25;
    unit(rgb.r, 25, 'percent');
    // Unique-cause: matchesNumber T, matchesPercentage skipped.
    rgb.g = CSS.number(12);
    unit(rgb.g, 12, 'number');
    // Unique-cause: matchesNumber F, matchesPercentage T.
    rgb.b = CSS.percent(40);
    unit(rgb.b, 40, 'percent');
    // Unique-cause: both F (px / deg / time).
    assertSyntax(() => { rgb.r = CSS.px(1); });
    assertSyntax(() => { rgb.g = CSS.deg(1); });
    assertSyntax(() => { rgb.b = CSS.ms(1); });

    // Unique-cause: typeof string T then none (kept original case).
    rgb.r = 'NONE';
    none(rgb.r, 'NONE');
    rgb.g = new CSSKeywordValue('none');
    none(rgb.g);
    assertSyntax(() => { rgb.b = new CSSKeywordValue('foo'); });

    // Unique-cause: instanceof CSSKeywordValue F (null / boolean / object / array).
    assertSyntax(() => assign(rgb, 'r', true));
    assertSyntax(() => assign(rgb, 'g', null));
    assertSyntax(() => assign(rgb, 'b', {}));
    assertSyntax(() => assign(rgb, 'r', []));
  });
});

describe('MC/DC leftover unique-cause: rectifyColorPercent (css-typed-om-1 § 8.1 #rectify-a-csscolorpercent)', { concurrency: false }, () => {
  test('number vs percent vs keyword vs instanceof Keyword F on hsl/hwb/lab/rgb alpha', () => {
    const hsl = new CSSHSL(CSS.deg(120), CSS.percent(50), CSS.percent(40));
    hsl.s = 0.2;
    unit(hsl.s, 20, 'percent');
    hsl.l = CSS.percent(75);
    unit(hsl.l, 75, 'percent');
    hsl.s = 'none';
    none(hsl.s);
    hsl.alpha = new CSSKeywordValue('NONE');
    none(hsl.alpha, 'NONE');
    assertSyntax(() => { hsl.s = CSS.number(1); });
    assertSyntax(() => { hsl.l = CSS.px(1); });
    assertSyntax(() => { hsl.alpha = new CSSKeywordValue('foo'); });
    // Unique-cause: instanceof CSSKeywordValue F.
    assertSyntax(() => assign(hsl, 's', true));
    assertSyntax(() => assign(hsl, 'l', null));

    const hwb = new CSSHWB(CSS.deg(10), CSS.percent(10), CSS.percent(20));
    hwb.w = 'none';
    none(hwb.w);
    hwb.b = 0.3;
    unit(hwb.b, 30, 'percent');
    assertSyntax(() => assign(hwb, 'w', true));

    const lab = new CSSLab(CSS.percent(50), CSS.number(1), CSS.number(2));
    lab.l = 0.4;
    unit(lab.l, 40, 'percent');
    assertSyntax(() => { lab.l = CSS.number(1); });
    assertSyntax(() => assign(lab, 'l', false));

    const rgb = new CSSRGB(CSS.number(1), CSS.number(2), CSS.number(3));
    rgb.alpha = 0.5;
    unit(rgb.alpha, 50, 'percent');
    assert.equal(rgb.toString(), 'rgba(1, 2, 3, 0.5)');
    assertSyntax(() => assign(rgb, 'alpha', true));
  });
});

describe('MC/DC leftover unique-cause: rectifyColorNumber (css-typed-om-1 § 8.1 #rectify-a-csscolornumber)', { concurrency: false }, () => {
  test('string none, matchesNumber F, instanceof Keyword F on lab/oklab a/b', () => {
    const lab = new CSSLab(0.5, 10, 20);
    // Unique-cause: typeof string T.
    lab.a = 'none';
    none(lab.a);
    lab.b = 'NONE';
    none(lab.b, 'NONE');
    lab.a = 7;
    unit(lab.a, 7, 'number');
    lab.b = CSS.number(-2);
    unit(lab.b, -2, 'number');
    // Unique-cause: matchesNumber F (percent / px).
    assertSyntax(() => { lab.a = CSS.percent(10); });
    assertSyntax(() => { lab.b = CSS.px(1); });
    // Unique-cause: none=F on a keyword.
    assertSyntax(() => { lab.a = new CSSKeywordValue('foo'); });
    // Unique-cause: instanceof CSSKeywordValue F.
    assertSyntax(() => assign(lab, 'a', true));
    assertSyntax(() => assign(lab, 'b', null));

    const oklab = new CSSOKLab(0.5, 0.1, 0.2);
    oklab.a = 'none';
    none(oklab.a);
    oklab.b = CSS.number(0.05);
    unit(oklab.b, 0.05, 'number');
    assertSyntax(() => { oklab.a = CSS.percent(1); });
    assertSyntax(() => assign(oklab, 'b', {}));
  });
});

describe('MC/DC leftover unique-cause: rectifyColorAngle (css-typed-om-1 § 8.1 #rectify-a-csscolorangle)', { concurrency: false }, () => {
  test('undefined T, keyword undefined vs none vs neither, instanceof Keyword F, angle units', () => {
    const hsl = new CSSHSL(CSS.deg(120), CSS.percent(50), CSS.percent(50));
    // Unique-cause: v === undefined T → CSSKeywordValue('undefined').
    assign(hsl, 'h', undefined);
    assert.ok(hsl.h instanceof CSSKeywordValue);
    assert.equal((hsl.h as CSSKeywordValue).value, 'undefined');

    // Unique-cause: none=F, === 'undefined' T (string then keyword; ASCII-case fold).
    hsl.h = 'undefined';
    assert.equal((hsl.h as CSSKeywordValue).value, 'undefined');
    hsl.h = 'UNDEFINED';
    assert.equal((hsl.h as CSSKeywordValue).value, 'UNDEFINED');
    hsl.h = new CSSKeywordValue('undefined');
    assert.equal((hsl.h as CSSKeywordValue).value, 'undefined');

    // Unique-cause: none=T, undefined skipped.
    hsl.h = 'none';
    none(hsl.h);
    hsl.h = new CSSKeywordValue('NONE');
    none(hsl.h, 'NONE');

    // Unique-cause: none=F, undefined=F.
    assertSyntax(() => { hsl.h = 'nope'; });
    assertSyntax(() => { hsl.h = new CSSKeywordValue('auto'); });

    // Unique-cause: typeof number T → deg.
    hsl.h = 90;
    unit(hsl.h, 90, 'deg');
    // Unique-cause: matchesAngle T for rad/grad/turn vs F for px/number.
    hsl.h = CSS.rad(1);
    unit(hsl.h, 1, 'rad');
    hsl.h = CSS.grad(100);
    unit(hsl.h, 100, 'grad');
    hsl.h = CSS.turn(0.5);
    unit(hsl.h, 0.5, 'turn');
    assertSyntax(() => { hsl.h = CSS.px(1); });
    assertSyntax(() => { hsl.h = CSS.number(1); });

    // Unique-cause: instanceof CSSKeywordValue F.
    assertSyntax(() => assign(hsl, 'h', null));
    assertSyntax(() => assign(hsl, 'h', true));
    assertSyntax(() => assign(hsl, 'h', {}));
    assertSyntax(() => assign(hsl, 'h', []));

    const lch = new CSSLCH(0.5, 0.1, CSS.deg(40));
    assign(lch, 'h', undefined);
    assert.equal((lch.h as CSSKeywordValue).value, 'undefined');
    const oklch = new CSSOKLCH(0.5, 0.1, CSS.deg(40));
    oklch.h = 'undefined';
    assert.equal((oklch.h as CSSKeywordValue).value, 'undefined');
  });
});

describe('MC/DC leftover unique-cause: rectifyColorNumberOrPercent (css-typed-om-1 § 8.1, CSSColor channels/alpha)', { concurrency: false }, () => {
  test('number vs percent unique-cause, string none, instanceof Keyword F, colorSpace setter', () => {
    const color = new CSSColor('srgb', [0.1, 0.2, 0.3]);
    // Unique-cause: matchesNumber T, matchesPercentage skipped.
    color.alpha = CSS.number(0.4);
    unit(color.alpha, 0.4, 'number');
    // Unique-cause: matchesNumber F, matchesPercentage T.
    color.alpha = CSS.percent(50);
    unit(color.alpha, 50, 'percent');
    assert.equal(color.toString(), 'color(srgb 0.1 0.2 0.3 / 50%)');
    // Unique-cause: both F.
    assertSyntax(() => { color.alpha = CSS.px(1); });
    assertSyntax(() => { color.alpha = CSS.deg(1); });

    // Unique-cause: typeof string T.
    color.alpha = 'none';
    none(color.alpha);
    assert.equal(color.toString(), 'color(srgb 0.1 0.2 0.3 / none)');
    color.alpha = new CSSKeywordValue('NONE');
    none(color.alpha, 'NONE');
    assertSyntax(() => { color.alpha = new CSSKeywordValue('foo'); });
    // Unique-cause: instanceof CSSKeywordValue F.
    assertSyntax(() => assign(color, 'alpha', true));
    assertSyntax(() => assign(color, 'alpha', null));

    color.channels = [CSS.percent(10), CSS.number(0.2), 'none'];
    unit(color.channels[0], 10, 'percent');
    unit(color.channels[1], 0.2, 'number');
    none(color.channels[2]);
    assertSyntax(() => { color.channels = [CSS.px(1)]; });
    assertSyntax(() => { color.channels = [new CSSKeywordValue('foo')]; });
    assertSyntax(() => assign(color, 'channels', [true]));

    // Unique-cause: colorSpace setter typeof !== 'string' T, instanceof Keyword T vs F.
    color.colorSpace = new CSSKeywordValue('xyz');
    assert.equal(color.colorSpace.value, 'xyz');
    color.colorSpace = 'rec2020';
    assert.equal(color.colorSpace.value, 'rec2020');
    assert.throws(() => assign(color, 'colorSpace', 1), TypeError);
    assert.throws(() => assign(color, 'colorSpace', null), TypeError);
    assert.throws(() => assign(color, 'colorSpace', true), TypeError);
  });
});

describe('MC/DC leftover unique-cause: CSSHWB.h (css-typed-om-2 § 2.3 #csshwb)', { concurrency: false }, () => {
  test('instanceof CSSNumericValue F, matchesAngle T/F for rad/turn/grad vs number/px/percent', () => {
    const hwb = new CSSHWB(CSS.deg(10), CSS.percent(10), CSS.percent(20));
    hwb.h = CSS.rad(1);
    unit(hwb.h, 1, 'rad');
    hwb.h = CSS.turn(0.25);
    unit(hwb.h, 0.25, 'turn');
    hwb.h = CSS.grad(50);
    unit(hwb.h, 50, 'grad');
    hwb.h = CSS.deg(180);
    unit(hwb.h, 180, 'deg');
    // Unique-cause: instanceof T, matchesAngle F.
    assertSyntax(() => { hwb.h = CSS.number(1); });
    assertSyntax(() => { hwb.h = CSS.px(1); });
    assertSyntax(() => { hwb.h = CSS.percent(1); });
    // Unique-cause: instanceof CSSNumericValue F (typeof number skipped).
    assert.throws(() => assign(hwb, 'h', 'none'), TypeError);
    assert.throws(() => assign(hwb, 'h', undefined), TypeError);
    assert.throws(() => assign(hwb, 'h', new CSSKeywordValue('none')), TypeError);
    assert.throws(() => assign(hwb, 'h', null), TypeError);
  });
});

describe('MC/DC leftover unique-cause: parseColor comment skip (css-color-4, color-reify parseColor)', { concurrency: false }, () => {
  test('comment unique-cause vs whitespace; comment-only empty; trailing/leading comments', () => {
    // Unique-cause: v.type === 'comment' T with whitespace F (leading comment, no space).
    const leading = CSSColorValue.parse('/*c*/red');
    assert.ok(leading instanceof CSSRGB);
    unit((leading as CSSRGB).r, 255, 'number');

    const trailing = CSSColorValue.parse('red/*c*/');
    assert.ok(trailing instanceof CSSRGB);

    const hashComment = CSSColorValue.parse('/*h*/#abc');
    assert.ok(hashComment instanceof CSSRGB);
    unit((hashComment as CSSRGB).r, 170, 'number');

    const mixed = CSSColorValue.parse('  /*c*/ canvas /*d*/ ');
    assert.ok(mixed instanceof CSSKeywordValue);
    assert.equal((mixed as CSSKeywordValue).value, 'canvas');

    // Unique-cause: comments only → !singleValue.
    assertInvalidColor('/* only comments */');
    assertInvalidColor('/*a*//*b*/');
    assertInvalidColor('   ');
    assertInvalidColor('');

    // Two non-skipped values after comments.
    assertInvalidColor('red /*c*/ blue');
    assertInvalidColor('/*c*/ red green');
  });
});

describe('MC/DC leftover unique-cause: reifyColor hex/named/system/function (css-color-4 #hex-notation / #named-colors / #css-system-colors)', { concurrency: false }, () => {
  test('hex mixed-case, non-hex digits NaN, 4-tuple transparent vs 3-tuple named, leftover system, unknown functions', () => {
    const mixed = CSSColorValue.parse('#AbC') as CSSRGB;
    unit(mixed.r, 170, 'number');
    unit(mixed.g, 187, 'number');
    unit(mixed.b, 204, 'number');
    unit(mixed.alpha, 100, 'percent');

    const hex4 = CSSColorValue.parse('#ABCD') as CSSRGB;
    unit(hex4.r, 170, 'number');
    assert.ok(Math.abs((hex4.alpha as CSSUnitValue).value - (221 / 255) * 100) < 1e-6);

    const hex8zero = CSSColorValue.parse('#00000000') as CSSRGB;
    unit(hex8zero.r, 0, 'number');
    unit(hex8zero.alpha, 0, 'percent');

    const hex4white = CSSColorValue.parse('#ffff') as CSSRGB;
    unit(hex4white.r, 255, 'number');
    unit(hex4white.alpha, 100, 'percent');

    // Unique-cause: parseInt of non-hex digits → NaN channels (len=3 still reifies).
    const badHex = CSSColorValue.parse('#ggg') as CSSRGB;
    assert.ok(badHex instanceof CSSRGB);
    assert.ok(Number.isNaN((badHex.r as CSSUnitValue).value));

    // Unique-cause: NAMED_COLORS parts.length > 3 T (transparent) vs F (aliceblue).
    const transparent = CSSColorValue.parse('TRANSPARENT') as CSSRGB;
    unit(transparent.r, 0, 'number');
    unit(transparent.alpha, 0, 'percent');
    const alice = CSSColorValue.parse('AliceBlue') as CSSRGB;
    unit(alice.r, 240, 'number');
    unit(alice.g, 248, 'number');
    unit(alice.b, 255, 'number');
    unit(alice.alpha, 100, 'percent');

    // Unique-cause: SYSTEM_COLORS.has T for leftover names / ASCII fold; F after named miss.
    for (const name of ['GrayText', 'ButtonFace', 'linktext', 'WindowText', 'CURRENTCOLOR', 'Canvas', 'HighlightText', 'Mark']) {
      const sys = CSSColorValue.parse(name);
      assert.ok(sys instanceof CSSKeywordValue, name);
      assert.equal((sys as CSSKeywordValue).value, name.toLowerCase(), name);
    }
    assertInvalidColor('notacolor');
    assertInvalidColor('rgb');
    assertInvalidColor('none');

    // Unique-cause: nameLower in COLOR_REIFIERS F, nameLower === 'color' T (xyz leftover space).
    const xyz = CSSColorValue.parse('color(xyz-d65 0.1 0.2 0.3)') as CSSColor;
    assert.equal(xyz.colorSpace.value, 'xyz-d65');
    unit(xyz.channels[0], 0.1, 'number');

    const rec = CSSColorValue.parse('COLOR(rec2020 1 0 0 / 0.2)') as CSSColor;
    assert.equal(rec.colorSpace.value, 'rec2020');
    unit(rec.alpha, 0.2, 'number');

    // Unique-cause: both conjuncts F (not a color function).
    assertInvalidColor('color-mix(in srgb, red, blue)');
    assertInvalidColor('light-dark(red, blue)');
    assertInvalidColor('device-cmyk(0 0 0 0)');
    assertInvalidColor('var(--x)');
    assertInvalidColor('min(1, 2)');
    assertInvalidColor('foo(1)');
    assertInvalidColor('calc(1)');

    // Unique-cause: ASCII-folded function names (nameLower).
    assert.ok(CSSColorValue.parse('Rgb(1, 2, 3)') instanceof CSSRGB);
    assert.ok(CSSColorValue.parse('HSL(120deg 50% 50%)') instanceof CSSHSL);
    assert.ok(CSSColorValue.parse('Lab(50% 10 10)') instanceof CSSLab);
    assert.ok(CSSColorValue.parse('OkLch(0.5 0.1 40)') instanceof CSSOKLCH);
    assert.ok(CSSColorValue.parse('HwB(45deg 0% 100%)') instanceof CSSHWB);
  });
});

describe('MC/DC leftover unique-cause: COLOR_REIFIERS alpha not in parseColorArgs (css-color-4 #rgb-functions / #ok-lab)', { concurrency: false }, () => {
  test('rgba/hwb/lab/lch/oklab none vs percent vs number alpha; leftover hue units', () => {
    // Unique-cause: rgba a instanceof CSSUnitValue F (keyword none).
    const rgbaNone = CSSColorValue.parse('rgba(1 2 3 / none)') as CSSRGB;
    none(rgbaNone.alpha);
    assert.equal(rgbaNone.toString(), 'rgba(1, 2, 3, none)');

    const rgbaPct = CSSColorValue.parse('rgba(1 2 3 / 50%)') as CSSRGB;
    unit(rgbaPct.alpha, 50, 'percent');
    const rgba3 = CSSColorValue.parse('rgba(1, 2, 3)') as CSSRGB;
    unit(rgba3.alpha, 100, 'percent');

    const hwbNone = CSSColorValue.parse('hwb(120 10% 20% / none)') as CSSHWB;
    none(hwbNone.alpha);
    const hwbRad = CSSColorValue.parse('hwb(1rad 10% 20%)') as CSSHWB;
    unit(hwbRad.h, 1, 'rad');
    const hwbTurn = CSSColorValue.parse('hwb(0.5turn 0% 0%)') as CSSHWB;
    unit(hwbTurn.h, 0.5, 'turn');

    const labNone = CSSColorValue.parse('lab(50% 10 20 / none)') as CSSLab;
    none(labNone.alpha);
    const lchNone = CSSColorValue.parse('lch(50% 10 40 / none)') as CSSLCH;
    none(lchNone.alpha);
    const lchRad = CSSColorValue.parse('lch(50% 10 1rad)') as CSSLCH;
    unit(lchRad.h, 1, 'rad');

    // Unique-cause: oklab alpha number T / percent TF / keyword FT (not in parseColorArgs).
    const oklabNumA = CSSColorValue.parse('oklab(0.5 0.1 0.1 / 0.4)') as CSSOKLab;
    unit(oklabNumA.alpha, 40, 'percent');
    const oklabPctA = CSSColorValue.parse('oklab(0.5 0.1 0.1 / 40%)') as CSSOKLab;
    unit(oklabPctA.alpha, 40, 'percent');
    const oklabNone = CSSColorValue.parse('oklab(0.5 0.1 0.1 / none)') as CSSOKLab;
    none(oklabNone.alpha);

    const hslRad = CSSColorValue.parse('hsl(1rad 50% 50%)') as CSSHSL;
    unit(hslRad.h, 1, 'rad');
    const hslaNone = CSSColorValue.parse('hsla(none 50% 50% / none)') as CSSHSL;
    none(hslaNone.h);
    none(hslaNone.alpha);
  });
});

describe('MC/DC leftover unique-cause: toString isAlphaUnity F (css-color-4 serialization)', { concurrency: false }, () => {
  test('lab/lch/oklab/oklch/color non-unity and none alpha; empty vs one vs many channels', () => {
    // Unique-cause: isAlphaUnity F for CSSLab / CSSLCH / CSSOKLab / CSSOKLCH (only T was sampled).
    const lab = new CSSLab(CSS.percent(50), CSS.number(10), CSS.number(20), CSS.percent(50));
    assert.equal(lab.toString(), 'lab(50% 10 20 / 50%)');
    const labNone = new CSSLab(CSS.percent(50), CSS.number(10), CSS.number(20), 'none');
    assert.equal(labNone.toString(), 'lab(50% 10 20 / none)');
    const labUnity = new CSSLab(CSS.percent(50), CSS.number(10), CSS.number(20), CSS.percent(100));
    assert.equal(labUnity.toString(), 'lab(50% 10 20)');

    const lch = new CSSLCH(CSS.percent(50), CSS.percent(10), CSS.deg(40), CSS.percent(50));
    assert.equal(lch.toString(), 'lch(50% 10% 40deg / 50%)');
    const lchNone = new CSSLCH(CSS.percent(50), CSS.percent(10), CSS.deg(40), 'none');
    assert.equal(lchNone.toString(), 'lch(50% 10% 40deg / none)');

    const oklab = new CSSOKLab(CSS.percent(50), CSS.number(0.1), CSS.number(0.2), CSS.percent(50));
    assert.equal(oklab.toString(), 'oklab(50% 0.1 0.2 / 50%)');
    const oklabNone = new CSSOKLab(CSS.percent(50), CSS.number(0.1), CSS.number(0.2), 'none');
    assert.equal(oklabNone.toString(), 'oklab(50% 0.1 0.2 / none)');

    const oklch = new CSSOKLCH(CSS.percent(50), CSS.percent(10), CSS.deg(40), CSS.percent(50));
    assert.equal(oklch.toString(), 'oklch(50% 10% 40deg / 50%)');
    const oklchNone = new CSSOKLCH(CSS.percent(50), CSS.percent(10), CSS.deg(40), 'none');
    assert.equal(oklchNone.toString(), 'oklch(50% 10% 40deg / none)');

    // Unique-cause: CSSColor toString i > 0 F (empty / one channel) vs T (2+).
    const empty = new CSSColor('srgb', []);
    assert.equal(empty.toString(), 'color(srgb )');
    const one = new CSSColor('srgb', [0.1]);
    assert.equal(one.toString(), 'color(srgb 0.1)');
    const two = new CSSColor('srgb', [0.1, 0.2]);
    assert.equal(two.toString(), 'color(srgb 0.1 0.2)');
    const twoAlpha = new CSSColor('srgb', [0.1, 0.2], CSS.number(0.5));
    assert.equal(twoAlpha.toString(), 'color(srgb 0.1 0.2 / 0.5)');
    const emptyAlpha = new CSSColor('srgb', [], 'none');
    assert.equal(emptyAlpha.toString(), 'color(srgb  / none)');
  });
});

describe('MC/DC leftover unique-cause: brand checks and CSSStyleValue.parse color routing', { concurrency: false }, () => {
  test('illegal invocation on leftover getters/setters', () => {
    assert.throws(() => { void CSSHSL.prototype.h; }, TypeError);
    assert.throws(() => { void CSSHSL.prototype.s; }, TypeError);
    assert.throws(() => { void CSSHSL.prototype.alpha; }, TypeError);
    assert.throws(() => { void CSSHWB.prototype.h; }, TypeError);
    assert.throws(() => { void CSSHWB.prototype.w; }, TypeError);
    assert.throws(() => { void CSSLab.prototype.a; }, TypeError);
    assert.throws(() => { void CSSLCH.prototype.c; }, TypeError);
    assert.throws(() => { void CSSOKLab.prototype.b; }, TypeError);
    assert.throws(() => { void CSSOKLCH.prototype.h; }, TypeError);
    assert.throws(() => { void CSSColor.prototype.colorSpace; }, TypeError);
    assert.throws(() => { void CSSColor.prototype.alpha; }, TypeError);
    assert.throws(() => { void CSSRGB.prototype.g; }, TypeError);
    assert.throws(() => {
      assign(CSSRGB.prototype, 'r', 1);
    }, TypeError);
    assert.throws(() => {
      assign(CSSHSL.prototype, 'h', CSS.deg(1));
    }, TypeError);
    assert.throws(() => {
      assign(CSSColor.prototype, 'colorSpace', 'srgb');
    }, TypeError);
  });

  test("CSSStyleValue.parse('color', ...) leftover hex/function/comment/none-alpha not in parseColorArgs", () => {
    // Named idents (`red`/`transparent`/`currentcolor`) stay CSSKeywordValue in
    // _parseAll and never reach reifyColor; drive hex/functions instead.
    const hex = CSSStyleValue.parse('color', '#AbC');
    assert.ok(hex instanceof CSSRGB);
    unit((hex as CSSRGB).r, 170, 'number');

    const commentedHex = CSSStyleValue.parse('color', '/*x*/#AbC');
    assert.ok(commentedHex instanceof CSSRGB);

    const commentedRgb = CSSStyleValue.parse('color', '/*x*/rgb(1 2 3)');
    assert.ok(commentedRgb instanceof CSSRGB);
    unit((commentedRgb as CSSRGB).r, 1, 'number');

    const rgbaNone = CSSStyleValue.parse('color', 'rgba(1 2 3 / none)');
    assert.ok(rgbaNone instanceof CSSRGB);
    none((rgbaNone as CSSRGB).alpha);

    const hwbNone = CSSStyleValue.parse('color', 'hwb(120 10% 20% / none)');
    assert.ok(hwbNone instanceof CSSHWB);
    none((hwbNone as CSSHWB).alpha);

    const labNone = CSSStyleValue.parse('color', 'lab(50% 10 20 / none)');
    assert.ok(labNone instanceof CSSLab);
    none((labNone as CSSLab).alpha);

    const oklab = CSSStyleValue.parse('color', 'oklab(0.5 0.1 0.1 / none)');
    assert.ok(oklab instanceof CSSOKLab);
    none((oklab as CSSOKLab).alpha);

    const xyz = CSSStyleValue.parse('color', 'color(xyz-d65 0.2 0.3 0.4)');
    assert.ok(xyz instanceof CSSColor);
    assert.equal((xyz as CSSColor).colorSpace.value, 'xyz-d65');

    const parseAll = CSSStyleValue.parseAll('color', '/*c*/#00000000');
    assert.equal(parseAll.length, 1);
    assert.ok(parseAll[0] instanceof CSSRGB);
    unit((parseAll[0] as CSSRGB).alpha, 0, 'percent');

    assert.throws(() => CSSStyleValue.parse('color', 'color-mix(in srgb, red, blue)'), TypeError);
    assert.throws(() => CSSStyleValue.parse('color', '/* only */'), TypeError);
    assert.throws(() => CSSStyleValue.parse('color', 'light-dark(red, blue)'), TypeError);
  });
});
