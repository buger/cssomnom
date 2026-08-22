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
// Verifies: SW-REQ-260821-FWNH, INT-REQ-260821-HJVC
// Leftover unique-cause for src/cascade/rule-filter.ts getSheetTitle
// (1/5 D, 2/6 C, 4 incomplete; last recapture top-8 #4). Hottest remaining
// seam L101 typeof ownerNode.getAttribute === "function". Drive only public
// getCascadedStyle (omit rules so collection walks linkedom <style title>
// / title attribute, or document.styleSheets ducks whose ownerNode is that
// style element). Prefer real HTML. css-cascade-5 § 2 #filtering, cssom-1
// § 6.1 #the-cssstylesheet-interface / #dom-stylesheet-title / § 7.3
// #the-document-or-shadow-root-interface, html #attr-style-title /
// #alternate-style-sheets. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleSheet } from '../src/CSSOM.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

const SETS_HTML = `<html><head>
  <style title="setA">.t { color: red; z-index: 1; }</style>
  <style title="setB">.t { z-index: 2; }</style>
  <style>.t { order: 3; }</style>
  <style title="">.t { opacity: 0.4; }</style>
  <style title="setA" rel="alternate stylesheet">.t { column-count: 5; }</style>
  <style title="setB" rel="alternate stylesheet">.t { flex-grow: 6; }</style>
</head><body><div class="t"></div></body></html>`;

type StyleEl = Element & { title: string; textContent: string | null };

function cascaded(element: unknown): CSSStyleDeclaration {
  const style = getCascadedStyle(element);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function pv(element: unknown, prop: string): string {
  return cascaded(element).getPropertyValue(prop);
}

function parseDoc(html: string): {
  el: Element;
  styles: StyleEl[];
  comment: Comment;
} {
  const { document } = parseHTML(html);
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  return {
    el,
    styles: [...document.querySelectorAll('style')] as StyleEl[],
    comment: document.createComment('sheet-owner'),
  };
}

function host(styleSheets: unknown[], extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    classList: { contains: (c: string) => c === 't' },
    isConnected: true,
    getRootNode: () => ({ styleSheets }),
    ...extra,
  };
}

function ownerDuck(styleEl: StyleEl, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ownerNode: styleEl,
    textContent: styleEl.textContent,
    ...extra,
  };
}

function cssomOwnedBy(styleEl: StyleEl): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(styleEl.textContent ?? '');
  (sheet as unknown as { _ownerNode: unknown })._ownerNode = styleEl;
  return sheet;
}

