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
// Verifies: SYS-REQ-260821-PJ76, SW-REQ-260821-6D9T
// Leftover unique-cause for src/matcher.ts not already in
// tests/mcdc-branch-matcher.test.ts, tests/mcdc-branch-matcher-pseudos.test.ts,
// or tests/mcdc-branch-matcher-dir.test.ts. Drive matches / querySelectorAll /
// matchComplexSelector / isElement. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  matches,
  querySelector,
  querySelectorAll,
  matchComplexSelector,
  isElement,
} from '../src/matcher.ts';
import type { DOMElement } from '../src/matcher.ts';
import type {
  Combinator,
  ComplexSelector,
  CompoundSelector,
  InvalidSelector,
  NumberToken,
  PseudoClassSelector,
  SelectorList,
  SimpleSelector,
} from '../src/types.ts';

function html(source: string) {
  return parseHTML(source).document;
}

function compound(...selectors: SimpleSelector[]): CompoundSelector {
  return { type: 'compound-selector', selectors };
}

function complex(...items: ComplexSelector['items']): ComplexSelector {
  return { type: 'complex-selector', items, tokens: [] };
}

function list(...selectors: (ComplexSelector | InvalidSelector)[]): SelectorList {
  return { type: 'selector-list', selectors };
}

function typeSel(name: string, namespace?: string): SimpleSelector {
  return namespace === undefined
    ? { type: 'type-selector', name }
    : { type: 'type-selector', name, namespace };
}

function comb(value: Combinator['value']): Combinator {
  return { type: 'combinator', value };
}

function invalid(): InvalidSelector {
  return { type: 'invalid-selector', tokens: [] };
}

function intToken(value: number): NumberToken {
  return { type: 'number', value, numberType: 'integer', sign: null };
}

function hasArg(argument: SelectorList | NumberToken[] | undefined): SelectorList {
  const pseudo: PseudoClassSelector = argument === undefined
    ? { type: 'pseudo-class-selector', name: 'has' }
    : { type: 'pseudo-class-selector', name: 'has', argument };
  return list(complex(compound(pseudo)));
}

describe('MC/DC leftover unique-cause: isElement and matches() mock / invalid', () => {
  test('isElement leftover unique-cause of nodeType-in vs empty vs primitive', () => {
    // selectors-4 § 15 #match-against-element
    assert.equal(isElement({}), false);
    assert.equal(isElement(undefined), false);
    assert.equal(isElement(1), false);
    assert.equal(isElement(true), false);
    assert.equal(isElement({ nodeType: 9 }), false);
  });

  test('matches() mock unique-cause of tagName / nodeType skipping custom matches()', () => {
    const accept: DOMElement & { matches: (s: string) => boolean } = {
      matches: () => true,
    };
    assert.equal(matches(accept, 'span'), true);

    const tagNameSkip: DOMElement & { matches: (s: string) => boolean } = {
      matches: () => true,
      tagName: 'SPAN',
    };
    assert.equal(matches(tagNameSkip, 'div'), false);
    assert.equal(matches(tagNameSkip, 'span'), true);

    const nodeTypeSkip: DOMElement & { matches: (s: string) => boolean } = {
      matches: () => true,
      nodeType: 1,
    };
    assert.equal(matches(nodeTypeSkip, 'div'), false);

    const noFn: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(noFn, 'div'), true);
  });

  test('invalid-selector unique-cause skip in matches() vs empty list', () => {
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(el, list(invalid(), complex(compound(typeSel('div'))))), true);
    assert.equal(matches(el, list(invalid())), false);
    assert.equal(matches(el, list()), false);
  });

  test('parseSelector leftover unique-cause of non-string neither list nor complex', () => {
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    const bogus = { type: 'compound-selector', selectors: [] } as unknown as ComplexSelector;
    assert.equal(matches(el, bogus), false);
  });
});

