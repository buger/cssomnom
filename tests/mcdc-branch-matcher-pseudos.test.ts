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
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { matches, isElement, querySelectorAll } from '../src/matcher.ts';
import type { DOMElement } from '../src/matcher.ts';
import type { ComplexSelector, SelectorList } from '../src/types.ts';

function html(source: string) {
  const { document } = parseHTML(source);
  return document;
}

describe('MC/DC branch: remaining structural and nth-* pseudos', () => {
  test(':only-child, :empty text vs comment, and nth a=0 / a>0 / a<0', () => {
    const document = html(`
      <div id="p"><span id="only"></span></div>
      <ul id="list"><li id="a"></li><li id="b"></li><li id="c"></li></ul>
      <div id="txt">hello</div>
      <div id="cmt"><!--x--></div>
      <div id="blank"></div>
    `);
    const only = document.getElementById('only')!;
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const c = document.getElementById('c')!;
    assert.equal(matches(only, ':only-child'), true);
    assert.equal(matches(a, ':only-child'), false);
    assert.equal(matches(document.getElementById('txt')!, ':empty'), false);
    assert.equal(matches(document.getElementById('cmt')!, ':empty'), true);
    assert.equal(matches(document.getElementById('blank')!, ':empty'), true);

    assert.equal(matches(a, ':nth-child(odd)'), true);
    assert.equal(matches(b, ':nth-child(even)'), true);
    assert.equal(matches(a, ':nth-child(even)'), false);
    assert.equal(matches(a, ':nth-child(0n+1)'), true);
    assert.equal(matches(b, ':nth-child(0n+1)'), false);
    assert.equal(matches(c, ':nth-child(-n+3)'), true);
    assert.equal(matches(b, ':nth-child(2n)'), true);
    assert.equal(matches(c, ':nth-last-child(odd)'), true);
    assert.equal(matches(b, ':nth-last-child(even)'), true);
    assert.equal(matches(b, ':nth-of-type(even)'), true);
    assert.equal(matches(a, ':nth-of-type(even)'), false);
    assert.equal(matches(c, ':nth-last-of-type(odd)'), true);
  });

  test(':nth-child(An+B of S) requires the element to match S', () => {
    const document = html(`<ul><li id="a" class="x"></li><li id="b"></li><li id="c" class="x"></li></ul>`);
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const c = document.getElementById('c')!;
    assert.equal(matches(a, ':nth-child(odd of .x)'), true);
    assert.equal(matches(c, ':nth-child(even of .x)'), true);
    assert.equal(matches(b, ':nth-child(odd of .x)'), false);
    assert.equal(matches(b, ':nth-last-child(1 of li)'), false);
    assert.equal(matches(c, ':nth-last-child(1 of li)'), true);
    assert.equal(matches(a, ':nth-child(abc)'), false);
  });

  test('nth-* falls back to parentNode.childNodes when parentElement is missing', () => {
    const a = { nodeType: 1, localName: 'span', tagName: 'SPAN', parentNode: null as DOMElement | null };
    const b = { nodeType: 1, localName: 'span', tagName: 'SPAN', parentNode: null as DOMElement | null };
    const parent: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      childNodes: [a, b],
    };
    a.parentNode = parent;
    b.parentNode = parent;
    assert.equal(matches(a, ':first-child'), true);
    assert.equal(matches(b, ':last-child'), true);
    assert.equal(matches(a, ':nth-child(1)'), true);
    assert.equal(matches(b, ':nth-child(2)'), true);
  });
});

