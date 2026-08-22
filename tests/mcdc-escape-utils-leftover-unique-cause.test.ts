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
// Verifies: SW-REQ-260821-3553, SW-REQ-260821-6951, SW-REQ-260821-YTV6, INT-REQ-260821-JTY2, INT-REQ-260821-MZW3
// Leftover unique-cause for src/css-escape.ts, src/utils.ts, and src/utils/format.ts
// not already in tests/css-escape.test.ts / tests/format.test.ts /
// tests/dom-matrix.test.ts / tests/mcdc-branch-cssom.test.ts /
// tests/mcdc-branch-declaration-leftover.test.ts.
// Drive CSS.escape / CSSKeywordValue.toString, CSSStyleDeclaration camelCase,
// StyleSheetList / MediaList / CSSRuleList indexed getters, deleteRule,
// DOMMatrix.rotateFromVector, serialize / CSSUnitValue, plus direct
// camelToDashed / createIndexedProxy / deleteRuleFromArray / angleFromVector /
// formatNumber for pairs public CSSOM cannot emit.
// cssom-1 § 2.3 #serialize-an-identifier / § 3 #the-css.escape()-method /
// § 6.5.4 #remove-a-css-rule / § 6.2 #the-medialist-interface,
// geometry-1 #dom-dommatrix-rotatefromvector / #dom-dommatrix-rotatefromvectorself,
// css-typed-om-1 § 3.1 #keywordvalue-objects / § 4.2 #unitvalue-objects.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/parser.ts';
import { CSS } from '../src/parser-api.ts';
import { escape } from '../src/css-escape.ts';
import {
  camelToDashed,
  createIndexedProxy,
  deleteRuleFromArray,
  angleFromVector,
  degToRad,
  radToDeg,
} from '../src/utils.ts';
import { formatNumber } from '../src/utils/format.ts';
import { serialize } from '../src/serializer.ts';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSMediaRule,
  StyleSheetList,
  MediaList,
} from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSKeywordValue, CSSUnitValue } from '../src/typed-om.ts';
import { DOMMatrix, DOMMatrixReadOnly } from '../src/DOMMatrix.ts';
import type { Rule, NumberToken, PercentageToken, DimensionToken } from '../src/types.ts';

function nearly(actual: number, expected: number, label: string, eps = 1e-6): void {
  assert.ok(Number.isFinite(actual) && Math.abs(actual - expected) < eps, `${label}: ${actual} vs ${expected}`);
}

function numberToken(value: number): NumberToken {
  return { type: 'number', value, numberType: 'number', sign: null };
}

function percentageToken(value: number): PercentageToken {
  return { type: 'percentage', value, sign: null };
}

function dimensionToken(value: number, unit: string): DimensionToken {
  return { type: 'dimension', value, unit, numberType: 'number', sign: null };
}

function indexSize(fn: () => unknown): void {
  assert.throws(fn, (err: unknown) => err instanceof DOMException && err.name === 'IndexSizeError');
}

function idx(obj: object, key: PropertyKey): unknown {
  return Reflect.get(obj, key);
}