describe('MC/DC leftover unique-cause: matchComplexSelector combinators', () => {
  test('empty items and last-not-compound unique-cause', () => {
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matchComplexSelector(el, complex()), false);
    assert.equal(matchComplexSelector(el, complex(comb('>'))), false);
    assert.equal(matchComplexSelector(el, complex(compound(typeSel('div')))), true);
  });

  test('leading combinator unique-cause of scope missing, parent/prev, column, and non-combinator', () => {
    const host: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    const mid: DOMElement = { nodeType: 1, localName: 'p', tagName: 'P', parentElement: host };
    const child: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN', parentElement: mid };
    const sib: DOMElement = { nodeType: 1, localName: 'b', tagName: 'B', parentElement: host };
    const later: DOMElement = { nodeType: 1, localName: 'i', tagName: 'I', parentElement: host };
    host.children = [mid, sib, later];
    mid.children = [child];
    mid.previousElementSibling = null;
    sib.previousElementSibling = mid;
    later.previousElementSibling = sib;

    const leadingGt = complex(comb('>'), compound(typeSel('span')));
    const leadingPlus = complex(comb('+'), compound(typeSel('b')));
    const leadingTilde = complex(comb('~'), compound(typeSel('i')));
    const leadingDesc = complex(comb(' '), compound(typeSel('span')));
    const leadingCol = complex(comb('||'), compound(typeSel('span')));

    // !scope unique-cause: leading combinator still matches the compound
    assert.equal(matchComplexSelector(child, leadingGt), true);
    assert.equal(matchComplexSelector(child, leadingGt, host), false);
    assert.equal(matchComplexSelector(mid, complex(comb('>'), compound(typeSel('p'))), host), true);

    assert.equal(matchComplexSelector(sib, leadingPlus, mid), true);
    assert.equal(matchComplexSelector(later, leadingPlus, mid), false);

    assert.equal(matchComplexSelector(later, leadingTilde, mid), true);
    assert.equal(matchComplexSelector(sib, leadingTilde, later), false);

    assert.equal(matchComplexSelector(child, leadingDesc, host), true);
    assert.equal(matchComplexSelector(child, leadingDesc, sib), false);
    assert.equal(matchComplexSelector(child, leadingCol, host), false);

    // itemIndex===1 && items[0].type==='combinator' unique-cause F on type
    const twoCompounds = complex(compound(typeSel('div')), compound(typeSel('span')));
    assert.equal(matchComplexSelector(child, twoCompounds, host), false);
  });

  test('non-leading combinator unique-cause of missing neighbor, skip, column', () => {
    const document = html(`
      <div id="g">
        <p id="p"><span id="s"></span></p>
        <b id="b"></b>
        <i id="i"></i>
      </div>
    `);
    const s = document.getElementById('s')!;
    const p = document.getElementById('p')!;
    const b = document.getElementById('b')!;
    const i = document.getElementById('i')!;
    const g = document.getElementById('g')!;

    assert.equal(matches(s, 'p > span'), true);
    assert.equal(matches(g, 'p > div'), false);
    const orphan: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    assert.equal(matches(orphan, 'p > span'), false);

    assert.equal(matches(b, 'p + b'), true);
    assert.equal(matches(p, 'b + p'), false);
    assert.equal(matches(i, 'p + i'), false);

    assert.equal(matches(i, 'p ~ i'), true);
    assert.equal(matches(p, 'i ~ p'), false);

    assert.equal(matches(s, 'div span'), true);
    assert.equal(matches(g, 'span div'), false);

    assert.equal(matches(b, 'p || b'), false);
  });
});

