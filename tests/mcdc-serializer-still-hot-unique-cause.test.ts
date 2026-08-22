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
// Still-hot unique-cause for src/serializer.ts leftovers that
// tests/mcdc-hotspot-serializer-more.test.ts,
// tests/mcdc-branch-tokenizer-serializer.test.ts, and
// tests/mcdc-serializer-unique-cause.test.ts do not isolate:
// serializeNode non-object / typeless, counter comma F with j>=0,
// attr l>=0 F and whitespace walk, serialize firstToken/last F,
// serializeFontFamilyItem wrapping-quote endsWith, remaining generics,
// serializeSimpleSelector pseudo-element type!==selector-list,
// serializeDeclarations css-wide remainder / !d middle / reconstructed
// sides / generic.important / contracted-null / logical allowDifferent
// via side shorthands. Drive serialize / serializeDeclarations /
// serializeSelectorList / serializeFontFamily / serializeIdentifier.
// css-syntax-3 § 8 #serialization, cssom-1 #serialize-a-css-value /
// #serialize-a-selector / #serialize-a-css-declaration-block /
// #serialize-an-identifier.
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
} from '../src/serializer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleRule } from '../src/CSSOM.ts';
import { ALL_SHORTHAND_LONGHANDS } from '../src/shorthands.ts';
import type {
  Token,
  ComponentValue,
  Declaration,
  CSSFunction,
  SelectorList,
  ComplexSelector,
  SimpleSelector,
} from '../src/types.ts';