describe('MC/DC leftover unique-cause: CSS.escape (cssom-1 § 2.3 #serialize-an-identifier / § 3 #the-css.escape()-method)', { concurrency: false }, () => {
  test('arguments.length === 0 vs String() conversion unique-cause', () => {
    // Unique-cause: arguments.length === 0 T vs F (undefined still counts as 1).
    assert.throws(
      () => (CSS.escape as unknown as () => string)(),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes('1 argument required, but only 0 present'),
    );
    assert.equal(CSS.escape(undefined), 'undefined');
    assert.equal(CSS.escape(12), '\\31 2');
    assert.equal(CSS.escape({ toString: () => 'foo.bar' }), 'foo\\.bar');
    assert.equal(escape(''), '');
    assert.equal(CSS.escape('a'), 'a');
  });

  test('NULL vs control vs DEL unique-cause; codeUnit >= 1 F unpairable after step 1', () => {
    // Unique-cause: codeUnit === 0x0000 T vs F. NUL never reaches step 2, so
    // `codeUnit >= 1` F at the control-escape OR is unpairable (charCodeAt is
    // never negative). No //mcdc:ignore.
    assert.equal(CSS.escape('\0'), '\uFFFD');
    assert.equal(CSS.escape('\0a'), '\uFFFDa');
    assert.equal(new CSSKeywordValue('\0').toString(), '\uFFFD');

    // Unique-cause of ( >= 1 && <= 31) || === 127: SOH/US T; space (32) F of <= 31
    // with >= 1 T and !== 127; DEL T of === 127 with the AND F.
    assert.equal(CSS.escape('\x01'), '\\1 ');
    assert.equal(CSS.escape('\x1F'), '\\1f ');
    assert.equal(CSS.escape(' '), '\\ ');
    assert.equal(CSS.escape('\x7F'), '\\7f ');
    assert.equal(CSS.escape('\x7Fa'), '\\7f a');
    assert.equal(new CSSKeywordValue('\x7F').toString(), '\\7f ');
  });

  test('first-digit and hyphen-digit unique-cause of index / range / leading dash', () => {
    // Step 3: index === 0 && >= 0x30 && <= 0x39.
    // Unique-cause index === 0: '0a' T vs 'a0' F (digit kept later).
    assert.equal(CSS.escape('0a'), '\\30 a');
    assert.equal(CSS.escape('9z'), '\\39 z');
    assert.equal(CSS.escape('a0'), 'a0');
    // Unique-cause >= 0x30 with <= 0x39 T: '/' (47) F vs '0' T.
    assert.equal(CSS.escape('/'), '\\/');
    // Unique-cause <= 0x39 with >= 0x30 T: ':' (58) F vs '0' T.
    assert.equal(CSS.escape(':'), '\\:');
    assert.equal(CSS.escape(':foo'), '\\:foo');

    // Step 4: index === 1 && digit && first === '-'.
    assert.equal(CSS.escape('-0a'), '-\\30 a');
    assert.equal(CSS.escape('-9'), '-\\39 ');
    // Unique-cause first === '-' F: 'a0' / '00'.
    assert.equal(CSS.escape('00'), '\\30 0');
    // Unique-cause index === 1 F with digit T and leading '-': '-a0'.
    assert.equal(CSS.escape('-a0'), '-a0');
    // Unique-cause second-char >= 0x30 F with <= 0x39 T: '-/' (47).
    assert.equal(CSS.escape('-/'), '-\\/');
    // Unique-cause second-char <= 0x39 F with >= 0x30 T: '-:'.
    assert.equal(CSS.escape('-:'), '-\\:');
    assert.equal(new CSSKeywordValue('-0a').toString(), '-\\30 a');
  });

  test('lone hyphen vs ident-keep leftover <= 122 {|}~ and otherwise-escape', () => {
    // Step 5: index === 0 && '-' && length === 1.
    assert.equal(CSS.escape('-'), '\\-');
    // Unique-cause length === 1 F: '--' / '-a' keep the hyphen via step 6 === 0x2D.
    assert.equal(CSS.escape('--'), '--');
    assert.equal(CSS.escape('-a'), '-a');
    assert.equal(CSS.escape('a-b'), 'a-b');

    // Step 6 leftover unique-cause of codeUnit <= 122: need >= 97 T so the AND
    // is evaluated. a-z T; { | } ~ (123-126) F → step 7.
    assert.equal(CSS.escape('a'), 'a');
    assert.equal(CSS.escape('z'), 'z');
    assert.equal(CSS.escape('{'), '\\{');
    assert.equal(CSS.escape('|'), '\\|');
    assert.equal(CSS.escape('}'), '\\}');
    assert.equal(CSS.escape('~'), '\\~');
    assert.equal(CSS.escape('{z}'), '\\{z\\}');
    assert.equal(new CSSKeywordValue('{z}').toString(), '\\{z\\}');

    // Unique-cause of <= 90 with >= 65 T: A-Z T; [ \ ] ^ ` F.
    assert.equal(CSS.escape('A'), 'A');
    assert.equal(CSS.escape('Z'), 'Z');
    assert.equal(CSS.escape('['), '\\[');
    assert.equal(CSS.escape('\\'), '\\\\');
    assert.equal(CSS.escape(']'), '\\]');
    assert.equal(CSS.escape('^'), '\\^');
    assert.equal(CSS.escape('`'), '\\`');

    // Unique-cause of <= 57 with >= 48 T after surviving steps 3-4: 'a9' T vs 'a:'.
    assert.equal(CSS.escape('a9'), 'a9');
    assert.equal(CSS.escape('a:'), 'a\\:');
    assert.equal(CSS.escape('_'), '_');
    assert.equal(CSS.escape('a_b'), 'a_b');

    // Unique-cause of >= 0x80 T vs ASCII F. U+0080 is a C1 control; keep as itself.
    assert.equal(CSS.escape('\u0080').charCodeAt(0), 0x80);
    assert.equal(CSS.escape('\u00A0'), '\u00A0');
    assert.equal(CSS.escape('\uD834\uDF06'), '\uD834\uDF06');
  });
});