describe('MC/DC leftover unique-cause: namespaces type and universal', () => {
  test('null-namespace leftover unique-cause of missing ns, xhtml, svg localName, svg ns', () => {
    const noNs: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    const xhtml: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    const htmlSvg: DOMElement = {
      nodeType: 1,
      localName: 'svg',
      tagName: 'SVG',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    const svgNs: DOMElement = {
      nodeType: 1,
      localName: 'rect',
      tagName: 'rect',
      namespaceURI: 'http://www.w3.org/2000/svg',
    };
    assert.equal(matches(noNs, '|div'), true);
    assert.equal(matches(xhtml, '|div'), true);
    assert.equal(matches(htmlSvg, '|svg'), false);
    assert.equal(matches(svgNs, '|rect'), false);
    assert.equal(matches(noNs, '|*'), true);
    assert.equal(matches(htmlSvg, '|*'), false);
    assert.equal(matches(svgNs, '|*'), false);
  });

  test('svg-namespace leftover unique-cause of isSvg localName, prefix, and ns', () => {
    const htmlDiv: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    const prefixed: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      prefix: 'svg',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    const htmlSvg: DOMElement = {
      nodeType: 1,
      localName: 'svg',
      tagName: 'SVG',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    const svgRect: DOMElement = {
      nodeType: 1,
      localName: 'rect',
      tagName: 'rect',
      namespaceURI: 'http://www.w3.org/2000/svg',
    };
    assert.equal(matches(htmlDiv, 'svg|div'), false);
    assert.equal(matches(prefixed, 'svg|div'), true);
    assert.equal(matches(htmlSvg, 'svg|svg'), true);
    assert.equal(matches(svgRect, 'svg|rect'), true);
    assert.equal(matches(htmlDiv, 'svg|*'), false);
    assert.equal(matches(prefixed, 'svg|*'), true);
    assert.equal(matches(htmlSvg, 'svg|*'), true);
    assert.equal(matches(svgRect, 'svg|*'), true);
  });

  test('other-namespace leftover unique-cause of prefix vs namespaceURI vs neither', () => {
    const prefixed: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      prefix: 'other',
    };
    const byUri: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      prefix: 'x',
      namespaceURI: 'other',
    };
    const neither: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      prefix: 'x',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
    };
    assert.equal(matches(prefixed, 'other|div'), true);
    assert.equal(matches(byUri, 'other|div'), true);
    assert.equal(matches(neither, 'other|div'), false);
    assert.equal(matches(prefixed, 'other|*'), true);
    assert.equal(matches(neither, 'other|*'), false);
  });
});

describe('MC/DC leftover unique-cause: id, class, attributes', () => {
  test('id leftover unique-cause of element.id vs missing getter', () => {
    const byProp: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV', id: 'main' };
    const noId: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(byProp, '#main'), true);
    assert.equal(matches(noId, '#main'), false);
  });

  test('class leftover unique-cause of classList.contains not a function and className-only', () => {
    const badList: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      classList: {} as { contains(cls: string): boolean },
      className: 'foo bar',
    };
    assert.equal(matches(badList, '.foo'), true);
    assert.equal(matches(badList, '.missing'), false);

    const classNameOnly: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      className: 'foo',
    };
    assert.equal(matches(classNameOnly, '.foo'), true);

    const attrNull: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      className: 'foo',
      getAttribute: () => null,
    };
    assert.equal(matches(attrNull, '.foo'), true);
  });

  test('[|attr] leftover unique-cause of hasAttributeNS without getAttributeNS and hasAttribute fallback', () => {
    const nsOnly: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttributeNS: (_ns, name) => name === 'x',
    };
    assert.equal(matches(nsOnly, '[|x]'), true);
    assert.equal(matches(nsOnly, '[|x="y"]'), false);

    const htmlFallback: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttributeNS: () => false,
      hasAttribute: (name) => name === 'title',
      getAttribute: (name) => (name === 'title' ? 'Hello' : null),
    };
    assert.equal(matches(htmlFallback, '[|title]'), true);
    assert.equal(matches(htmlFallback, '[|title="Hello"]'), true);
    assert.equal(matches(htmlFallback, '[|missing]'), false);
  });

  test('attribute leftover unique-cause of hasAttribute missing, getAttribute null, ~= whitespace, |= neither', () => {
    const getterOnly: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name) => (name === 'title' ? 'Hello World' : null),
    };
    assert.equal(matches(getterOnly, '[title]'), true);
    assert.equal(matches(getterOnly, '[title="Hello World"]'), true);
    assert.equal(matches(getterOnly, '[missing]'), false);

    const noGetter: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(noGetter, '[title]'), false);

    const document = html(`<div id="d" title="Hello World" lang="eng"></div>`);
    const d = document.getElementById('d')!;
    assert.equal(matches(d, '[title~="a b"]'), false);
    assert.equal(matches(d, '[title~="Hello"]'), true);
    assert.equal(matches(d, '[lang|="en"]'), false);
    assert.equal(matches(d, '[lang|="eng"]'), true);

    const en = html(`<div id="e" lang="en"></div>`).getElementById('e')!;
    assert.equal(matches(en, '[lang|="en"]'), true);
  });

  test('attribute flags leftover unique-cause of I vs HTML-CI title vs s', () => {
    const document = html(`<div id="d" title="Hello"></div><input id="i" type="TEXT">`);
    const d = document.getElementById('d')!;
    const i = document.getElementById('i')!;
    assert.equal(matches(d, '[title="HELLO" i]'), true);
    assert.equal(matches(d, '[title="HELLO" I]'), true);
    assert.equal(matches(d, '[title="HELLO"]'), false);
    assert.equal(matches(i, '[type="text"]'), true);
    assert.equal(matches(i, '[type="TEXT" s]'), true);
    assert.equal(matches(i, '[type="text" s]'), false);
  });

  test('unknown attribute operator unique-cause via pre-parsed selector', () => {
    const el: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttribute: (name) => name === 'title',
      getAttribute: (name) => (name === 'title' ? 'x' : null),
    };
    const unknown = list(complex(compound({
      type: 'attribute-selector',
      name: 'title',
      operator: '!=',
      value: 'x',
    })));
    assert.equal(matches(el, unknown), false);
    assert.equal(matches(el, '[title="x"]'), true);
  });
});

