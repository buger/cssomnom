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
// Verifies: SW-REQ-260821-6D9T, SYS-REQ-260821-PJ76
// Still-hot unique-cause for src/SelectorParser.ts leftovers that
// tests/mcdc-branch-selectorparser-leftover.test.ts does not isolate:
// hasAmpersand delim/block/function, parse() leading-trim while T,T,
// tryConsumeCombinator !token, consumeCompoundSelector ~ / ident-after-PE /
// hole token, consumeTypeOrUniversalSelector EOF / *|| / | nextPipe,
// consumeAttributeSelector !block / * without pipe, consumePseudoSelector
// !token, validateSimpleSelectorAfterPseudo type F, parseAnPlusB !t1 /
// +-n- / n-foo / non-integer dimension / +n- eof.
// Drive SelectorParser.parse, parseAnPlusB, CSS.supports, parse(), plus
// Reflect private-method calls for arms parse() cannot reach.
// selectors-4 #grammar / #combinators / #compound / #type-selector /
// #attribute-selectors / #pseudo-elements / #forgiving-selector,
// css-syntax-3 #anb-microsyntax.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SelectorParser,
  parseAnPlusB,
  ComponentValueCursor,
} from '../src/SelectorParser.ts';
import type { SelectorParserOptions } from '../src/SelectorParser.ts';
import { Parser, parse } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSS } from '../src/parser-api.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import type {
  Combinator,
  ComplexSelector,
  ComponentValue,
  CompoundSelector,
  CSSFunction,
  DimensionToken,
  InvalidSelector,
  NumberToken,
  SelectorList,
  SimpleSelector,
} from '../src/types.ts';

function valuesOf(css: string): ComponentValue[] {
  return new Parser(tokenize(css)).parseComponentValues();
}

function parseSel(css: string, options: SelectorParserOptions = {}): SelectorList {
  return new SelectorParser(valuesOf(css), options).parse();
}

function syntaxError(err: unknown, needle?: string): boolean {
  if (!(err instanceof DOMException) || err.name !== 'SyntaxError') return false;
  if (needle === undefined) return true;
  return err.message.includes(needle);
}

function throwsSel(css: string, options: SelectorParserOptions = {}, needle?: string): void {
  assert.throws(() => parseSel(css, options), (err: unknown) => syntaxError(err, needle));
}

function firstComplex(list: SelectorList): ComplexSelector {
  assert.ok(list.selectors.length >= 1, 'expected a selector');
  const sel = list.selectors[0];
  assert.equal(sel.type, 'complex-selector');
  return sel as ComplexSelector;
}

function firstCompound(list: SelectorList): CompoundSelector {
  const item = firstComplex(list).items.find((i) => i.type === 'compound-selector');
  assert.ok(item, 'expected a compound selector');
  return item as CompoundSelector;
}

function firstSimple(list: SelectorList): SimpleSelector {
  const simple = firstCompound(list).selectors[0];
  assert.ok(simple, 'expected a simple selector');
  return simple;
}

function protoFn(name: string): (...args: unknown[]) => unknown {
  const fn = Reflect.get(Object.getPrototypeOf(new SelectorParser([])), name);
  assert.equal(typeof fn, 'function', name);
  return fn as (...args: unknown[]) => unknown;
}

function callPrivate(parser: SelectorParser, name: string, ...args: unknown[]): unknown {
  return protoFn(name).apply(parser, args);
}

function hasAmpersand(values: ComponentValue[]): boolean {
  const result = callPrivate(new SelectorParser([]), 'hasAmpersand', values);
  assert.equal(typeof result, 'boolean');
  return result as boolean;
}

function ident(value: string): ComponentValue {
  return { type: 'ident', value };
}

function delim(value: string): ComponentValue {
  return { type: 'delim', value };
}

function colon(): ComponentValue {
  return { type: 'colon', value: ':' };
}

function num(value: number, numberType: 'integer' | 'number' = 'integer', sign: '+' | '-' | null = null): NumberToken {
  return { type: 'number', value, numberType, sign };
}

function dim(value: number, unit: string, numberType: 'integer' | 'number' = 'integer', sign: '+' | '-' | null = null): DimensionToken {
  return { type: 'dimension', value, unit, numberType, sign };
}

function fn(name: string, value: ComponentValue[]): CSSFunction {
  return { type: 'function', name, value };
}