describe('MC/DC leftover unique-cause: camelToDashed (cssom-1 § 6.6.2 #dom-cssstyledeclaration-csstext)', { concurrency: false }, () => {
  test('[A-Z] replace vs /^ms-/ unique-cause through style proxy and direct', () => {
    // Unique-cause: /[A-Z]/ F and /^ms-/ F.
    assert.equal(camelToDashed(''), '');
    assert.equal(camelToDashed('color'), 'color');
    assert.equal(camelToDashed('ms'), 'ms');
    // Unique-cause: /[A-Z]/ T, /^ms-/ F.
    assert.equal(camelToDashed('backgroundColor'), 'background-color');
    assert.equal(camelToDashed('marginTop'), 'margin-top');
    assert.equal(camelToDashed('MS'), '-m-s');
    assert.equal(camelToDashed('mSFoo'), 'm-s-foo');
    // Unique-cause: /[A-Z]/ T, /^ms-/ T (ms + uppercase → ms-… then leading dash).
    assert.equal(camelToDashed('msTransform'), '-ms-transform');
    assert.equal(camelToDashed('msGridColumn'), '-ms-grid-column');

    const s = new CSSStyleDeclaration();
    s.color = 'blue';
    assert.equal(s.getPropertyValue('color'), 'blue');
    s.backgroundColor = 'red';
    assert.equal(s.getPropertyValue('background-color'), 'red');
    assert.equal(s.backgroundColor, 'red');
    assert.equal('backgroundColor' in s, true);
    assert.equal('marginTop' in s, true);
    // -ms-transform is not a supported property; camelToDashed still runs then expando.
    s.msTransform = 'none';
    assert.equal(s.getPropertyValue('-ms-transform'), '');
    assert.equal(s.msTransform, 'none');
  });
});

