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
// Still-hot unique-cause for src/matcher.ts leftovers that
// tests/mcdc-branch-matcher.test.ts, tests/mcdc-branch-matcher-pseudos.test.ts,
// tests/mcdc-branch-matcher-dir.test.ts, and
// tests/mcdc-branch-matcher-leftover.test.ts do not isolate.
// Drive matches / querySelectorAll / matchComplexSelector. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  matches,
  querySelector,
  querySelectorAll,
  matchComplexSelector,
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

function pc(name: string, extra: Partial<PseudoClassSelector> = {}): SelectorList {
  return list(complex(compound({ type: 'pseudo-class-selector', name, ...extra })));
}

function asArg(value: unknown): PseudoClassSelector['argument'] {
  return value as PseudoClassSelector['argument'];
}

describe('MC/DC still-hot unique-cause: matches() mock invalid-selector', () => {
  test('mock matches() unique-cause of invalid-selector continue vs valid complex', () => {
    // selectors-4 § 15 #match-against-element — mock path only when
    // localName/tagName/nodeType are all missing. Leftover invalid skip used
    // a real div (second loop), never the mock loop's type === invalid-selector.
    const accept: DOMElement & { matches: (s: string) => boolean } = {
      matches: () => true,
    };
    assert.equal(matches(accept, list(invalid())), false);
    assert.equal(matches(accept, list(complex(compound(typeSel('div'))))), true);
    assert.equal(matches(accept, list(invalid(), complex(compound(typeSel('span'))))), true);
  });
});

describe('MC/DC still-hot unique-cause: querySelectorAll nested walk isElement', () => {
  test('nested walk unique-cause of isElement on mixed grandchildren', () => {
    // selectors-4 § 16 #match-against-tree. Leftover mixed children ran on the
    // element-root loop, so walk()'s isElement never saw a non-element.
    const span: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const inner: DOMElement = {
      nodeType: 1,
      localName: 'p',
      tagName: 'P',
      children: [{ nodeType: 3 } as unknown as DOMElement, span],
    };
    const root: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      children: [inner],
    };
    assert.equal(querySelectorAll(root, 'span').length, 1);
    assert.equal(querySelector(root, 'span'), span);
    assert.equal(querySelectorAll(root, 'p').length, 1);
    inner.children = [{ nodeType: 3 } as unknown as DOMElement];
    assert.equal(querySelectorAll(root, 'span').length, 0);
  });
});

describe('MC/DC still-hot unique-cause: leading ~ while(sib) miss after enter', () => {
  test('leading ~ unique-cause of while(sib) F after a previous sibling walk', () => {
    // selectors-4 § 3.4 #subsequent-sibling-combinators. Leftover fail path
    // used an element that failed the compound (never entered while).
    const host: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    const mid: DOMElement = { nodeType: 1, localName: 'p', tagName: 'P', parentElement: host };
    const sib: DOMElement = { nodeType: 1, localName: 'b', tagName: 'B', parentElement: host };
    const later: DOMElement = { nodeType: 1, localName: 'i', tagName: 'I', parentElement: host };
    host.children = [mid, sib, later];
    mid.previousElementSibling = null;
    sib.previousElementSibling = mid;
    later.previousElementSibling = sib;

    const leadingTilde = complex(comb('~'), compound(typeSel('i')));
    assert.equal(matchComplexSelector(later, leadingTilde, mid), true);
    assert.equal(matchComplexSelector(later, leadingTilde, host), false);
    assert.equal(matchComplexSelector(later, leadingTilde, later), false);
  });
});

describe('MC/DC still-hot unique-cause: type-selector name * and other|* URI', () => {
  test('type-selector unique-cause of selName !== "*" with elLocal mismatch held T', () => {
    // selectors-4 § 5.1 #type-selectors. `|*` parses as universal-selector, so
    // leftover never unique-caused type-selector name '*'.
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(el, list(complex(compound(typeSel('*'))))), true);
    assert.equal(matches(el, list(complex(compound(typeSel('span'))))), false);
    assert.equal(matches(el, list(complex(compound(typeSel('div'))))), true);
    assert.equal(matches(el, list(complex(compound(typeSel('*', ''))))), true);
  });

  test('universal other|* unique-cause of namespaceURI match when prefix mismatches', () => {
    // selectors-4 § 5.2 #universal-selector. Leftover other|* used prefix-match
    // and neither; missing prefix-F + namespaceURI-T.
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
    assert.equal(matches(byUri, 'other|*'), true);
    assert.equal(matches(neither, 'other|*'), false);
  });
});

