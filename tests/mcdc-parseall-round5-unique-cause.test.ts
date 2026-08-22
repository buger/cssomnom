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
// Verifies: SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3, SW-REQ-260821-7AKJ, SW-REQ-260821-E5D5, INT-REQ-260821-9SGA
// Round-5 unique-cause leftovers for src/typed-om/values/style-value-parser.ts
// _parseAll (~L159), createValueFromTokens (~L105), and ParseHooks.validatePropertyValue
// (L447) after tests/mcdc-hotspot-parse-all.test.ts,
// tests/mcdc-hotspot-parse-all-more.test.ts, tests/mcdc-parseall-unique-cause.test.ts,
// tests/mcdc-parseall-still-hot-unique-cause.test.ts, and
// tests/mcdc-parseall-remaining-unique-cause.test.ts.
// Drive CSSStyleValue.parse / parseAll (and CSSStyleDeclaration.setProperty for L447,
// the only caller of validatePropertyValue). No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSUnitValue,
  CSSPositionValue,
  CSSColorValue,
  CSS,
} from '../src/typed-om.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { LIST_PROPERTIES, COLOR_PROPERTIES } from '../src/typed-om/style-map/style-validation.ts';
import { SUPPORTED_PROPERTIES } from '../src/data/gen/property-list.ts';
import { STANDARD_PROPERTIES_SYNTAX } from '../src/data/gen/standard-syntax.ts';
import type { ComponentValue, FunctionToken } from '../src/types.ts';

function parseAll(property: string, css: string): CSSStyleValue[] {
  return CSSStyleValue.parseAll(property, css);
}

const MIXED_LIST = '-Webkit-Box-Align';
const COLOR_UC = 'mcdc-parseall5-color';
const COLOR_NOSYN = 'mcdc-parseall5-nosyntax';
const NN_PROP = 'mcdc-parseall5-nn';
const CUSTOM_LEN = '--mcdc-parseall5-len';
const CUSTOM_STAR = '--mcdc-parseall5-star';

const origParseComponentValues = ParseHooks.parseComponentValues;

function withComponentValues(values: ComponentValue[], fn: () => void): void {
  const original = ParseHooks.parseComponentValues;
  ParseHooks.parseComponentValues = () => values;
  try {
    fn();
  } finally {
    ParseHooks.parseComponentValues = original;
  }
}

function restoreTables(): void {
  LIST_PROPERTIES.delete(MIXED_LIST);
  LIST_PROPERTIES.delete(CUSTOM_LEN);
  LIST_PROPERTIES.delete(CUSTOM_STAR);
  COLOR_PROPERTIES.delete(COLOR_UC);
  COLOR_PROPERTIES.delete(COLOR_NOSYN);
  SUPPORTED_PROPERTIES.delete(COLOR_UC);
  SUPPORTED_PROPERTIES.delete(COLOR_NOSYN);
  SUPPORTED_PROPERTIES.delete(NN_PROP);
  delete STANDARD_PROPERTIES_SYNTAX[COLOR_UC];
  delete STANDARD_PROPERTIES_SYNTAX[NN_PROP];
  ParseHooks.parseComponentValues = origParseComponentValues;
}

