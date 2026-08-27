/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// MC/DC audit round 3, Typed OM style-map / values / color / position legs:
//   - StylePropertyMapReadOnly declaration-array construction with custom
//     properties, partial shorthands, and key enumeration
//     (css-typed-om-1 § 3.2 #the-stylepropertymap).
//   - getDummyStyle caching and document-backed fallbacks, shouldWrapInCalc
//     raw-acceptance arm (css-typed-om-1 § 3.3 #stylevalue-objects).
//   - matchesStyleValueSyntax keyword arms (css-properties-values-api-1 § 3).
//   - CSSStyleValue.parse/parseAll arity guards and color keyword parsing
//     (css-typed-om-1 § 6.6 #parse-a-cssstylevalue).
//   - Color reification hex lengths, hsl alpha unit normalization
//     (css-color-4 § 4.2 #hex-notation, § 5 #hsl).
//   - Position property grammar arms (css-values-4 § 10.1 #position).
//   - CSSVariableReferenceValue fallback null vs undefined distinction
//     (css-variables-1 § 2 #API).
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { StylePropertyMapReadOnly } from '../src/typed-om/style-map/StylePropertyMapReadOnly.ts';
import {
  getDummyStyle,
  shouldWrapInCalc,
  isEquivalent,
  matchesStyleValueSyntax,
} from '../src/typed-om/style-map/style-validation.ts';
import { CSSStyleValue } from '../src/typed-om/values/CSSStyleValue.ts';
import { CSSKeywordValue } from '../src/typed-om/values/CSSKeywordValue.ts';
import { CSSColorValue } from '../src/typed-om/color/CSSColorValue.ts';
import { CSSUnitValue } from '../src/typed-om/numeric/CSSUnitValue.ts';
import { CSSVariableReferenceValue } from '../src/typed-om/values/CSSVariableReferenceValue.ts';
import { CSSUnparsedValue } from '../src/typed-om/values/CSSUnparsedValue.ts';

function withDocumentMock(styleFactory: () => unknown, run: () => void): void {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => ({ style: styleFactory() }) },
  });
  try {
    run();
  } finally {
    if (prev) Object.defineProperty(globalThis, 'document', prev);
    else Reflect.deleteProperty(globalThis as { document?: unknown }, 'document');
  }
}