describe('MC/DC still-hot unique-cause: hasAttribute without getAttribute', () => {
  test('[|attr] hasAttribute fallback unique-cause of missing getAttribute', () => {
    // selectors-4 § 7 #attribute-selectors. Leftover htmlFallback had both.
    const presence: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttributeNS: () => false,
      hasAttribute: (name) => name === 'title',
    };
    assert.equal(matches(presence, '[|title]'), true);
    assert.equal(matches(presence, '[|title="Hello"]'), false);
    assert.equal(matches(presence, '[|missing]'), false);
  });

  test('[attr] hasAttribute unique-cause of missing getAttribute', () => {
    const presence: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      hasAttribute: (name) => name === 'title',
    };
    assert.equal(matches(presence, '[title]'), true);
    assert.equal(matches(presence, '[title="Hello"]'), false);
    assert.equal(matches(presence, '[missing]'), false);
  });
});

describe('MC/DC still-hot unique-cause: legacy :after as pseudo-class', () => {
  test('pre-parsed :after/:before/:first-letter/:first-line unique-cause of each OR arm', () => {
    // selectors-4 § 3.7 #legacy-pseudo-element-aliases. String `:after` parses
    // as pseudo-element-selector (already covered); this hits the pseudo-class
    // OR that leftover never entered.
    const empty: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(empty, pc('after')), false);
    assert.equal(matches(empty, pc('before')), false);
    assert.equal(matches(empty, pc('first-letter')), false);
    assert.equal(matches(empty, pc('first-line')), false);
    assert.equal(matches(empty, ':empty'), true);
    assert.equal(matches(empty, pc('AFTER')), false);
  });
});

describe('MC/DC still-hot unique-cause: :matches and argument conjuncts', () => {
  test(':matches unique-cause of name === "matches" vs :is/:where held F', () => {
    // selectors-4 § 4.1 #forgiving-selector / #matches-pseudo (legacy alias).
    // Branch test is named :matches but never calls it.
    const document = html(`<div id="d"><span id="s"></span></div>`);
    const d = document.getElementById('d')!;
    assert.equal(matches(d, ':matches(div, span)'), true);
    assert.equal(matches(d, ':matches(span)'), false);
    assert.equal(matches(d, ':matches()'), false);
    assert.equal(matches(d, pc('matches', { argument: list(complex(compound(typeSel('div')))) })), true);
    assert.equal(matches(d, ':defined'), true);
  });

  test(':is/:not/:has unique-cause of missing argument, primitive typeof, and :not non-list', () => {
    // selectors-4 § 4.1 / § 4.2 / § 4.3. Leftover used empty :is(), array
    // (object T, 'type' in F), and non-list only on :is/:has — not :not, and
    // never a truthy non-object argument.
    const el: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(el, pc('is')), false);
    assert.equal(matches(el, pc('where')), false);
    assert.equal(matches(el, pc('matches')), false);
    assert.equal(matches(el, pc('is', { argument: asArg(1) })), false);
    assert.equal(matches(el, pc('not', { argument: asArg(1) })), true);
    assert.equal(matches(el, pc('has', { argument: asArg('span') })), false);

    const notList = { type: 'complex-selector', items: [], tokens: [] };
    assert.equal(matches(el, pc('not', { argument: asArg(notList) })), true);
    assert.equal(matches(el, pc('is', { argument: list(complex(compound(typeSel('div')))) })), true);
    assert.equal(matches(el, pc('not', { argument: list(complex(compound(typeSel('div')))) })), false);
  });

  test(':not unique-cause of invalid-selector skip then a matching complex', () => {
    // selectors-4 § 4.2 #negation. String :not(:unknown) is a parse error /
    // unknown pseudo, not invalid-selector continue.
    const document = html(`<div id="d"></div><span id="s"></span>`);
    const d = document.getElementById('d')!;
    const s = document.getElementById('s')!;
    const notMixed = pc('not', {
      argument: list(invalid(), complex(compound(typeSel('span')))),
    });
    assert.equal(matches(d, notMixed), true);
    assert.equal(matches(s, notMixed), false);
    assert.equal(matches(d, pc('not', { argument: list(invalid()) })), true);
    assert.equal(matches(d, pc('is', {
      argument: list(invalid(), complex(compound(typeSel('div')))),
    })), true);
  });
});

