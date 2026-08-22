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
// Verifies: SYS-REQ-260821-KV30, SW-REQ-260821-YTV6
// Unique-cause leftovers for src/serializer.ts not covered by
// tests/mcdc-hotspot-serializer-more.test.ts or
// tests/mcdc-branch-tokenizer-serializer.test.ts.
// Drive serialize / serializeDeclarations / serializeSelectorList /
// serializeFontFamily / requiresTokenSeparator / getOriginalText.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { parse } from '../src/parser.ts';
import {
  serialize,
  serializeDeclarations,
  serializeSelectorList,
  serializeFontFamily,
  serializeIdentifier,
  serializeString,
  requiresTokenSeparator,
  getOriginalText,
  getMirrorToken,
} from '../src/serializer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import {
  ALL_SHORTHAND_LONGHANDS,
  FONT_LONGHANDS,
  FONT_VARIANT_LONGHANDS,
} from '../src/shorthands.ts';
import type {
  Token,
  ComponentValue,
  Declaration,
  CSSFunction,
  SimpleBlock,
  SelectorList,
  ComplexSelector,
  SimpleSelector,
} from '../src/types.ts';

function ident(value: string): Token {
  return { type: 'ident', value };
}
function num(value: number): Token {
  return { type: 'number', value, numberType: 'integer', sign: null };
}
function delim(value: string): Token {
  return { type: 'delim', value };
}
function dim(value: number, unit: string): Token {
  return { type: 'dimension', value, unit, numberType: 'number', sign: null };
}
function pct(value: number): Token {
  return { type: 'percentage', value, sign: null };
}
function comma(): Token {
  return { type: 'comma', value: ',' };
}
function ws(value = ' '): Token {
  return { type: 'whitespace', value };
}
function str(value: string): Token {
  return { type: 'string', value };
}
function fn(name: string, value: ComponentValue[]): CSSFunction {
  return { type: 'function', name, value };
}
function block(start: '{' | '[' | '(', value: ComponentValue[]): SimpleBlock {
  return { type: 'simple-block', associatedToken: { type: start, value: start }, value };
}
function comps(css: string): ComponentValue[] {
  return ParseHooks.parseComponentValues(tokenize(css));
}
function decl(name: string, css: string, important = false): Declaration {
  return { type: 'declaration', name, value: comps(css), important };
}
function selectorText(css: string): string {
  const sheet = parse(css);
  const rule = [...sheet.cssRules].find((r) => r instanceof CSSStyleRule) as CSSStyleRule | undefined;
  assert.ok(rule, `expected a style rule in ${JSON.stringify(css)}`);
  return rule.selectorText;
}
function listFrom(selectors: ComplexSelector['items'] extends infer _ ? ComplexSelector[] : never): SelectorList {
  return { type: 'selector-list', selectors };
}
function complex(items: ComplexSelector['items']): ComplexSelector {
  return { type: 'complex-selector', items, tokens: [] };
}
function compound(selectors: SimpleSelector[]): ComplexSelector['items'][number] {
  return { type: 'compound-selector', selectors };
}
function hasDecl(cssText: string, name: string): boolean {
  return cssText.split(';').some((part) => part.trim().startsWith(`${name}:`));
}