describe('MC/DC leftover unique-cause: :is/:not/:has argument conjuncts', () => {
  test(':is/:not/:has unique-cause of missing argument, array, and non-list type', () => {
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(el, ':is()'), false);
    assert.equal(matches(el, list(complex(compound({ type: 'pseudo-class-selector', name: 'not' })))), true);
    assert.equal(matches(el, hasArg(undefined)), false);

    const arrayArg: NumberToken[] = [intToken(1)];
    assert.equal(matches(el, list(complex(compound({ type: 'pseudo-class-selector', name: 'is', argument: arrayArg })))), false);
    assert.equal(matches(el, list(complex(compound({ type: 'pseudo-class-selector', name: 'not', argument: arrayArg })))), true);
    assert.equal(matches(el, hasArg(arrayArg)), false);

    const notList = { type: 'complex-selector', items: [], tokens: [] } as unknown as SelectorList;
    assert.equal(matches(el, list(complex(compound({ type: 'pseudo-class-selector', name: 'is', argument: notList })))), false);
    assert.equal(matches(el, list(complex(compound({ type: 'pseudo-class-selector', name: 'has', argument: notList })))), false);
  });
});

describe('MC/DC leftover unique-cause: :root :empty :scope siblings', () => {
  test(':root leftover unique-cause of missing documentElement and parentNode nodeType 9', () => {
    const noDocEl: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      ownerDocument: {},
    };
    assert.equal(matches(noDocEl, ':root'), true);

    const inDocument: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      parentNode: { nodeType: 9 },
    };
    assert.equal(matches(inDocument, ':root'), true);

    const inElement: DOMElement = {
      nodeType: 1,
      localName: 'span',
      tagName: 'SPAN',
      parentNode: { nodeType: 1, localName: 'div', tagName: 'DIV' },
    };
    assert.equal(matches(inElement, ':root'), false);
  });

  test(':empty leftover unique-cause of empty text, element child, missing childNodes', () => {
    const emptyText: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      childNodes: [{ nodeType: 3, nodeValue: '' }],
    };
    const elementChild: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      childNodes: [{ nodeType: 1 }],
    };
    const missing: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(emptyText, ':empty'), true);
    assert.equal(matches(elementChild, ':empty'), false);
    assert.equal(matches(missing, ':empty'), true);
  });

  test(':scope leftover unique-cause of ownerDocument without documentElement', () => {
    const noDocEl: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      ownerDocument: {},
    };
    assert.equal(matches(noDocEl, ':scope'), true);
    const child: DOMElement = {
      nodeType: 1,
      localName: 'span',
      tagName: 'SPAN',
      parentElement: noDocEl,
      ownerDocument: {},
    };
    assert.equal(matches(child, ':scope'), false);
  });

  test('getElementSiblings leftover unique-cause of empty parentElement.children and empty parentNode.childNodes', () => {
    const emptyKids: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      children: [],
    };
    const detached: DOMElement = {
      nodeType: 1,
      localName: 'span',
      tagName: 'SPAN',
      parentElement: emptyKids,
    };
    assert.equal(matches(detached, ':first-child'), false);

    const parentNode: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      childNodes: [{ nodeType: 3, nodeValue: 'x' }],
    };
    const onlyTextSib: DOMElement = {
      nodeType: 1,
      localName: 'span',
      tagName: 'SPAN',
      parentNode,
    };
    assert.equal(matches(onlyTextSib, ':first-child'), true);
    assert.equal(matches(onlyTextSib, ':only-child'), true);
  });
});

