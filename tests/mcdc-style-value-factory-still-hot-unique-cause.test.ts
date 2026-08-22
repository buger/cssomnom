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
// Still-hot unique-cause leftovers for src/typed-om/values/style-value-factory.ts
// createCSSStyleValue (12/19 dec, 17/32 cond, 7 incomplete) after
// tests/mcdc-hotspot-typed-om-more.test.ts. Hottest leftovers: L56 OR-chain
// and L84 trailing fallback while. Drive shipped createCSSStyleValue plus
// CSSStyleValue.parse / parseAll on custom properties and var() fallbacks.
// css-typed-om-1 § 3.4 #unparsedvalue-objects / #variable-reference-value-objects,
// § 6.6 #parse-a-cssstylevalue, css-variables-1 § 3 #using-variables,
// css-syntax-3 § 4.3.2 #consume-comments / § 5.5.10 #consume-function.
// Tokenizer discards comments, so comment unique-cause uses constructed
// ComponentValues into the shipped factory. No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSS,
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSUnitValue,
  CSSMathSum,
  CSSMathMin,
  CSSMathMax,
  CSSMathClamp,
  CSSImageValue,
  createCSSStyleValue,
} from '../src/typed-om.ts';
import { CSSURLImageValue, CSSGradientImageValue } from '../src/typed-om/values/CSSImageValue.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { STANDARD_PROPERTIES_SYNTAX } from '../src/data/gen/standard-syntax.ts';
import type {
  ComponentValue,
  CSSFunction,
  CommentToken,
  DimensionToken,
  IdentToken,
  NumberToken,
  SimpleBlock,
  SimpleToken,
} from '../src/types.ts';

function first(css: string): ComponentValue {
  const values = ParseHooks.parseComponentValues(tokenize(css)).filter(
    (t) => t.type !== 'whitespace' && t.type !== 'EOF',
  );
  assert.ok(values.length >= 1, `expected a component value for ${JSON.stringify(css)}`);
  return values[0];
}

function factory(css: string, property?: string): CSSStyleValue | null {
  return createCSSStyleValue(first(css), property);
}

function asUnparsed(v: CSSStyleValue | null, label: string): CSSUnparsedValue {
  assert.ok(v instanceof CSSUnparsedValue, `${label}: expected CSSUnparsedValue`);
  return v;
}

function asStringSeg(v: CSSStyleValue | null, label: string): string {
  const u = asUnparsed(v, label);
  assert.equal(typeof u[0], 'string', `${label}: expected serialized invalid var()`);
  return u[0] as string;
}

function asRef(v: CSSStyleValue | null, label: string): CSSVariableReferenceValue {
  const u = asUnparsed(v, label);
  assert.ok(u[0] instanceof CSSVariableReferenceValue, `${label}: expected CSSVariableReferenceValue`);
  return u[0];
}

function ident(value: string): IdentToken {
  return { type: 'ident', value };
}

function ws(): SimpleToken {
  return { type: 'whitespace', value: ' ' };
}

function comment(value = '/*c*/'): CommentToken {
  return { type: 'comment', value };
}

function comma(): SimpleToken {
  return { type: 'comma', value: ',' };
}

function dim(value = 1, unit = 'px'): DimensionToken {
  return { type: 'dimension', value, unit, numberType: 'integer', sign: null };
}

function varFn(value: ComponentValue[], name = 'var'): CSSFunction {
  return { type: 'function', name, value };
}

const injected: string[] = [];
function injectSyntax(name: string, syntax: string): void {
  STANDARD_PROPERTIES_SYNTAX[name] = syntax;
  injected.push(name);
}

afterEach(() => {
  for (const name of injected) {
    delete STANDARD_PROPERTIES_SYNTAX[name];
  }
  injected.length = 0;
});