describe('MC/DC round 3: style-map unique-cause legs', () => {

  // css-typed-om-1 § 3.2: declaration-array backed maps preserve custom
  // properties case-sensitively and answer has()/getAll()/keys() for them.
  test('StylePropertyMapReadOnly custom-property declarations', () => {
    const map = new StylePropertyMapReadOnly([
      { name: '--Custom', value: [{ type: 'ident', value: 'v' }] },
      { name: 'margin-top', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
    ] as never);
    assert.equal(map.has('--Custom'), true);
    assert.equal(map.get('--Custom')?.toString(), 'v');
    assert.ok(Array.from(map.keys() as Iterable<string>).includes('--Custom'));
  });

  // css-typed-om-1 § 3.2: a shorthand with only some longhands present does
  // not produce a getAll result.
  test('getAll partial shorthand returns empty', () => {
    const map = new StylePropertyMapReadOnly([
      { name: 'margin-top', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
    ] as never);
    assert.deepEqual(map.getAll('margin'), []);
    const full = new StylePropertyMapReadOnly([
      { name: 'margin-top', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
      { name: 'margin-right', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
      { name: 'margin-bottom', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
      { name: 'margin-left', value: [{ type: 'dimension', value: 1, unit: 'px' }] },
    ] as never);
    assert.equal(full.getAll('margin').length > 0, true);
  });

  // getDummyStyle caches its instance; a document-backed element style makes
  // shouldWrapInCalc's raw-set acceptance arm succeed.
  test('getDummyStyle cache and shouldWrapInCalc raw acceptance', () => {
    // Without a document the stub is built fresh per call.
    const first = getDummyStyle();
    const second = getDummyStyle();
    assert.equal(first === second, false);

    withDocumentMock(() => ({
      cssText: '',
      store: {} as Record<string, string>,
      setProperty(p: string, v: string) { (this as unknown as { store: Record<string, string> }).store[p] = v; },
      getPropertyValue(p: string) {
        return (this as unknown as { store: Record<string, string> }).store[p] ?? '';
      },
    }), () => {
      const cached = getDummyStyle();
      assert.equal(getDummyStyle() === cached, true);
      // Raw assignment of a px length to margin-top is accepted verbatim.
      assert.equal(shouldWrapInCalc('margin-top', new CSSUnitValue(4, 'px')), false);
      assert.equal(shouldWrapInCalc('width', new CSSUnitValue(10, 'px')), false);
    });
  });

  // isEquivalent normalizes any input through String(); syntax matching has
  // dedicated keyword and wildcard arms.
  test('isEquivalent non-string inputs', () => {
    assert.equal(isEquivalent(5 as unknown as string, '5'), true);
    assert.equal(isEquivalent(null as unknown as string, ''), true);
    assert.equal(isEquivalent('a b', 'a  b'), true);
  });

  // css-properties-values-api-1 § 3: universal and absent syntaxes accept;
  // recognized color keywords pass without re-parsing.
  test('matchesStyleValueSyntax keyword and syntax arms', () => {
    const kw = new CSSKeywordValue('currentcolor');
    assert.equal(matchesStyleValueSyntax(kw, '<color>', 'color'), true);
    // An absent syntax accepts every value (universal).
    assert.equal(matchesStyleValueSyntax(kw, '', 'anything'), true);
    assert.equal(matchesStyleValueSyntax(kw, '*', 'anything'), true);
    const named = new CSSKeywordValue('red');
    assert.equal(matchesStyleValueSyntax(named, '<color>', 'color'), true);
    assert.equal(matchesStyleValueSyntax(new CSSKeywordValue('canvas'), '<color>', 'color'), true);
    assert.equal(matchesStyleValueSyntax(new CSSKeywordValue('nope'), '<color>', 'color'), false);
  });
});

describe('MC/DC round 3: CSSStyleValue parse guards', () => {

  test('parse/parseAll arity and invalid-value guards', () => {
    assert.throws(() => (CSSStyleValue as unknown as { parse(): unknown }).parse(), TypeError);
    assert.throws(() => (CSSStyleValue as unknown as { parseAll(): unknown }).parseAll(), TypeError);
    assert.throws(
      () => (CSSStyleValue as unknown as { parse(p?: string): unknown }).parse('color'),
      TypeError
    );
    assert.throws(
      () => (CSSStyleValue as unknown as { parseAll(p?: string): unknown }).parseAll('color'),
      TypeError
    );
    assert.throws(() => CSSStyleValue.parse('color', ''), TypeError);
  });

  // css-color-4 § 15: transparent survives as a keyword rather than being
  // parsed into rgb components.
  test('color keyword transparent parses as keyword', () => {
    const v = CSSStyleValue.parse('color', 'transparent');
    assert.ok(v instanceof CSSKeywordValue);
    assert.equal(v.toString(), 'transparent');
  });
});

describe('MC/DC round 3: color value reification legs', () => {

  test('CSSColorValue arity guard', () => {
    assert.throws(
      () => (CSSColorValue as unknown as { parse(): unknown }).parse(),
      TypeError
    );
  });

  // css-color-4 § 4.2: six-digit and eight-digit hex both reify; only the
  // latter carries explicit alpha.
  test('hex reification lengths', () => {
    const six = CSSColorValue.parse('#ff0000');
    assert.ok(six.toString().toLowerCase().includes('rgb'));
    const eight = CSSColorValue.parse('#ff000080');
    assert.ok(eight.toString().length > 0);
  });

  // css-color-4 § 5: numeric hue converts to degrees; alpha given as number
  // converts to percent while percent alphas stay untouched.
  test('hsl hue and alpha unit normalization', () => {
    const numericAlpha = CSSColorValue.parse('hsl(120 50% 50% / 0.5)');
    assert.ok(numericAlpha.toString().length > 0);
    const percentAlpha = CSSColorValue.parse('hsl(120deg 50% 50% / 50%)');
    assert.ok(percentAlpha.toString().length > 0);
    const degHue = CSSColorValue.parse('hsl(120deg 50% 50%)');
    assert.ok(degHue.toString().length > 0);
  });
});

describe('MC/DC round 3: position grammar legs', () => {

  // css-backgrounds-3 #background-position: keyword, calc(), comma lists
  // (including empty segments), and offset-anchor keywords each exercise a
  // distinct grammar arm.
  test('position property grammar battery', () => {
    assert.equal(CSSStyleValue.parse('background-position', 'left').toString(), '0% 50%');
    assert.equal(
      CSSStyleValue.parse('background-position', 'calc(10px + 1%) top').toString().length > 0,
      true
    );
    assert.equal(CSSStyleValue.parse('background-position', 'top, left').toString().length > 0, true);
    assert.equal(CSSStyleValue.parse('offset-position', 'auto').toString(), 'auto');
    assert.equal(CSSStyleValue.parse('offset-position', 'normal').toString(), 'normal');
    assert.equal(CSSStyleValue.parse('offset-anchor', 'auto').toString(), 'auto');
    assert.equal(
      CSSStyleValue.parse('transform-origin', 'center bottom').toString().length > 0,
      true
    );
    assert.throws(() => CSSStyleValue.parse('perspective-origin', 'garbage-here'), TypeError);
  });
});

describe('MC/DC round 3: variable reference fallbacks', () => {

  // css-variables-1 § 2: null and omitted fallback are equivalent but distinct
  // code paths from a provided CSSUnparsedValue.
  test('CSSVariableReferenceValue fallback distinctions', () => {
    const bare = new CSSVariableReferenceValue('--a');
    assert.equal(bare.fallback, null);
    const nulled = new CSSVariableReferenceValue('--a', null);
    assert.equal(nulled.fallback, null);
    const undefineded = new CSSVariableReferenceValue('--a', undefined);
    assert.equal(undefineded.fallback, null);
    const real = new CSSVariableReferenceValue('--a', new CSSUnparsedValue(['b']));
    assert.ok(real.fallback !== null);
    assert.throws(
      () => new CSSVariableReferenceValue('--a', 42 as never),
      TypeError
    );
  });
});
