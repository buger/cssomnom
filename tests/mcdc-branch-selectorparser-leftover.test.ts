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
// Leftover unique-cause for src/SelectorParser.ts. Drive SelectorParser.parse
// or CSS APIs (Parser.parseSelectorAST / CSS.supports / parse / insertRule /
// matches). No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { SelectorParser } from '../src/SelectorParser.ts';
import type { SelectorParserOptions } from '../src/SelectorParser.ts';
import { Parser, parse } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSS } from '../src/parser-api.ts';
import { matches } from '../src/matcher.ts';
import { CSSStyleSheet, CSSStyleRule } from '../src/CSSOM.ts';
import type {
  Combinator,
  ComplexSelector,
  ComponentValue,
  CompoundSelector,
  CSSFunction,
  DimensionToken,
  InvalidSelector,
  NumberToken,
  PseudoElementSelector,
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

function sheetSelector(css: string): string | null {
  const sheet = parse(`${css} { color: red; }`);
  if (sheet.cssRules.length === 0) return null;
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  return sheet.cssRules[0].selectorText;
}

function fn(name: string, value: ComponentValue[]): CSSFunction {
  return { type: 'function', name, value };
}

function num(value: number, numberType: 'integer' | 'number' = 'integer', sign: '+' | '-' | null = null): NumberToken {
  return { type: 'number', value, numberType, sign };
}

function dim(value: number, unit: string, numberType: 'integer' | 'number' = 'integer', sign: '+' | '-' | null = null): DimensionToken {
  return { type: 'dimension', value, unit, numberType, sign };
}

function nthChild(arg: ComponentValue[]): SelectorList {
  return new SelectorParser([{ type: 'colon', value: ':' }, fn('nth-child', arg)]).parse();
}

function nthThrows(arg: ComponentValue[], needle?: string): void {
  assert.throws(() => nthChild(arg), (err: unknown) => syntaxError(err, needle));
}

describe('MC/DC leftover unique-cause: SelectorParser.parse list (selectors-4 #selector-list, #forgiving-selector)', () => {
  test('empty list unique-cause of !forgiving AND selectors.length===0', () => {
    // !forgiving T, length===0 T
    throwsSel('', {}, 'Selector list cannot be empty');
    throwsSel('   ', {}, 'Selector list cannot be empty');

    // !forgiving F, length===0 T
    const emptyForgiving = parseSel('', { forgiving: true });
    assert.equal(emptyForgiving.selectors.length, 0);
    assert.equal(parseSel('   ', { forgiving: true }).selectors.length, 0);

    // !forgiving T, length===0 F
    assert.equal(parseSel('div').selectors.length, 1);
    assert.equal(firstSimple(parseSel('div')).type, 'type-selector');
  });

  test('comma / EOF / unexpected-token unique-cause after a complex selector', () => {
    // next.type==='comma' T, !next F
    const list = parseSel('div, span, #id');
    assert.equal(list.selectors.length, 3);

    // !next T (EOF after skipWhitespace)
    assert.equal(parseSel('div').selectors.length, 1);
    assert.equal(parseSel('div ').selectors.length, 1);

    // both F → unexpected token
    throwsSel('div ;', {}, 'Unexpected token');
    throwsSel('div .class ;', {}, 'Unexpected token');
    throwsSel('div 123', {}, 'Unexpected token');
  });

  test('forgiving catch unique-cause of whitespace-trim AND failedTokens.length', () => {
    // failedTokens.length>0 T, leading+trailing whitespace T
    const padded = parseSel('  ###  , .ok', { forgiving: true });
    assert.equal(padded.selectors.length, 2);
    assert.equal(padded.selectors[0].type, 'invalid-selector');
    assert.equal(padded.selectors[1].type, 'complex-selector');

    // failedTokens.length>0 T, trim loops F (no surrounding whitespace)
    const tight = parseSel('###,.ok', { forgiving: true });
    assert.equal(tight.selectors[0].type, 'invalid-selector');
    assert.equal((tight.selectors[0] as InvalidSelector).tokens.length > 0, true);

    // failedTokens.length>0 F: whitespace-only / empty comma item is not pushed
    const emptyItem = parseSel(' , .ok', { forgiving: true });
    assert.equal(emptyItem.selectors.length, 1);
    assert.equal(emptyItem.selectors[0].type, 'complex-selector');
    const trailing = parseSel('.ok,  ', { forgiving: true });
    assert.equal(trailing.selectors.length, 1);

    // unforgiving rethrow unique-cause of forgiving F
    throwsSel('###, .ok', { forgiving: false }, 'Complex selector cannot be empty');
  });

  test('hasNext / EOF-token unique-cause of the parse loop break', () => {
    // next.type==='EOF' T after a comma (start-of-iteration break, not trailing-token)
    const withEof = new SelectorParser([
      { type: 'ident', value: 'div' },
      { type: 'comma', value: ',' },
      { type: 'EOF', value: '' },
    ], { forgiving: true }).parse();
    assert.equal(withEof.selectors.length, 1);

    const onlyEof = new SelectorParser([{ type: 'EOF', value: '' }], { forgiving: true }).parse();
    assert.equal(onlyEof.selectors.length, 0);

    // EOF after a selector (not comma) is unexpected, not the loop-break arm
    assert.throws(() => new SelectorParser([
      { type: 'ident', value: 'div' },
      { type: 'EOF', value: '' },
    ]).parse(), (err: unknown) => syntaxError(err, 'Unexpected token'));
  });
});

describe('MC/DC leftover unique-cause: validateNamespace (selectors-4 #type-ns-attr)', () => {
  test('declaredNamespaces AND prefix unique-cause of undeclared vs * vs empty vs missing', () => {
    const declared = new Set(['ns']);

    // declaredNamespaces!==undefined T, namespace set, not *, not '', !has T
    throwsSel('other|div', { declaredNamespaces: declared }, 'Undeclared namespace');
    throwsSel('[other|attr]', { declaredNamespaces: declared }, 'Undeclared namespace');

    // !has F (declared)
    assert.equal(firstSimple(parseSel('ns|div', { declaredNamespaces: declared })).type, 'type-selector');
    assert.equal(firstSimple(parseSel('[ns|attr]', { declaredNamespaces: declared })).type, 'attribute-selector');

    // namespace==='*' unique-cause (skip has())
    assert.equal(firstSimple(parseSel('*|div', { declaredNamespaces: new Set() })).type, 'type-selector');
    assert.equal(firstSimple(parseSel('[*|attr]', { declaredNamespaces: new Set() })).type, 'attribute-selector');

    // namespace==='' unique-cause
    assert.equal(firstSimple(parseSel('|div', { declaredNamespaces: new Set() })).type, 'type-selector');
    assert.equal(firstSimple(parseSel('[|attr]', { declaredNamespaces: new Set() })).type, 'attribute-selector');

    // namespace===undefined unique-cause (no prefix)
    assert.equal(firstSimple(parseSel('div', { declaredNamespaces: new Set() })).type, 'type-selector');
    assert.equal(firstSimple(parseSel('[attr]', { declaredNamespaces: new Set() })).type, 'attribute-selector');

    // declaredNamespaces===undefined unique-cause: prefix is not checked
    assert.equal(firstSimple(parseSel('undeclared|div')).type, 'type-selector');
    assert.equal(sheetSelector('undeclared|div'), null);
  });

  test('CSS parse / insertRule unique-cause of @namespace declaration vs drop', () => {
    const ok = parse('@namespace ns "http://example.com"; ns|div { color: red; } *|span { color: blue; } |p { color: green; }');
    assert.equal(ok.cssRules.length, 4);
    assert.ok(ok.cssRules[1] instanceof CSSStyleRule);
    assert.equal(ok.cssRules[1].selectorText.includes('ns|div'), true);

    const dropped = parse('other|div { color: red; } div { color: blue; }');
    assert.equal(dropped.cssRules.length, 1);
    assert.ok(dropped.cssRules[0] instanceof CSSStyleRule);
    assert.equal(dropped.cssRules[0].selectorText, 'div');

    const sheet = new CSSStyleSheet();
    assert.throws(() => sheet.insertRule('ns|div { color: red; }'), (err: unknown) => syntaxError(err));
    assert.throws(() => sheet.insertRule('[other|attr] { color: red; }'), (err: unknown) => syntaxError(err));
    sheet.insertRule('@namespace ns "http://example.com";', 0);
    sheet.insertRule('div { color: red; }', 1);
    const rule = sheet.cssRules[1];
    assert.ok(rule instanceof CSSStyleRule);
    rule.selectorText = 'ns|div';
    assert.equal(rule.selectorText, 'ns|div');
    const original = rule.selectorText;
    rule.selectorText = 'other|div';
    assert.equal(rule.selectorText, original);
  });
});

describe('MC/DC leftover unique-cause: consumeComplexSelector combinators (selectors-4 #combinators, #relative-selector)', () => {
  test('leading combinator unique-cause of items.length===0 AND !allowRelative', () => {
    // items.length===0 T, !allowRelative T
    throwsSel('> .foo', {}, 'Relative selector not allowed');
    throwsSel('+ .foo', {}, 'Relative selector not allowed');
    throwsSel('~ .foo', {}, 'Relative selector not allowed');
    throwsSel('|| .foo', {}, 'Relative selector not allowed');

    // items.length===0 T, !allowRelative F
    const rel = parseSel('> .foo, + .bar, ~ .baz, || .col', { allowRelative: true });
    assert.equal(rel.selectors.length, 4);
    assert.equal((firstComplex(rel).items[0] as Combinator).value, '>');

    // items.length===0 F (non-leading)
    assert.equal(parseSel('.foo > .bar').selectors.length, 1);
    assert.equal(Parser.parseSelectorAST('> .foo'), null);
    assert.ok(Parser.parseSelectorAST('> .foo', undefined, true));
  });

  test('> + ~ || unique-cause of tryConsumeCombinator OR and column AND', () => {
    const child = firstComplex(parseSel('a > b'));
    assert.equal((child.items[1] as Combinator).value, '>');
    const adj = firstComplex(parseSel('a + b'));
    assert.equal((adj.items[1] as Combinator).value, '+');
    const sib = firstComplex(parseSel('a ~ b'));
    assert.equal((sib.items[1] as Combinator).value, '~');

    // val==='|' T AND peek '||' T
    const col = firstComplex(parseSel('a || b'));
    assert.equal((col.items[1] as Combinator).value, '||');
    assert.ok(Parser.parseSelectorAST('a||b'));

    // val==='|' T AND peek '||' F → whitespace-separated `|b` is a descendant of a null-namespace type
    const pipe = firstComplex(parseSel('a |b'));
    assert.equal(pipe.items.length, 3);
    assert.equal((pipe.items[1] as Combinator).value, ' ');
    const nsType = (pipe.items[2] as CompoundSelector).selectors[0];
    assert.equal(nsType.type, 'type-selector');
    assert.equal((nsType as { namespace?: string }).namespace, '');
    throwsSel('a | b', {}, 'Expected identifier or * after namespace pipe');

    // delim that is not a combinator
    assert.equal(firstSimple(parseSel('.foo')).type, 'class-selector');
  });

  test('consecutive / trailing combinator unique-cause of last-item-is-combinator AND', () => {
    // items.length>0 T, last combinator T
    throwsSel('.a + + .b', {}, 'Consecutive combinators');
    throwsSel('.a > > .b', {}, 'Consecutive combinators');
    throwsSel('.a || + .b', {}, 'Consecutive combinators');
    throwsSel('.a >', {}, 'Trailing combinator');
    throwsSel('.a ||', {}, 'Trailing combinator');
    throwsSel('.a + ', {}, 'Trailing combinator');

    // last combinator F
    assert.equal(parseSel('.a + .b').selectors.length, 1);

    // items.length>0 F: empty complex (not trailing)
    throwsSel('123', {}, 'Complex selector cannot be empty');
  });

  test('descendant insertion unique-cause of previous compound AND seenPseudoElement', () => {
    // previous compound T → implicit ' '
    const desc = firstComplex(parseSel('div span'));
    assert.equal(desc.items.length, 3);
    assert.equal((desc.items[1] as Combinator).value, ' ');

    // previous combinator (insertion F)
    const child = firstComplex(parseSel('div > span'));
    assert.equal(child.items.length, 3);
    assert.equal((child.items[1] as Combinator).value, '>');

    // seenPseudoElement T after a following compound
    throwsSel('div::before span', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before + span', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before > span', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before ~ span', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before || span', {}, 'Pseudo-element must be at the end');

    // seenPseudoElement F
    assert.equal(parseSel('div span::before').selectors.length, 1);
  });
});

describe('MC/DC leftover unique-cause: consumeCompoundSelector (selectors-4 #compound)', () => {
  test('type / universal must-be-first unique-cause after another simple', () => {
    throwsSel('[attr]div', {}, 'Type selector must be first');
    throwsSel('.foo|div', {}, 'Type selector must be first');
    throwsSel('[attr]*', {}, 'Universal selector must be first');
    throwsSel(':hover*', {}, 'Universal selector must be first');
    throwsSel('&foo', {}, 'Type selector must be first');
    assert.equal(firstCompound(parseSel('div.foo')).selectors.length, 2);
    assert.equal(firstCompound(parseSel('*.foo')).selectors.length, 2);
  });

  test('lastPseudoElement unique-cause of each simple after ::before vs ::slotted/::part', () => {
    // lastPseudoElement T, isSlottedOrPart F → break then PE-at-end
    throwsSel('div::before.class', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before#id', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before[attr]', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before*', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before|span', {}, 'Pseudo-element must be at the end');
    throwsSel('div::before&', {}, 'Pseudo-element must be at the end');

    // lastPseudoElement F
    assert.equal(parseSel('div.class#id[attr]').selectors.length, 1);
    assert.equal(firstSimple(parseSel('&')).type, 'nesting-selector');

    // isSlottedOrPart T unique-cause of slotted vs part vs neither
    assert.ok(parseSel('::slotted(span):checked'));
    assert.ok(parseSel('::slotted(span)::before'));
    assert.ok(parseSel('::part(button):checked'));
    assert.ok(parseSel('::part(button)::selection'));
    throwsSel('div::before::after', {}, 'Pseudo-elements cannot be nested');
    throwsSel('div::before:checked', {}, 'Only user-action pseudo-classes');
  });

  test('user-action / logical-pseudo unique-cause after a pseudo-element', () => {
    // isUserActionPseudoClass T unique-cause of each name
    for (const name of ['hover', 'active', 'focus', 'focus-visible', 'focus-within']) {
      assert.equal(parseSel(`div::before:${name}`).selectors.length, 1);
      assert.equal(parseSel(`div::before:${name.toUpperCase()}`).selectors.length, 1);
    }

    // logical :not/:is/:where/:has unique-cause of includes()
    assert.ok(parseSel('::before:not(:hover)'));
    assert.ok(parseSel('::before:is(.x)'));
    assert.ok(parseSel('::before:where(.x)'));
    assert.ok(parseSel('::before:has(.x)'));

    // both F: :matches is not in the logical list and is not user-action
    throwsSel('::before:matches(.x)', {}, 'Only user-action pseudo-classes');
    throwsSel('::before:lang(en)', {}, 'Only user-action pseudo-classes');
  });

  test('hashType id unique-cause and class ident unique-cause', () => {
    // hashType==='id' T
    assert.equal(firstSimple(parseSel('#foo')).type, 'id-selector');
    assert.equal(firstSimple(parseSel('#_id')).type, 'id-selector');

    // hashType==='id' F (unrestricted)
    throwsSel('#123', {}, 'ID selector must be an identifier');
    throwsSel('div#123', {}, 'ID selector must be an identifier');
    assert.equal(Parser.parseSelectorAST('#123'), null);

    // isIdentToken after '.' T vs F
    assert.equal((firstSimple(parseSel('.foo')) as { name: string }).name, 'foo');
    const emptyClass = parseSel('.');
    assert.equal(firstSimple(emptyClass).type, 'class-selector');
    assert.equal((firstSimple(emptyClass) as { name: string }).name, '');
    // `.123` tokenizes as a number, so the compound is empty (not delim '.' + number)
    throwsSel('.123', {}, 'Complex selector cannot be empty');
    // leftover !isIdentToken after '.': next token is consumed as the empty name
    assert.equal((firstSimple(parseSel('.>')) as { name: string }).name, '');
    assert.equal((firstSimple(parseSel('.#x')) as { name: string }).name, '');
  });
});

describe('MC/DC leftover unique-cause: type / universal namespace prefix (selectors-4 #type-selector)', () => {
  test('ident| vs *| vs | vs || unique-cause of the prefix AND/OR', () => {
    // ident T, nextPipe T, !column T
    const ns = firstSimple(parseSel('ns|div')) as { type: string; namespace?: string; name?: string };
    assert.equal(ns.type, 'type-selector');
    assert.equal(ns.namespace, 'ns');
    assert.equal(ns.name, 'div');

    // * T, nextPipe T, !column T
    const starNs = firstSimple(parseSel('*|div')) as { type: string; namespace?: string };
    assert.equal(starNs.namespace, '*');

    // delim '|' T, nextPipe F
    const emptyNs = firstSimple(parseSel('|div')) as { type: string; namespace?: string };
    assert.equal(emptyNs.namespace, '');

    // nextPipe T, column T (||) — prefix is not consumed as a namespace
    const column = firstComplex(parseSel('ns||div'));
    assert.equal((column.items[0] as CompoundSelector).selectors[0].type, 'type-selector');
    assert.equal((column.items[1] as Combinator).value, '||');

    // universal without prefix
    assert.equal(firstSimple(parseSel('*')).type, 'universal-selector');
    const nsStar = firstSimple(parseSel('ns|*')) as { type: string; namespace?: string };
    assert.equal(nsStar.type, 'universal-selector');
    assert.equal(nsStar.namespace, 'ns');

    // ident after pipe F
    throwsSel('ns|123', {}, 'Expected identifier or * after namespace pipe');
    throwsSel('ns|', {}, 'Expected identifier or * after namespace pipe');
  });
});

describe('MC/DC leftover unique-cause: attribute selector (selectors-4 #attribute-selectors, #attribute-case)', () => {
  test('namespace prefix unique-cause of ident| vs *| vs | vs |=', () => {
    // ident T, pipe T, !pipeEquals T
    const ns = firstSimple(parseSel('[ns|attr]')) as { namespace?: string; name: string };
    assert.equal(ns.namespace, 'ns');
    assert.equal(ns.name, 'attr');

    // * T, pipe T, !pipeEquals T
    assert.equal((firstSimple(parseSel('[*|attr]')) as { namespace?: string }).namespace, '*');

    // '|' T, v2 not '='
    assert.equal((firstSimple(parseSel('[|attr]')) as { namespace?: string }).namespace, '');

    // ident T, pipe T, !pipeEquals F → |= operator, no namespace
    const pipeEq = firstSimple(parseSel('[attr|=val]')) as { namespace?: string; operator: string; value: string };
    assert.equal(pipeEq.namespace, undefined);
    assert.equal(pipeEq.operator, '|=');
    assert.equal(pipeEq.value, 'val');

    // *|= : !isPipeFollowedByEquals F on the *| arm; '*' is consumed as operator, leftover '|'
    throwsSel('[*|=val]', {}, 'Unexpected content');
    // |= : '|' AND v2==='=' unique-cause F, then !name
    throwsSel('[|=val]', {}, 'Expected attribute name');
    throwsSel('[]', {}, 'Expected attribute name');
  });

  test('operator / value / flags unique-cause of ident vs string vs i vs s', () => {
    const eq = firstSimple(parseSel('[attr=val]')) as { operator: string; value: string };
    assert.equal(eq.operator, '=');
    assert.equal(eq.value, 'val');

    const quoted = firstSimple(parseSel('[attr="val"]')) as { value: string };
    assert.equal(quoted.value, 'val');

    for (const op of ['~=', '|=', '^=', '$=', '*=']) {
      const sel = firstSimple(parseSel(`[attr${op}x]`)) as { operator: string };
      assert.equal(sel.operator, op, op);
    }

    // no operator, no value
    const bare = firstSimple(parseSel('[attr]')) as { operator: string; value: string };
    assert.equal(bare.operator, '');
    assert.equal(bare.value, '');

    // flags: lower!=='i' F vs lower!=='s' F vs both T
    assert.equal((firstSimple(parseSel('[attr=val i]')) as { flags: string }).flags, 'i');
    assert.equal((firstSimple(parseSel('[attr=val I]')) as { flags: string }).flags, 'I');
    assert.equal((firstSimple(parseSel('[attr=val s]')) as { flags: string }).flags, 's');
    assert.equal((firstSimple(parseSel('[attr=val S]')) as { flags: string }).flags, 'S');
    throwsSel('[attr=val x]', {}, 'Invalid attribute selector flag');
    throwsSel('[attr=val ix]', {}, 'Invalid attribute selector flag');
    throwsSel('[attr=val i s]', {}, 'Unexpected content');
    throwsSel('[attr=val i garbage]', {}, 'Unexpected content');
  });
});

describe('MC/DC leftover unique-cause: consumePseudoSelector (selectors-4 #pseudo-classes, #pseudo-elements)', () => {
  test('double-colon vs single-colon leftover unique-cause of isPseudoElement', () => {
    assert.equal(firstSimple(parseSel('::before')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel(':before')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel(':after')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel(':first-line')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel(':first-letter')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel(':hover')).type, 'pseudo-class-selector');
    throwsSel(':123', {}, 'Expected identifier or function after colon');
    throwsSel(':', {}, 'Expected identifier or function after colon');
  });

  test('forbidPseudo OR insideHas unique-cause for ident and functional pseudo-elements', () => {
    // forbidPseudo T, insideHas F
    throwsSel('::before', { forbidPseudo: true }, 'Pseudo-elements are not allowed');
    throwsSel(':before', { forbidPseudo: true }, 'Pseudo-elements are not allowed');
    throwsSel('::slotted(div)', { forbidPseudo: true }, 'Pseudo-elements are not allowed');
    throwsSel(':not(::before)', {}, 'Pseudo-elements are not allowed');

    // forbidPseudo F, insideHas T
    throwsSel('::before', { insideHas: true }, 'Pseudo-elements are not allowed');
    throwsSel(':before', { insideHas: true }, 'Pseudo-elements are not allowed');
    throwsSel('::part(x)', { insideHas: true }, 'Pseudo-elements are not allowed');
    throwsSel(':has(::before)', {}, 'Pseudo-elements are not allowed');
    throwsSel(':has(:before)', {}, 'Pseudo-elements are not allowed');

    // both F
    assert.equal(parseSel('::before').selectors.length, 1);
    assert.equal(parseSel('::slotted(div)').selectors.length, 1);
  });

  test('unknown PE unique-cause of Set.has F AND (strictSupports OR !-webkit-)', () => {
    // has F, strict T (CSS.supports uses strictSupports)
    assert.equal(CSS.supports('selector(::bogus)'), false);
    assert.equal(CSS.supports('selector(::-webkit-unknown)'), false);
    throwsSel('::bogus', { strictSupports: true }, 'Unknown pseudo-element');
    throwsSel('::-webkit-unknown', { strictSupports: true }, 'Unknown pseudo-element');

    // has F, !webkit T, strict F
    throwsSel('::bogus', {}, 'Unknown pseudo-element');

    // has F, strict F, !webkit F → unknown -webkit- ident quirk
    const webkit = firstSimple(parseSel('::-webkit-unknown')) as PseudoElementSelector;
    assert.equal(webkit.type, 'pseudo-element-selector');
    assert.equal(webkit.name, '-webkit-unknown');

    // functional unknown -webkit- still throws (no ident quirk)
    throwsSel('::-webkit-unknown()', {}, 'Unknown pseudo-element');

    // has T (known) regardless of strict
    assert.equal(CSS.supports('selector(::before)'), true);
    assert.equal(CSS.supports('selector(::-webkit-progress-bar)'), true);
    assert.ok(parseSel('::-webkit-progress-bar', { strictSupports: true }));
  });

  test('unknown PC unique-cause of Set.has F AND (strictSupports OR !-webkit-) AND !== matches', () => {
    throwsSel(':bogus', {}, 'Unknown pseudo-class');
    throwsSel(':bogus', { strictSupports: true }, 'Unknown pseudo-class');
    throwsSel(':-webkit-unknown', { strictSupports: true }, 'Unknown pseudo-class');
    assert.equal((firstSimple(parseSel(':-webkit-drag')) as { name: string }).name, '-webkit-drag');
    assert.equal((firstSimple(parseSel(':-webkit-autofill')) as { name: string }).name, 'autofill');

    // functional: Set.has F AND name!=='matches'
    throwsSel(':bogus()', {}, 'Unknown pseudo-class');
    assert.equal(firstSimple(parseSel(':matches(.x)')).type, 'pseudo-class-selector');
    assert.equal(CSS.supports('selector(:hover)'), true);
    assert.equal(CSS.supports('selector(:bogus)'), false);
  });

  test('::slotted() leftover unique-cause of leftover tokens OR empty compound', () => {
    // i!==length T (complex / trailing combinator / extra tokens)
    throwsSel('::slotted(div > span)', {}, 'must be a compound selector');
    throwsSel('::slotted(div span)', {}, 'must be a compound selector');
    throwsSel('::slotted(div, span)', {}, 'must be a compound selector');

    // compound.selectors.length===0 T
    throwsSel('::slotted()', {}, 'must be a compound selector');
    throwsSel('::slotted( )', {}, 'must be a compound selector');

    // both F
    assert.equal(firstSimple(parseSel('::slotted(div.foo)')).type, 'pseudo-element-selector');
    assert.equal(firstSimple(parseSel('::part(button)')).type, 'pseudo-element-selector');
  });

  test(':is/:not/:has/:where/:matches unique-cause of forgiving, nested :has, forbidPseudo', () => {
    // isHas && insideHas T
    throwsSel(':has(:has(a))', {}, ':has() cannot be nested');
    throwsSel('.a:has(.b:has(.c))', {}, ':has() cannot be nested');

    // isHas T, insideHas F
    assert.ok(parseSel(':has(> .foo)', { allowRelative: false }));
    assert.equal((firstComplex(parseSel('div:has(> p)')).items[0] as CompoundSelector).selectors[1].type, 'pseudo-class-selector');

    // isForgiving = !strictSupports && is/where/matches
    assert.ok(parseSel(':is(.foo, ###)'));
    assert.ok(parseSel(':where(.foo, > .bar)'));
    assert.ok(parseSel(':matches(.foo, 123)'));
    throwsSel(':is(.foo, ###)', { strictSupports: true }, 'Complex selector cannot be empty');
    assert.equal(CSS.supports('selector(:is(::before))'), false);
    assert.equal(CSS.supports('selector(:is(div))'), true);

    // :not is never forgiving
    throwsSel(':not(###)', {}, 'Complex selector cannot be empty');
    throwsSel(':not()', {}, 'Selector list cannot be empty');
    assert.ok(parseSel(':is()'));
    throwsSel(':has()', {}, 'Selector list cannot be empty');
  });

  test(':host / :host-context leftover unique-cause of empty vs leftover tokens', () => {
    assert.ok(parseSel(':host(.foo)'));
    assert.ok(parseSel(':host(div.foo)'));
    assert.ok(parseSel(':host-context(.foo)'));
    throwsSel(':host()', {}, 'must be a compound selector');
    throwsSel(':host( )', {}, 'must be a compound selector');
    throwsSel(':host(div .foo)', {}, 'must be a compound selector');
    throwsSel(':host-context(div span)', {}, 'must be a compound selector');
    throwsSel(':host-context()', {}, 'must be a compound selector');
    throwsSel(':host(::before)', {}, 'Pseudo-elements are not allowed');
  });
});

describe('MC/DC leftover unique-cause: nth An+B (css-syntax-3 #anb-microsyntax, selectors-4 #nth-child-pseudo)', () => {
  test("'of' ident unique-cause and nth-of-type reject", () => {
    assert.ok(parseSel(':nth-child(2n + 1 of .foo, .bar)'));
    assert.ok(parseSel(':nth-last-child(odd of a > b)'));
    assert.ok(parseSel(':nth-child(1 OF .foo)'));

    // ofIdx!==-1 T, nth-of-type includes T
    throwsSel(':nth-of-type(1 of .foo)', {}, "'of' is not allowed");
    throwsSel(':nth-last-of-type(1 of .foo)', {}, "'of' is not allowed");

    // ofIdx===-1
    assert.ok(parseSel(':nth-of-type(2n+1)'));
    assert.ok(parseSel(':nth-last-of-type(odd)'));
    assert.ok(parseSel(':nth-child(even)'));

    // of without An+B
    throwsSel(':nth-child(of .foo)', {}, 'Invalid An+B');
    throwsSel(':nth-child(2n + 1 of)', {}, 'Selector list cannot be empty');
    throwsSel(':nth-child(1 of div::before)', {}, 'Pseudo-elements are not allowed');
    throwsSel(':nth-child(1 of > div)', {}, 'Relative selector not allowed');
  });

  test('parseAnPlusB length-1 unique-cause of odd/even/n/-n/n-digit/integer/dimension', () => {
    assert.ok(parseSel(':nth-child(odd)'));
    assert.ok(parseSel(':nth-child(even)'));
    assert.ok(parseSel(':nth-child(n)'));
    assert.ok(parseSel(':nth-child(-n)'));
    assert.ok(parseSel(':nth-child(N)'));
    assert.ok(parseSel(':nth-child(n-3)'));
    assert.ok(parseSel(':nth-child(-n-3)'));
    assert.ok(parseSel(':nth-child(5)'));
    assert.ok(parseSel(':nth-child(-3)'));
    assert.ok(parseSel(':nth-child(2n)'));
    assert.ok(parseSel(':nth-child(2n-3)'));
    assert.ok(parseSel(':nth-child(+2n)'));

    // length-1 ident fallthrough / non-integer dimension / other
    throwsSel(':nth-child(abc)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n-)', {}, 'Invalid An+B');
    throwsSel(':nth-child(2n-)', {}, 'Invalid An+B');
    throwsSel(':nth-child(2.5)', {}, 'Invalid An+B');
    throwsSel(':nth-child(2npx)', {}, 'Invalid An+B');
    throwsSel(':nth-child("odd")', {}, 'Invalid An+B');
    throwsSel(':nth-child()', {}, 'Invalid An+B');
    throwsSel(':nth-child( )', {}, 'Invalid An+B');
  });

  test('parseAnPlusB plusPrefix / hasDashAfterN / signed vs delim unique-cause', () => {
    // plusPrefix T, whitespace after + T → null
    throwsSel(':nth-child(+ n)', {}, 'Invalid An+B');
    throwsSel(':nth-child(+ n + 7)', {}, 'Invalid An+B');

    // plusPrefix T, ident n / n-digit
    assert.ok(parseSel(':nth-child(+n)'));
    assert.ok(parseSel(':nth-child(+n+3)'));
    assert.ok(parseSel(':nth-child(+n-3)'));
    assert.ok(parseSel(':nth-child(+n-5)'));

    // plusPrefix T unique-cause of !plusPrefix on -n / -n- (invalid)
    throwsSel(':nth-child(+-n)', {}, 'Invalid An+B');
    throwsSel(':nth-child(+-n-1)', {}, 'Invalid An+B');

    // hasDashAfterN T, unsigned integer T, no leftover
    assert.ok(parseSel(':nth-child(n- 10)'));
    assert.ok(parseSel(':nth-child(-n- 1)'));
    assert.ok(parseSel(':nth-child(23n- 4)'));

    // hasDashAfterN T, signed integer / leftover / missing
    throwsSel(':nth-child(n- +1)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n- 1 2)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n-)', {}, 'Invalid An+B');

    // signed integer t2 unique-cause of t2.sign T vs leftover
    assert.ok(parseSel(':nth-child(n+3)'));
    assert.ok(parseSel(':nth-child(n-3)'));
    assert.ok(parseSel(':nth-child(2n+1)'));
    throwsSel(':nth-child(n+3 4)', {}, 'Invalid An+B');

    // delim + / - then unsigned integer, leftover F
    assert.ok(parseSel(':nth-child(n + 7)'));
    assert.ok(parseSel(':nth-child(-n - 1)'));
    assert.ok(parseSel(':nth-child(2n + 1)'));
    throwsSel(':nth-child(n +)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n + +1)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n + 7 8)', {}, 'Invalid An+B');
    throwsSel(':nth-child(n + foo)', {}, 'Invalid An+B');
    throwsSel(':nth-child(+12n-0+1)', {}, 'Invalid An+B');
  });

  test('parseAnPlusB leftover unique-cause of comments, plusPrefix+dimension, n-digit extra', () => {
    assert.ok(parseSel(':nth-child(/*c*/odd/*c*/)'));
    assert.ok(parseSel(':nth-child(  n + 7 )'));

    // plusPrefix T blocks the dimension arm (!plusPrefix F)
    nthThrows([{ type: 'delim', value: '+' }, dim(2, 'n')], 'Invalid An+B');
    nthThrows([{ type: 'delim', value: '+' }, dim(2, 'n-')], 'Invalid An+B');

    // plusPrefix F, dimension unit n / n-
    assert.ok(nthChild([dim(3, 'n')]));
    assert.ok(nthChild([dim(3, 'n-'), num(2)]));
    nthThrows([dim(3, 'n-')], 'Invalid An+B');
    nthThrows([dim(3, 'n-', 'number')], 'Invalid An+B');
    nthThrows([dim(3, 'px')], 'Invalid An+B');

    // n-digit with extra tokens: match T, idx===length-1 F
    nthThrows([{ type: 'ident', value: 'n-5' }, { type: 'ident', value: 'x' }], 'Invalid An+B');
    // plusPrefix T, n-digit, idx===length-1 T
    assert.ok(nthChild([{ type: 'delim', value: '+' }, { type: 'ident', value: 'n-5' }]));

    // integer without sign after delim already covered; leftover after dash-form t2
    nthThrows([{ type: 'ident', value: 'n-' }, num(1), num(2)], 'Invalid An+B');
  });
});

describe('MC/DC leftover unique-cause: :heading :dir :lang (selectors-4 #heading-pseudo, #dir-pseudo, #lang-pseudo)', () => {
  test(':heading leftover unique-cause of empty, integer AND, comma OR, trailing comma', () => {
    assert.ok(parseSel(':heading'));
    assert.ok(parseSel(':heading(1)'));
    assert.ok(parseSel(':heading(1, 2)'));
    assert.ok(parseSel(':heading( 1 , 2 )'));
    assert.ok(parseSel(':heading(/*c*/1/*c*/, 2)'));

    throwsSel(':heading()', {}, 'cannot be empty');
    throwsSel(':heading( )', {}, 'cannot be empty');
    throwsSel(':heading(1.5)', {}, 'comma-separated integers');
    throwsSel(':heading(2n)', {}, 'comma-separated integers');
    throwsSel(':heading(foo)', {}, 'comma-separated integers');
    throwsSel(':heading(1 2)', {}, 'Expected comma');
    throwsSel(':heading(1,)', {}, 'Trailing comma');
    throwsSel(':heading(1,,2)', {}, 'comma-separated integers');

    // delim ',' unique-cause of the comma OR
    const delimComma = new SelectorParser([
      { type: 'colon', value: ':' },
      fn('heading', [num(1), { type: 'delim', value: ',' }, num(2)]),
    ]).parse();
    assert.equal(firstSimple(delimComma).type, 'pseudo-class-selector');

    const badDelim: ComponentValue[] = [
      { type: 'colon', value: ':' },
      fn('heading', [num(1), { type: 'delim', value: '/' }, num(2)]),
    ];
    assert.throws(() => new SelectorParser(badDelim).parse(), (err: unknown) => syntaxError(err, 'Expected comma'));
  });

  test(':dir leftover unique-cause of length!==1 OR !ident, then ltr/rtl/auto AND', () => {
    assert.ok(parseSel(':dir(ltr)'));
    assert.ok(parseSel(':dir(rtl)'));
    assert.ok(parseSel(':dir(auto)'));
    assert.ok(parseSel(':dir(LTR)'));
    assert.equal(sheetSelector(':dir(auto)'), ':dir(auto)');

    // length!==1 T, ident T (two idents)
    throwsSel(':dir(ltr rtl)', {}, 'must be a single identifier');
    throwsSel(':dir(ltr, rtl)', {}, 'must be a single identifier');
    // length!==1 T, ident F
    throwsSel(':dir()', {}, 'must be a single identifier');
    // length!==1 F, ident F
    throwsSel(':dir(123)', {}, 'must be a single identifier');
    throwsSel(':dir("ltr")', {}, 'must be a single identifier');
    // all three keywords F
    throwsSel(':dir(foo)', {}, 'must be ltr, rtl, or auto');
  });

  test(':lang leftover unique-cause of ident vs string vs comma vs trailing', () => {
    assert.ok(parseSel(':lang(en)'));
    assert.ok(parseSel(':lang("en")'));
    assert.ok(parseSel(':lang(en, fr)'));
    assert.ok(parseSel(':lang(en, "fr")'));
    assert.ok(parseSel(':lang( /*c*/ en /*c*/ )'));

    throwsSel(':lang()', {}, 'cannot be empty');
    throwsSel(':lang( )', {}, 'cannot be empty');
    // ident F AND string F
    throwsSel(':lang(123)', {}, 'must be identifiers or strings');
    throwsSel(':lang(en 123)', {}, 'Expected comma');
    throwsSel(':lang(en,)', {}, 'Trailing comma');
    throwsSel(':lang(en,,fr)', {}, 'must be identifiers or strings');

    // bad-string unique-cause of isStringToken's string OR
    const badStr = new SelectorParser([
      { type: 'colon', value: ':' },
      fn('lang', [{ type: 'bad-string', value: 'en' }]),
    ]).parse();
    assert.equal(firstSimple(badStr).type, 'pseudo-class-selector');
  });
});

describe('MC/DC leftover unique-cause: CSS APIs (CSS.supports / parse / matches / insertRule)', () => {
  test('CSS.supports selector() unique-cause of strict unknown vs valid vs comma', () => {
    assert.equal(CSS.supports('selector(div)'), true);
    assert.equal(CSS.supports('selector(.foo > #bar)'), true);
    assert.equal(CSS.supports('selector(::before)'), true);
    assert.equal(CSS.supports('selector(:hover)'), true);
    assert.equal(CSS.supports('selector(:is(div))'), true);

    assert.equal(CSS.supports('selector()'), false);
    assert.equal(CSS.supports('selector(div, span)'), false);
    assert.equal(CSS.supports('selector(:is(::before))'), false);
    assert.equal(CSS.supports('selector(:where(::after))'), false);
    assert.equal(CSS.supports('selector(::bogus)'), false);
    assert.equal(CSS.supports('selector(:has(:has(a)))'), false);
    assert.equal(CSS.supports('selector(> .foo)'), false);
    assert.equal(CSS.supports('selector(:nth-child(abc))'), false);
    assert.equal(CSS.supports('selector(::-webkit-unknown)'), false);
    assert.equal(CSS.supports('selector(::-webkit-progress-bar)'), true);
  });

  test('parse / matches unique-cause of valid vs rejected selectors', () => {
    assert.equal(sheetSelector('div > span.foo'), 'div > span.foo');
    assert.equal(sheetSelector(':is(.a, 123)'), ':is(.a, 123)');
    assert.equal(sheetSelector('> .foo'), null);
    assert.equal(sheetSelector('::bogus'), null);
    assert.equal(sheetSelector(':nth-child(n +)'), null);

    const nested = parse('.a { > .b { color: red; } + .c { color: blue; } }');
    assert.ok(nested.cssRules[0] instanceof CSSStyleRule);
    assert.equal(nested.cssRules[0].cssRules.length, 2);

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('div');
    assert.ok(el);
    assert.equal(matches(el, 'div.t'), true);
    assert.equal(matches(el, 'span'), false);
    assert.equal(matches(el, '###'), false);
    // matcher parseSelector uses allowRelative T (unique-cause vs stylesheet / parseSel F)
    assert.equal(matches(el, '> .t'), true);
    throwsSel('> .t', {}, 'Relative selector not allowed');
    assert.equal(matches(el, ':is(div, ###)'), true);
    assert.equal(matches(el, ':not(span)'), true);
  });

  test('insertRule leftover unique-cause of combinators, attributes, and forgiving lists', () => {
    const sheet = new CSSStyleSheet();
    assert.equal(sheet.insertRule('a || b { color: red; }', 0), 0);
    assert.equal(sheet.insertRule('[attr|=val i] { color: red; }', 1), 1);
    assert.equal(sheet.insertRule(':nth-child(2n+1 of .foo) { color: red; }', 2), 2);
    assert.equal(sheet.insertRule(':is(.a, ###) { color: red; }', 3), 3);
    assert.throws(() => sheet.insertRule(':not(###) { color: red; }'), (err: unknown) => syntaxError(err));
    assert.throws(() => sheet.insertRule('::bogus { color: red; }'), (err: unknown) => syntaxError(err));
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
    assert.equal(sheet.cssRules[0].selectorText.includes('||'), true);
  });
});
