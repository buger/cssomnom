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
import { matches, querySelector, querySelectorAll, toAsciiLowerCase, isElement } from '../src/matcher.ts';
import type { DOMElement } from '../src/matcher.ts';

function html(source: string) {
  const { document } = parseHTML(source);
  return document;
}

describe('MC/DC branch: matcher combinators and :has()', () => {
  test(':has() child, adjacent, sibling, and descendant combinators', () => {
    const document = html(`
      <div id="root">
        <p id="p1"><span id="s1"></span></p>
        <p id="p2"></p>
        <p id="p3"><b id="b1"></b></p>
      </div>
    `);
    const p1 = document.getElementById('p1')!;
    const p2 = document.getElementById('p2')!;
    const p3 = document.getElementById('p3')!;
    const root = document.getElementById('root')!;

    assert.equal(matches(p1, ':has(> span)'), true);
    assert.equal(matches(p2, ':has(> span)'), false);
    assert.equal(matches(p1, ':has(+ p)'), true);
    assert.equal(matches(p3, ':has(+ p)'), false);
    assert.equal(matches(p1, ':has(~ p)'), true);
    assert.equal(matches(p3, ':has(~ p)'), false);
    assert.equal(matches(root, ':has( b)'), true);
    assert.equal(matches(root, ':has(span)'), true);
    assert.equal(matches(p2, ':has(span)'), false);
  });

  test('descendant, child, adjacent, subsequent sibling combinators', () => {
    const document = html(`<div id="d"><span id="s"></span><b id="b"></b><i id="i"></i></div>`);
    const d = document.getElementById('d')!;
    const s = document.getElementById('s')!;
    const b = document.getElementById('b')!;
    const i = document.getElementById('i')!;
    assert.equal(matches(s, 'div > span'), true);
    assert.equal(matches(s, 'div span'), true);
    assert.equal(matches(b, 'span + b'), true);
    assert.equal(matches(i, 'span ~ i'), true);
    assert.equal(matches(s, 'b + span'), false);
    assert.equal(matches(d, 'span || div'), false);
  });

  test('querySelector / querySelectorAll walk children and document-like roots', () => {
    const document = html(`<div id="d"><span id="sx" class="x"></span><span id="sy" class="y"></span></div>`);
    const d = document.getElementById('d')!;
    assert.equal(querySelector(d, 'span.y')?.id, 'sy');
    assert.equal(querySelectorAll(d, 'span').length, 2);
    assert.equal(querySelector(d, 'p'), null);
    assert.deepEqual(querySelectorAll(null, 'div'), []);
    assert.deepEqual(querySelectorAll(1, 'div'), []);

    const fakeDoc = { children: [d], childNodes: [d] };
    assert.equal(querySelectorAll(fakeDoc, 'span.x').length, 1);
    const nodesOnly = { childNodes: [d] };
    assert.equal(querySelectorAll(nodesOnly, 'span.y').length, 1);
  });
});

describe('MC/DC branch: namespaces, attributes, class without classList', () => {
  test('type and universal namespace matching including svg and null namespace', () => {
    const htmlEl: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      namespaceURI: 'http://www.w3.org/1999/xhtml',
      prefix: null,
    };
    const svgEl: DOMElement = {
      nodeType: 1,
      localName: 'rect',
      tagName: 'rect',
      namespaceURI: 'http://www.w3.org/2000/svg',
      prefix: 'svg',
    };
    assert.equal(matches(htmlEl, 'div'), true);
    assert.equal(matches(htmlEl, '*|div'), true);
    assert.equal(matches(htmlEl, '|div'), true);
    assert.equal(matches(svgEl, '|rect'), false);
    assert.equal(matches(svgEl, 'svg|rect'), true);
    assert.equal(matches(htmlEl, 'svg|div'), false);
    assert.equal(matches(htmlEl, '*|*'), true);
    assert.equal(matches(svgEl, '|*'), false);
    assert.equal(matches(htmlEl, 'other|div'), false);
  });

  test('attribute operators reject empty expected values and honor [|attr]', () => {
    const document = html(`<input id="i" type="text" title="Hello World" data-empty="">`);
    const input = document.getElementById('i')!;
    assert.equal(matches(input, '[type=""]'), false);
    assert.equal(matches(input, '[title~=""]'), false);
    assert.equal(matches(input, '[title^=""]'), false);
    assert.equal(matches(input, '[title$=""]'), false);
    assert.equal(matches(input, '[title*=""]'), false);
    assert.equal(matches(input, '[title~="Hello"]'), true);
    assert.equal(matches(input, '[data-empty=""]'), true);
    assert.equal(matches(input, '[|type]'), true);
    assert.equal(matches(input, '[|missing]'), false);
  });

  test('class matching falls back to className when classList is missing', () => {
    const el: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      className: 'foo bar',
      getAttribute: (name: string) => (name === 'class' ? 'foo bar' : null),
    };
    assert.equal(matches(el, '.foo'), true);
    assert.equal(matches(el, '.bar'), true);
    assert.equal(matches(el, '.missing'), false);
  });

  test('id matching falls back to getAttribute', () => {
    const el: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'id' ? 'main' : null),
    };
    assert.equal(matches(el, '#main'), true);
    assert.equal(matches(el, '#other'), false);
  });
});

