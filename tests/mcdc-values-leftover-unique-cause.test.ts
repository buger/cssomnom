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
// Verifies: SW-REQ-260821-7AKJ, SYS-REQ-260821-HGFK, SYS-REQ-260821-Y6R3
// Leftover unique-cause for src/typed-om/values/CSSUnparsedValue.ts,
// CSSKeywordValue.ts, CSSImageValue.ts, CSSVariableReferenceValue.ts, and
// CSSStyleValue.ts leftover methods not already in
// tests/mcdc-hotspot-typed-om-more.test.ts / tests/typed-om-unparsed-roundtrip.test.ts
// / tests/typed-om-iterators.test.ts / tests/mcdc-hotspot-parse-all.test.ts.
// Drive CSSStyleValue.parse / parseAll, constructors, getters, setters,
// toString / serialize. css-typed-om-1 § 3 #stylevalue-objects / § 3.1
// #keywordvalue-objects / § 3.4 #unparsedvalue-objects /
// #variable-reference-value-objects / § 3.5 #imagevalue-objects / § 6.6
// #parse-a-cssstylevalue. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import {
  CSSStyleValue,
  CSSKeywordValue,
  CSSUnparsedValue,
  CSSVariableReferenceValue,
  CSSImageValue,
} from '../src/typed-om.ts';
import { CSSURLImageValue, CSSGradientImageValue } from '../src/typed-om/values/CSSImageValue.ts';
import { tokensToUnparsedSegments } from '../src/typed-om/values/CSSUnparsedValue.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { privateToken } from '../src/typed-om/utils/validation.ts';
import type { ComponentValue, CSSFunction, IdentToken, SimpleBlock } from '../src/types.ts';

function parseCustom(css: string): CSSUnparsedValue {
  const v = CSSStyleValue.parse('--x', css);
  assert.ok(v instanceof CSSUnparsedValue, `expected CSSUnparsedValue for ${JSON.stringify(css)}`);
  return v;
}

function segs(css: string): (string | CSSVariableReferenceValue)[] {
  return tokensToUnparsedSegments(
    ParseHooks.parseComponentValues(tokenize(css)).filter((t) => t.type !== 'EOF'),
  );
}

function ident(value: string): IdentToken {
  return { type: 'ident', value };
}

function varFn(value: ComponentValue[]): CSSFunction {
  return { type: 'function', name: 'var', value };
}

describe('MC/DC leftover unique-cause: CSSStyleValue leftover methods (css-typed-om-1 § 3 #stylevalue-objects / § 6.6 #parse-a-cssstylevalue)', { concurrency: false }, () => {
  test('constructor token vs constructor-name AND; toString _cssText; toStringTag', () => {
    // Unique-cause: token !== privateToken T && constructor === CSSStyleValue T.
    assert.throws(() => new CSSStyleValue(), TypeError);
    assert.throws(() => new CSSStyleValue('opacity'), TypeError);

    // Unique-cause: token !== privateToken F && constructor === CSSStyleValue T.
    const priv = new CSSStyleValue('opacity', privateToken);
    assert.equal(priv.constructor, CSSStyleValue);
    assert.equal(priv.toString(), 'opacity');
    assert.equal(Object.prototype.toString.call(priv), '[object CSSStyleValue]');

    // Unique-cause: token !== privateToken T && constructor === CSSStyleValue F.
    class Sub extends CSSStyleValue {}
    const sub = new Sub('hello');
    assert.equal(sub.toString(), 'hello');
    assert.equal(Object.prototype.toString.call(sub), '[object Sub]');

    // Unique-cause leftover toString: this._cssText || '' F (empty / omitted) vs T.
    assert.equal(new Sub('').toString(), '');
    assert.equal(new Sub().toString(), '');
    const fallback = CSSStyleValue.parse('will-change', 'opacity');
    assert.equal(fallback.constructor, CSSStyleValue);
    assert.equal(fallback.toString(), 'opacity');
  });

  test('parse / parseAll leftover arity unique-cause vs initialized 2-arg', () => {
    // Unique-cause: arguments.length < 2 T (0 and 1) vs F (2). Installed
    // parseStyleValue / parseAllStyleValues keep the same arity guard as the
    // CSSStyleValue.ts stubs (css-typed-om-1 § 6.6 #parse-a-cssstylevalue).
    assert.throws(
      () => (CSSStyleValue.parse as unknown as () => CSSStyleValue)(),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes('2 arguments required, but only 0 present'),
    );
    assert.throws(
      () => (CSSStyleValue.parse as unknown as (p: string) => CSSStyleValue)('width'),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes('2 arguments required, but only 1 present'),
    );
    assert.throws(
      () => (CSSStyleValue.parseAll as unknown as () => CSSStyleValue[])(),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes('2 arguments required, but only 0 present'),
    );
    assert.throws(
      () => (CSSStyleValue.parseAll as unknown as (p: string) => CSSStyleValue[])('width'),
      (err: unknown) =>
        err instanceof TypeError && err.message.includes('2 arguments required, but only 1 present'),
    );

    const parsed = CSSStyleValue.parse('width', 'auto');
    assert.ok(parsed instanceof CSSKeywordValue);
    assert.equal(parsed.toString(), 'auto');
    const all = CSSStyleValue.parseAll('width', 'auto');
    assert.equal(all.length, 1);
    assert.ok(all[0] instanceof CSSKeywordValue);
  });
});