describe('MC/DC leftover unique-cause: nth An+B and of S', () => {
  test('matchAnPlusB leftover unique-cause of a=0 miss, a>0 diff/modulo, a<0 diff/modulo', () => {
    const document = html(`
      <ul>
        <li id="a"></li><li id="b"></li><li id="c"></li><li id="d"></li><li id="e"></li>
      </ul>
    `);
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const c = document.getElementById('c')!;
    const e = document.getElementById('e')!;

    assert.equal(matches(b, ':nth-child(0n+2)'), true);
    assert.equal(matches(a, ':nth-child(0n+2)'), false);

    assert.equal(matches(c, ':nth-child(2n+3)'), true);
    assert.equal(matches(a, ':nth-child(2n+3)'), false);
    assert.equal(matches(b, ':nth-child(2n+1)'), false);

    assert.equal(matches(b, ':nth-child(-2n+4)'), true);
    assert.equal(matches(a, ':nth-child(-2n+4)'), false);
    assert.equal(matches(e, ':nth-child(-2n+4)'), false);
  });

  test('getAnPlusB leftover unique-cause of argument array without nth vs both missing', () => {
    const document = html(`<ul><li id="a"></li><li id="b"></li></ul>`);
    const b = document.getElementById('b')!;
    const viaArg = list(complex(compound({
      type: 'pseudo-class-selector',
      name: 'nth-child',
      argument: [intToken(2)],
    })));
    assert.equal(matches(b, viaArg), true);
    const missing = list(complex(compound({ type: 'pseudo-class-selector', name: 'nth-child' })));
    assert.equal(matches(b, missing), false);
  });

  test('nth-child of S leftover unique-cause of argument not a selector-list', () => {
    const document = html(`<ul><li id="a" class="x"></li><li id="b"></li></ul>`);
    const a = document.getElementById('a')!;
    const ofArray = list(complex(compound({
      type: 'pseudo-class-selector',
      name: 'nth-child',
      nth: [intToken(1)],
      argument: [intToken(1)],
    })));
    assert.equal(matches(a, ofArray), true);
  });
});

describe('MC/DC leftover unique-cause: :heading :lang', () => {
  test(':heading leftover unique-cause of h4-h6, non-digit argument, and non-array argument', () => {
    const document = html(`<h4 id="h4">t</h4><h5 id="h5">t</h5><h6 id="h6">t</h6><p id="p">x</p>`);
    assert.equal(matches(document.getElementById('h4')!, ':heading'), true);
    assert.equal(matches(document.getElementById('h5')!, ':heading'), true);
    assert.equal(matches(document.getElementById('h6')!, ':heading'), true);
    assert.equal(matches(document.getElementById('p')!, ':heading'), false);
    const h4el = document.getElementById('h4')!;
    const noDigits = list(complex(compound({
      type: 'pseudo-class-selector',
      name: 'heading',
      argument: [{ type: 'ident', value: 'foo' }],
    })));
    assert.equal(matches(h4el, noDigits), true);
    assert.equal(matches(h4el, ':heading(5)'), false);

    const h4: DOMElement = { nodeType: 1, localName: 'h4', tagName: 'H4' };
    const notArray = list(complex(compound({
      type: 'pseudo-class-selector',
      name: 'heading',
      argument: list(),
    })));
    assert.equal(matches(h4, notArray), true);

    const tagOnly: DOMElement = { nodeType: 1, tagName: 'H7' };
    assert.equal(matches(tagOnly, ':heading'), false);
  });

  test(':lang leftover unique-cause of exact, prefix-dash, neither, and missing lang', () => {
    const document = html(`
      <div lang="en"><span id="exact">x</span></div>
      <div lang="en-US"><span id="prefix">x</span></div>
      <div lang="eng"><span id="neither">x</span></div>
      <div id="none">x</div>
    `);
    assert.equal(matches(document.getElementById('exact')!, ':lang(en)'), true);
    assert.equal(matches(document.getElementById('prefix')!, ':lang(en)'), true);
    assert.equal(matches(document.getElementById('neither')!, ':lang(en)'), false);
    assert.equal(matches(document.getElementById('none')!, ':lang(en)'), false);

    const orphan: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(orphan, ':lang(en)'), false);
  });
});