describe('MC/DC still-hot unique-cause: createCSSStyleValue var() L56 OR (css-variables-1 § 3 #using-variables)', { concurrency: false }, () => {
  test('args.length === 0 / type !== ident / !startsWith -- / ident === -- / valid --x', () => {
    // Unique-cause C1 T: args.length === 0 (empty / whitespace / comments filtered).
    assert.equal(asStringSeg(factory('var()'), 'var()'), 'var()');
    assert.equal(asStringSeg(factory('var( )'), 'var( )'), 'var( )');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([])), 'constructed empty'), 'var()');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([ws()])), 'ws-only'), 'var( )');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([comment()])), 'comment-only'), 'var(/*c*/)');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([ws(), comment(), ws()])), 'ws+comment'), 'var( /*c*/ )');

    // Public parse / parseAll on custom properties take tokensToUnparsedSegments
    // (hasVarFunction short-circuits _parseAll) but still observe the same invalid
    // empty var() as a string segment, not CSSVariableReferenceValue.
    const parsedEmpty = CSSStyleValue.parse('--mcdc-fac1-empty', 'var()');
    assert.equal(asStringSeg(parsedEmpty, 'parse custom var()'), 'var()');
    const allEmpty = CSSStyleValue.parseAll('--mcdc-fac1-empty', 'var( )');
    assert.equal(allEmpty.length, 1);
    assert.equal(asStringSeg(allEmpty[0], 'parseAll custom var( )'), 'var( )');

    // Unique-cause C2 T: length>0, args[0].type !== 'ident'.
    assert.equal(asStringSeg(factory('var(1px)'), 'number'), 'var(1px)');
    assert.equal(asStringSeg(factory('var("foo")'), 'string'), 'var("foo")');
    assert.equal(asStringSeg(factory('var(#fff)'), 'hash'), 'var(#fff)');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([comma(), ident('--x')])), 'leading comma'), 'var(,--x)');

    // Unique-cause C3 T: ident that does not start with --.
    assert.equal(asStringSeg(factory('var(foo)'), 'foo'), 'var(foo)');
    assert.equal(asStringSeg(factory('var(-x)'), '-x'), 'var(-x)');
    assert.equal(asStringSeg(CSSStyleValue.parse('color', 'var(foo)'), 'parse color var(foo)'), 'var(foo)');

    // Unique-cause C4 T: ident is exactly '--' (invalid custom).
    assert.equal(asStringSeg(factory('var(--)'), '--'), 'var(--)');
    assert.equal(asStringSeg(CSSStyleValue.parse('--mcdc-fac1-dash', 'var(--)'), 'parse custom var(--)'), 'var(--)');

    // All F: ident `--x` is a valid dashed-ident → CSSVariableReferenceValue.
    const ok = asRef(factory('var(--x)'), 'var(--x)');
    assert.equal(ok.variable, '--x');
    assert.equal(ok.fallback, null);
    const parsedOk = asRef(CSSStyleValue.parse('--mcdc-fac1-ok', 'var(--x)'), 'parse custom var(--x)');
    assert.equal(parsedOk.variable, '--x');
    assert.equal(parsedOk.fallback, null);
    const upper = asRef(createCSSStyleValue(varFn([ident('--x')], 'VAR')), 'VAR(--x)');
    assert.equal(upper.variable, '--x');
  });

  test('args.length > 1 && args[1].type !== comma unique-cause', () => {
    // Unique-cause AND T T: length>1 and second token is not a comma.
    assert.equal(asStringSeg(factory('var(--x 1px)'), 'missing comma'), 'var(--x 1px)');
    assert.equal(asStringSeg(createCSSStyleValue(varFn([ident('--x'), ident('red')])), 'ident fallback'), 'var(--x/**/red)');
    assert.equal(
      asStringSeg(CSSStyleValue.parse('color', 'var(--x 1px)'), 'parse color missing comma'),
      'var(--x 1px)',
    );

    // Unique-cause AND T F: length>1 and second is comma → valid fallback.
    const withFb = asRef(factory('var(--x, 1px)'), 'comma fallback');
    assert.equal(withFb.variable, '--x');
    assert.ok(withFb.fallback instanceof CSSUnparsedValue);
    assert.equal(withFb.fallback.toString(), '1px');

    // Unique-cause AND F (length === 1): second conjunct is not evaluated.
    const noFb = asRef(factory('var(--x)'), 'length 1');
    assert.equal(noFb.fallback, null);
  });
});