describe('MC/DC leftover unique-cause: CSSKeywordValue leftover methods (css-typed-om-1 § 3.1 #keywordvalue-objects)', { concurrency: false }, () => {
  test('constructor/setter empty T vs F; serialize leftover vs escape toString', () => {
    // Unique-cause: value === '' T vs F.
    assert.throws(() => new CSSKeywordValue(''), TypeError);
    const kw = new CSSKeywordValue('auto');
    assert.equal(kw.value, 'auto');
    assert.equal(kw.toString(), 'auto');
    assert.equal(kw.serialize(), 'auto');

    kw.value = 'none';
    assert.equal(kw.value, 'none');
    assert.equal(kw.serialize(), 'none');
    assert.throws(() => {
      kw.value = '';
    }, TypeError);
    assert.equal(kw.value, 'none');

    // Leftover toString → cssom-1 § 2.3 #serialize-an-identifier escape.
    const spaced = new CSSKeywordValue('a b');
    assert.equal(spaced.toString(), 'a\\ b');
    assert.equal(spaced.serialize(), 'a\\ b');
    const dashed = new CSSKeywordValue('--custom');
    assert.equal(dashed.toString(), '--custom');
  });
});

describe('MC/DC leftover unique-cause: CSSImageValue leftover methods (css-typed-om-1 § 3.5 #imagevalue-objects)', { concurrency: false }, () => {
  test('url() wrapper unique-cause of startsWith url( vs leftover url getter / gradient toString', () => {
    // Unique-cause: url.startsWith('url(') F wraps; T keeps the token.
    const bare = new CSSURLImageValue('http://example.com/a.png');
    assert.ok(bare instanceof CSSImageValue);
    assert.equal(bare.url, 'http://example.com/a.png');
    assert.equal(bare.toString(), 'url("http://example.com/a.png")');

    const already = new CSSURLImageValue('url("x")');
    assert.equal(already.url, 'url("x")');
    assert.equal(already.toString(), 'url("x")');

    // Unique-cause leftover: startsWith is case-sensitive, so URL( is F.
    const upper = new CSSURLImageValue('URL("x")');
    assert.equal(upper.url, 'URL("x")');
    assert.equal(upper.toString(), 'url("URL("x")")');

    const grad = new CSSGradientImageValue('linear-gradient(red, blue)');
    assert.ok(grad instanceof CSSImageValue);
    assert.equal(grad.toString(), 'linear-gradient(red, blue)');
    const radial = new CSSGradientImageValue('radial-gradient(circle, red, blue)');
    assert.equal(radial.toString(), 'radial-gradient(circle, red, blue)');
  });
});