describe('MC/DC branch: remaining forgiving, unknown, and document pseudos', () => {
  test(':is/:where skip invalid selectors; unknown and pseudo-elements do not match', () => {
    const document = html(`<div id="d"><span id="s"></span></div>`);
    const d = document.getElementById('d')!;
    assert.equal(matches(d, ':is(:unknown, div)'), true);
    assert.equal(matches(d, ':where(:unknown, span)'), false);
    assert.equal(matches(d, ':is()'), false);
    assert.equal(matches(d, ':has()'), false);
    assert.equal(matches(d, ':hover'), false);
    assert.equal(matches(d, ':active'), false);
    assert.equal(matches(d, ':visited'), false);
    assert.equal(matches(d, ':fullscreen'), false);
    assert.equal(matches(d, '::before'), false);
    assert.equal(matches(d, ':not(:unknown)'), false);
  });

  test(':root / :scope fallbacks without a live documentElement', () => {
    const orphan: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(orphan, ':root'), true);
    assert.equal(matches(orphan, ':scope'), true);
    const child: DOMElement = {
      nodeType: 1,
      localName: 'span',
      tagName: 'SPAN',
      parentElement: orphan,
    };
    assert.equal(matches(child, ':root'), false);
    assert.equal(matches(child, ':scope'), false);

    const document = html(`<div id="x"></div>`);
    assert.equal(matches(document.documentElement, ':scope'), true);
    assert.equal(matches(document.getElementById('x')!, ':target'), false);
  });

  test(':heading without argument matches h1-h6; :lang quoted and multi-arg; default :dir(ltr)', () => {
    const document = html(`
      <h1 id="h1">t</h1>
      <h3 id="h3">t</h3>
      <p id="p">x</p>
      <div lang="en-US"><span id="en">x</span></div>
      <p id="fr" lang="fr"></p>
      <div id="nodir"></div>
    `);
    assert.equal(matches(document.getElementById('h1')!, ':heading'), true);
    assert.equal(matches(document.getElementById('p')!, ':heading'), false);
    assert.equal(matches(document.getElementById('h3')!, ':heading(1, 3)'), true);
    assert.equal(matches(document.getElementById('h1')!, ':heading(3)'), false);
    assert.equal(matches(document.getElementById('en')!, ':lang(en, fr)'), true);
    assert.equal(matches(document.getElementById('fr')!, ':lang("fr")'), true);
    assert.equal(matches(document.getElementById('en')!, ':lang("en-US")'), true);
    assert.equal(matches(document.getElementById('nodir')!, ':dir(ltr)'), true);
    assert.equal(matches(document.getElementById('nodir')!, ':dir(rtl)'), false);
  });
});

describe('MC/DC branch: remaining input, link, focus, and disabled pseudos', () => {
  test(':checked radio vs non-checkable; :enabled/:read-only/:read-write on non-controls', () => {
    const document = html(`
      <input id="radio" type="radio" checked>
      <input id="text" type="text" checked>
      <input id="cb" type="checkbox">
      <div id="plain"></div>
      <button id="btn">b</button>
    `);
    assert.equal(matches(document.getElementById('radio')!, ':checked'), true);
    assert.equal(matches(document.getElementById('text')!, ':checked'), false);
    assert.equal(matches(document.getElementById('cb')!, ':checked'), false);
    assert.equal(matches(document.getElementById('plain')!, ':checked'), false);
    assert.equal(matches(document.getElementById('plain')!, ':enabled'), false);
    assert.equal(matches(document.getElementById('btn')!, ':enabled'), true);
    assert.equal(matches(document.getElementById('plain')!, ':read-only'), true);
    assert.equal(matches(document.getElementById('text')!, ':read-only'), false);
    assert.equal(matches(document.getElementById('text')!, ':read-write'), true);
    assert.equal(matches(document.getElementById('plain')!, ':read-write'), false);
  });

  test(':link / :any-link on area and link; missing href does not match', () => {
    const document = html(`
      <a id="bare">n</a>
      <area id="area" href="/">
      <link id="lnk" href="/css">
    `);
    assert.equal(matches(document.getElementById('bare')!, ':link'), false);
    assert.equal(matches(document.getElementById('area')!, ':link'), true);
    assert.equal(matches(document.getElementById('lnk')!, ':any-link'), true);
  });

  test(':focus / :focus-visible / :focus-within miss when not active or contains() is false', () => {
    const document = html(`<div id="host"><input id="f"></div>`);
    const host = document.getElementById('host')!;
    const f = document.getElementById('f')!;
    assert.equal(matches(f, ':focus'), false);
    assert.equal(matches(f, ':focus-visible'), false);
    assert.equal(matches(host, ':focus-within'), false);

    const denied = {
      activeElement: f,
      contains: () => false,
    };
    (f as { ownerDocument?: unknown }).ownerDocument = denied;
    (host as { ownerDocument?: unknown }).ownerDocument = denied;
    assert.equal(matches(f, ':focus'), false);
    assert.equal(matches(f, ':focus-visible'), false);
    assert.equal(matches(host, ':focus-within'), false);
  });

  test(':focus-within walks parentElement when contains() is absent', () => {
    const child: DOMElement = { nodeType: 1, localName: 'input', tagName: 'INPUT' };
    const host: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      children: [child],
    };
    child.parentElement = host;
    const doc = { activeElement: child };
    (child as { ownerDocument?: unknown }).ownerDocument = doc;
    (host as { ownerDocument?: unknown }).ownerDocument = doc;
    assert.equal(matches(host, ':focus-within'), true);
    assert.equal(matches(child, ':focus-within'), true);
  });

  test(':disabled optgroup/option/select and form-associated custom elements', () => {
    const document = html(`
      <fieldset id="fs" disabled>
        <select id="sel" disabled><option id="opt2">y</option></select>
      </fieldset>
      <select id="sel2"><optgroup id="og2" disabled><option id="opt3">z</option></optgroup></select>
    `);
    assert.equal(matches(document.getElementById('sel')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('opt2')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('og2')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('opt3')!, ':disabled'), true);

    const custom: DOMElement & { formAssociated: boolean } = {
      nodeType: 1,
      localName: 'my-input',
      tagName: 'MY-INPUT',
      formAssociated: true,
      hasAttribute: (name: string) => name === 'disabled',
    };
    assert.equal(matches(custom, ':disabled'), true);
    assert.equal(matches(custom, ':enabled'), false);

    class FormAssoc {
      static formAssociated = true;
      nodeType = 1;
      localName = 'x-field';
      tagName = 'X-FIELD';
      hasAttribute(name: string) {
        return name === 'disabled';
      }
    }
    assert.equal(matches(new FormAssoc(), ':disabled'), true);
  });
});