describe('MC/DC still-hot unique-cause: createCSSStyleValue var() fallback while (css-typed-om-1 § 3.4)', { concurrency: false }, () => {
  test('commaIdx search and commaIdx !== -1 T vs F', () => {
    // Unique-cause: type === 'comma' F for ident/ws/comment, then T and break.
    const afterComment = asRef(
      createCSSStyleValue(varFn([ident('--x'), comment(), comma(), dim()])),
      'comma after comment',
    );
    assert.ok(afterComment.fallback instanceof CSSUnparsedValue);
    assert.equal(afterComment.fallback.toString(), '1px');

    const afterWs = asRef(factory('var(--x , 1px)'), 'comma after ws');
    assert.equal(afterWs.fallback?.toString(), '1px');

    // Unique-cause: commaIdx !== -1 F (no comma in fn.value).
    const none = asRef(createCSSStyleValue(varFn([ws(), ident('--x'), comment()])), 'no comma');
    assert.equal(none.fallback, null);

    // Unique-cause: commaIdx !== -1 T with empty remainder (end >= start F).
    const emptyFb = asRef(factory('var(--x,)'), 'empty fallback');
    assert.ok(emptyFb.fallback instanceof CSSUnparsedValue);
    assert.equal(emptyFb.fallback.length, 0);
    assert.equal(emptyFb.fallback.toString(), '');
    const wsFb = asRef(factory('var(--x,   )'), 'ws-only fallback');
    assert.equal(wsFb.fallback?.length, 0);

    // First comma wins when the fallback itself contains commas.
    const multi = asRef(factory('var(--x, 1px, 2px)'), 'two commas');
    assert.equal(multi.fallback?.toString(), '1px, 2px');
  });

  test('L80 start-while unique-cause of length / whitespace / comment / neither', () => {
    // Unique-cause: start < fallbackTokens.length F (empty remainder).
    const empty = asRef(createCSSStyleValue(varFn([ident('--x'), comma()])), 'empty start');
    assert.equal(empty.fallback?.length, 0);

    // Unique-cause: whitespace T, comment F — leading spaces skipped.
    const leadWs = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), ws(), ws(), dim()])), 'lead ws');
    assert.equal(leadWs.fallback?.toString(), '1px');

    // Unique-cause: whitespace F, comment T — leading comments skipped.
    // css-syntax-3 § 4.3.2 discards comments, so this row is constructed.
    const leadC = asRef(
      createCSSStyleValue(varFn([ident('--x'), comma(), comment(), comment(), dim()])),
      'lead comment',
    );
    assert.equal(leadC.fallback?.toString(), '1px');
    assert.equal(leadC.fallback?.toString().includes('/*c*/'), false);

    // Unique-cause: neither — first fallback token is the value (stop).
    const neither = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), dim()])), 'no lead skip');
    assert.equal(neither.fallback?.toString(), '1px');

    // Mixed leading skip then stop.
    const mixed = asRef(
      createCSSStyleValue(varFn([ident('--x'), comma(), ws(), comment(), dim()])),
      'lead ws then comment',
    );
    assert.equal(mixed.fallback?.toString(), '1px');
  });

  test('L84 end-while unique-cause of end >= start / whitespace / comment / neither', () => {
    // Unique-cause: end >= start F (empty, and all-ws / all-comment after start skip).
    const empty = asRef(createCSSStyleValue(varFn([ident('--x'), comma()])), 'empty end');
    assert.equal(empty.fallback?.length, 0);
    const allWs = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), ws(), ws()])), 'all ws');
    assert.equal(allWs.fallback?.length, 0);
    const allC = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), comment(), comment()])), 'all comment');
    assert.equal(allC.fallback?.length, 0);

    // Unique-cause: whitespace T, comment F — trailing spaces skipped.
    // Factory trims; CSSStyleValue.parse on custom properties does not.
    const trailWs = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), dim(), ws(), ws()])), 'trail ws');
    assert.equal(trailWs.fallback?.toString(), '1px');
    const parsedWs = asRef(CSSStyleValue.parse('--mcdc-fac1-fb', 'var(--x, 1px )'), 'parse keeps trail ws');
    assert.equal(parsedWs.fallback?.toString(), ' 1px ');
    const factoryCss = asRef(factory('var(--x, 1px )'), 'factory trims css trail ws');
    assert.equal(factoryCss.fallback?.toString(), '1px');

    // Unique-cause: whitespace F, comment T — trailing comments skipped.
    const trailC = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), dim(), comment()])), 'trail comment');
    assert.equal(trailC.fallback?.toString(), '1px');
    assert.equal(trailC.fallback?.toString().includes('/*c*/'), false);

    // Unique-cause: neither — last token is the value (stop).
    const neither = asRef(createCSSStyleValue(varFn([ident('--x'), comma(), dim()])), 'no trail skip');
    assert.equal(neither.fallback?.toString(), '1px');

    // Independence: lead comment + trail ws; lead ws + trail comment.
    const leadCTrailWs = asRef(
      createCSSStyleValue(varFn([ident('--x'), comma(), comment(), dim(), ws()])),
      'lead comment trail ws',
    );
    assert.equal(leadCTrailWs.fallback?.toString(), '1px');
    const leadWsTrailC = asRef(
      createCSSStyleValue(varFn([ident('--x'), comma(), ws(), dim(), comment()])),
      'lead ws trail comment',
    );
    assert.equal(leadWsTrailC.fallback?.toString(), '1px');

    const nested = asRef(factory('var(--a, var(--b, red))'), 'nested fallback');
    assert.ok(nested.fallback instanceof CSSUnparsedValue);
    assert.ok(nested.fallback[0] instanceof CSSVariableReferenceValue);
    assert.equal((nested.fallback[0] as CSSVariableReferenceValue).variable, '--b');
    const parsedNested = CSSStyleValue.parseAll('color', 'var(--a, var(--b, red))');
    assert.ok(parsedNested[0] instanceof CSSUnparsedValue);
    assert.ok(parsedNested[0][0] instanceof CSSVariableReferenceValue);
  });
});