function nthThrows(arg: ComponentValue[], needle?: string): void {
  assert.throws(
    () => new SelectorParser([colon(), fn('nth-child', arg)]).parse(),
    (err: unknown) => syntaxError(err, needle),
  );
}

function sparseAfter(prefix: ComponentValue[]): ComponentValue[] {
  const values = prefix.slice();
  values.length = prefix.length + 1;
  return values;
}

function cursorOf(parser: SelectorParser): ComponentValueCursor {
  const cursor = Reflect.get(parser, 'cursor');
  assert.ok(cursor instanceof ComponentValueCursor);
  return cursor;
}

describe('MC/DC still-hot unique-cause: hasAmpersand delim / block / function', () => {
  test('isDelimToken(&) vs isSimpleBlock vs isCSSFunction unique-cause of the some() walk', () => {
    // selectors-4 #nest-selector. Dead on parse(); isolate the unused walker.
    assert.equal(hasAmpersand([delim('&')]), true);
    assert.equal(hasAmpersand([delim('.')]), false);
    assert.equal(hasAmpersand([ident('div')]), false);
    assert.equal(hasAmpersand([ident('div'), delim('&')]), true);

    const ampBlock = valuesOf('[&]');
    assert.equal(hasAmpersand(ampBlock), true);
    const attrBlock = valuesOf('[attr]');
    assert.equal(hasAmpersand(attrBlock), false);
    const parenAmp = valuesOf('( & )');
    assert.equal(hasAmpersand(parenAmp), true);
    const parenEmpty = valuesOf('()');
    assert.equal(hasAmpersand(parenEmpty), false);

    const isAmp = valuesOf(':is(&)');
    assert.equal(hasAmpersand(isAmp), true);
    const isClass = valuesOf(':is(.x)');
    assert.equal(hasAmpersand(isClass), false);
    const notEmpty = valuesOf(':not()');
    assert.equal(hasAmpersand(notEmpty), false);

    // nested block-in-function and function-in-block
    assert.equal(hasAmpersand(valuesOf(':is([&])')), true);
    assert.equal(hasAmpersand(valuesOf('[:is(&)]')), true);
    assert.equal(hasAmpersand(valuesOf(':is([attr])')), false);
    assert.equal(hasAmpersand(valuesOf('[:is(.x)]')), false);

    assert.equal(hasAmpersand([]), false);
    assert.equal(hasAmpersand([{ type: 'whitespace', value: ' ' }]), false);
  });
});

describe('MC/DC still-hot unique-cause: parse() forgiving leading-trim while', () => {
  test('trimmedStart < length AND first whitespace T (skipWhitespace no-op isolation)', () => {
    // selectors-4 #forgiving-selector. Leftover skipWhitespace before start
    // made the T,T while row unreachable. Stub isolates the trim loop.
    const parser = new SelectorParser(valuesOf('  ###,.ok'), { forgiving: true });
    cursorOf(parser).skipWhitespace = () => {};
    const list = parser.parse();
    assert.equal(list.selectors.length, 2);
    assert.equal(list.selectors[0].type, 'invalid-selector');
    const tokens = (list.selectors[0] as InvalidSelector).tokens;
    // while T,T consumed the leading whitespace; failedTokens is trimmed.
    assert.equal(valuesOf('  ###,.ok')[0]?.type, 'whitespace');
    assert.equal(tokens[0]?.type, 'delim');
    assert.equal(list.selectors[1].type, 'complex-selector');

    // length F still: empty comma item (no-op skip leaves the comma)
    const emptyItem = new SelectorParser(valuesOf(',.ok'), { forgiving: true });
    cursorOf(emptyItem).skipWhitespace = () => {};
    const emptyList = emptyItem.parse();
    assert.equal(emptyList.selectors.length, 1);
    assert.equal(emptyList.selectors[0].type, 'complex-selector');

    // T,F: leftover tight ### already; keep a no-stub pair
    const tight = parseSel('###,.ok', { forgiving: true });
    assert.equal(tight.selectors[0].type, 'invalid-selector');
    assert.equal((tight.selectors[0] as InvalidSelector).tokens[0]?.type !== 'whitespace', true);
  });
});