describe('MC/DC leftover unique-cause: form and location pseudos', () => {
  test(':checked leftover unique-cause of checked property vs attribute and option selected property', () => {
    const cbProp: DOMElement & { checked: boolean } = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      checked: true,
      getAttribute: (name) => (name === 'type' ? 'checkbox' : null),
      hasAttribute: () => false,
    };
    const radioAttr: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      getAttribute: (name) => (name === 'type' ? 'radio' : null),
      hasAttribute: (name) => name === 'checked',
    };
    const text: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      getAttribute: (name) => (name === 'type' ? 'text' : null),
      hasAttribute: (name) => name === 'checked',
    };
    const optProp: DOMElement & { selected: boolean } = {
      nodeType: 1,
      localName: 'option',
      tagName: 'OPTION',
      selected: true,
      hasAttribute: () => false,
    };
    assert.equal(matches(cbProp, ':checked'), true);
    assert.equal(matches(radioAttr, ':checked'), true);
    assert.equal(matches(text, ':checked'), false);
    assert.equal(matches(optProp, ':checked'), true);
  });

  test(':disabled leftover unique-cause of textarea, fieldset ancestor hasAttribute, optgroup, and formAssociated false', () => {
    const document = html(`
      <textarea id="ta" disabled></textarea>
      <textarea id="ta2"></textarea>
      <fieldset id="plain">
        <fieldset id="inner"></fieldset>
        <input id="in-plain">
      </fieldset>
      <fieldset id="outer" disabled>
        <fieldset id="nested"></fieldset>
      </fieldset>
      <select id="sel"><optgroup id="og"><option id="opt">z</option></optgroup></select>
      <option id="opt-disabled" disabled>d</option>
    `);
    assert.equal(matches(document.getElementById('ta')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('ta2')!, ':enabled'), true);
    assert.equal(matches(document.getElementById('inner')!, ':disabled'), false);
    assert.equal(matches(document.getElementById('nested')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('in-plain')!, ':disabled'), false);
    assert.equal(matches(document.getElementById('opt')!, ':disabled'), false);
    assert.equal(matches(document.getElementById('opt-disabled')!, ':disabled'), true);

    const noKids: DOMElement = {
      nodeType: 1,
      localName: 'fieldset',
      tagName: 'FIELDSET',
      hasAttribute: (name) => name === 'disabled',
    };
    const inNoKids: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      parentElement: noKids,
      hasAttribute: () => false,
    };
    noKids.children = [inNoKids];
    assert.equal(matches(inNoKids, ':disabled'), true);

    const notCustom: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      formAssociated: true,
      hasAttribute: (name) => name === 'disabled',
    } as DOMElement & { formAssociated: boolean };
    assert.equal(matches(notCustom, ':disabled'), false);

    const assocFalse: DOMElement & { formAssociated: boolean } = {
      nodeType: 1,
      localName: 'my-input',
      tagName: 'MY-INPUT',
      formAssociated: false,
      hasAttribute: (name) => name === 'disabled',
    };
    assert.equal(matches(assocFalse, ':disabled'), false);
    assert.equal(matches(assocFalse, ':enabled'), false);
  });

  test(':read-only / :read-write leftover unique-cause of textarea, disabled input, contenteditable false', () => {
    const document = html(`
      <textarea id="ta"></textarea>
      <input id="dis" disabled>
      <div id="cefalse" contenteditable="false"></div>
      <div id="plain"></div>
    `);
    assert.equal(matches(document.getElementById('ta')!, ':read-write'), true);
    assert.equal(matches(document.getElementById('ta')!, ':read-only'), false);
    assert.equal(matches(document.getElementById('dis')!, ':read-only'), true);
    assert.equal(matches(document.getElementById('dis')!, ':read-write'), false);
    assert.equal(matches(document.getElementById('cefalse')!, ':read-write'), false);
    assert.equal(matches(document.getElementById('plain')!, ':read-only'), true);
  });

  test(':link leftover unique-cause of getAttribute href without hasAttribute', () => {
    const getterOnly: DOMElement = {
      nodeType: 1,
      localName: 'a',
      tagName: 'A',
      getAttribute: (name) => (name === 'href' ? '/' : null),
    };
    const noHref: DOMElement = { nodeType: 1, localName: 'a', tagName: 'A' };
    const divHref: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttribute: (name) => name === 'href',
    };
    assert.equal(matches(getterOnly, ':link'), true);
    assert.equal(matches(noHref, ':any-link'), false);
    assert.equal(matches(divHref, ':link'), false);
  });

  test(':target leftover unique-cause of getAttribute id, hash without #, and empty hash', () => {
    const byAttr: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name) => (name === 'id' ? 'x' : null),
      ownerDocument: { location: { hash: '#x' } },
    };
    const noHash: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      id: 'x',
      ownerDocument: { location: { hash: '#' } },
    };
    const bareHash: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      id: 'x',
      ownerDocument: { location: { hash: 'x' } },
    };
    const miss: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      id: 'y',
      ownerDocument: { location: { hash: '#x' } },
    };
    assert.equal(matches(byAttr, ':target'), true);
    assert.equal(matches(noHash, ':target'), false);
    assert.equal(matches(bareHash, ':target'), true);
    assert.equal(matches(miss, ':target'), false);
  });

  test(':focus leftover unique-cause of missing contains() vs active mismatch', () => {
    const el: DOMElement = { nodeType: 1, localName: 'input', tagName: 'INPUT' };
    (el as { ownerDocument?: unknown }).ownerDocument = { activeElement: el };
    assert.equal(matches(el, ':focus'), true);
    assert.equal(matches(el, ':focus-visible'), true);

    const other: DOMElement = { nodeType: 1, localName: 'input', tagName: 'INPUT' };
    (el as { ownerDocument?: unknown }).ownerDocument = { activeElement: other };
    assert.equal(matches(el, ':focus'), false);

    (el as { ownerDocument?: unknown }).ownerDocument = {};
    assert.equal(matches(el, ':focus'), false);
  });

  test(':focus-within leftover unique-cause of element.contains and parentNode walk miss', () => {
    const child: DOMElement = { nodeType: 1, localName: 'input', tagName: 'INPUT' };
    const host: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      contains: (n: unknown) => n === child,
    };
    const doc = { activeElement: child };
    (child as { ownerDocument?: unknown }).ownerDocument = doc;
    (host as { ownerDocument?: unknown }).ownerDocument = doc;
    assert.equal(matches(host, ':focus-within'), true);

    const outsider: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const viaNode: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    outsider.parentNode = viaNode;
    const missDoc = { activeElement: outsider };
    (viaNode as { ownerDocument?: unknown }).ownerDocument = missDoc;
    (outsider as { ownerDocument?: unknown }).ownerDocument = missDoc;
    assert.equal(matches(viaNode, ':focus-within'), true);

    const unrelated: DOMElement = { nodeType: 1, localName: 'p', tagName: 'P' };
    (unrelated as { ownerDocument?: unknown }).ownerDocument = missDoc;
    assert.equal(matches(unrelated, ':focus-within'), false);
  });
});