describe('MC/DC still-hot unique-cause: createCSSStyleValue number-zero syntax (css-typed-om-1 § 6.6)', { concurrency: false }, () => {
  test('v.value === 0 && property unique-cause', () => {
    const zero = first('0') as NumberToken;
    assert.equal(zero.value, 0);

    // Unique-cause AND T T: 0 with a property name.
    const width0 = CSSStyleValue.parse('width', '0');
    assert.ok(width0 instanceof CSSUnitValue);
    assert.equal(width0.unit, 'px');
    const viaFactory = createCSSStyleValue(zero, 'width');
    assert.ok(viaFactory instanceof CSSUnitValue);
    assert.equal(viaFactory.unit, 'px');

    // Unique-cause AND T F: 0 without property (omitted / undefined / '').
    const noProp = createCSSStyleValue(zero);
    assert.ok(noProp instanceof CSSUnitValue);
    assert.equal(noProp.unit, 'number');
    const undef = createCSSStyleValue(zero, undefined);
    assert.ok(undef instanceof CSSUnitValue);
    assert.equal(undef.unit, 'number');
    const empty = createCSSStyleValue(zero, '');
    assert.ok(empty instanceof CSSUnitValue);
    assert.equal(empty.unit, 'number');

    // Unique-cause AND F T: non-zero with property stays a unitless number.
    const one = factory('1', 'width');
    assert.ok(one instanceof CSSUnitValue);
    assert.equal(one.unit, 'number');
    const opacity = CSSStyleValue.parse('opacity', '1');
    assert.ok(opacity instanceof CSSUnitValue);
    assert.equal(opacity.unit, 'number');
    assert.equal(opacity.value, 1);
  });

  test('!syntax && property.startsWith("--") unique-cause via registry and inject', () => {
    const zero = first('0');

    // Unique-cause AND T T: custom name missing from STANDARD_PROPERTIES_SYNTAX.
    CSS.registerProperty({
      name: '--mcdc-fac1-len',
      syntax: '<length>',
      inherits: false,
      initialValue: '0px',
    });
    const unreg = createCSSStyleValue(zero, '--mcdc-fac1-unreg');
    assert.ok(unreg instanceof CSSUnitValue);
    assert.equal(unreg.unit, 'number');
    const parsedUnreg = CSSStyleValue.parse('--mcdc-fac1-unreg', '0');
    assert.ok(parsedUnreg instanceof CSSUnparsedValue);

    const regFactory = createCSSStyleValue(zero, '--mcdc-fac1-len');
    assert.ok(regFactory instanceof CSSUnitValue);
    assert.equal(regFactory.unit, 'px');
    const regParse = CSSStyleValue.parse('--mcdc-fac1-len', '0');
    assert.ok(regParse instanceof CSSUnitValue);
    assert.equal(regParse.unit, 'px');
    const regAll = CSSStyleValue.parseAll('--mcdc-fac1-len', '10px');
    assert.ok(regAll[0] instanceof CSSUnitValue);
    assert.equal((regAll[0] as CSSUnitValue).unit, 'px');

    CSS.registerProperty({
      name: '--mcdc-fac1-star',
      syntax: '*',
      inherits: false,
      initialValue: 'x',
    });
    const starFactory = createCSSStyleValue(zero, '--mcdc-fac1-star');
    assert.ok(starFactory instanceof CSSUnitValue);
    assert.equal(starFactory.unit, 'number');
    const starParse = CSSStyleValue.parse('--mcdc-fac1-star', '0');
    assert.ok(starParse instanceof CSSUnparsedValue);

    // Unique-cause AND T F: no STANDARD syntax, not a dashed-ident.
    const nosyn = createCSSStyleValue(zero, 'mcdc-fac1-nosyn');
    assert.ok(nosyn instanceof CSSUnitValue);
    assert.equal(nosyn.unit, 'number');

    // Unique-cause AND F T: STANDARD lookup hits a dashed-ident key (injected).
    injectSyntax('--mcdc-fac1-std', '<length>');
    const injectedCustom = createCSSStyleValue(zero, '--mcdc-fac1-std');
    assert.ok(injectedCustom instanceof CSSUnitValue);
    assert.equal(injectedCustom.unit, 'px');

    // Unique-cause AND F F: standard property with syntax (width).
    const width = createCSSStyleValue(zero, 'width');
    assert.ok(width instanceof CSSUnitValue);
    assert.equal(width.unit, 'px');
  });

  test('syntax && (includes length / length-percentage / dimension) unique-cause', () => {
    const zero = first('0');

    // Unique-cause: syntax F (unregistered custom / unknown property).
    const noSyntax = createCSSStyleValue(zero, '--mcdc-fac1-nosyntax');
    assert.ok(noSyntax instanceof CSSUnitValue);
    assert.equal(noSyntax.unit, 'number');

    // Unique-cause: includes('<length>') T, includes('<length-percentage>') F,
    // includes('<dimension>') F. outline-offset / scroll-margin-top syntax is '<length>'.
    const offset = CSSStyleValue.parse('outline-offset', '0');
    assert.ok(offset instanceof CSSUnitValue);
    assert.equal(offset.unit, 'px');
    const margin = CSSStyleValue.parse('scroll-margin-top', '0');
    assert.ok(margin instanceof CSSUnitValue);
    assert.equal(margin.unit, 'px');
    assert.equal(STANDARD_PROPERTIES_SYNTAX['outline-offset']?.includes('<length-percentage>'), false);
    assert.equal(STANDARD_PROPERTIES_SYNTAX['outline-offset']?.includes('<dimension>'), false);

    // width / padding-top syntax contains '<length-percentage>', which also
    // matches includes('<length>') as a substring (unpairable independently).
    const pad = CSSStyleValue.parse('padding-top', '0');
    assert.ok(pad instanceof CSSUnitValue);
    assert.equal(pad.unit, 'px');
    const width = CSSStyleValue.parse('width', '0');
    assert.ok(width instanceof CSSUnitValue);
    assert.equal(width.unit, 'px');

    // Unique-cause: includes('<dimension>') T with length F (injected).
    injectSyntax('mcdc-fac1-dim', '<dimension>');
    const dimZero = createCSSStyleValue(zero, 'mcdc-fac1-dim');
    assert.ok(dimZero instanceof CSSUnitValue);
    assert.equal(dimZero.unit, 'px');
    assert.equal(STANDARD_PROPERTIES_SYNTAX['mcdc-fac1-dim']?.includes('<length>'), false);

    // Unique-cause: syntax T and all includes F (opacity / flex-grow / * registry).
    const opacity = CSSStyleValue.parse('opacity', '0');
    assert.ok(opacity instanceof CSSUnitValue);
    assert.equal(opacity.unit, 'number');
    const grow = CSSStyleValue.parse('flex-grow', '0');
    assert.ok(grow instanceof CSSUnitValue);
    assert.equal(grow.unit, 'number');
    const order = CSSStyleValue.parseAll('order', '0');
    assert.ok(order[0] instanceof CSSUnitValue);
    assert.equal((order[0] as CSSUnitValue).unit, 'number');
  });
});