describe('MC/DC leftover unique-cause: getSheetTitle via getCascadedStyle', { concurrency: false }, () => {
  // css-cascade-5 § 2 #filtering, cssom-1 #dom-stylesheet-title, html #attr-style-title
  // linkedom has no document.styleSheets, so collection uses querySelectorAll('style').
  // HTMLElement.title reflects the title attribute (D1); style elements have no ownerNode
  // (L101 ownerNode F short-circuits typeof === "function").
  test('real HTML <style title> unique-cause of s.title vs persistent vs empty vs alternate', () => {
    const { el, styles } = parseDoc(SETS_HTML);
    assert.equal(styles[0].title, 'setA');
    assert.equal(styles[1].title, 'setB');
    assert.equal(styles[2].title, '');
    assert.equal(styles[3].title, '');
    assert.equal(styles[3].getAttribute('title'), '');
    assert.equal(styles[2].getAttribute('title'), null);

    const preferred = cascaded(el);
    assert.equal(preferred.getPropertyValue('color'), 'rgb(255, 0, 0)', 'D1 T first titled non-alternate is preferred');
    assert.equal(preferred.getPropertyValue('z-index'), '1', 'setB title mismatch disabled');
    assert.equal(preferred.getPropertyValue('order'), '3', 'untitled persistent still applies');
    assert.equal(preferred.getPropertyValue('opacity'), '0.4', 'title="" is falsy persistent (D1 F / D5 F empty string)');
    assert.equal(preferred.getPropertyValue('column-count'), '5', 'alternate whose title matches preferred');
    assert.equal(preferred.getPropertyValue('flex-grow'), '', 'alternate setB disabled');

    const untitledFirst = parseDoc(`<html><head>
      <style>.t { color: lime; }</style>
      <style title="setB">.t { z-index: 8; }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(untitledFirst.el, 'color'), 'rgb(0, 255, 0)', 'D1 F untitled does not become preferred');
    assert.equal(pv(untitledFirst.el, 'z-index'), '8', 'later titled sheet becomes preferred');

    const emptyFirst = parseDoc(`<html><head>
      <style title="">.t { color: aqua; }</style>
      <style title="setB">.t { z-index: 9; }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(emptyFirst.el, 'color'), 'rgb(0, 255, 255)', 'title="" D1 F unique-cause vs title="setB"');
    assert.equal(pv(emptyFirst.el, 'z-index'), '9');

    const onlyPersistent = parseDoc(`<html><head>
      <style>.t { color: navy; }</style>
    </head><body><div class="t"></div></body></html>`);
    assert.equal(pv(onlyPersistent.el, 'color'), 'rgb(0, 0, 128)');

    const viaEmptyStyleSheets = host([], {
      getRootNode: () => ({
        styleSheets: [],
        querySelectorAll: () => styles,
      }),
    });
    assert.equal(pv(viaEmptyStyleSheets, 'color'), 'rgb(255, 0, 0)', 'empty styleSheets still titles via querySelectorAll(style)');
    assert.equal(pv(viaEmptyStyleSheets, 'z-index'), '1');
    assert.equal(pv(viaEmptyStyleSheets, 'order'), '3');
  });

  // L105 typeof s.getAttribute === "function" / L107 if (t). HTMLElement.title
  // always reflects the title attribute, so D5 T (getAttribute truthy while
  // s.title F) is unpairable on an unmodified style element.
  test('L105/L107 getAttribute function and t unique-cause via title-shadowed style', () => {
    const shadowed = parseDoc(SETS_HTML);
    Object.defineProperty(shadowed.styles[0], 'title', { configurable: true, value: '' });
    assert.equal(shadowed.styles[0].title, '');
    assert.equal(shadowed.styles[0].getAttribute('title'), 'setA');
    const viaAttr = cascaded(shadowed.el);
    assert.equal(viaAttr.getPropertyValue('color'), 'rgb(255, 0, 0)', 'D1 F then D4 T D5 T preferred from getAttribute');
    assert.equal(viaAttr.getPropertyValue('z-index'), '1', 'setB still disabled once preferred is setA');
    assert.equal(viaAttr.getPropertyValue('order'), '3');

    const noGetAttribute = parseDoc(SETS_HTML);
    Object.defineProperty(noGetAttribute.styles[0], 'title', { configurable: true, value: '' });
    Object.defineProperty(noGetAttribute.styles[0], 'getAttribute', { configurable: true, value: undefined });
    const lostTitle = cascaded(noGetAttribute.el);
    assert.equal(lostTitle.getPropertyValue('color'), 'rgb(255, 0, 0)', 'D4 F first sheet is persistent (color still applies)');
    assert.equal(lostTitle.getPropertyValue('z-index'), '2', 'D4 F unique-cause: later setB becomes preferred');
    assert.equal(lostTitle.getPropertyValue('order'), '3');

    const { styles } = parseDoc(SETS_HTML);
    const duckAttr = host([
      { title: '', getAttribute: (n: string) => styles[0].getAttribute(n), textContent: styles[0].textContent },
      { title: '', getAttribute: (n: string) => styles[1].getAttribute(n), textContent: styles[1].textContent },
      { textContent: styles[2].textContent },
    ]);
    assert.equal(pv(duckAttr, 'color'), 'rgb(255, 0, 0)', 'duck title F + delegated getAttribute T is D5 T');
    assert.equal(pv(duckAttr, 'z-index'), '1');
    assert.equal(pv(duckAttr, 'order'), '3');

    const duckNoAttr = host([
      { title: '', textContent: styles[0].textContent },
      { title: '', getAttribute: (n: string) => styles[1].getAttribute(n), textContent: styles[1].textContent },
    ]);
    assert.equal(pv(duckNoAttr, 'color'), 'rgb(255, 0, 0)', 'D4 F duck has no getAttribute (persistent)');
    assert.equal(pv(duckNoAttr, 'z-index'), '2', 'D4 F then D5 T on later sheet prefers setB');
  });

  // L101 ownerNode && typeof getAttribute === "function" — next recapture seam.
  // Style elements never have ownerNode; unique-cause T rows collect CSSStyleSheet /
  // ducks whose ownerNode is the linkedom <style> or a comment (no getAttribute).
  test('L101 ownerNode && getAttribute === function unique-cause via style vs comment ownerNode', () => {
    const { styles, comment } = parseDoc(SETS_HTML);
    const [setA, setB, untitled] = styles;

    const titledOwner = host([
      ownerDuck(setA),
      ownerDuck(setB),
      ownerDuck(untitled),
    ]);
    assert.equal(pv(titledOwner, 'color'), 'rgb(255, 0, 0)', 'D2 T,T D3 T: ownerNode is titled style');
    assert.equal(pv(titledOwner, 'z-index'), '1');
    assert.equal(pv(titledOwner, 'order'), '3');

    const commentOwner = host([
      { ownerNode: comment, textContent: setA.textContent },
      ownerDuck(setB),
      ownerDuck(untitled),
    ]);
    assert.equal(pv(commentOwner, 'color'), 'rgb(255, 0, 0)', 'D2 T,F comment has no getAttribute; first sheet persistent');
    assert.equal(pv(commentOwner, 'z-index'), '2', 'typeof === "function" F unique-cause lets setB become preferred');
    assert.equal(pv(commentOwner, 'order'), '3');

    const nullOwner = host([
      { ownerNode: null, textContent: setA.textContent },
      ownerDuck(setB),
    ]);
    assert.equal(pv(nullOwner, 'color'), 'rgb(255, 0, 0)', 'D2 ownerNode F short-circuits typeof === "function"');
    assert.equal(pv(nullOwner, 'z-index'), '2');

    const commentThenAttr = host([
      { ownerNode: comment, getAttribute: (n: string) => setA.getAttribute(n), textContent: setA.textContent },
      ownerDuck(setB),
    ]);
    assert.equal(pv(commentThenAttr, 'color'), 'rgb(255, 0, 0)', 'D2 T,F then D4 T D5 T still prefers setA from getAttribute');
    assert.equal(pv(commentThenAttr, 'z-index'), '1');

    const nonFn = host([
      { ownerNode: { getAttribute: 'title' }, textContent: setA.textContent },
      ownerDuck(setB),
    ]);
    assert.equal(pv(nonFn, 'color'), 'rgb(255, 0, 0)', 'D2 T,F getAttribute is a string');
    assert.equal(pv(nonFn, 'z-index'), '2');
  });

  // L103 if (t) after ownerNode.getAttribute. CSSStyleSheet.title already
  // reads ownerNode, so D3 T is unpairable on CSSStyleSheet (D1 returns first);
  // unique-cause T is the duck without a title property.
  test('L103 ownerNode getAttribute t unique-cause vs CSSStyleSheet title getter', () => {
    const { styles } = parseDoc(SETS_HTML);
    const [setA, setB, untitled, emptyTitle] = styles;

    const d3True = host([ownerDuck(setA), ownerDuck(setB)]);
    assert.equal(pv(d3True, 'color'), 'rgb(255, 0, 0)', 'D3 T title attr on ownerNode');
    assert.equal(pv(d3True, 'z-index'), '1');

    const d3Null = host([ownerDuck(untitled), ownerDuck(setA)]);
    assert.equal(pv(d3Null, 'color'), 'rgb(255, 0, 0)', 'D3 F getAttribute title is null (untitled style)');
    assert.equal(pv(d3Null, 'z-index'), '1', 'later setA becomes preferred');
    assert.equal(pv(d3Null, 'order'), '3');

    const d3Empty = host([ownerDuck(emptyTitle), ownerDuck(setA)]);
    assert.equal(pv(d3Empty, 'opacity'), '0.4', 'D3 F empty title attr on ownerNode is persistent');
    assert.equal(pv(d3Empty, 'color'), 'rgb(255, 0, 0)');
    assert.equal(pv(d3Empty, 'z-index'), '1');

    const titledA = cssomOwnedBy(setA);
    const titledB = cssomOwnedBy(setB);
    assert.equal(titledA.title, 'setA', 'CSSStyleSheet.title getter is D1 T, never D3');
    const cssomTitled = host([titledA, titledB]);
    assert.equal(pv(cssomTitled, 'color'), 'rgb(255, 0, 0)');
    assert.equal(pv(cssomTitled, 'z-index'), '1');

    const emptyOwned = cssomOwnedBy(emptyTitle);
    const setAOwned = cssomOwnedBy(setA);
    assert.equal(emptyOwned.title, null, 'empty owner title → CSSStyleSheet.title null (D1 F)');
    const cssomEmpty = host([emptyOwned, setAOwned]);
    assert.equal(pv(cssomEmpty, 'opacity'), '0.4', 'D2 T,T D3 F via CSSStyleSheet then D4 F (no getAttribute)');
    assert.equal(pv(cssomEmpty, 'color'), 'rgb(255, 0, 0)');
    assert.equal(pv(cssomEmpty, 'z-index'), '1');

    const cssomBare = new CSSStyleSheet();
    cssomBare.replaceSync(setA.textContent ?? '');
    const bareThenB = host([cssomBare, cssomOwnedBy(setB)]);
    assert.equal(cssomBare.title, null);
    assert.equal(pv(bareThenB, 'color'), 'rgb(255, 0, 0)', 'D2 F D4 F CSSStyleSheet without ownerNode is persistent');
    assert.equal(pv(bareThenB, 'z-index'), '2');
  });
});