describe('MC/DC leftover unique-cause: :has() combinators and invalid skip', () => {
  test(':has() leftover unique-cause of child miss, adjacent miss, sibling miss, descendant space', () => {
    const document = html(`
      <div id="root">
        <p id="p1"><b id="b1"></b></p>
        <p id="p2"><span id="s1"></span></p>
        <p id="p3"></p>
        <div id="deep"><em id="e1"><span id="s2"></span></em></div>
      </div>
    `);
    const p1 = document.getElementById('p1')!;
    const p2 = document.getElementById('p2')!;
    const p3 = document.getElementById('p3')!;
    const root = document.getElementById('root')!;
    const deep = document.getElementById('deep')!;

    assert.equal(matches(p1, ':has(> span)'), false);
    assert.equal(matches(p2, ':has(> span)'), true);
    assert.equal(matches(p2, ':has(+ p)'), true);
    assert.equal(matches(p3, ':has(+ p)'), false);
    assert.equal(matches(p1, ':has(+ span)'), false);
    assert.equal(matches(p1, ':has(~ div)'), true);
    assert.equal(matches(p3, ':has(~ p)'), false);
    assert.equal(matches(deep, ':has( span)'), true);
    assert.equal(matches(p3, ':has( span)'), false);
    assert.equal(matches(root, ':has(span)'), true);
  });

  test(':has() leftover unique-cause of invalid-selector skip and leading space combinator', () => {
    const document = html(`<div id="d"><span id="s"><b id="b"></b></span></div>`);
    const d = document.getElementById('d')!;
    const mixed = hasArg(list(invalid(), complex(comb(' '), compound(typeSel('b')))));
    assert.equal(matches(d, mixed), true);
    assert.equal(matches(d, hasArg(list(invalid()))), false);

    const leadingSpace = hasArg(list(complex(comb(' '), compound(typeSel('b')))));
    assert.equal(matches(d, leadingSpace), true);
    assert.equal(matches(document.getElementById('s')!, leadingSpace), true);
    assert.equal(matches(document.getElementById('b')!, leadingSpace), false);
  });
});