describe('MC/DC still-hot unique-cause: createCSSStyleValue remaining decisions (css-typed-om-1 § 3 / § 4)', { concurrency: false }, () => {
  test('calc/min/max/clamp includes, mathNode, nameLower === calc, instanceof CSSUnitValue', () => {
    // Unique-cause: includes T for each math name; nameLower === 'calc' T vs F.
    const calcUnit = CSSStyleValue.parse('width', 'calc(1px + 2px)');
    assert.ok(calcUnit instanceof CSSMathSum);
    assert.equal(calcUnit.toString(), 'calc(3px)');
    const calcMixed = CSSStyleValue.parse('width', 'calc(1px + 1em)');
    assert.ok(calcMixed instanceof CSSMathSum);
    assert.equal(calcMixed.toString().includes('1em'), true);
    const min = CSSStyleValue.parse('width', 'min(1px, 2px)');
    assert.ok(min instanceof CSSMathMin);
    const max = CSSStyleValue.parse('width', 'max(1px, 2em)');
    assert.ok(max instanceof CSSMathMax);
    const clamp = CSSStyleValue.parse('width', 'clamp(1px, 2px, 3px)');
    assert.ok(clamp instanceof CSSMathClamp);
    const calcUpper = factory('CALC(1px + 2px)', 'width');
    assert.ok(calcUpper instanceof CSSMathSum);
    const minUpper = factory('MIN(1px, 2px)', 'width');
    assert.ok(minUpper instanceof CSSMathMin);

    // Unique-cause: mathNode F — invalid calc that parseMathFunction rejects.
    // _parseAll throws before the factory; call createCSSStyleValue directly.
    assert.equal(factory('calc()'), null);
    assert.equal(factory('calc(red)'), null);
    assert.throws(() => CSSStyleValue.parse('width', 'calc()'), TypeError);
  });

  test('url / endsWith gradient / ident / percentage / dimension / default / isToken F', () => {
    // Unique-cause: nameLower === 'url' T (function) vs url token (function F).
    const urlFn = CSSStyleValue.parse('background-image', 'url("a.png")');
    assert.ok(urlFn instanceof CSSURLImageValue);
    assert.ok(urlFn instanceof CSSImageValue);
    const urlTok = CSSStyleValue.parse('background-image', 'url(a.png)');
    assert.ok(urlTok instanceof CSSURLImageValue);
    assert.equal(createCSSStyleValue(first('url(a.png)')) instanceof CSSURLImageValue, true);
    assert.equal(createCSSStyleValue(first('url("a.png")')) instanceof CSSURLImageValue, true);

    // Unique-cause: nameLower.endsWith('gradient') T vs F.
    const linear = CSSStyleValue.parse('background-image', 'linear-gradient(red, blue)');
    assert.ok(linear instanceof CSSGradientImageValue);
    const radial = factory('radial-gradient(red, blue)', 'background-image');
    assert.ok(radial instanceof CSSGradientImageValue);
    const conic = factory('conic-gradient(red, blue)', 'background-image');
    assert.ok(conic instanceof CSSGradientImageValue);
    const repeating = factory('repeating-linear-gradient(red, blue)', 'background-image');
    assert.ok(repeating instanceof CSSGradientImageValue);
    const upperGrad = factory('LINEAR-GRADIENT(red, blue)', 'background-image');
    assert.ok(upperGrad instanceof CSSGradientImageValue);
    assert.equal(factory('image-set(url(a.png) 1x)'), null);
    assert.equal(factory('attr(data-x)'), null);
    assert.equal(factory('rgb(1, 2, 3)'), null);

    const identVal = CSSStyleValue.parse('width', 'auto');
    assert.ok(identVal instanceof CSSKeywordValue);
    assert.equal(identVal.value, 'auto');
    const viaFactory = factory('auto', 'width');
    assert.ok(viaFactory instanceof CSSKeywordValue);

    const pct = CSSStyleValue.parse('width', '50%');
    assert.ok(pct instanceof CSSUnitValue);
    assert.equal(pct.unit, 'percent');
    const px = CSSStyleValue.parse('width', '10px');
    assert.ok(px instanceof CSSUnitValue);
    assert.equal(px.unit, 'px');

    // Unique-cause: v.unit || '' F (empty unit) then CSSUnitValue rejects ''.
    const emptyUnit: DimensionToken = { type: 'dimension', value: 1, unit: '', numberType: 'integer', sign: null };
    assert.throws(() => createCSSStyleValue(emptyUnit), TypeError);

    // Unique-cause: switch default → null (hash / string / delim / comment).
    assert.equal(createCSSStyleValue({ type: 'hash', value: 'fff', hashType: 'id' }), null);
    assert.equal(createCSSStyleValue({ type: 'string', value: 'x' }), null);
    assert.equal(createCSSStyleValue({ type: 'delim', value: '+' }), null);
    assert.equal(createCSSStyleValue(comment()), null);

    // Unique-cause: isToken F (simple-block value is an array).
    const block: SimpleBlock = {
      type: 'simple-block',
      associatedToken: { type: '[', value: '[' },
      value: [],
    };
    assert.equal(createCSSStyleValue(block), null);
  });
});