describe('MC/DC branch: :has-slotted remainder, parseSelector objects, isElement', () => {
  test(':has-slotted is true for any slot without a selector-list argument', () => {
    const emptySlot: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      assignedNodes: () => [],
      children: [],
    };
    assert.equal(matches(emptySlot, ':has-slotted'), true);
    const div: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(div, ':has-slotted'), false);
  });

  test(':has-slotted(selector-list) matches assigned elements via a pre-parsed argument', () => {
    const slotted: DOMElement = { nodeType: 1, localName: 'b', tagName: 'B' };
    const spanSlotted: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const slot: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      assignedNodes: () => [slotted],
      children: [slotted],
    };
    const spanList: SelectorList = {
      type: 'selector-list',
      selectors: [{
        type: 'complex-selector',
        items: [{ type: 'compound-selector', selectors: [{ type: 'type-selector', name: 'span' }] }],
        tokens: [],
      }],
    };
    const bList: SelectorList = {
      type: 'selector-list',
      selectors: [{
        type: 'complex-selector',
        items: [{ type: 'compound-selector', selectors: [{ type: 'type-selector', name: 'b' }] }],
        tokens: [],
      }],
    };
    const hasSpan: SelectorList = {
      type: 'selector-list',
      selectors: [{
        type: 'complex-selector',
        items: [{
          type: 'compound-selector',
          selectors: [{ type: 'pseudo-class-selector', name: 'has-slotted', argument: spanList }],
        }],
        tokens: [],
      }],
    };
    const hasB: SelectorList = {
      type: 'selector-list',
      selectors: [{
        type: 'complex-selector',
        items: [{
          type: 'compound-selector',
          selectors: [{ type: 'pseudo-class-selector', name: 'has-slotted', argument: bList }],
        }],
        tokens: [],
      }],
    };
    assert.equal(matches(slot, hasSpan), false);
    assert.equal(matches(slot, hasB), true);
    slot.assignedNodes = () => [spanSlotted];
    assert.equal(matches(slot, hasSpan), true);
  });

  test('matches accepts a ComplexSelector object; isElement uses tagName/localName/matches', () => {
    const document = html(`<div id="d"></div>`);
    const d = document.getElementById('d')!;
    const complex: ComplexSelector = {
      type: 'complex-selector',
      items: [{ type: 'compound-selector', selectors: [{ type: 'type-selector', name: 'div' }] }],
      tokens: [],
    };
    assert.equal(matches(d, complex), true);
    const list: SelectorList = { type: 'selector-list', selectors: [complex] };
    assert.equal(matches(d, list), true);
    assert.equal(querySelectorAll(d, list).length, 0);

    assert.equal(isElement({ tagName: 'DIV' }), true);
    assert.equal(isElement({ localName: 'div' }), true);
    assert.equal(isElement({ matches: () => true }), true);
    assert.equal(isElement({ nodeType: 3 }), false);

    const mockThrow: DOMElement & { matches: (s: string) => boolean } = {
      matches: () => {
        throw new Error('boom');
      },
    };
    assert.equal(matches(mockThrow, 'div'), false);
  });
});