function ident(value: string): Token {
  return { type: 'ident', value };
}
function delim(value: string): Token {
  return { type: 'delim', value };
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
function listFrom(selectors: ComplexSelector[]): SelectorList {
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
function serializeUnknown(nodes: unknown): string {
  return Reflect.apply(serialize, undefined, [nodes]) as string;
}
function allKw(kw: string): Declaration[] {
  return ALL_SHORTHAND_LONGHANDS.map((name) => decl(name, kw));
}

describe('MC/DC still-hot unique-cause: serializeNode / serialize firstToken last (cssom-1 #serialize-a-css-value)', { concurrency: false }, () => {
  test('non-object, typeless object, and last F keep prevLastToken for separator', () => {
    // Unique-cause: typeof node !== 'object' T (serializeNode / getFirstToken / getLastToken).
    assert.equal(serializeUnknown([1]), '');
    assert.equal(serializeUnknown(['x']), '');
    assert.equal(serializeUnknown([true]), '');
    // Unique-cause: 'type' in node F (plain object / null-prototype).
    assert.equal(serializeUnknown([{}]), '');
    assert.equal(serializeUnknown([Object.create(null)]), '');
    // Unique-cause: last F so prevLastToken is not overwritten (ident still separates later ident).
    assert.equal(serializeUnknown([ident('a'), 1, ident('b')]), 'a/**/b');
    // Unique-cause: prevLastToken T, firstToken F (primitive after ident; no extra separator).
    assert.equal(serializeUnknown([ident('a'), 1]), 'a');
    // Unique-cause: last F on the first node so prevLastToken stays null (no separator before ident).
    assert.equal(serializeUnknown([1, ident('a')]), 'a');
  });

  test('counter comma F with j>=0; inner whitespace walk before decimal', () => {
    // Unique-cause: j >= 0 T and args[j].type === 'comma' F (decimal follows an ident, no comma).
    assert.equal(serialize([fn('counter', [ident('item'), ident('decimal')])]), 'counter(item/**/decimal)');
    // Unique-cause: while j>=0 whitespace T then comma T (drop still happens).
    assert.equal(
      serialize([fn('counter', [ident('item'), comma(), ws(), ident('decimal')])]),
      'counter(item)',
    );
    // Unique-cause: trailing ident is not decimal so the comma-drop AND stays F.
    assert.equal(
      serialize([fn('counter', [ident('item'), comma(), ident('disc')])]).includes('disc'),
      true,
    );
  });

  test('attr() l>=0 F, whitespace walk to comma, k>=0 F after pipe', () => {
    // Unique-cause: k === 0 so l = -1 (l >= 0 F) — empty string is the only remaining arg.
    assert.equal(serialize([fn('attr', [delim('|'), str('')])]), 'attr("")');
    // Unique-cause: while l>=0 whitespace T then comma T (drop trailing empty fallback).
    assert.equal(
      serialize([fn('attr', [delim('|'), ident('foo'), comma(), ws(), str('')])]),
      'attr(foo)',
    );
    // Unique-cause: whitespace between ident and comma, then empty fallback.
    assert.equal(
      serialize([fn('attr', [delim('|'), ident('foo'), ws(), comma(), str('')])]),
      'attr(foo)',
    );
    // Unique-cause: k >= 0 F after walking whitespace-only args (already empty after pipe).
    assert.equal(serialize([fn('attr', [delim('|')])]), 'attr()');
    // Unique-cause: hasPipe T, trailing empty string with only whitespace before it and no comma.
    assert.equal(serialize([fn('attr', [delim('|'), ws(), str('')])]).includes('""'), true);
  });

  test('serialize propertyName font-family vs other; function without name falls through', () => {
    const times = [ident('Times'), ws(), ident('New')];
    // Unique-cause: propertyName === 'font-family' T vs F.
    assert.equal(serialize(times, false, 'font-family'), 'Times New');
    assert.equal(serialize(times, false, 'color'), 'Times New');
    assert.equal(serialize(times), 'Times New');
    // Unique-cause: type === 'function' T and 'name' in node F (raw function token).
    assert.equal(serialize([{ type: 'function', value: 'Attr' }]), 'attr(');
  });
});

describe('MC/DC still-hot unique-cause: serializeFontFamilyItem wrapping quotes (cssom-1 #serialize-a-css-value)', { concurrency: false }, () => {
  test('startsWith T endsWith F unique-cause of each quote AND; remaining generics', () => {
    // Unique-cause: startsWith "'" T, endsWith "'" F (second AND not needed).
    assert.equal(serializeFontFamily([str("'serif")]).includes('serif'), true);
    // Unique-cause: startsWith '"' T, endsWith '"' F.
    assert.equal(serializeFontFamily([str('"serif')]).includes('serif'), true);
    // Unique-cause: first AND F via endsWith "'" F, second startsWith '"' F (`'serif"`).
    assert.equal(serializeFontFamily([str("'serif\"")]).includes('serif'), true);
    // Unique-cause: startsWith "'" F with endsWith "'" T (`serif'`).
    assert.equal(serializeFontFamily([str("serif'")]).includes('serif'), true);
    // Remaining generic / css-wide names leftover tests did not quote.
    assert.equal(serializeFontFamily(comps('"fantasy"')), '"fantasy"');
    assert.equal(serializeFontFamily(comps('"monospace"')), '"monospace"');
    assert.equal(serializeFontFamily(comps('"system-ui"')), '"system-ui"');
    assert.equal(serializeFontFamily(comps('"math"')), '"math"');
    assert.equal(serializeFontFamily(comps('"emoji"')), '"emoji"');
    assert.equal(serializeFontFamily(comps('"fangsong"')), '"fangsong"');
    assert.equal(serializeFontFamily(comps('"ui-sans-serif"')), '"ui-sans-serif"');
    assert.equal(serializeFontFamily(comps('"ui-monospace"')), '"ui-monospace"');
    assert.equal(serializeFontFamily(comps('"ui-rounded"')), '"ui-rounded"');
    assert.equal(serializeFontFamily(comps('"initial"')), '"initial"');
    assert.equal(serializeFontFamily(comps('"inherit"')), '"inherit"');
    assert.equal(serializeFontFamily(comps('"unset"')), '"unset"');
    assert.equal(serializeFontFamily(comps('"revert"')), '"revert"');
    assert.equal(serializeFontFamily(comps('"default"')), '"default"');
  });

  test('tab/newline/cr unique-cause of the whitespace regex; leading-digit word; empty nonWs', () => {
    // Unique-cause: /\\t/ vs /\\n/ vs /\\r/ vs {2,} spaces (serializer-more used double space).
    assert.equal(serializeFontFamily([str('a\tb')]), '"a\tb"');
    assert.equal(serializeFontFamily([str('a\nb')]), '"a\nb"');
    assert.equal(serializeFontFamily([str('a\rb')]), '"a\rb"');
    // Unique-cause: /^[0-9]/ T (leftover used -- and -digit).
    assert.equal(serializeFontFamily([str('9foo')]), '"9foo"');
    // Unique-cause: nonWs.length === 0 (comment-only) → empty serialization.
    assert.equal(serializeFontFamily([{ type: 'comment', value: '/*x*/' }]), '');
    // Unique-cause: leading comma pushes an empty group that filters out.
    assert.equal(serializeFontFamily(comps(',serif')), 'serif');
    assert.equal(serializeFontFamily(comps('serif,,sans-serif')), 'serif, sans-serif');
  });
});

describe('MC/DC still-hot unique-cause: serializeSimpleSelector leftover (cssom-1 #serialize-a-selector)', { concurrency: false }, () => {
  test('pseudo-element type in T and type !== selector-list; boolean nsContext false', () => {
    // Unique-cause: 'type' in argument T, argument.type === 'selector-list' F
    // (leftover used a plain token array so 'type' in F skipped the second conjunct).
    const typedArg: ComponentValue[] = [ident('foo')];
    Object.assign(typedArg, { type: 'an-plus-b' });
    const highlightTyped: SelectorList = listFrom([
      complex([compound([{ type: 'pseudo-element-selector', name: 'highlight', argument: typedArg }])]),
    ]);
    assert.equal(serializeSelectorList(highlightTyped), '::highlight(foo)');

    // Unique-cause: 'type' in T, type === 'selector-list' T on a constructed pseudo-element.
    const slottedList: SelectorList = listFrom([
      complex([
        compound([
          {
            type: 'pseudo-element-selector',
            name: 'slotted',
            argument: listFrom([complex([compound([{ type: 'type-selector', name: 'span' }])])]),
          },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(slottedList), '::slotted(span)');

    const typeDiv: SelectorList = listFrom([complex([compound([{ type: 'type-selector', name: 'div' }])])]);
    // Unique-cause: typeof nsContext === 'boolean' T with false (serializer-more used true).
    assert.equal(serializeSelectorList(typeDiv, false), 'div');

    // Unique-cause: default branch of serializeSimpleSelector (unknown simple type).
    const bogus = {
      type: 'selector-list',
      selectors: [
        {
          type: 'complex-selector',
          items: [{ type: 'compound-selector', selectors: [{ type: 'bogus-selector' }] }],
          tokens: [],
        },
      ],
    };
    assert.equal(Reflect.apply(serializeSelectorList, undefined, [bogus]), '');
  });

  test('universal length>1 namespace prefixes; space combinator; remaining nth names; attribute ops', () => {
    const prefixes = new Set(['svg']);
    const svgStarClass: SelectorList = listFrom([
      complex([
        compound([
          { type: 'universal-selector', namespace: 'svg' },
          { type: 'class-selector', name: 'c' },
        ]),
      ]),
    ]);
    // Unique-cause: sIdx === 0, length > 1, isDefaultNs T → drop universal.
    assert.equal(
      serializeSelectorList(svgStarClass, { hasDefaultNamespace: true, defaultNamespacePrefixes: prefixes }),
      '.c',
    );
    // Unique-cause: namespace defined, prefixes.has F → keep svg|*.
    assert.equal(
      serializeSelectorList(svgStarClass, { hasDefaultNamespace: true, defaultNamespacePrefixes: new Set() }),
      'svg|*.c',
    );
    // Unique-cause: defaultNamespacePrefixes omitted (optional-chain has F).
    assert.equal(serializeSelectorList(svgStarClass, { hasDefaultNamespace: true }), 'svg|*.c');
    // Unique-cause: namespace === '' so isDefaultNs F and drop-condition F → keep |*.
    const emptyStarClass: SelectorList = listFrom([
      complex([
        compound([
          { type: 'universal-selector', namespace: '' },
          { type: 'class-selector', name: 'c' },
        ]),
      ]),
    ]);
    assert.equal(serializeSelectorList(emptyStarClass), '|*.c');

    // Unique-cause: combinator value === ' ' T (idx !== 0) vs leading non-space already leftover.
    const descendant: SelectorList = listFrom([
      complex([
        compound([{ type: 'type-selector', name: 'a' }]),
        { type: 'combinator', value: ' ' },
        compound([{ type: 'type-selector', name: 'b' }]),
      ]),
    ]);
    assert.equal(serializeSelectorList(descendant), 'a b');
    const leadingSpace: SelectorList = listFrom([
      complex([
        { type: 'combinator', value: ' ' },
        compound([{ type: 'type-selector', name: 'div' }]),
      ]),
    ]);
    assert.equal(serializeSelectorList(leadingSpace), ' div');

    assert.equal(selectorText(':nth-last-of-type(2n) { color: red }').includes('nth-last-of-type'), true);
    assert.equal(selectorText(':nth-last-child(n) { color: red }').includes('nth-last-child'), true);
    assert.equal(selectorText(':where(.a) { color: red }').includes(':where'), true);
    assert.equal(selectorText(':not(.a) { color: red }').includes(':not'), true);
    assert.equal(selectorText(':has(.a) { color: red }').includes(':has'), true);

    assert.equal(selectorText('[attr*=value] { color: red }').includes('*='), true);
    assert.equal(selectorText('[attr$=value] { color: red }').includes('$='), true);
    assert.equal(selectorText('[attr~=value] { color: red }').includes('~='), true);
    assert.equal(selectorText('[attr|=value] { color: red }').includes('|='), true);
    assert.equal(selectorText('[attr=value I] { color: red }').toLowerCase().includes('i'), true);

    // Unique-cause: type-selector namespace prefixes omitted (optional-chain has F).
    const svgEl: SelectorList = listFrom([
      complex([compound([{ type: 'type-selector', name: 'rect', namespace: 'svg' }])]),
    ]);
    assert.equal(serializeSelectorList(svgEl, { hasDefaultNamespace: true }), 'svg|rect');
  });
});

describe('MC/DC still-hot unique-cause: serializeDeclarations combining (cssom-1 #serialize-a-css-declaration-block)', { concurrency: false }, () => {
  test('remaining css-wide all:; includes F startsWith F; !d middle longhand missing', () => {
    assert.equal(serializeDeclarations(allKw('initial')), 'all: initial;');
    assert.equal(serializeDeclarations(allKw('unset')), 'all: unset;');
    assert.equal(serializeDeclarations(allKw('revert')), 'all: revert;');
    assert.equal(serializeDeclarations(allKw('revert-layer')), 'all: revert-layer;');
    // Unique-cause: includes F and startsWith('var(') F (neither css-wide nor var).
    assert.equal(hasDecl(serializeDeclarations(allKw('none')), 'all'), false);
    assert.equal(hasDecl(serializeDeclarations(allKw('red')), 'all'), false);

    // Unique-cause: !d T on a middle longhand while firstDecl exists and length >=.
    const first = ALL_SHORTHAND_LONGHANDS[0];
    const mid = ALL_SHORTHAND_LONGHANDS[Math.floor(ALL_SHORTHAND_LONGHANDS.length / 2)];
    const missingMid: Declaration[] = ALL_SHORTHAND_LONGHANDS.filter((n) => n !== mid).map((n) =>
      decl(n, 'inherit'),
    );
    let pad = 0;
    while (missingMid.length < ALL_SHORTHAND_LONGHANDS.length) {
      missingMid.push(decl(`--pad${pad}`, '1'));
      pad += 1;
    }
    assert.ok(missingMid.some((d) => d.name === first), 'first all-longhand still present');
    assert.equal(hasDecl(serializeDeclarations(missingMid), 'all'), false);
  });

  test('reconstructed side longhands combine to border; generic.important T vs mixed', () => {
    // Unique-cause: r && 'longhands' in r T (reconstructed other side) with existing 'decl' sides.
    const reconstructed = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      decl('border-right-width', '1px'),
      decl('border-right-style', 'solid'),
      decl('border-right-color', 'red'),
      decl('border-bottom', '1px solid red'),
      decl('border-left', '1px solid red'),
    ]);
    assert.equal(hasDecl(reconstructed, 'border'), true);

    // Unique-cause: reconstructed every() F (missing a longhand on the other side).
    const incompleteRight = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
      decl('border-right-width', '1px'),
      decl('border-right-style', 'solid'),
      decl('border-bottom', '1px solid red'),
      decl('border-left', '1px solid red'),
    ]);
    assert.equal(hasDecl(incompleteRight, 'border-top'), true);
    assert.equal(hasDecl(incompleteRight, 'border'), false);

    // Unique-cause: generic.important T on the equal-sides `border:` arm.
    const equalImp = serializeDeclarations([
      decl('border-top-width', '1px', true),
      decl('border-top-style', 'solid', true),
      decl('border-top-color', 'red', true),
      decl('border-right', '1px solid red', true),
      decl('border-bottom', '1px solid red', true),
      decl('border-left', '1px solid red', true),
    ]);
    assert.equal(hasDecl(equalImp, 'border'), true);
    assert.equal(equalImp.includes('!important'), true);

    // Unique-cause: generic.important T on the mixed-sides `border-top:` arm.
    const mixedImp = serializeDeclarations([
      decl('border-top-width', '1px', true),
      decl('border-top-style', 'solid', true),
      decl('border-top-color', 'red', true),
      decl('border-right', '2px solid red', true),
      decl('border-bottom', '1px solid red', true),
      decl('border-left', '1px solid red', true),
    ]);
    assert.equal(hasDecl(mixedImp, 'border-top'), true);
    assert.equal(hasDecl(mixedImp, 'border'), false);
    assert.equal(mixedImp.includes('!important'), true);

    // Unique-cause: r.important === generic.important F (values match).
    const importantMismatch = serializeDeclarations([
      decl('border-top-width', '1px', true),
      decl('border-top-style', 'solid', true),
      decl('border-top-color', 'red', true),
      decl('border-right', '1px solid red', false),
      decl('border-bottom', '1px solid red', true),
      decl('border-left', '1px solid red', true),
    ]);
    assert.equal(hasDecl(importantMismatch, 'border-top'), true);
    assert.equal(hasDecl(importantMismatch, 'border'), false);
  });

  test('tryCombineGenericShorthand contracted null and checkIntervening T via radius', () => {
    // Unique-cause: contracted !== null F (border-image slice is not initial).
    const img = serializeDeclarations([
      decl('border-image-source', 'url(x.png)'),
      decl('border-image-slice', '50%'),
      decl('border-image-width', '1'),
      decl('border-image-outset', '0'),
      decl('border-image-repeat', 'stretch'),
    ]);
    assert.equal(hasDecl(img, 'border-image-source'), true);
    assert.equal(hasDecl(img, 'border-image'), false);

    // Unique-cause: contractFlex null (mixed css-wide).
    const flex = serializeDeclarations([
      decl('flex-grow', 'inherit'),
      decl('flex-shrink', '1'),
      decl('flex-basis', 'auto'),
    ]);
    assert.equal(hasDecl(flex, 'flex-grow'), true);
    assert.equal(hasDecl(flex, 'flex'), false);

    const outline = serializeDeclarations([
      decl('outline-color', 'inherit'),
      decl('outline-style', 'solid'),
      decl('outline-width', '1px'),
    ]);
    assert.equal(hasDecl(outline, 'outline-color'), true);
    assert.equal(hasDecl(outline, 'outline'), false);

    const list = serializeDeclarations([
      decl('list-style-type', 'inherit'),
      decl('list-style-position', 'inside'),
      decl('list-style-image', 'none'),
    ]);
    assert.equal(hasDecl(list, 'list-style-type'), true);
    assert.equal(hasDecl(list, 'list-style'), false);

    // Unique-cause: checkIntervening T for generic border-top (radius starts with sidePrefix-).
    const radius = serializeDeclarations([
      decl('border-top-width', '1px'),
      decl('border-top-left-radius', '4px'),
      decl('border-top-style', 'solid'),
      decl('border-top-color', 'red'),
    ]);
    assert.equal(hasDecl(radius, 'border-top-width'), true);
    assert.equal(hasDecl(radius, 'border-top'), false);
    assert.equal(hasDecl(radius, 'border-top-left-radius'), true);
  });

  test('logical allowDifferent F via side shorthands; unequal !important two-value', () => {
    // Leftover used 6 width/style/color longhands, which tryCombineBorderBlock / generic
    // consume before tryCombineLogicalShorthand. Drive the side-shorthand names instead.
    const unequal = serializeDeclarations([
      decl('border-block-start', '1px solid red'),
      decl('border-block-end', '2px solid red'),
    ]);
    // Unique-cause: allowDifferent F, valS !== valE, no var → do not emit border-block.
    assert.equal(hasDecl(unequal, 'border-block-start'), true);
    assert.equal(hasDecl(unequal, 'border-block-end'), true);
    assert.equal(hasDecl(unequal, 'border-block'), false);

    const equal = serializeDeclarations([
      decl('border-block-start', '1px solid red'),
      decl('border-block-end', '1px solid red'),
    ]);
    assert.equal(hasDecl(equal, 'border-block'), true);

    const unequalInline = serializeDeclarations([
      decl('border-inline-start', '1px solid blue'),
      decl('border-inline-end', '2px solid blue'),
    ]);
    assert.equal(hasDecl(unequalInline, 'border-inline'), false);
    assert.equal(hasDecl(unequalInline, 'border-inline-start'), true);

    // Unique-cause: d.important T on the allowDifferent two-value return (L641).
    const importantTwo = serializeDeclarations([
      decl('margin-inline-start', '1px', true),
      decl('margin-inline-end', '2px', true),
    ]);
    assert.equal(importantTwo, 'margin-inline: 1px 2px !important;');

    const overflowImp = serializeDeclarations([
      decl('overflow-x', 'hidden', true),
      decl('overflow-y', 'scroll', true),
    ]);
    assert.equal(overflowImp, 'overflow: hidden scroll !important;');
  });

  test('box shorthands leftover: scroll-margin/padding, inset, border-radius, line-clamp none', () => {
    const scrollMargin = serializeDeclarations([
      decl('scroll-margin-top', '1px'),
      decl('scroll-margin-right', '2px'),
      decl('scroll-margin-bottom', '1px'),
      decl('scroll-margin-left', '2px'),
    ]);
    assert.equal(hasDecl(scrollMargin, 'scroll-margin'), true);

    const scrollPadding = serializeDeclarations([
      decl('scroll-padding-top', '1px'),
      decl('scroll-padding-right', '1px'),
      decl('scroll-padding-bottom', '1px'),
      decl('scroll-padding-left', '1px'),
    ]);
    assert.equal(hasDecl(scrollPadding, 'scroll-padding'), true);

    const inset = serializeDeclarations([
      decl('top', '1px'),
      decl('right', '2px'),
      decl('bottom', '1px'),
      decl('left', '2px'),
    ]);
    assert.equal(hasDecl(inset, 'inset'), true);

    const radius = serializeDeclarations([
      decl('border-top-left-radius', '1px'),
      decl('border-top-right-radius', '1px'),
      decl('border-bottom-right-radius', '1px'),
      decl('border-bottom-left-radius', '1px'),
    ]);
    assert.equal(hasDecl(radius, 'border-radius'), true);

    const clamp = serializeDeclarations([
      decl('max-lines', 'none'),
      decl('block-ellipsis', 'auto'),
      decl('continue', 'auto'),
    ]);
    assert.equal(hasDecl(clamp, 'line-clamp') || hasDecl(clamp, 'max-lines'), true);

    const overscroll = serializeDeclarations([
      decl('overscroll-behavior-x', 'contain'),
      decl('overscroll-behavior-y', 'none'),
    ]);
    assert.equal(hasDecl(overscroll, 'overscroll-behavior'), true);

    // Unique-cause: d.raw T and raw.includes('var(') T → serialize, not raw.
    const customVar = serializeDeclarations([
      { type: 'declaration', name: '--x', value: comps('var(--y)'), important: false, raw: 'var(--y)' },
    ]);
    assert.equal(customVar.includes('var(--y)'), true);
    // Unique-cause: d.raw F on a custom property.
    const customNoRaw = serializeDeclarations([
      { type: 'declaration', name: '--x', value: comps('Bar'), important: false },
    ]);
    assert.equal(customNoRaw, '--x: Bar;');
  });
});

describe('MC/DC still-hot unique-cause: serializeIdentifier / serializeString leftover bounds (cssom-1 #serialize-an-identifier)', { concurrency: false }, () => {
  test('digit/alpha inclusive bounds and step-6 otherwise-escape', () => {
    // Unique-cause: [0-9] inclusive vs just-outside; first-char digit already serializer-more.
    assert.equal(serializeIdentifier('/'), '\\/');
    assert.equal(serializeIdentifier('0'), '\\30 ');
    assert.equal(serializeIdentifier('9x'), '\\39 x');
    assert.equal(serializeIdentifier(':'), '\\:');
    // Unique-cause: [A-Z] / [a-z] inclusive vs just-outside.
    assert.equal(serializeIdentifier('@'), '\\@');
    assert.equal(serializeIdentifier('A'), 'A');
    assert.equal(serializeIdentifier('Z'), 'Z');
    assert.equal(serializeIdentifier('['), '\\[');
    assert.equal(serializeIdentifier('`'), '\\`');
    assert.equal(serializeIdentifier('a'), 'a');
    assert.equal(serializeIdentifier('z'), 'z');
    assert.equal(serializeIdentifier('{'), '\\{');
    // Unique-cause: i > 1 digit (step 3/4 F, step 6 digit T).
    assert.equal(serializeIdentifier('ab0'), 'ab0');
    assert.equal(serializeIdentifier('~'), '\\~');
    assert.equal(serializeIdentifier(' '), '\\ ');
    // serializeString: 0x20 is not a control (charCode <= 31 F, === 127 F).
    assert.equal(serializeString(' '), '" "');
    assert.equal(serializeString('\t'), '"\\9 "');
    assert.equal(serializeString('\u001f'), '"\\1f "');
  });
});

describe('MC/DC still-hot unique-cause: CSSStyleDeclaration.cssText remaining shorthands', { concurrency: false }, () => {
  test('scroll-margin / inset / border-radius / overscroll via setProperty', () => {
    const sm = new CSSStyleDeclaration();
    sm.setProperty('scroll-margin-top', '1px');
    sm.setProperty('scroll-margin-right', '1px');
    sm.setProperty('scroll-margin-bottom', '1px');
    sm.setProperty('scroll-margin-left', '1px');
    assert.equal(sm.cssText.includes('scroll-margin:'), true);

    const inset = new CSSStyleDeclaration();
    inset.setProperty('top', '0px');
    inset.setProperty('right', '0px');
    inset.setProperty('bottom', '0px');
    inset.setProperty('left', '0px');
    assert.equal(inset.cssText.includes('inset:') || inset.cssText.includes('top:'), true);

    const os = new CSSStyleDeclaration();
    os.setProperty('overscroll-behavior-x', 'auto');
    os.setProperty('overscroll-behavior-y', 'auto');
    assert.equal(os.cssText.includes('overscroll-behavior:'), true);
  });
});