describe('MC/DC leftover unique-cause: CSSVariableReferenceValue leftover methods (css-typed-om-1 § 3.4 #variable-reference-value-objects)', { concurrency: false }, () => {
  test('constructor arity and fallback !== null / !== undefined unique-cause', () => {
    assert.throws(
      () => new (CSSVariableReferenceValue as unknown as new () => CSSVariableReferenceValue)(),
      TypeError,
    );

    const none = new CSSVariableReferenceValue('--x');
    assert.equal(none.fallback, null);
    assert.equal(none.toString(), 'var(--x)');

    // Unique-cause: fallback !== null T && fallback !== undefined F.
    const undef = new CSSVariableReferenceValue('--x', undefined);
    assert.equal(undef.fallback, null);
    assert.equal(undef.toString(), 'var(--x)');

    const withFb = new CSSVariableReferenceValue('--x', new CSSUnparsedValue(['red']));
    assert.ok(withFb.fallback instanceof CSSUnparsedValue);
    assert.equal(withFb.toString(), 'var(--x,red)');

    const explicitNull = new CSSVariableReferenceValue('--x', null);
    assert.equal(explicitNull.fallback, null);
  });

  test('fallback duck-type unique-cause of truthy / object / constructor / name / iterator', () => {
    // Unique-cause: typeof === 'object' F (string / number / function).
    assert.throws(() => new CSSVariableReferenceValue('--x', 'red' as unknown as CSSUnparsedValue), TypeError);
    assert.throws(() => new CSSVariableReferenceValue('--x', 1 as unknown as CSSUnparsedValue), TypeError);
    assert.throws(
      () => new CSSVariableReferenceValue('--x', (() => undefined) as unknown as CSSUnparsedValue),
      TypeError,
    );

    // Unique-cause: fallback truthy F (0 / false / '') after !== null && !== undefined T.
    assert.throws(() => new CSSVariableReferenceValue('--x', 0 as unknown as CSSUnparsedValue), TypeError);
    assert.throws(() => new CSSVariableReferenceValue('--x', false as unknown as CSSUnparsedValue), TypeError);
    assert.throws(() => new CSSVariableReferenceValue('--x', '' as unknown as CSSUnparsedValue), TypeError);

    // Unique-cause: "constructor" in fallback F.
    assert.throws(
      () => new CSSVariableReferenceValue('--x', Object.create(null) as CSSUnparsedValue),
      TypeError,
    );

    // Unique-cause: constructor.name === 'CSSUnparsedValue' F && iterator F.
    assert.throws(
      () => new CSSVariableReferenceValue('--x', { constructor: { name: 'Foo' } } as CSSUnparsedValue),
      TypeError,
    );

    // Unique-cause: constructor.name === 'CSSUnparsedValue' T (iterator skipped).
    const fakeName = { constructor: { name: 'CSSUnparsedValue' }, toString() { return 'red'; } };
    const named = new CSSVariableReferenceValue('--x', fakeName as unknown as CSSUnparsedValue);
    assert.equal(named.toString(), 'var(--x,red)');

    // Unique-cause: name F && iterator T (array / custom iterable).
    const fromArr = new CSSVariableReferenceValue('--x', ['red'] as unknown as CSSUnparsedValue);
    assert.equal(fromArr.toString(), 'var(--x,red)');
    const iter = {
      [Symbol.iterator]: function* () { yield 'a'; },
      toString() { return 'iter'; },
    };
    const fromIter = new CSSVariableReferenceValue('--x', iter as unknown as CSSUnparsedValue);
    assert.equal(fromIter.toString(), 'var(--x,iter)');
  });

  test('variable setter typeof !== string leftover vs startsWith / empty --', () => {
    const v = new CSSVariableReferenceValue('--ok');
    // Unique-cause: typeof value !== 'string' T.
    assert.throws(() => {
      (v as { variable: unknown }).variable = 123;
    }, TypeError);
    assert.throws(() => {
      (v as { variable: unknown }).variable = null;
    }, TypeError);
    assert.throws(() => {
      (v as { variable: unknown }).variable = { toString() { return '--x'; } };
    }, TypeError);

    // Unique-cause: typeof string T, startsWith('--') F vs value === '--' T vs both F.
    assert.throws(() => {
      v.variable = 'foo';
    }, TypeError);
    assert.throws(() => {
      v.variable = '--';
    }, TypeError);
    v.variable = '--bar';
    assert.equal(v.variable, '--bar');
    assert.equal(v.toString(), 'var(--bar)');
  });
});