describe('MC/DC still-hot unique-cause: nth-child of S and nth-of-type !anb', () => {
  test('nth-child of S unique-cause of missing, primitive, and non-list argument', () => {
    // selectors-4 § 8.5 #the-nth-child-pseudo. Leftover held nth and passed an
    // argument array ('type' in F); never missing/primitive/non-list with nth.
    const document = html(`<ul><li id="a" class="x"></li><li id="b"></li></ul>`);
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const nth = [intToken(1)];
    assert.equal(matches(a, pc('nth-child', { nth })), true);
    assert.equal(matches(a, pc('nth-child', { nth, argument: asArg(1) })), true);
    assert.equal(matches(a, pc('nth-child', {
      nth,
      argument: asArg({ type: 'complex-selector', items: [], tokens: [] }),
    })), true);
    assert.equal(matches(a, ':nth-child(1 of .x)'), true);
    assert.equal(matches(b, ':nth-child(1 of .x)'), false);
  });

  test('nth-of-type / nth-last-of-type unique-cause of !anb', () => {
    // selectors-4 § 8.6 #the-nth-of-type-pseudo. Leftover missing-nth was only
    // :nth-child.
    const document = html(`<ul><li id="a"></li><li id="b"></li></ul>`);
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    assert.equal(matches(a, pc('nth-of-type')), false);
    assert.equal(matches(b, pc('nth-last-of-type')), false);
    assert.equal(matches(a, ':nth-of-type(1)'), true);
    assert.equal(matches(b, ':nth-last-of-type(1)'), true);
  });
});

describe('MC/DC still-hot unique-cause: :checked type without getAttribute', () => {
  test(':checked unique-cause of missing getAttribute so type is empty', () => {
    // html#selector-checked. Leftover checkbox used getAttribute('type').
    const noGet: DOMElement & { checked: boolean } = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      checked: true,
      hasAttribute: (name) => name === 'checked',
    };
    assert.equal(matches(noGet, ':checked'), false);

    const withType: DOMElement & { checked: boolean } = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      checked: true,
      getAttribute: (name) => (name === 'type' ? 'checkbox' : null),
      hasAttribute: () => false,
    };
    assert.equal(matches(withType, ':checked'), true);
  });
});

describe('MC/DC still-hot unique-cause: :has-slotted argument and :has ||', () => {
  test(':has-slotted unique-cause of primitive argument and non-list type', () => {
    // css-scoping-1 #selectordef-has-slotted. Leftover used a real selector-list.
    const span: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const slot: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      assignedNodes: () => [span],
    };
    assert.equal(matches(slot, pc('has-slotted', { argument: asArg(1) })), true);
    assert.equal(matches(slot, pc('has-slotted', {
      argument: asArg({ type: 'complex-selector', items: [], tokens: [] }),
    })), true);
    assert.equal(matches(slot, pc('has-slotted', {
      argument: list(complex(compound(typeSel('span')))),
    })), true);
    assert.equal(matches(slot, pc('has-slotted', {
      argument: list(complex(compound(typeSel('div')))),
    })), false);
  });

  test(':has() unique-cause of leading || vs space combinator', () => {
    // selectors-4 § 4.3 #relational / § 3.5 #column-combinator. Leftover leading
    // space sampled comb === ' ' T only; || is the F unique-cause after >/+/~.
    const document = html(`<div id="d"><span id="s"></span></div>`);
    const d = document.getElementById('d')!;
    const leadingCol = pc('has', {
      argument: list(complex(comb('||'), compound(typeSel('span')))),
    });
    const leadingSpace = pc('has', {
      argument: list(complex(comb(' '), compound(typeSel('span')))),
    });
    assert.equal(matches(d, leadingCol), false);
    assert.equal(matches(d, leadingSpace), true);
  });
});