describe('MC/DC leftover unique-cause: createIndexedProxy (cssom-1 § 6.2 #the-medialist-interface / § 6.3 #the-cssstylesheet-interface)', { concurrency: false }, () => {
  test('typeof string / isNaN / val !== undefined leftover unique-cause on lists and holes', () => {
    const a = new CSSStyleSheet();
    const b = new CSSStyleSheet();
    const sheets = new StyleSheetList([a, b]);
    // Unique-cause: typeof prop === 'string' T && !isNaN T && val !== undefined T.
    assert.equal(idx(sheets, 0), a);
    assert.equal(idx(sheets, 1), b);
    // val !== undefined F: OOB numeric.
    assert.equal(idx(sheets, 2), undefined);
    assert.equal(idx(sheets, 99), undefined);
    // Number('') === 0 leftover: empty string is a numeric index.
    assert.equal(idx(sheets, ''), a);
    assert.equal(idx(sheets, '00'), a);
    assert.equal(idx(sheets, '+1'), b);
    assert.equal(idx(sheets, '1e0'), b);
    // !isNaN F: non-numeric string falls through to the target.
    assert.equal(idx(sheets, 'length'), 2);
    assert.equal(idx(sheets, 'foo'), undefined);
    // Number('Infinity') is not NaN → index path, val undefined.
    assert.equal(idx(sheets, 'Infinity'), undefined);
    // Number('NaN') is NaN → !isNaN F, Reflect.get.
    assert.equal(idx(sheets, 'NaN'), undefined);
    // typeof prop === 'string' F (symbol): skip numeric index.
    assert.equal(typeof idx(sheets, Symbol.iterator), 'function');

    const media = new MediaList('screen, print');
    assert.equal(media[0], 'screen');
    assert.equal(media[1], 'print');
    assert.equal(media[2], undefined);
    assert.equal(media['mediaText'], 'screen, print');

    const sheet = parse('.a{color:red} .b{color:blue}');
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
    assert.ok(sheet.cssRules[1] instanceof CSSStyleRule);
    assert.equal(sheet.cssRules[2], undefined);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.a');

    // Direct leftover: default mapValue vs custom; hole val !== undefined F; negative index.
    const target = { name: 't' };
    const def = createIndexedProxy(target, () => ['x', 'y']);
    assert.equal(idx(def, 0), 'x');
    assert.equal(def.name, 't');
    const mapped = createIndexedProxy(target, () => [2, 3], (v) => v * 10);
    assert.equal(idx(mapped, 0), 20);
    assert.equal(idx(mapped, 1), 30);
    assert.equal(idx(mapped, 2), undefined);
    const holed = createIndexedProxy({}, () => {
      const arr: Array<string | undefined> = ['a'];
      arr[2] = 'c';
      return arr;
    });
    assert.equal(idx(holed, 0), 'a');
    assert.equal(idx(holed, 1), undefined);
    assert.equal(idx(holed, 2), 'c');
    assert.equal(idx(holed, '-1'), undefined);
    const mark = Symbol('idx');
    const withSym = createIndexedProxy({ [mark]: 'sym' } as { [k: symbol]: string }, () => ['z']);
    assert.equal(idx(withSym, mark), 'sym');
    assert.equal(idx(withSym, 0), 'z');
  });
});