describe('MC/DC still-hot unique-cause: tryConsumeCombinator / type / attribute private arms', () => {
  test('tryConsumeCombinator !token unique-cause at EOF', () => {
    // selectors-4 #combinators. Complex loop breaks on !hasNext before this.
    const parser = new SelectorParser([]);
    assert.equal(callPrivate(parser, 'tryConsumeCombinator'), null);
    assert.equal(callPrivate(new SelectorParser(valuesOf('> .a')), 'tryConsumeCombinator') !== null, true);
  });

  test('consumeTypeOrUniversalSelector !token EOF vs | nextPipe T', () => {
    // selectors-4 #type-selector. Caller only invokes with ident/* /|.
    assert.throws(
      () => callPrivate(new SelectorParser([]), 'consumeTypeOrUniversalSelector'),
      (err: unknown) => syntaxError(err, 'Unexpected EOF in type selector'),
    );

    // token '|' AND isNextPipe T — caller breaks on || before this arm
    assert.throws(
      () => callPrivate(new SelectorParser(valuesOf('||div')), 'consumeTypeOrUniversalSelector'),
      (err: unknown) => syntaxError(err, 'Expected identifier or * after namespace pipe'),
    );
    const emptyNs = callPrivate(new SelectorParser(valuesOf('|div')), 'consumeTypeOrUniversalSelector') as SimpleSelector;
    assert.equal(emptyNs.type, 'type-selector');
    assert.equal((emptyNs as { namespace?: string }).namespace, '');
  });

  test('consumeAttributeSelector !isSimpleBlock unique-cause', () => {
    // selectors-4 #attribute-selectors. Caller already checked isSimpleBlock('[').
    assert.throws(
      () => callPrivate(new SelectorParser([ident('div')]), 'consumeAttributeSelector'),
      (err: unknown) => syntaxError(err, 'Expected attribute selector block'),
    );
    const attr = callPrivate(new SelectorParser(valuesOf('[attr]')), 'consumeAttributeSelector') as SimpleSelector;
    assert.equal(attr.type, 'attribute-selector');
  });
});

describe('MC/DC still-hot unique-cause: consumeCompoundSelector ~ / ident-after-PE / hole', () => {
  test('val === "~" unique-cause of the combinator-break OR (no whitespace)', () => {
    // selectors-4 #subsequent-sibling-combinators. Leftover used `a ~ b` (ws
    // breaks the compound before L337). Tight `div~span` evaluates `~`.
    const sib = firstComplex(parseSel('div~span'));
    assert.equal((sib.items[1] as Combinator).value, '~');
    const classes = firstComplex(parseSel('.a~.b'));
    assert.equal((classes.items[1] as Combinator).value, '~');
    assert.equal(CSS.supports('selector(div~span)'), true);
    const sheet = parse('div~span { color: red; }');
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
    assert.equal(sheet.cssRules[0].selectorText.includes('~'), true);

    // F,F,F already: class / star / pipe. Keep a local pair.
    assert.equal(firstSimple(parseSel('.foo')).type, 'class-selector');
    assert.equal((firstComplex(parseSel('div>span')).items[1] as Combinator).value, '>');
    assert.equal((firstComplex(parseSel('div+span')).items[1] as Combinator).value, '+');
  });

  test('lastPseudoElement T unique-cause of the ident arm (crafted tokens)', () => {
    // selectors-4 #compound. `::beforediv` tokenizes as one ident (unknown PE).
    // Separate ident after ::before needs a token split.
    const crafted: ComponentValue[] = [colon(), colon(), ident('before'), ident('span')];
    assert.throws(
      () => new SelectorParser(crafted).parse(),
      (err: unknown) => syntaxError(err, 'Pseudo-element must be at the end'),
    );
    const parser = new SelectorParser(crafted);
    const compound = callPrivate(parser, 'consumeCompoundSelector') as CompoundSelector;
    assert.equal(compound.selectors.length, 1);
    assert.equal(compound.selectors[0].type, 'pseudo-element-selector');
    assert.equal(cursorOf(parser).next?.type, 'ident');

    // lastPseudoElement F
    assert.equal(firstSimple(parseSel('div')).type, 'type-selector');
    assert.equal(parseSel('div.class').selectors.length, 1);
  });

  test('!token unique-cause via a hole after a type selector', () => {
    // hasNext T with a hole: token is undefined without whitespace/comma.
    const parser = new SelectorParser(sparseAfter([ident('div')]));
    const compound = callPrivate(parser, 'consumeCompoundSelector') as CompoundSelector;
    assert.equal(compound.selectors.length, 1);
    assert.equal(compound.selectors[0].type, 'type-selector');

    const ws = callPrivate(
      new SelectorParser([ident('div'), { type: 'whitespace', value: ' ' }, ident('span')]),
      'consumeCompoundSelector',
    ) as CompoundSelector;
    assert.equal(ws.selectors.length, 1);

    const comma = callPrivate(
      new SelectorParser([ident('div'), { type: 'comma', value: ',' }, ident('span')]),
      'consumeCompoundSelector',
    ) as CompoundSelector;
    assert.equal(comma.selectors.length, 1);
  });

  test('validateSimpleSelectorAfterPseudo type F and non-PC after PE', () => {
    // selectors-4 #pseudo-elements. Caller only forwards pseudo-classes.
    const parser = new SelectorParser([]);
    assert.throws(
      () => callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'type-selector', name: 'div' }),
      (err: unknown) => syntaxError(err, 'Only user-action pseudo-classes'),
    );
    assert.throws(
      () => callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'class-selector', name: 'x' }),
      (err: unknown) => syntaxError(err, 'Only user-action pseudo-classes'),
    );
    assert.throws(
      () => callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'id-selector', name: 'x' }),
      (err: unknown) => syntaxError(err, 'Only user-action pseudo-classes'),
    );
    assert.throws(
      () => callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'nesting-selector' }),
      (err: unknown) => syntaxError(err, 'Only user-action pseudo-classes'),
    );
    callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'pseudo-class-selector', name: 'hover' });
    callPrivate(parser, 'validateSimpleSelectorAfterPseudo', { type: 'pseudo-class-selector', name: 'is' });

    // consumePseudoSelector never yields a third type; stub isolates L400 else.
    const peParser = new SelectorParser(valuesOf('::before:hover'));
    const orig = protoFn('consumePseudoSelector');
    let calls = 0;
    Reflect.set(peParser, 'consumePseudoSelector', function (this: SelectorParser) {
      calls += 1;
      if (calls === 1) return orig.call(this);
      const cur = cursorOf(this);
      cur.consume();
      cur.consume();
      return { type: 'nesting-selector' };
    });
    assert.throws(
      () => peParser.parse(),
      (err: unknown) => syntaxError(err, 'Unexpected selector after pseudo-element'),
    );
    assert.equal(calls, 2);
  });
});