describe('MC/DC still-hot unique-cause: firstLegendChild children missing', () => {
  test('fieldset[disabled] unique-cause of missing children vs legend.contains missing', () => {
    // html#concept-fe-disabled / #concept-fieldset-disabled. Sibling gating
    // reads parentElement.children, so leftover had to set fieldset.children
    // to the input (children T, find legend F). Hold the input under a wrapper
    // so fieldset.children can stay missing.
    const noKids: DOMElement = {
      nodeType: 1,
      localName: 'fieldset',
      tagName: 'FIELDSET',
      hasAttribute: (name) => name === 'disabled',
    };
    const wrap: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      parentElement: noKids,
    };
    const inNoKids: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      parentElement: wrap,
      hasAttribute: () => false,
    };
    wrap.children = [inNoKids];
    assert.equal(matches(inNoKids, ':disabled'), true);

    const legend: DOMElement = { nodeType: 1, localName: 'legend', tagName: 'LEGEND' };
    const withLegend: DOMElement = {
      nodeType: 1,
      localName: 'fieldset',
      tagName: 'FIELDSET',
      hasAttribute: (name) => name === 'disabled',
      children: [legend],
    };
    const inLegend: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      parentElement: legend,
      hasAttribute: () => false,
    };
    legend.parentElement = withLegend;
    legend.children = [inLegend];
    // legend.contains missing → isInsideFirstLegend F (unique-cause vs live DOM)
    assert.equal(matches(inLegend, ':disabled'), true);
    legend.contains = (n: unknown) => n === inLegend;
    assert.equal(matches(inLegend, ':disabled'), false);
  });
});

describe('MC/DC still-hot unique-cause: nearestAncestorSelectIsDisabled while', () => {
  test('option/optgroup unique-cause of missing parent vs non-select ancestor', () => {
    // html#concept-option-disabled / #selector-disabled. Leftover option lived
    // under <select> so while(ancestor) never sampled F; disabled option
    // short-circuits before nearestAncestor.
    const orphanOpt: DOMElement = {
      nodeType: 1,
      localName: 'option',
      tagName: 'OPTION',
      hasAttribute: () => false,
    };
    const orphanOg: DOMElement = {
      nodeType: 1,
      localName: 'optgroup',
      tagName: 'OPTGROUP',
      hasAttribute: () => false,
    };
    assert.equal(matches(orphanOpt, ':disabled'), false);
    assert.equal(matches(orphanOg, ':disabled'), false);

    const div: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    const optInDiv: DOMElement = {
      nodeType: 1,
      localName: 'option',
      tagName: 'OPTION',
      parentElement: div,
      hasAttribute: () => false,
    };
    const ogInDiv: DOMElement = {
      nodeType: 1,
      localName: 'optgroup',
      tagName: 'OPTGROUP',
      parentElement: div,
      hasAttribute: () => false,
    };
    div.children = [optInDiv, ogInDiv];
    assert.equal(matches(optInDiv, ':disabled'), false);
    assert.equal(matches(ogInDiv, ':disabled'), false);

    const document = html(`<select id="sel" disabled><option id="opt">z</option></select>`);
    assert.equal(matches(document.getElementById('opt')!, ':disabled'), true);
  });
});

describe('MC/DC still-hot unique-cause: getPseudoArgumentString missing vs non-array', () => {
  test(':dir/:lang unique-cause of missing argument vs SelectorList vs token array', () => {
    // selectors-4 § 9.1 #the-dir-pseudo / § 9.2 #the-lang-pseudo. Leftover
    // :lang(en) always had a token array; :heading non-array uses getHeadingLevels.
    const bare: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(bare, pc('dir')), false);
    assert.equal(matches(bare, pc('dir', { argument: list() })), false);
    assert.equal(matches(bare, ':dir(ltr)'), true);

    const en: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name) => (name === 'lang' ? 'en' : null),
    };
    assert.equal(matches(en, pc('lang')), false);
    assert.equal(matches(en, pc('lang', { argument: list() })), false);
    assert.equal(matches(en, ':lang(en)'), true);
    assert.equal(matches(bare, pc('lang')), true);
  });
});