describe('MC/DC branch: pseudo-classes', () => {
  test('legacy pseudo-elements and :is/:where/:not/:matches', () => {
    const document = html(`<div id="d"><span></span></div>`);
    const d = document.getElementById('d')!;
    assert.equal(matches(d, ':after'), false);
    assert.equal(matches(d, ':before'), false);
    assert.equal(matches(d, ':first-letter'), false);
    assert.equal(matches(d, ':first-line'), false);
    assert.equal(matches(d, ':is(div, span)'), true);
    assert.equal(matches(d, ':where(span, div)'), true);
    assert.equal(matches(d, ':not(span)'), true);
    assert.equal(matches(d, ':not(div)'), false);
    assert.equal(matches(d, ':is(:unknown)'), false);
  });

  test(':root, :scope, :empty, structural nth-* including last-of-type', () => {
    const document = html(`<html><body><div id="a"></div><p id="b"></p><p id="c"><!--c--></p></body></html>`);
    const htmlEl = document.documentElement;
    const a = document.getElementById('a')!;
    const b = document.getElementById('b')!;
    const c = document.getElementById('c')!;
    assert.equal(matches(htmlEl, ':root'), true);
    assert.equal(matches(a, ':root'), false);
    assert.equal(matches(a, ':scope', a), true);
    assert.equal(matches(a, ':scope', b), false);
    assert.equal(matches(a, ':empty'), true);
    assert.equal(matches(c, ':empty'), true);
    assert.equal(matches(a, ':first-child'), true);
    assert.equal(matches(c, ':last-child'), true);
    assert.equal(matches(b, ':first-of-type'), true);
    assert.equal(matches(c, ':last-of-type'), true);
    assert.equal(matches(a, ':only-of-type'), true);
    assert.equal(matches(b, ':nth-of-type(1)'), true);
    assert.equal(matches(c, ':nth-last-of-type(1)'), true);
    assert.equal(matches(b, ':nth-child(2)'), true);
    assert.equal(matches(c, ':nth-last-child(1)'), true);
    assert.equal(matches(a, ':nth-child(odd of div, p)'), true);
  });

  test(':dir auto rtl/ltr, tel input, and parent inheritance', () => {
    const document = html(`
      <div id="rtl" dir="rtl"><span id="child"></span></div>
      <div id="ltr" dir="ltr"></div>
      <div id="auto-rtl" dir="auto">שלום</div>
      <div id="auto-ltr" dir="auto">Hello</div>
      <input id="tel" type="tel">
    `);
    assert.equal(matches(document.getElementById('rtl')!, ':dir(rtl)'), true);
    assert.equal(matches(document.getElementById('ltr')!, ':dir(ltr)'), true);
    assert.equal(matches(document.getElementById('child')!, ':dir(rtl)'), true);
    assert.equal(matches(document.getElementById('auto-rtl')!, ':dir(rtl)'), true);
    assert.equal(matches(document.getElementById('auto-ltr')!, ':dir(ltr)'), true);
    assert.equal(matches(document.getElementById('tel')!, ':dir(ltr)'), true);
  });

  test(':lang walks ancestors; :heading and :heading(n)', () => {
    const document = html(`<div lang="en-US"><p id="p">x</p><h2 id="h">t</h2></div>`);
    const p = document.getElementById('p')!;
    const h = document.getElementById('h')!;
    assert.equal(matches(p, ':lang(en)'), true);
    assert.equal(matches(p, ':lang(fr)'), false);
    assert.equal(matches(h, ':heading'), true);
    assert.equal(matches(h, ':heading(2)'), true);
    assert.equal(matches(h, ':heading(1)'), false);
    assert.equal(matches(p, ':heading'), false);
  });

  test(':disabled fieldset/legend, :enabled, :checked, :read-only, :read-write, :link, :defined', () => {
    const document = html(`
      <fieldset id="fs" disabled>
        <legend><input id="in-legend"></legend>
        <input id="in-fs">
      </fieldset>
      <input id="cb" type="checkbox" checked>
      <option id="opt" selected>x</option>
      <textarea id="ro" readonly></textarea>
      <a id="a" href="/">l</a>
      <div id="ce" contenteditable="true"></div>
    `);
    assert.equal(matches(document.getElementById('in-fs')!, ':disabled'), true);
    assert.equal(matches(document.getElementById('in-legend')!, ':disabled'), false);
    assert.equal(matches(document.getElementById('cb')!, ':checked'), true);
    assert.equal(matches(document.getElementById('opt')!, ':checked'), true);
    assert.equal(matches(document.getElementById('in-fs')!, ':enabled'), false);
    assert.equal(matches(document.getElementById('ro')!, ':read-only'), true);
    assert.equal(matches(document.getElementById('cb')!, ':read-write'), true);
    assert.equal(matches(document.getElementById('ce')!, ':read-write'), true);
    assert.equal(matches(document.getElementById('a')!, ':link'), true);
    assert.equal(matches(document.getElementById('a')!, ':any-link'), true);
    assert.equal(matches(document.getElementById('ce')!, ':defined'), true);
  });

  test(':target, :focus, :focus-visible, :focus-within', () => {
    const document = html(`<div id="host"><input id="f"></div>`);
    const host = document.getElementById('host')!;
    const f = document.getElementById('f')!;
    (document as { location?: { hash?: string } }).location = { hash: '#host' };
    assert.equal(matches(host, ':target'), true);
    (document as { activeElement?: unknown; contains?: (n: unknown) => boolean }).activeElement = f;
    (document as { contains?: (n: unknown) => boolean }).contains = () => true;
    assert.equal(matches(f, ':focus'), true);
    assert.equal(matches(f, ':focus-visible'), true);
    assert.equal(matches(host, ':focus-within'), true);
    assert.equal(matches(f, ':focus-within'), true);
    assert.equal(matches(host, ':focus'), false);
  });

  test(':has-slotted on slot elements with assignedNodes', () => {
    const slotted: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN' };
    const slot: DOMElement = {
      nodeType: 1,
      localName: 'slot',
      tagName: 'SLOT',
      assignedNodes: () => [slotted],
      children: [slotted],
    };
    assert.equal(matches(slot, ':has-slotted'), true);
    assert.equal(matches(slot, ':has-slotted(span)'), true);
    const div: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assert.equal(matches(div, ':has-slotted'), false);
  });

  test('matches rejects non-elements and uses mock matches() without DOM fields', () => {
    assert.equal(matches(null, 'div'), false);
    assert.equal(matches('div', 'div'), false);
    const mock: DOMElement & { matches: (s: string) => boolean } = {
      matches: (s: string) => s === '.ok',
    };
    assert.equal(matches(mock, '.ok'), true);
    assert.equal(matches(mock, '.no'), false);
    assert.equal(isElement(null), false);
    assert.equal(isElement({ nodeType: 1 }), true);
    assert.equal(toAsciiLowerCase('AbCΩ'), 'abcΩ');
  });

  test('nesting-selector & matches only the scope element', () => {
    const document = html(`<div id="a"><span id="s"></span></div>`);
    const a = document.getElementById('a')!;
    const s = document.getElementById('s')!;
    assert.equal(matches(a, '&', a), true);
    assert.equal(matches(s, '&', a), false);
    assert.equal(matches(a, '&'), false);
  });
});