describe('MC/DC still-hot unique-cause: type *|| and attribute * without pipe', () => {
  test('*|| unique-cause of isColumnCombinator on the universal-prefix arm', () => {
    // selectors-4 #column-combinator. Leftover had ns||div (ident arm) only.
    const col = firstComplex(parseSel('*||div'));
    assert.equal((col.items[0] as CompoundSelector).selectors[0].type, 'universal-selector');
    assert.equal((col.items[1] as Combinator).value, '||');
    assert.equal(((col.items[2] as CompoundSelector).selectors[0] as { name?: string }).name, 'div');
    assert.ok(Parser.parseSelectorAST('*||span'));
    assert.equal(CSS.supports('selector(*||div)'), true);

    // isColumnCombinator F: *|div still a namespace prefix
    const starNs = firstSimple(parseSel('*|div')) as { namespace?: string };
    assert.equal(starNs.namespace, '*');
    // isNextPipe F: bare *
    assert.equal(firstSimple(parseSel('*')).type, 'universal-selector');
  });

  test('[*attr] unique-cause of isDelimToken(v2, "|") F on the *| arm', () => {
    // Leftover [*|attr] / [*|=val] never evaluated v2 !== '|'.
    throwsSel('[*attr]', {}, 'Expected attribute name');
    throwsSel('[*]', {}, 'Expected attribute name');
    throwsSel('[*=x]', {}, 'Expected attribute name');
    throwsSel('[* i]', {}, 'Expected attribute name');

    assert.equal((firstSimple(parseSel('[*|attr]')) as { namespace?: string }).namespace, '*');
    throwsSel('[*|=val]', {}, 'Unexpected content');
  });
});