describe('MC/DC round5 unique-cause: CSSStyleValue.parseAll / _parseAll', { concurrency: false }, () => {
  afterEach(() => {
    restoreTables();
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue
  test('property-name OR: -- vs - vs --x vs color; length<3 independent is unpairable', () => {
    // Unique-cause: property === '--' T (parseAllStyleValues L141; _parseAll L159 is
    // the same check and never runs after that throw).
    assert.throws(() => parseAll('--', 'auto'), TypeError);
    // Unique-cause: === '--' F, startsWith('--') F (`-` / `-x` / `color`).
    assert.throws(() => parseAll('-', 'auto'), TypeError);
    assert.throws(() => parseAll('-x', 'auto'), TypeError);
    const color = parseAll('color', 'red');
    assert.ok(color[0] instanceof CSSKeywordValue);
    // Unique-cause: startsWith('--') T && length < 3 F (`--x` len 3, `---` len 3).
    // Independent length<3 with startsWith T and === '--' F is structurally
    // impossible (only `'--'` has len<3 and starts with `'--'`).
    const custom = parseAll('--x', 'hello');
    assert.ok(custom[0] instanceof CSSUnparsedValue);
    const triple = parseAll('---', 'hello');
    assert.ok(triple[0] instanceof CSSUnparsedValue);
  });

  // css-typed-om-1 § 6.6 #parse-a-cssstylevalue
  test('L324 isListProperty T no-comma vs F with/without comma; T,T mute behind L259', () => {
    // Unique-cause: isListProperty T && some(comma) F → else matchesSyntax on the whole value.
    const one = parseAll('transition-duration', '1s');
    assert.equal(one.length, 1);
    assert.ok(one[0] instanceof CSSUnitValue);
    assert.throws(() => parseAll('transition-duration', 'red'), TypeError);
    assert.ok(parseAll('animation-name', 'spin')[0] instanceof CSSKeywordValue);
    assert.throws(() => parseAll('animation-name', '1s'), TypeError);

    // Unique-cause: isListProperty F. Non-list with and without a top-level comma
    // both take the else syntax check (L259 does not split).
    const width = parseAll('width', '10px');
    assert.ok(width[0] instanceof CSSUnitValue);
    assert.throws(() => parseAll('quotes', '"a", "b"'), TypeError);
    assert.throws(() => parseAll('mask-image', 'none, url(x)'), TypeError);
    assert.throws(() => parseAll('content', '"a", "b"'), TypeError);

    // T,T (list + comma) returns at L259 before L324, so L327/L335 stay mute.
    const listed = parseAll('transition-duration', '1s, 2s');
    assert.equal(listed.length, 2);
  });

  // css-typed-om-1 § 3.6 #colorvalue-objects
  test('L347 color ident-AND: length=1 ident vs length=1 non-ident vs length≠1', () => {
    COLOR_PROPERTIES.add(COLOR_UC);
    COLOR_PROPERTIES.add(COLOR_NOSYN);
    SUPPORTED_PROPERTIES.add(COLOR_UC);
    SUPPORTED_PROPERTIES.add(COLOR_NOSYN);
    STANDARD_PROPERTIES_SYNTAX[COLOR_UC] = '<color> | leftover-kw';

    // Unique-cause: trimmed.length === 1 T && type === ident T.
    const ident = parseAll(COLOR_UC, 'leftover-kw');
    assert.ok(ident[0] instanceof CSSKeywordValue);
    assert.equal((ident[0] as CSSKeywordValue).value, 'leftover-kw');
    assert.ok(parseAll(COLOR_UC, 'red')[0] instanceof CSSKeywordValue);
    // `transparent` is also in NAMED_COLORS, so kw === 'transparent' cannot unique-cause
    // independently of `kw in NAMED_COLORS` (left mute; no NAMED_COLORS delete).
    assert.ok(parseAll(COLOR_UC, 'transparent')[0] instanceof CSSKeywordValue);

    // Unique-cause: length === 1 T && type === ident F (hash / function / number).
    const hex = parseAll(COLOR_UC, '#00ff00');
    assert.equal(hex.length, 1);
    assert.ok(hex[0] instanceof CSSColorValue || hex[0] instanceof CSSStyleValue);
    assert.throws(() => parseAll(COLOR_UC, '1'), TypeError);
    const rgb = parseAll(COLOR_UC, 'rgb(0, 0, 0)');
    assert.equal(rgb.length, 1);

    // Unique-cause: length === 1 F with an ident present. Generated `<color>` fails
    // syntax before L347; no-syntax throwaway reaches L347 then CSSColorValue.parse.
    assert.throws(() => parseAll(COLOR_UC, 'red extra'), TypeError);
    assert.throws(() => parseAll(COLOR_NOSYN, 'red extra'), TypeError);
    assert.ok(parseAll(COLOR_NOSYN, 'red')[0] instanceof CSSKeywordValue);
    assert.ok(CSSStyleValue.parse(COLOR_NOSYN, 'red') instanceof CSSKeywordValue);
  });

  // css-typed-om-1 § 3.3 #positionvalue-objects
  test('L373 position-keyword AND: non-position T vs ordinary ident; position T mute', () => {
    // Unique-cause: isPositionProperty F && isPositionKeyword T.
    const flt = parseAll('float', 'left');
    assert.ok(flt[0] instanceof CSSKeywordValue);
    assert.equal((flt[0] as CSSKeywordValue).value, 'left');
    assert.ok(parseAll('justify-content', 'left')[0] instanceof CSSKeywordValue);

    // Unique-cause: isPositionProperty F && isPositionKeyword F.
    const display = parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    assert.equal((display[0] as CSSKeywordValue).value, 'block');

    // isPositionProperty T returns at L204, so L373 never sees T. Mute.
    const pos = parseAll('object-position', 'left');
    assert.ok(pos[0] instanceof CSSPositionValue);
  });

  // css-values-4 § 10 #math / css-variables-1 #using-variables
  test('L379 fn.name === var F via calc/min; var T mute behind L193/L282', () => {
    // Unique-cause: trimmed.length === 1 && type function, name.toLowerCase() === 'var' F.
    const calc = parseAll('width', 'calc(10px + 2px)');
    assert.equal(calc.length, 1);
    assert.ok(calc[0].toString().includes('12px') || calc[0].toString().includes('calc'));
    const min = parseAll('width', 'min(1px, 2px)');
    assert.ok(min[0].toString().includes('min('));
    assert.ok(CSSStyleValue.parse('width', 'calc(1px + 1px)'));

    // var() returns at L193 (CSSFunction) or L282 (FunctionToken), never L379.
    const unparsed = parseAll('width', 'var(--x)');
    assert.ok(unparsed[0] instanceof CSSUnparsedValue);
    assert.throws(() => parseAll('width', 'env(safe-area-inset-top)'), TypeError);
  });

  // css-syntax-3 § 5.4.8 #parse-a-list-of-component-values
  test('L386-L400 mixed-case LIST: comma T/F, empty current, createValueFromTokens empty', () => {
    // L259 splits on LIST_PROPERTIES.has(propLower). Adding only the mixed-case key
    // unique-causes the late splitter (L386 uses the original `property` string).
    LIST_PROPERTIES.add(MIXED_LIST);

    // Unique-cause: v.type === 'comma' T vs F (L391).
    const both = parseAll(MIXED_LIST, 'center, start');
    assert.equal(both.length, 2);
    assert.ok(both[0] instanceof CSSKeywordValue);
    assert.ok(both[1] instanceof CSSKeywordValue);
    assert.equal((both[0] as CSSKeywordValue).value, 'center');
    assert.equal((both[1] as CSSKeywordValue).value, 'start');
    const first = CSSStyleValue.parse(MIXED_LIST, 'center, start');
    assert.ok(first instanceof CSSKeywordValue);

    const one = parseAll(MIXED_LIST, 'center');
    assert.equal(one.length, 1);
    assert.ok(one[0] instanceof CSSKeywordValue);

    // Unique-cause: L400 current.length > 0 F (trailing comma drains current).
    const trailing = parseAll(MIXED_LIST, 'center,');
    assert.equal(trailing.length, 1);
    assert.equal((trailing[0] as CSSKeywordValue).value, 'center');

    // Unique-cause: L392 current.length > 0 F (leading / doubled comma).
    const leading = parseAll(MIXED_LIST, ',start');
    assert.equal(leading.length, 1);
    assert.equal((leading[0] as CSSKeywordValue).value, 'start');
    const doubled = parseAll(MIXED_LIST, 'center,,start');
    assert.equal(doubled.length, 2);

    // Unique-cause: createValueFromTokens start > end T (whitespace-only / comment-only segment).
    assert.throws(() => parseAll(MIXED_LIST, 'center,   ,start'), TypeError);
    assert.throws(() => parseAll(MIXED_LIST, 'center, /* x */, start'), TypeError);
    assert.throws(() => parseAll(MIXED_LIST, '/* a */, /* b */'), TypeError);

    // All-comma: L386 pushes nothing → parseAllStyleValues results.length === 0.
    assert.throws(() => parseAll(MIXED_LIST, ','), TypeError);

    LIST_PROPERTIES.delete(MIXED_LIST);
  });

  test('L276 css-wide includes F; L281 value-in F via nameless function token', () => {
    // Unique-cause: L276 .includes(...) F (css-wide already returned at L180 when T).
    const display = parseAll('display', 'block');
    assert.ok(display[0] instanceof CSSKeywordValue);
    const inherit = parseAll('display', 'inherit');
    assert.ok(inherit[0] instanceof CSSKeywordValue);

    // Unique-cause: `'name' in` F && `'value' in` F. Tokenizer FunctionToken always
    // has `value`; stub a typeless function so the nested ternary takes the '' arm.
    // `display` then fails matchesSyntax (does not reach L379).
    const nameless = { type: 'function' } as FunctionToken;
    withComponentValues([nameless], () => {
      assert.throws(() => parseAll('display', 'block'), TypeError);
    });

    // `'name' in` T skips the `'value' in` arm (calc CSSFunction from the real parser).
    const calc = parseAll('width', 'calc(1px + 2px)');
    assert.equal(calc.length, 1);
  });

  test('shorthand / SHORTHANDS_DATA / syntax !hasVarFunction T; var present returns at L193', () => {
    // Unique-cause: shorthand T && !hasVarFunction T (L302).
    const margin = parseAll('margin', '1px');
    assert.equal(margin[0].constructor, CSSStyleValue);
    // Unique-cause: shorthand F (width is not in SHORTHANDS[]).
    assert.ok(parseAll('width', '10px')[0] instanceof CSSUnitValue);

    // Unique-cause: SHORTHANDS_DATA T && !hasVarFunction T (L312), LOGICAL_2VAL F.
    const gap = parseAll('gap', '10px');
    assert.equal(gap[0].constructor, CSSStyleValue);

    // Unique-cause: syntax T && !hasVarFunction T (L322).
    assert.ok(parseAll('z-index', '1')[0] instanceof CSSUnitValue);
    // Unique-cause: syntax F (`-webkit-box-*` are supported but have no generated syntax).
    assert.ok(parseAll('-webkit-box-align', 'center')[0] instanceof CSSKeywordValue);

    // !hasVarFunction F is unreachable at L302/L312/L322: hasVarFunction returns at L193.
    assert.ok(parseAll('margin', 'var(--m)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('gap', 'var(--g)')[0] instanceof CSSUnparsedValue);
    assert.ok(parseAll('width', 'var(--w)')[0] instanceof CSSUnparsedValue);
  });

  // css-typed-om-1 § 3.4 #unparsedvalue-objects / css-properties-values-api-1
  test('createValueFromTokens: registered custom list, star syntax, string vs dimension', () => {
    CSS.registerProperty({
      name: CUSTOM_LEN,
      syntax: '<length>',
      inherits: false,
      initialValue: '0px',
    });
    CSS.registerProperty({
      name: CUSTOM_STAR,
      syntax: '*',
      inherits: false,
      initialValue: 'x',
    });

    // Unique-cause: property.startsWith('--') T, def T, syntax === '*' F, then
    // trimmed.length === 1 T → CSSUnitValue. LIST membership reaches createValueFromTokens
    // via L259 (unregistered customs return at L197 and never get here).
    LIST_PROPERTIES.add(CUSTOM_LEN);
    const lens = parseAll(CUSTOM_LEN, '1px, 2px');
    assert.equal(lens.length, 2);
    assert.ok(lens[0] instanceof CSSUnitValue);
    assert.ok(lens[1] instanceof CSSUnitValue);
    assert.equal((lens[0] as CSSUnitValue).value, 1);
    LIST_PROPERTIES.delete(CUSTOM_LEN);
    // Without LIST, commas fail `<length>` syntax as one value.
    assert.throws(() => parseAll(CUSTOM_LEN, '1px, 2px'), TypeError);
    assert.ok(parseAll(CUSTOM_LEN, '1px')[0] instanceof CSSUnitValue);

    // Unique-cause: def.syntax === '*' T → CSSUnparsedValue inside createValueFromTokens.
    const star = parseAll(CUSTOM_STAR, 'foo bar');
    assert.ok(star[0] instanceof CSSUnparsedValue);
    LIST_PROPERTIES.add(CUSTOM_STAR);
    const starList = parseAll(CUSTOM_STAR, 'foo, bar');
    assert.equal(starList.length, 2);
    assert.ok(starList.every((v) => v instanceof CSSUnparsedValue));
    LIST_PROPERTIES.delete(CUSTOM_STAR);

    // Unique-cause: createCSSStyleValue sv F (string token) vs T (ident / dimension).
    const quoted = parseAll('animation-name', '"spin"');
    assert.equal(quoted[0].constructor, CSSStyleValue);
    const family = parseAll('font-family', '"Courier New", serif');
    assert.equal(family.length, 2);
    assert.equal(family[0].constructor, CSSStyleValue);
    assert.ok(family[1] instanceof CSSKeywordValue);

    // Unique-cause: trimmed.length === 1 F (multi-token list segment).
    const shadows = parseAll('box-shadow', '1px 2px red, 3px 4px blue');
    assert.equal(shadows.length, 2);
    assert.equal(shadows[0].constructor, CSSStyleValue);

    // Leading/trailing whitespace and comments on a list segment (while start/end walks).
    const times = parseAll('transition-duration', ' 1s , /*c*/ 2s ');
    assert.equal(times.length, 2);
    assert.ok(times[0] instanceof CSSUnitValue);
    assert.ok(times[1] instanceof CSSUnitValue);
  });

  // cssom-1 § 6.7.1 #set-a-css-declaration — ParseHooks.validatePropertyValue L447
  test('L447 negative dimension AND and range-syntax OR via setProperty', () => {
    SUPPORTED_PROPERTIES.add(NN_PROP);
    const decl = new CSSStyleDeclaration();

    // Unique-cause: tokens.length === 1 T, type === dimension T, value < 0 T, range OR all-F
    // (generated syntax has no `[0,∞]` / `[0,` / `[0.0,`) → accept.
    assert.equal(ParseHooks.validatePropertyValue('width', '-10px'), true);
    decl.setProperty('width', '-10px');
    assert.equal(decl.getPropertyValue('width'), '-10px');
    // parseAll does not call validatePropertyValue; negative lengths still reify.
    const parsed = parseAll('width', '-10px');
    assert.ok(parsed[0] instanceof CSSUnitValue);
    assert.equal((parsed[0] as CSSUnitValue).value, -10);

    // Unique-cause: value < 0 F (`10px` / `0px`).
    assert.equal(ParseHooks.validatePropertyValue('width', '10px'), true);
    assert.equal(ParseHooks.validatePropertyValue('width', '0px'), true);
    // Unique-cause: type === dimension F (number / percentage / ident).
    assert.equal(ParseHooks.validatePropertyValue('width', '-10'), false);
    assert.equal(ParseHooks.validatePropertyValue('width', '-10%'), true);
    assert.equal(ParseHooks.validatePropertyValue('width', 'auto'), true);
    // Unique-cause: tokens.length === 1 F.
    assert.equal(ParseHooks.validatePropertyValue('width', '-10px 1px'), true);
    // value !== undefined F is mute: tokenizer always sets dimension.value.

    // Range-syntax OR. `[0,∞]` includes `[0,` as a substring, so `[0,∞]` cannot
    // unique-cause independently of `[0,`. Pair `[0,1]` and `[0.0,1]` instead.
    STANDARD_PROPERTIES_SYNTAX[NN_PROP] = '<length> [0,1]';
    assert.equal(ParseHooks.validatePropertyValue(NN_PROP, '-10px'), false);
    assert.equal(ParseHooks.validatePropertyValue(NN_PROP, '10px'), true);
    decl.setProperty(NN_PROP, '10px');
    decl.setProperty(NN_PROP, '-10px');
    assert.equal(decl.getPropertyValue(NN_PROP), '10px');

    STANDARD_PROPERTIES_SYNTAX[NN_PROP] = '<length> [0.0,1]';
    assert.equal(ParseHooks.validatePropertyValue(NN_PROP, '-1px'), false);
    assert.equal(ParseHooks.validatePropertyValue(NN_PROP, '1px'), true);

    STANDARD_PROPERTIES_SYNTAX[NN_PROP] = '<length> [0,∞]';
    assert.equal(ParseHooks.validatePropertyValue(NN_PROP, '-10px'), false);
    decl.setProperty(NN_PROP, '20px');
    decl.setProperty(NN_PROP, '-5px');
    assert.equal(decl.getPropertyValue(NN_PROP), '20px');

    delete STANDARD_PROPERTIES_SYNTAX[NN_PROP];
    SUPPORTED_PROPERTIES.delete(NN_PROP);
  });
});