describe('MC/DC leftover unique-cause: :has-slotted remainder', () => {
  test(':has-slotted leftover unique-cause of children fallback, non-element assigned, flatten', () => {
    const span: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const noAssign: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      children: [span],
    };
    const spanList: SelectorList = list(complex(compound(typeSel('span'))));
    const hasSpan = list(complex(compound({
      type: 'pseudo-class-selector',
      name: 'has-slotted',
      argument: spanList,
    })));
    assert.equal(matches(noAssign, hasSpan), true);

    let flatten: boolean | undefined;
    const withAssign: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      assignedNodes: (opts?: { flatten?: boolean }) => {
        flatten = opts?.flatten;
        return [{ nodeType: 3, nodeValue: 'x' }];
      },
    };
    assert.equal(matches(withAssign, hasSpan), false);
    assert.equal(flatten, true);

    withAssign.assignedNodes = (opts?: { flatten?: boolean }) => {
      flatten = opts?.flatten;
      return [span];
    };
    assert.equal(matches(withAssign, hasSpan), true);
  });
});

describe('MC/DC leftover unique-cause: querySelectorAll walk and document roots', () => {
  test('element root leftover unique-cause of missing children and non-element child', () => {
    const leaf: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.deepEqual(querySelectorAll(leaf, 'div'), []);
    assert.equal(querySelector(leaf, 'div'), null);

    const mixed: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      children: [{ nodeType: 3 } as unknown as DOMElement, { nodeType: 1, localName: 'span', tagName: 'SPAN' }],
    };
    assert.equal(querySelectorAll(mixed, 'span').length, 1);
    assert.equal(querySelectorAll(mixed, 'div').length, 0);
  });

  test('non-element root leftover unique-cause of children-in vs childNodes-in vs neither', () => {
    const span: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const childrenOnly = { children: [span] };
    const nodesOnly = { childNodes: [span] };
    const neither = { foo: 1 };
    const childrenUndef = { children: undefined as unknown as DOMElement[], childNodes: [span] };
    const mixedNodes = { childNodes: [{ nodeType: 3 }, span] };
    assert.equal(querySelectorAll(childrenOnly, 'span').length, 1);
    assert.equal(querySelectorAll(nodesOnly, 'span').length, 1);
    assert.deepEqual(querySelectorAll(neither, 'span'), []);
    assert.equal(querySelectorAll(childrenUndef, 'span').length, 1);
    assert.equal(querySelectorAll(mixedNodes, 'span').length, 1);
    assert.deepEqual(querySelectorAll(undefined, 'span'), []);
  });
});