describe('MC/DC leftover unique-cause: deleteRuleFromArray (cssom-1 § 6.5.4 #remove-a-css-rule)', { concurrency: false }, () => {
  test('index < 0 vs >= length vs valid unique-cause through public deleteRule', () => {
    const sheet = parse('.a{} .b{}');
    indexSize(() => sheet.deleteRule(-1));
    indexSize(() => sheet.deleteRule(2));
    const first = sheet.cssRules[0] as CSSStyleRule;
    assert.equal(first.parentStyleSheet, sheet);
    sheet.deleteRule(0);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal(first.parentRule, null);
    assert.equal(first.parentStyleSheet, null);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.b');

    const grouped = parse('@media all { .inner { color: red } .other { color: blue } }');
    const media = grouped.cssRules[0] as CSSMediaRule;
    const inner = media.cssRules[0] as CSSStyleRule;
    assert.equal(inner.parentRule, media);
    media.deleteRule(0);
    assert.equal(inner.parentRule, null);
    assert.equal(inner.parentStyleSheet, null);
    assert.equal(media.cssRules.length, 1);
    indexSize(() => media.deleteRule(-1));
    indexSize(() => media.deleteRule(1));
  });

  test('oldRule && typeof object / in parentRule / in parentStyleSheet leftover unique-cause', () => {
    // Unique-cause of index bounds on the helper itself (empty / valid / OOB).
    indexSize(() => deleteRuleFromArray([], 0));
    indexSize(() => deleteRuleFromArray([{ type: 'style-rule' } as unknown as Rule], -1));
    indexSize(() => deleteRuleFromArray([{ type: 'style-rule' } as unknown as Rule], 1));

    // Unique-cause: oldRule F && typeof === 'object' T (null).
    const withNull = [null as unknown as Rule];
    assert.equal(deleteRuleFromArray(withNull, 0), null);
    assert.equal(withNull.length, 0);

    // Unique-cause: oldRule F && typeof === 'object' F (hole / undefined).
    const holed: Rule[] = [{ type: 'at-rule', name: 'x', prelude: [], value: [] } as unknown as Rule];
    holed[1] = undefined as unknown as Rule;
    assert.equal(deleteRuleFromArray(holed, 1), undefined);

    // Unique-cause: oldRule T && typeof === 'object' F (truthy primitive / function).
    assert.equal(deleteRuleFromArray(['hello' as unknown as Rule], 0), 'hello');
    assert.equal(deleteRuleFromArray([1 as unknown as Rule], 0), 1);
    const fn = () => {};
    assert.equal(deleteRuleFromArray([fn as unknown as Rule], 0), fn);

    // Unique-cause: both `in` checks F (plain object / null-prototype).
    const plain = { type: 'x' };
    assert.equal(deleteRuleFromArray([plain as unknown as Rule], 0), plain);
    const bare = Object.create(null) as { flag: number };
    bare.flag = 1;
    assert.equal(deleteRuleFromArray([bare as unknown as Rule], 0), bare);

    // Unique-cause: parentRule T, parentStyleSheet F.
    const onlyRule = { parentRule: 1 as unknown };
    deleteRuleFromArray([onlyRule as unknown as Rule], 0);
    assert.equal(onlyRule.parentRule, null);
    assert.equal('parentStyleSheet' in onlyRule, false);

    // Unique-cause: parentRule F, parentStyleSheet T.
    const onlySheet = { parentStyleSheet: 1 as unknown };
    deleteRuleFromArray([onlySheet as unknown as Rule], 0);
    assert.equal(onlySheet.parentStyleSheet, null);
    assert.equal('parentRule' in onlySheet, false);

    // Unique-cause: both T (public CSSRule already covered; crafted both keys too).
    const both = { parentRule: 1 as unknown, parentStyleSheet: 2 as unknown };
    deleteRuleFromArray([both as unknown as Rule], 0);
    assert.equal(both.parentRule, null);
    assert.equal(both.parentStyleSheet, null);
  });
});

describe('MC/DC leftover unique-cause: angleFromVector (geometry-1 #dom-dommatrix-rotatefromvector)', { concurrency: false }, () => {
  test('x === 0 && y === 0 leftover unique-cause of y === 0 via rotateFromVector', () => {
    // Unique-cause of y === 0 requires x === 0 so the AND is evaluated.
    // Existing tests only had (0,0) and (10,10) (x F skips y).
    nearly(angleFromVector(0, 0), 0, 'zero vector');
    nearly(angleFromVector(0, 1), 90, 'x=0 y>0');
    nearly(angleFromVector(0, -1), -90, 'x=0 y<0');
    // Unique-cause of x === 0 with y === 0 T: (1,0) F vs (0,0) T.
    nearly(angleFromVector(1, 0), 0, 'x>0 y=0');
    nearly(angleFromVector(-1, 0), 180, 'x<0 y=0');
    nearly(angleFromVector(1, 1), 45, 'both nonzero');

    const id = new DOMMatrixReadOnly();
    const zz = id.rotateFromVector(0, 0);
    assert.equal(zz.is2D, true);
    nearly(zz.a, 1, 'zz a');
    nearly(zz.d, 1, 'zz d');
    const yp = id.rotateFromVector(0, 1);
    nearly(yp.a, 0, 'yp a');
    nearly(yp.b, 1, 'yp b');
    nearly(yp.c, -1, 'yp c');
    nearly(yp.d, 0, 'yp d');
    const xp = id.rotateFromVector(1, 0);
    nearly(xp.a, 1, 'xp a');
    nearly(xp.b, 0, 'xp b');

    const self = new DOMMatrix();
    const res = self.rotateFromVectorSelf(0, 1);
    assert.equal(res, self);
    nearly(self.a, 0, 'self a');
    nearly(self.b, 1, 'self b');

    nearly(degToRad(180), Math.PI, 'degToRad 180');
    nearly(radToDeg(Math.PI), 180, 'radToDeg PI');
    const rotated = new DOMMatrixReadOnly().rotate(90);
    nearly(rotated.a, 0, 'rotate 90 a');
    nearly(rotated.b, 1, 'rotate 90 b');
  });
});