describe('MC/DC leftover unique-cause: CSSUnparsedValue proxy leftover (css-typed-om-1 § 3.4 #unparsedvalue-objects)', { concurrency: false }, () => {
  test('get/set typeof prop === string F via symbol; non-digit Reflect; invalid value', () => {
    const u = new CSSUnparsedValue(['foo']);
    assert.equal(u[0], 'foo');
    assert.equal(u[1], undefined);

    // Unique-cause: typeof prop === 'string' F (symbol) on get and set.
    const key = Symbol('k');
    const asSym = u as unknown as Record<symbol, string>;
    assert.equal(asSym[key], undefined);
    asSym[key] = 'sym';
    assert.equal(asSym[key], 'sym');
    assert.equal(u.length, 1);

    // Unique-cause: typeof string T && /^\d+$/ F → Reflect.set (expando / length).
    const asRec = u as unknown as Record<string, unknown>;
    asRec.expando = 'z';
    assert.equal(asRec.expando, 'z');
    asRec[-1] = 'n';
    assert.equal(asRec[-1], 'n');
    assert.equal(u.length, 1);

    u[0] = 'bar';
    assert.equal(u[0], 'bar');
    u[1] = new CSSVariableReferenceValue('--x');
    assert.equal(u.length, 2);
    assert.throws(() => {
      u[9] = 'z';
    }, RangeError);
    assert.throws(() => {
      (u as unknown as Record<number, unknown>)[0] = 1;
    }, TypeError);
    assert.throws(() => {
      (u as unknown as Record<number, unknown>)[0] = null;
    }, TypeError);
  });
});

describe('MC/DC leftover unique-cause: CSSUnparsedValue.toString leftover (css-typed-om-1 § 3.4 #unparsedvalue-objects)', { concurrency: false }, () => {
  test('comment-separator unique-cause of empty / space / isIdentChar independence', () => {
    // Unique-cause: prev === null F (single fragment skips the separator).
    assert.equal(new CSSUnparsedValue(['foo']).toString(), 'foo');
    assert.equal(new CSSUnparsedValue(['']).toString(), '');

    // Unique-cause: prevStr.length > 0 F / currentStr.length > 0 F.
    assert.equal(new CSSUnparsedValue(['', 'foo']).toString(), 'foo');
    assert.equal(new CSSUnparsedValue(['foo', '']).toString(), 'foo');
    assert.equal(new CSSUnparsedValue(['', '']).toString(), '');

    // Unique-cause: endsWith(' ') T vs startsWith(' ') T vs both F.
    assert.equal(new CSSUnparsedValue(['foo ', 'bar']).toString(), 'foo bar');
    assert.equal(new CSSUnparsedValue(['foo', ' bar']).toString(), 'foo bar');
    assert.equal(new CSSUnparsedValue(['foo ', ' bar']).toString(), 'foo  bar');
    assert.equal(new CSSUnparsedValue(['lem', 'on']).toString(), 'lem/**/on');

    // Unique-cause: isIdentChar(prev) T && isIdentChar(current) F; F && T; F && F.
    assert.equal(new CSSUnparsedValue(['foo', '(']).toString(), 'foo(');
    assert.equal(new CSSUnparsedValue(['(', 'foo']).toString(), '(foo');
    assert.equal(new CSSUnparsedValue(['(', ')']).toString(), '()');
    assert.equal(new CSSUnparsedValue(['foo', '1']).toString(), 'foo/**/1');
    assert.equal(new CSSUnparsedValue(['1', 'foo']).toString(), '1/**/foo');

    const mixed = new CSSUnparsedValue([
      'foo',
      new CSSVariableReferenceValue('--x', new CSSUnparsedValue(['red'])),
    ]);
    assert.equal(mixed.toString(), 'foo/**/var(--x,red)');
    assert.equal(mixed.serialize(), mixed.toString());
  });
});