describe('MC/DC unique-cause: requiresTokenSeparator leftover pairs (css-syntax-3 § 8 #serialization)', { concurrency: false }, () => {
  test('number/@/.+/ rows unique-cause members serializer-more did not flip', () => {
    // Number row: isBadUrl2 T (serializer-more used url, not bad-url).
    assert.equal(requiresTokenSeparator(num(1), { type: 'bad-url', value: 'x' }), true);
    // @ row: isUrl2 / isBadUrl2 T (serializer-more used ident/function/dash/CDC).
    assert.equal(requiresTokenSeparator(delim('@'), { type: 'url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator(delim('@'), { type: 'bad-url', value: 'x' }), true);
    // + row: percentage / dimension T (serializer-more used number vs ident).
    assert.equal(requiresTokenSeparator(delim('+'), pct(5)), true);
    assert.equal(requiresTokenSeparator(delim('+'), dim(5, 'px')), true);
    // . row already has number/pct/dim; keep the F unique-cause for CDC (not in the . row).
    assert.equal(requiresTokenSeparator(delim('.'), { type: 'CDC', value: '-->' }), false);
    // / row: star F already; unique-cause isDelimStar2 F vs another delim.
    assert.equal(requiresTokenSeparator(delim('/'), delim('/')), false);
    // Hash/at/dimension vs bad-url (group A unique-cause isBadUrl2 T, isIdent2 F).
    assert.equal(requiresTokenSeparator({ type: 'hash', value: 'a', hashType: 'id' }, { type: 'bad-url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator({ type: 'at-keyword', value: 'media' }, { type: 'url', value: 'x' }), true);
    assert.equal(requiresTokenSeparator(dim(1, 'em'), { type: 'CDC', value: '-->' }), true);
  });
});

describe('MC/DC unique-cause: serializeNode counter/url/attr leftover (cssom-1 #serialize-a-css-value)', { concurrency: false }, () => {
  test('counter() empty, ident-only decimal, non-ident list-style, trailing whitespace', () => {
    // Unique-cause: i >= 0 F (no args).
    assert.equal(serialize([fn('counter', [])]), 'counter()');
    // Unique-cause: j >= 0 F / comma F — last non-ws ident is decimal but there is no preceding comma.
    assert.equal(serialize([fn('counter', [ident('decimal')])]), 'counter(decimal)');
    // Unique-cause: args[i].type === 'ident' F.
    assert.equal(serialize([fn('counter', [ident('item'), comma(), num(1)])]), 'counter(item,1)');
    // Unique-cause: trailing whitespace while-loop T then ident decimal + comma T.
    assert.equal(
      serialize([fn('counter', [ident('item'), comma(), ident('decimal'), ws()])]),
      'counter(item)',
    );
    // preserveCase keeps Counter so funcName === 'counter' is F (no drop).
    assert.equal(
      serialize([fn('Counter', [ident('item'), comma(), ident('decimal')])], true),
      'Counter(item,decimal)',
    );
  });

  test('url() empty vs whitespace-only vs untrimmed string; attr pipe unique-cause', () => {
    assert.equal(serialize([fn('url', [])]), 'url()');
    // Unique-cause: start <= end F after trimming whitespace-only args.
    assert.equal(serialize([fn('url', [ws(), ws()])]), 'url()');
    // Unique-cause: no leading/trailing whitespace (while bodies F).
    assert.equal(serialize([fn('url', [str('x')])]), 'url("x")');

    // Unique-cause: i < args.length F.
    assert.equal(serialize([fn('attr', [])]), 'attr()');
    // Unique-cause: delim whose value !== '|'.
    assert.equal(serialize([fn('attr', [delim('+'), ident('foo')])]).includes('+'), true);
    // Unique-cause: hasPipe T, trailing string !== ''.
    assert.equal(serialize([fn('attr', [delim('|'), ident('foo'), comma(), str('bar')])]), 'attr(foo,"bar")');
    // Unique-cause: hasPipe T, empty string but no comma (l >= 0 && comma F).
    assert.equal(serialize([fn('attr', [delim('|'), ident('foo'), str('')])]).includes('foo'), true);
    // Unique-cause: whitespace-only after dropping pipe → empty args.
    assert.equal(serialize([fn('attr', [delim('|'), ws()])]), 'attr()');
    // Unique-cause: leading whitespace then pipe.
    assert.equal(serialize([fn('attr', [ws(), delim('|'), ident('foo'), comma(), str('')])]), 'attr(foo)');
  });

  test('simple-block { [ ( mirrors and getOriginalText leftover start tokens', () => {
    assert.equal(serialize([block('{', [ident('a')])]), '{a}');
    assert.equal(serialize([block('[', [ident('a')])]), '[a]');
    assert.equal(serialize([block('(', [ident('a')])]), '(a)');
    // Unique-cause: getMirrorToken already covered; getOriginalText start === '{' / '(' / not-a-bracket.
    assert.equal(getOriginalText([block('(', [ident('a')])]).includes(')'), true);
    assert.equal(getOriginalText([block('{', [ident('a')])]).includes('}'), true);
    const noStart = {
      type: 'simple-block' as const,
      associatedToken: { type: 'ident' as const, value: 'x', originalText: 'x' },
      value: [],
    };
    // Unique-cause: start is neither '{', '[', nor '(' so no mirror is appended.
    assert.equal(getOriginalText([noStart]), 'x');
    assert.equal(getMirrorToken(''), '');
  });

  test('serialize whitespace preserveCase without originalText; consecutive EOF skipped', () => {
    // Unique-cause: preserveCase T and token.originalText F.
    assert.equal(serialize([{ type: 'whitespace', value: '  ' }], true), '  ');
    assert.equal(serialize([{ type: 'whitespace', value: ' ', originalText: '' }], true), ' ');
    assert.equal(serialize([ident('a'), { type: 'EOF', value: '' }, ident('b')]), 'a/**/b');
  });
});

describe('MC/DC unique-cause: serializeFontFamilyItem leftover (cssom-1 #serialize-a-css-value)', { concurrency: false }, () => {
  test('constructed string values with wrapping quotes, empty word, mixed ident sequence', () => {
    // Unique-cause: strVal.startsWith("'") / '"' T (token.value already includes quotes).
    assert.equal(serializeFontFamily([str("'serif'")]), '"serif"');
    assert.equal(serializeFontFamily([str('"serif"')]), '"serif"');
    assert.equal(serializeFontFamily([str("'Helvetica Neue'")]), 'Helvetica Neue');
    // Unique-cause: word.length === 0 T on split(' ') of empty string.
    assert.equal(serializeFontFamily([str('')]), '""');
    // Unique-cause: nonWs.every(ident) F — mix ident + dimension.
    assert.equal(serializeFontFamily([ident('Foo'), ws(), dim(12, 'pt')]).includes('12pt'), true);
    // Remaining generic / css-wide quoted names.
    assert.equal(serializeFontFamily(comps('"cursive"')), '"cursive"');
    assert.equal(serializeFontFamily(comps('"ui-serif"')), '"ui-serif"');
    assert.equal(serializeFontFamily(comps('"revert-layer"')), '"revert-layer"');
    // Unique-cause: word starting with -- or -digit stays quoted.
    assert.equal(serializeFontFamily([str('a --b')]), '"a --b"');
    assert.equal(serializeFontFamily([str('-9foo')]), '"-9foo"');
  });
});

describe('MC/DC unique-cause: formatAnPlusB leftover (css-syntax-3 #the-anb-type)', { concurrency: false }, () => {
  test('a===0, a===±1, b===0 / b>0 / b<0, and parsed===null fallback', () => {
    // Unique-cause: a === 0 → serialize just b.
    assert.equal(selectorText(':nth-child(5) { color: red }'), ':nth-child(5)');
    assert.equal(selectorText(':nth-child(0n+5) { color: red }'), ':nth-child(5)');
    // Unique-cause: a === 1, b > 0.
    assert.equal(selectorText(':nth-child(n+2) { color: red }'), ':nth-child(n+2)');
    // Unique-cause: a === 1, b < 0.
    assert.equal(selectorText(':nth-child(n-2) { color: red }'), ':nth-child(n-2)');
    // Unique-cause: a === -1, b === 0.
    assert.equal(selectorText(':nth-child(-n) { color: red }'), ':nth-child(-n)');
    // Unique-cause: a === -1, b < 0.
    assert.equal(selectorText(':nth-child(-n-1) { color: red }'), ':nth-child(-n-1)');
    // Unique-cause: |a| > 1, b === 0 / b < 0 (serializer-more used 2n+1 and 2n of).
    assert.equal(selectorText(':nth-child(3n) { color: red }'), ':nth-child(3n)');
    assert.equal(selectorText(':nth-child(2n-1) { color: red }'), ':nth-child(2n-1)');
    assert.equal(selectorText(':nth-child(even) { color: red }'), ':nth-child(2n)');
    assert.equal(selectorText(':nth-child(odd) { color: red }'), ':nth-child(2n+1)');

    // Unique-cause: parseAnPlusB returns null → serialize(tokens).
    const invalidNth: SelectorList = listFrom([
      complex([
        compound([
          {
            type: 'pseudo-class-selector',
            name: 'nth-child',
            argument: [ident('foo')],
          },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(invalidNth), ':nth-child(foo)');
  });
});

describe('MC/DC unique-cause: serializeSelectorList leftover (cssom-1 #serialize-a-selector)', { concurrency: false }, () => {
  test('nsContext null vs object prefixes; leading combinator; universal sIdx unique-cause', () => {
    const typeDiv: SelectorList = listFrom([complex([compound([{ type: 'type-selector', name: 'div' }])])]);
    // Unique-cause: typeof nsContext === 'object' T and nsContext !== null F (typeof null === 'object').
    // Signature omits null; Reflect.apply supplies it without a type assertion.
    assert.equal(Reflect.apply(serializeSelectorList, undefined, [typeDiv, null]), 'div');
    assert.equal(serializeSelectorList(typeDiv, undefined), 'div');

    const svgEl: SelectorList = listFrom([
      complex([compound([{ type: 'type-selector', name: 'rect', namespace: 'svg' }])]),
    ]);
    const prefixes = new Set(['svg']);
    // Unique-cause: defaultNamespacePrefixes.has(namespace) T → drop the prefix.
    assert.equal(serializeSelectorList(svgEl, { hasDefaultNamespace: true, defaultNamespacePrefixes: prefixes }), 'rect');
    assert.equal(serializeSelectorList(svgEl, { hasDefaultNamespace: true, defaultNamespacePrefixes: new Set() }), 'svg|rect');

    const uniDefault: SelectorList = listFrom([
      complex([compound([{ type: 'universal-selector', namespace: 'svg' }])]),
    ]);
    assert.equal(serializeSelectorList(uniDefault, { hasDefaultNamespace: true, defaultNamespacePrefixes: prefixes }), '*');
    assert.equal(serializeSelectorList(uniDefault, { hasDefaultNamespace: false }), 'svg|*');

    // Unique-cause: combinator idx === 0.
    const leading: SelectorList = listFrom([
      complex([
        { type: 'combinator', value: '>' },
        compound([{ type: 'type-selector', name: 'div' }]),
      ]),
    ]);
    assert.equal(serializeSelectorList(leading), '> div');
    const column: SelectorList = listFrom([
      complex([
        compound([{ type: 'type-selector', name: 'a' }]),
        { type: 'combinator', value: '||' },
        compound([{ type: 'type-selector', name: 'b' }]),
      ]),
    ]);
    assert.equal(serializeSelectorList(column), 'a || b');

    // Unique-cause: universal at sIdx === 0 with length > 1 is dropped.
    const starClass: SelectorList = listFrom([
      complex([
        compound([
          { type: 'universal-selector' },
          { type: 'class-selector', name: 'c' },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(starClass), '.c');
    // Unique-cause: sIdx === 0 F (universal is not first) — keep both.
    const classStar: SelectorList = listFrom([
      complex([
        compound([
          { type: 'class-selector', name: 'c' },
          { type: 'universal-selector' },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(classStar), '.c*');

    const starStarNoDefault: SelectorList = listFrom([
      complex([
        compound([
          { type: 'universal-selector', namespace: '*' },
          { type: 'class-selector', name: 'c' },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(starStarNoDefault, { hasDefaultNamespace: false }), '.c');
    assert.equal(serializeSelectorList(starStarNoDefault, { hasDefaultNamespace: true }), '*|*.c');
  });

  test('attribute namespaces, pseudo nth-of, pseudo-element non-list argument, nesting', () => {
    assert.equal(selectorText('[*|attr] { color: red }').includes('*|'), true);
    // Unique-cause: attribute namespace === '' omits the pipe (cssom-1 #serialize-a-simple-selector).
    assert.equal(selectorText('[|attr] { color: red }'), '[attr]');
    // Undeclared prefix `ns|attr` is dropped by the parser; construct the AST instead.
    const namedAttr: SelectorList = listFrom([
      complex([compound([{ type: 'attribute-selector', name: 'attr', namespace: 'ns' }])]),
    ]);
    assert.equal(serializeSelectorList(namedAttr), '[ns|attr]');
    assert.equal(selectorText('[attr^=value] { color: red }').includes('^='), true);
    assert.equal(selectorText('[attr|=value s] { color: red }').toLowerCase().includes('s'), true);

    // Unique-cause: isNth T, argument is selector-list, simple.nth T already in serializer-more;
    // simple.nth F with a selector-list argument.
    const nthNoTokens: SelectorList = listFrom([
      complex([
        compound([
          {
            type: 'pseudo-class-selector',
            name: 'nth-child',
            argument: { type: 'selector-list', selectors: [complex([compound([{ type: 'class-selector', name: 'foo' }])])] },
          },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(nthNoTokens), ':nth-child(.foo)');

    // Unique-cause: "type" in argument T but type !== 'selector-list' (array with extra type).
    const typedArray = [ident('odd')] as ComponentValue[] & { type: string };
    typedArray.type = 'an-plus-b';
    const nthTypedArray: SelectorList = listFrom([
      complex([compound([{ type: 'pseudo-class-selector', name: 'nth-child', argument: typedArray }])]),
    ]);
    assert.equal(serializeSelectorList(nthTypedArray), ':nth-child(2n+1)');

    // Unique-cause: pseudo-element argument is ComponentValue[] not a selector-list.
    const highlight: SelectorList = listFrom([
      complex([compound([{ type: 'pseudo-element-selector', name: 'highlight', argument: [ident('foo')] }])]),
    ]);
    assert.equal(serializeSelectorList(highlight), '::highlight(foo)');
    assert.equal(selectorText('::slotted(span) { color: red }').includes('slotted'), true);

    const nest: SelectorList = listFrom([complex([compound([{ type: 'nesting-selector' }])])]);
    assert.equal(serializeSelectorList(nest), '&');

    // Unique-cause: empty namespace type selector vs * with default namespace.
    assert.equal(selectorText('|div { color: red }'), '|div');
    const starDefault: SelectorList = listFrom([complex([compound([{ type: 'type-selector', name: 'div', namespace: '*' }])])]);
    assert.equal(serializeSelectorList(starDefault, { hasDefaultNamespace: true }), '*|div');
    assert.equal(serializeSelectorList(starDefault, { hasDefaultNamespace: false }), 'div');
    const uniEmpty: SelectorList = listFrom([complex([compound([{ type: 'universal-selector', namespace: '' }])])]);
    assert.equal(serializeSelectorList(uniEmpty), '|*');
  });
});

describe('MC/DC unique-cause: serializeDeclarations leftover combining (cssom-1 #serialize-a-css-declaration-block)', { concurrency: false }, () => {
  test('all longhands recombine to all: css-wide / var; mismatch unique-cause', () => {
    const inherit = comps('inherit');
    const allInherit: Declaration[] = ALL_SHORTHAND_LONGHANDS.map((name) => ({
      type: 'declaration',
      name,
      value: inherit,
      important: false,
    }));
    // Unique-cause: length >= ALL_SHORTHAND_LONGHANDS.length T, css-wide match, inserted T.
    assert.equal(serializeDeclarations(allInherit), 'all: inherit;');

    const allVar: Declaration[] = ALL_SHORTHAND_LONGHANDS.map((name) => ({
      type: 'declaration',
      name,
      value: comps('var(--x)'),
      important: false,
    }));
    // Unique-cause: firstValLower.startsWith('var(') T (css-wide includes F).
    assert.equal(serializeDeclarations(allVar), 'all: var(--x);');

    const extras: Declaration[] = [
      decl('direction', 'rtl'),
      ...allInherit,
      { type: 'declaration', name: '--x', value: comps('1'), important: false },
    ];
    const withExtras = serializeDeclarations(extras);
    assert.equal(hasDecl(withExtras, 'all'), true);
    assert.equal(withExtras.includes('all: inherit'), true);
    assert.equal(withExtras.includes('direction: rtl'), true);
    assert.equal(withExtras.includes('--x:'), true);

    // Unique-cause: serialize(d.value) !== firstValLower (one longhand differs).
    const mismatch = allInherit.map((d, i) => (i === allInherit.length - 1 ? decl(d.name, 'initial') : d));
    const mismatchText = serializeDeclarations(mismatch);
    assert.equal(hasDecl(mismatchText, 'all'), false);

    // Unique-cause: d.important !== firstImportant.
    const mixedImportant = allInherit.map((d, i) => (i === 0 ? { ...d, important: true } : d));
    assert.equal(hasDecl(serializeDeclarations(mixedImportant), 'all'), false);

    // Unique-cause: firstDecl missing (no ALL_SHORTHAND_LONGHANDS[0]) even with enough decls.
    const first = ALL_SHORTHAND_LONGHANDS[0];
    const missingFirst = allInherit
      .filter((d) => d.name !== first)
      .concat(decl('direction', 'ltr'), decl('--pad1', '1'), decl('--pad2', '2'));
    assert.ok(missingFirst.length >= ALL_SHORTHAND_LONGHANDS.length);
    assert.equal(hasDecl(serializeDeclarations(missingFirst), 'all'), false);
  });

  test('checkIntervening unique-cause: same-group logical, side-prefix radius, named border', () => {
    // Unique-cause: groups.has(interveningGroup) T — logical margin between physical sides.
    const style = new CSSStyleDeclaration();
    style.setProperty('margin-top', '1px');
    style.setProperty('margin-inline-start', '5px');
    style.setProperty('margin-right', '1px');
    style.setProperty('margin-bottom', '1px');
    style.setProperty('margin-left', '1px');
    assert.equal(style.cssText.includes('margin-top:'), true);
    assert.equal(style.cssText.includes('margin-inline-start:'), true);

    // Unique-cause: isSideShorthand T and intervening.name.startsWith(sidePrefix + '-') T.
    const radius = new CSSStyleDeclaration();
    radius.setProperty('border-top-width', '1px');
    radius.setProperty('border-top-left-radius', '4px');
    radius.setProperty('border-top-style', 'solid');
    radius.setProperty('border-top-color', 'red');
    radius.setProperty('border-right-width', '1px');
    radius.setProperty('border-right-style', 'solid');
    radius.setProperty('border-right-color', 'red');
    radius.setProperty('border-bottom-width', '1px');
    radius.setProperty('border-bottom-style', 'solid');
    radius.setProperty('border-bottom-color', 'red');
    radius.setProperty('border-left-width', '1px');
    radius.setProperty('border-left-style', 'solid');
    radius.setProperty('border-left-color', 'red');
    radius.setProperty('border-image', 'none');
    assert.equal(hasDecl(radius.cssText, 'border-top-left-radius'), true);
    assert.equal(hasDecl(radius.cssText, 'border'), false);

    // Unique-cause: ['all','border'].includes(intervening.name) T via a constructed 'border' decl
    // that is also in propertyToGroup (use 'border-top' group 'border' is not the name;
    // a raw name 'border' is skipped because it has no group). Use serialized raw decls:
    const namedBorder = serializeDeclarations([
      decl('margin-top', '1px'),
      { type: 'declaration', name: 'border', value: comps('1px solid red'), important: false },
      decl('margin-right', '1px'),
      decl('margin-bottom', '1px'),
      decl('margin-left', '1px'),
    ]);
    // 'border' is not in propertyToGroup so combining still happens; the name is preserved either way.
    assert.equal(namedBorder.includes('margin:'), true);
    assert.equal(namedBorder.includes('border:'), true);
  });

  test('tryCombineBorderFull initial vs non-initial image, important, missing image', () => {
    const initialImage = new CSSStyleDeclaration();
    initialImage.setProperty('border-top', '1px solid red');
    initialImage.setProperty('border-right', '1px solid red');
    initialImage.setProperty('border-bottom', '1px solid red');
    initialImage.setProperty('border-left', '1px solid red');
    initialImage.setProperty('border-image', 'none');
    assert.equal(initialImage.cssText, 'border: 1px solid red;');

    const important = new CSSStyleDeclaration();
    important.setProperty('border-top', '1px solid red', 'important');
    important.setProperty('border-right', '1px solid red', 'important');
    important.setProperty('border-bottom', '1px solid red', 'important');
    important.setProperty('border-left', '1px solid red', 'important');
    important.setProperty('border-image', 'none', 'important');
    assert.equal(hasDecl(important.cssText, 'border'), true);
    assert.equal(important.cssText.includes('!important'), true);

    const nonInitial = new CSSStyleDeclaration();
    nonInitial.setProperty('border-top', '1px solid red');
    nonInitial.setProperty('border-right', '1px solid red');
    nonInitial.setProperty('border-bottom', '1px solid red');
    nonInitial.setProperty('border-left', '1px solid red');
    nonInitial.setProperty('border-image-source', 'url(x.png)');
    assert.equal(hasDecl(nonInitial.cssText, 'border'), false);
    assert.equal(hasDecl(nonInitial.cssText, 'border-image-source'), true);

    const mixedWidth = new CSSStyleDeclaration();
    mixedWidth.setProperty('border-top', '1px solid red');
    mixedWidth.setProperty('border-right', '2px solid red');
    mixedWidth.setProperty('border-bottom', '1px solid red');
    mixedWidth.setProperty('border-left', '1px solid red');
    mixedWidth.setProperty('border-image', 'none');
    assert.equal(mixedWidth.cssText.includes('border-width:'), true);
  });

  test('generic border-top longhands plus existing side shorthands equal vs mixed', () => {
    // Unique-cause: existing && !processed.has (L1035) and "decl" in r (L1051).
    const equalSides = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      decl('border-right', '1px solid red'),
      decl('border-bottom', '1px solid red'),
      decl('border-left', '1px solid red'),
    ]);
    assert.equal(hasDecl(equalSides, 'border'), true);

    const mixedSides = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      decl('border-right', '2px solid red'),
      decl('border-bottom', '1px solid red'),
      decl('border-left', '1px solid red'),
    ]);
    assert.equal(hasDecl(mixedSides, 'border-top'), true);
    assert.equal(hasDecl(mixedSides, 'border-right'), true);
    assert.equal(hasDecl(mixedSides, 'border'), false);

    // Unique-cause: "longhands" in r — reconstruct a missing side from its 3 longhands.
    const reconstructed = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      decl('border-right-width', '1px'),
      decl('border-right-style', 'solid'),
      decl('border-right-color', 'red'),
      decl('border-bottom-width', '1px'),
      decl('border-bottom-style', 'solid'),
      decl('border-bottom-color', 'red'),
      decl('border-left-width', '1px'),
      decl('border-left-style', 'solid'),
      decl('border-left-color', 'red'),
      decl('margin-top', '1px'),
    ]);
    // 12 longhands combine via box/full paths; margin stays.
    assert.equal(reconstructed.includes('margin-top:') || reconstructed.includes('margin:'), true);
  });

  test('tryCombineLogicalShorthand allowDifferent F, var() unique-cause, end-first, important', () => {
    const blockDiff = new CSSStyleDeclaration();
    blockDiff.setProperty('border-block-start-width', '1px');
    blockDiff.setProperty('border-block-start-style', 'solid');
    blockDiff.setProperty('border-block-start-color', 'red');
    blockDiff.setProperty('border-block-end-width', '2px');
    blockDiff.setProperty('border-block-end-style', 'solid');
    blockDiff.setProperty('border-block-end-color', 'red');
    // Unique-cause: allowDifferent F so unequal sides stay side shorthands, not border-block.
    assert.equal(hasDecl(blockDiff.cssText, 'border-block-start'), true);
    assert.equal(hasDecl(blockDiff.cssText, 'border-block-end'), true);
    assert.equal(hasDecl(blockDiff.cssText, 'border-block'), false);

    const varStart = new CSSStyleDeclaration();
    varStart.setProperty('margin-inline-start', 'var(--x)');
    varStart.setProperty('margin-inline-end', '1px');
    assert.equal(varStart.cssText.includes('margin-inline-start:'), true);
    assert.equal(varStart.cssText.includes('var(--x)'), true);

    const varEnd = new CSSStyleDeclaration();
    varEnd.setProperty('margin-inline-start', '1px');
    varEnd.setProperty('margin-inline-end', 'var(--y)');
    assert.equal(varEnd.cssText.includes('var(--y)'), true);

    // Unique-cause: d.name === longhands.end T (end appears first).
    const endFirst = serializeDeclarations([decl('margin-inline-end', '2px'), decl('margin-inline-start', '1px')]);
    assert.equal(endFirst, 'margin-inline: 1px 2px;');

    const importantLogical = new CSSStyleDeclaration();
    importantLogical.setProperty('padding-block-start', '1px', 'important');
    importantLogical.setProperty('padding-block-end', '1px', 'important');
    assert.equal(importantLogical.cssText.includes('padding-block: 1px !important'), true);

    const importantMismatch = serializeDeclarations([
      decl('overflow-x', 'hidden', true),
      decl('overflow-y', 'hidden', false),
    ]);
    assert.equal(importantMismatch.includes('overflow-x:'), true);
    assert.equal(importantMismatch.includes('overflow-y:'), true);
  });

  test('tryCombineFont / font-variant contracted null, important, intervening, leftover longhands', () => {
    const font = new CSSStyleDeclaration();
    for (const lh of FONT_LONGHANDS) {
      if (lh === 'font-size') font.setProperty(lh, '16px');
      else if (lh === 'font-family') font.setProperty(lh, 'serif');
      else if (lh === 'font-style') font.setProperty(lh, 'italic');
      else font.setProperty(lh, 'normal');
    }
    assert.equal(font.cssText.includes('font:'), true);

    const fontImportant = new CSSStyleDeclaration();
    for (const lh of FONT_LONGHANDS) {
      if (lh === 'font-size') fontImportant.setProperty(lh, '16px', 'important');
      else if (lh === 'font-family') fontImportant.setProperty(lh, 'serif', 'important');
      else fontImportant.setProperty(lh, 'normal', 'important');
    }
    assert.equal(fontImportant.cssText.includes('font:') && fontImportant.cssText.includes('!important'), true);

    // Unique-cause: contractFont returns null (non-normal extra variant).
    const extraLig = new CSSStyleDeclaration();
    for (const lh of FONT_LONGHANDS) {
      if (lh === 'font-size') extraLig.setProperty(lh, '16px');
      else if (lh === 'font-family') extraLig.setProperty(lh, 'serif');
      else if (lh === 'font-variant-ligatures') extraLig.setProperty(lh, 'none');
      else extraLig.setProperty(lh, 'normal');
    }
    assert.equal(hasDecl(extraLig.cssText, 'font'), false);
    assert.equal(hasDecl(extraLig.cssText, 'font-variant'), true);

    // Unique-cause: contractFontVariant returns null (none + extra caps).
    const noneAndCaps = new CSSStyleDeclaration();
    for (const lh of FONT_VARIANT_LONGHANDS) {
      noneAndCaps.setProperty(lh, lh === 'font-variant-ligatures' ? 'none' : lh === 'font-variant-caps' ? 'small-caps' : 'normal');
    }
    assert.equal(hasDecl(noneAndCaps.cssText, 'font-variant-ligatures'), true);
    assert.equal(hasDecl(noneAndCaps.cssText, 'font-variant-caps'), true);
    assert.equal(hasDecl(noneAndCaps.cssText, 'font-variant'), false);

    const variantImportant = new CSSStyleDeclaration();
    for (const lh of FONT_VARIANT_LONGHANDS) {
      variantImportant.setProperty(lh, lh === 'font-variant-caps' ? 'small-caps' : 'normal', 'important');
    }
    assert.equal(variantImportant.cssText.includes('font-variant:') && variantImportant.cssText.includes('!important'), true);

    const missingVariant = new CSSStyleDeclaration();
    missingVariant.setProperty('font-variant-caps', 'small-caps');
    assert.equal(missingVariant.cssText.includes('font-variant-caps:'), true);
    assert.equal(missingVariant.cssText.includes('font-variant:'), false);
  });

  test('tryCombineBackground / border-block / border-inline important and intervening', () => {
    const bg = new CSSStyleDeclaration();
    bg.setProperty('background-image', 'none', 'important');
    bg.setProperty('background-position', '0% 0%', 'important');
    bg.setProperty('background-size', 'auto', 'important');
    bg.setProperty('background-repeat', 'repeat', 'important');
    bg.setProperty('background-attachment', 'scroll', 'important');
    bg.setProperty('background-origin', 'padding-box', 'important');
    bg.setProperty('background-clip', 'border-box', 'important');
    bg.setProperty('background-color', 'red', 'important');
    assert.equal(bg.cssText.includes('background:') && bg.cssText.includes('!important'), true);

    const blockImp = new CSSStyleDeclaration();
    blockImp.setProperty('border-block-start', '1px solid red', 'important');
    blockImp.setProperty('border-block-end', '1px solid red', 'important');
    assert.equal(blockImp.cssText.includes('border-block:') && blockImp.cssText.includes('!important'), true);

    const inlineImp = new CSSStyleDeclaration();
    inlineImp.setProperty('border-inline-start', '1px solid blue', 'important');
    inlineImp.setProperty('border-inline-end', '1px solid blue', 'important');
    assert.equal(inlineImp.cssText.includes('border-inline:') && inlineImp.cssText.includes('!important'), true);

    const outlineImp = new CSSStyleDeclaration();
    outlineImp.setProperty('outline-color', 'red', 'important');
    outlineImp.setProperty('outline-style', 'solid', 'important');
    outlineImp.setProperty('outline-width', '1px', 'important');
    assert.equal(outlineImp.cssText.includes('outline:') && outlineImp.cssText.includes('!important'), true);

    const flexMismatch = new CSSStyleDeclaration();
    flexMismatch.setProperty('flex-grow', '1');
    flexMismatch.setProperty('flex-shrink', '1', 'important');
    flexMismatch.setProperty('flex-basis', 'auto');
    assert.equal(flexMismatch.cssText.includes('flex-grow:'), true);
    assert.equal(flexMismatch.cssText.includes('flex-shrink:'), true);
  });

  test('flex-basis 0 unique-cause F; font-family declaration path; custom raw', () => {
    const auto = new CSSStyleDeclaration();
    auto.setProperty('flex-basis', 'auto');
    assert.equal(auto.cssText.includes('flex-basis: auto'), true);

    const zero = new CSSStyleDeclaration();
    zero.setProperty('flex-basis', '0');
    assert.equal(zero.cssText.includes('0px'), true);

    const family = new CSSStyleDeclaration();
    family.setProperty('font-family', '"Times New Roman", serif');
    assert.equal(family.cssText.includes('font-family:'), true);

    const customImp = serializeDeclarations([
      { type: 'declaration', name: '--Foo', value: comps('Bar'), important: true, raw: 'Bar' },
    ]);
    assert.equal(customImp, '--Foo: Bar !important;');
  });
});

describe('MC/DC unique-cause: serializeIdentifier / serializeString leftover (cssom-1 #serialize-an-identifier)', { concurrency: false }, () => {
  test('second-char digit unique-cause when first is not dash; U+0080 and underscore', () => {
    // Unique-cause: i === 1 && digit T but first character is not '-' (step 4 F).
    assert.equal(serializeIdentifier('a0'), 'a0');
    // Unique-cause: i === 1 && first is '-' but char is not a digit.
    assert.equal(serializeIdentifier('-a'), '-a');
    assert.equal(serializeIdentifier('_'), '_');
    assert.equal(serializeIdentifier('\u0080'), '\u0080');
    assert.equal(serializeIdentifier('Z'), 'Z');
    // serializeString unique-cause: char that is neither control nor quote/backslash.
    assert.equal(serializeString('~'), '"~"');
    assert.equal(serializeString('\u0080'), '"\u0080"');
  });
});