describe('MC/DC leftover unique-cause: formatNumber (cssom-1 § 2.1 #serializing-css-values)', { concurrency: false }, () => {
  test('val === 0 / isFinite / Infinity / -0 format leftover unique-cause via serialize and CSSUnitValue', () => {
    // Unique-cause: val === 0 T (+0 and -0) vs F.
    assert.equal(formatNumber(0), '0');
    assert.equal(formatNumber(-0), '0');
    assert.equal(serialize([numberToken(0)]), '0');
    assert.equal(serialize([numberToken(-0)]), '0');
    assert.equal(new CSSUnitValue(0, 'px').toString(), '0px');
    assert.equal(new CSSUnitValue(-0, 'px').toString(), '0px');

    // Unique-cause: !Number.isFinite T vs F (only reached when val !== 0).
    // CSSUnitValue short-circuits Inf/NaN before formatNumber; serialize does not.
    assert.equal(formatNumber(Infinity), 'infinity');
    assert.equal(formatNumber(-Infinity), '-infinity');
    assert.equal(formatNumber(NaN), 'nan');
    assert.equal(serialize([numberToken(Infinity)]), 'infinity');
    assert.equal(serialize([numberToken(-Infinity)]), '-infinity');
    assert.equal(serialize([numberToken(NaN)]), 'nan');
    assert.equal(serialize([dimensionToken(Infinity, 'px')]), 'infinitypx');
    // Unique-cause of val === Infinity F then val === -Infinity F: NaN.
    assert.equal(serialize([percentageToken(NaN)]), 'nan%');

    // Unique-cause: formatted === '-0' T (tiny negative) vs F (tiny positive / ordinary).
    assert.equal(formatNumber(-1e-7), '0');
    assert.equal(formatNumber(1e-7), '0');
    assert.equal(formatNumber(-4e-7), '0');
    assert.equal(formatNumber(-5e-7), '-0.000001');
    assert.equal(formatNumber(1.23), '1.23');
    assert.equal(serialize([numberToken(-1e-7)]), '0');
    assert.equal(serialize([numberToken(1e-7)]), '0');
    assert.equal(serialize([percentageToken(-1e-7)]), '0%');
    assert.equal(serialize([dimensionToken(-1e-7, 'px')]), '0px');
    assert.equal(serialize([dimensionToken(1.2345678, 'px')]), '1.234568px');
    assert.equal(new CSSUnitValue(-1e-7, 'percent').toString(), '0%');
    assert.equal(new CSSUnitValue(1.2345678, 'px').toString(), '1.234568px');

    const sheet = parse('div { z-index: 0; opacity: 0.0000001; width: 1.23px; height: -0.0000001%; }');
    assert.equal(
      (sheet.cssRules[0] as CSSStyleRule).cssText,
      'div { z-index: 0; opacity: 0; width: 1.23px; height: 0%; }',
    );
  });
});