describe('MC/DC leftover unique-cause: tokensToUnparsedSegments processNode leftover (css-typed-om-1 § 3.4)', { concurrency: false }, () => {
  test('invalid var() unique-cause of args.length === 0 and first type !== ident', () => {
    // Unique-cause: args.length === 0 T (whitespace / comments filtered).
    const empty = parseCustom('var()');
    assert.equal(empty[0], 'var()');
    assert.equal(parseCustom('var( )')[0], 'var( )');
    assert.equal(parseCustom('var(/*c*/)')[0], 'var()');

    // Unique-cause: args[0].type !== 'ident' T (number / string / hash).
    assert.equal(parseCustom('var(1px)')[0], 'var(1px)');
    assert.equal(parseCustom('var("foo")')[0], 'var("foo")');
    assert.equal(parseCustom('var(#fff)')[0], 'var(#fff)');

    // Unique-cause: ident that does not start with -- vs ident === '--' vs valid.
    assert.equal(parseCustom('var(foo)')[0], 'var(foo)');
    assert.equal(parseCustom('var(--)')[0], 'var(--)');
    const ok = parseCustom('var(--x)');
    assert.ok(ok[0] instanceof CSSVariableReferenceValue);
    assert.equal((ok[0] as CSSVariableReferenceValue).variable, '--x');
    assert.equal((ok[0] as CSSVariableReferenceValue).fallback, null);

    // Unique-cause: args.length > 1 && args[1].type !== 'comma' T vs F.
    assert.equal(parseCustom('var(--x 1px)')[0], 'var(--x 1px)');
    const withFb = parseCustom('var(--x, red)');
    assert.ok(withFb[0] instanceof CSSVariableReferenceValue);
    assert.equal((withFb[0] as CSSVariableReferenceValue).toString(), 'var(--x, red)');
    const nested = parseCustom('var(--x, var(--y))');
    assert.ok(nested[0] instanceof CSSVariableReferenceValue);
    assert.equal(nested.toString(), 'var(--x, var(--y))');

    // Uppercase function name still matches toLowerCase() === 'var'.
    const upper = segs('VAR(--x)');
    assert.ok(upper[0] instanceof CSSVariableReferenceValue);
  });

  test('function / simple-block hasVar unique-cause and last-is-string close merge', () => {
    // Unique-cause: isCSSFunction T, name !== 'var', hasVarFunction T vs F.
    const calcVar = parseCustom('calc(var(--x))');
    assert.equal(calcVar.length, 3);
    assert.equal(calcVar[0], 'calc(');
    assert.ok(calcVar[1] instanceof CSSVariableReferenceValue);
    assert.equal(calcVar[2], ')');
    assert.equal(parseCustom('calc(1px)')[0], 'calc(1px)');

    // Unique-cause: typeof last === 'string' F (close after var) vs T (close after ident).
    const after = parseCustom('calc(var(--x) + 1px)');
    assert.equal(after[0], 'calc(');
    assert.ok(after[1] instanceof CSSVariableReferenceValue);
    assert.equal(after[2], ' + 1px)');
    const before = parseCustom('calc(1px + var(--x))');
    assert.equal(before[0], 'calc(1px + ');
    assert.ok(before[1] instanceof CSSVariableReferenceValue);
    assert.equal(before[2], ')');

    const rgb = parseCustom('rgb(var(--r) var(--g))');
    assert.equal(rgb.length, 5);
    assert.equal(rgb[0], 'rgb(');
    assert.ok(rgb[1] instanceof CSSVariableReferenceValue);
    assert.ok(rgb[3] instanceof CSSVariableReferenceValue);
    assert.equal(rgb[4], ')');

    // Unique-cause: simple-block hasVar T vs F; close string vs var.
    const block = parseCustom('[var(--x)]');
    assert.equal(block[0], '[');
    assert.ok(block[1] instanceof CSSVariableReferenceValue);
    assert.equal(block[2], ']');
    assert.equal(parseCustom('[1px]')[0], '[1px]');
    const afterBlock = parseCustom('[var(--x) 1px]');
    assert.equal(afterBlock[0], '[');
    assert.ok(afterBlock[1] instanceof CSSVariableReferenceValue);
    assert.equal(afterBlock[2], ' 1px]');
    const beforeBlock = parseCustom('[1px var(--x)]');
    assert.equal(beforeBlock[0], '[1px ');
    assert.ok(beforeBlock[1] instanceof CSSVariableReferenceValue);
    assert.equal(beforeBlock[2], ']');
    assert.equal(parseCustom('{var(--x)}')[0], '{');
    assert.equal(parseCustom('(var(--x))')[0], '(');
  });

  test('seg === "" leftover via EOF serialize and non-mirror simple-block close', () => {
    // Unique-cause: seg === "" T — serialize(EOF) is empty, cleanup drops it.
    const eof = { type: 'EOF', value: '' } as ComponentValue;
    assert.deepEqual(tokensToUnparsedSegments([eof]), []);
    const identPlusEof = tokensToUnparsedSegments([ident('foo'), eof]);
    assert.deepEqual(identPlusEof, ['foo']);

    // Unique-cause: getMirrorToken default '' then last is var → push empty close,
    // cleanup skips it (typeof last === 'string' F on the close).
    const block: SimpleBlock = {
      type: 'simple-block',
      associatedToken: { type: 'delim', value: '<' },
      value: [varFn([ident('--x')])],
    };
    const weird = tokensToUnparsedSegments([block]);
    assert.equal(weird.length, 2);
    assert.equal(weird[0], '<');
    assert.ok(weird[1] instanceof CSSVariableReferenceValue);

    // Direct empty var() function node (no tokenizer whitespace).
    const emptyVar = tokensToUnparsedSegments([varFn([])]);
    assert.deepEqual(emptyVar, ['var()']);
  });
});