describe('MC/DC still-hot unique-cause: consumePseudoSelector !token', () => {
  test('consume() falsy unique-cause of empty pseudo-class name', () => {
    // cursor.consume coalesces holes to EOF (truthy). Override isolates !token.
    const parser = new SelectorParser([colon()]);
    const cur = cursorOf(parser);
    const orig = cur.consume.bind(cur);
    let n = 0;
    cur.consume = () => {
      n += 1;
      const v = orig();
      if (n === 1) return v;
      return undefined as unknown as ComponentValue;
    };
    const list = parser.parse();
    assert.equal(firstSimple(list).type, 'pseudo-class-selector');
    assert.equal((firstSimple(list) as { name: string }).name, '');
    assert.equal(n, 2);

    // token T: leftover `:` throws (EOF ident miss), `:hover` succeeds
    throwsSel(':', {}, 'Expected identifier or function after colon');
    assert.equal(firstSimple(parseSel(':hover')).type, 'pseudo-class-selector');
  });
});

describe('MC/DC still-hot unique-cause: parseAnPlusB leftover independence rows', () => {
  test('!t1 unique-cause after plusPrefix via a hole', () => {
    // css-syntax-3 #anb-microsyntax. Dense `+` is length-1; hole makes idx=1 miss.
    const hole = sparseAfter([delim('+')]);
    assert.equal(parseAnPlusB(hole), null);
    assert.deepEqual(parseAnPlusB([delim('+'), ident('n')]), { a: 1, b: 0 });
    // Hole in :nth-child() hits getOriginalText on the undefined slot (not SyntaxError).
  });

  test('lower === "-n-" AND plusPrefix T unique-cause', () => {
    // leftover +-n / +-n-1 never hit the exact ident `-n-`.
    throwsSel(':nth-child(+-n-)', {}, 'Invalid An+B');
    throwsSel(':nth-child(+-n- 1)', {}, 'Invalid An+B');
    assert.equal(parseAnPlusB([delim('+'), ident('-n-')]), null);
    assert.equal(parseAnPlusB([delim('+'), ident('-n-'), num(1)]), null);
    // plusPrefix F
    assert.deepEqual(parseAnPlusB([ident('-n-'), num(1)]), { a: -1, b: -1 });
    assert.ok(parseSel(':nth-child(-n- 1)'));
  });

  test('n-foo unique-cause of /^n-(\\d+)$/ match F with extra tokens', () => {
    // leftover n-5 + x is match T, idx last F; need startsWith n- but not digits.
    assert.equal(parseAnPlusB([delim('+'), ident('n-foo')]), null);
    assert.equal(parseAnPlusB([ident('n-foo'), ident('x')]), null);
    assert.equal(parseAnPlusB([ident('n-1x'), ident('x')]), null);
    nthThrows([delim('+'), ident('n-foo')], 'Invalid An+B');
    nthThrows([ident('n-abc'), ident('x')], 'Invalid An+B');
    throwsSel(':nth-child(+n-foo)', {}, 'Invalid An+B');
    // match T
    assert.deepEqual(parseAnPlusB([delim('+'), ident('n-5')]), { a: 1, b: -5 });
    nthThrows([ident('n-5'), ident('x')], 'Invalid An+B');
  });

  test('dimension numberType === "integer" F with length > 1', () => {
    // leftover 2.5n is length-1 (other decision). Need extra tokens.
    throwsSel(':nth-child(2.5n+1)', {}, 'Invalid An+B');
    throwsSel(':nth-child(2.5n-3)', {}, 'Invalid An+B');
    assert.equal(parseAnPlusB([dim(2.5, 'n', 'number'), delim('+'), num(1)]), null);
    nthThrows([dim(3, 'n', 'number'), num(1, 'integer', '+')], 'Invalid An+B');
    // integer T, plusPrefix F
    assert.deepEqual(parseAnPlusB([dim(3, 'n'), delim('+'), num(1)]), { a: 3, b: 1 });
    assert.ok(parseSel(':nth-child(3n+1)'));
  });

  test('hasDashAfterN T unique-cause of the no-more-tokens arm (+n-)', () => {
    // leftover n- / 2n- are length-1. plusPrefix + ident `n-` reaches L901.
    throwsSel(':nth-child(+n-)', {}, 'Invalid An+B');
    assert.equal(parseAnPlusB([delim('+'), ident('n-')]), null);
    nthThrows([delim('+'), ident('n-')], 'Invalid An+B');
    // hasDashAfterN F, no more tokens
    assert.deepEqual(parseAnPlusB([delim('+'), ident('n')]), { a: 1, b: 0 });
    assert.ok(parseSel(':nth-child(+n)'));
    // hasDashAfterN T with a following unsigned integer
    assert.deepEqual(parseAnPlusB([ident('n-'), num(4)]), { a: 1, b: -4 });
  });
});