describe('MC/DC leftover unique-cause: CSSUnparsedValue leftover list methods (css-typed-om-1 § 3.4 #unparsedvalue-objects)', { concurrency: false }, () => {
  test('forEach thisArg / empty length; item; serialize; type()', () => {
    const ref = new CSSVariableReferenceValue('--x');
    const u = new CSSUnparsedValue(['a', ref]);
    assert.equal(u.item(0), 'a');
    assert.equal(u.item(1), ref);
    assert.equal(u.item(2), undefined);
    assert.equal(u.serialize(), 'a/**/var(--x)');
    assert.deepEqual(u.type(), {});

    const ctx = { n: 0 };
    u.forEach(function (this: { n: number }, value, index, parent) {
      this.n += 1;
      assert.equal(parent, u);
      if (index === 0) assert.equal(value, 'a');
      if (index === 1) assert.equal(value, ref);
    }, ctx);
    assert.equal(ctx.n, 2);

    // Unique-cause: i < length F (empty leftover forEach).
    const empty = new CSSUnparsedValue([]);
    let calls = 0;
    empty.forEach(() => {
      calls += 1;
    });
    assert.equal(calls, 0);
    assert.equal(empty.length, 0);
    assert.equal(empty.toString(), '');
    assert.deepEqual([...empty.keys()], []);
    assert.deepEqual([...empty.values()], []);
    assert.deepEqual([...empty.entries()], []);
  });
});
