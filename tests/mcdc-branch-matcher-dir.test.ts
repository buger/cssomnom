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
// Verifies: SYS-REQ-260821-PJ76, SW-REQ-260821-6D9T, INT-REQ-260821-HJVC
// Leftover unique-cause cases for src/matcher.ts getElementDirection.
// selectors-4 § 9.1 #the-dir-pseudo. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { matches } from '../src/matcher.ts';
import type { DOMElement } from '../src/matcher.ts';

const HEBREW_ALEF = String.fromCodePoint(0x05d0);

function documentOf(source = '<!doctype html><html><body></body></html>') {
  return parseHTML(source).document;
}

function add(
  document: { createElement(tag: string): Element },
  parent: { appendChild(n: Element): unknown },
  tag: string,
  attrs: Record<string, string> = {},
  text = '',
) {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) el.setAttribute(name, value);
  if (text !== '') el.textContent = text;
  parent.appendChild(el);
  return el;
}

function assertDir(el: unknown, dir: 'ltr' | 'rtl', label: string) {
  assert.equal(matches(el, `:dir(${dir})`), true, `${label} matches :dir(${dir})`);
  assert.equal(matches(el, `:dir(${dir === 'ltr' ? 'rtl' : 'ltr'})`), false, `${label} rejects opposite :dir()`);
}

function dirRules() {
  return parseStyleSheet(`
    :dir(ltr) { z-index: 1; order: 1; }
    :dir(rtl) { z-index: 2; order: 2; }
  `);
}

function cascadedDir(el: unknown): string {
  return getCascadedStyle(el, dirRules()).getPropertyValue('z-index');
}

describe('MC/DC leftover: getElementDirection html dir, inherit, :dir()', () => {
  // selectors-4 § 9.1 #the-dir-pseudo / html #the-dir-attribute
  test('dir=ltr/rtl, html dir, inherit via matches() and getCascadedStyle', () => {
    const document = documentOf();
    document.documentElement.setAttribute('dir', 'rtl');
    const host = add(document, document.body, 'div', { id: 'host' });
    const plain = add(document, host, 'span', { id: 'plain' });
    const ltr = add(document, host, 'span', { id: 'ltr', dir: 'ltr' });
    const rtl = add(document, host, 'span', { id: 'rtl', dir: 'rtl' });
    const inherit = add(document, host, 'span', { id: 'inherit', dir: 'inherit' });
    const invalid = add(document, host, 'span', { id: 'invalid', dir: 'foo' });
    const empty = add(document, host, 'span', { id: 'empty', dir: '' });
    const asciiRtl = add(document, host, 'span', { id: 'ascii-rtl', dir: 'RTL' });
    const asciiLtr = add(document, host, 'span', { id: 'ascii-ltr', dir: 'LTR' });
    const nested = add(document, inherit, 'em', { id: 'nested' });
    const cssLtr = add(document, rtl, 'i', { id: 'css-ltr' });

    assertDir(document.documentElement, 'rtl', 'html[dir=rtl]');
    assertDir(document.body, 'rtl', 'body inherits html dir=rtl');
    assertDir(plain, 'rtl', 'plain inherits html dir=rtl');
    assertDir(ltr, 'ltr', 'dir=ltr override');
    assertDir(rtl, 'rtl', 'dir=rtl');
    assertDir(inherit, 'rtl', 'dir=inherit is not a valid HTML dir keyword; walks parent');
    assertDir(invalid, 'rtl', 'invalid dir walks parent');
    assertDir(empty, 'rtl', 'empty dir walks parent');
    assertDir(asciiRtl, 'rtl', 'dir=RTL ASCII-folded');
    assertDir(asciiLtr, 'ltr', 'dir=LTR ASCII-folded');
    assertDir(nested, 'rtl', 'grandchild inherits through dir=inherit');
    assertDir(cssLtr, 'rtl', ':dir uses HTML dir, not CSS direction');
    assert.equal(matches(ltr, ':dir(LTR)'), true);
    assert.equal(matches(rtl, ':dir(RTL)'), true);

    assert.equal(cascadedDir(document.documentElement), '2');
    assert.equal(cascadedDir(plain), '2');
    assert.equal(cascadedDir(ltr), '1');
    assert.equal(cascadedDir(rtl), '2');
    assert.equal(cascadedDir(inherit), '2');
    assert.equal(cascadedDir(invalid), '2');
    assert.equal(cascadedDir(empty), '2');
    assert.equal(cascadedDir(nested), '2');

    const cssDirSheet = parseStyleSheet(`
      #css-ltr { direction: ltr; }
      :dir(rtl) { z-index: 2; }
      :dir(ltr) { z-index: 1; }
    `);
    const cssStyle = getCascadedStyle(cssLtr, cssDirSheet);
    assert.equal(cssStyle.getPropertyValue('direction'), 'ltr');
    assert.equal(cssStyle.getPropertyValue('z-index'), '2');

    document.documentElement.setAttribute('dir', 'ltr');
    assertDir(document.documentElement, 'ltr', 'html[dir=ltr]');
    assertDir(plain, 'ltr', 'plain inherits html dir=ltr');
    assertDir(inherit, 'ltr', 'dir=inherit follows html dir=ltr');
    assertDir(rtl, 'rtl', 'explicit dir=rtl still wins');
    assert.equal(cascadedDir(plain), '1');
    assert.equal(cascadedDir(inherit), '1');
    assert.equal(cascadedDir(rtl), '2');

    const inheritChild = add(document, ltr, 'b', { dir: 'inherit' });
    assertDir(inheritChild, 'ltr', 'dir=inherit under dir=ltr parent');
    assert.equal(cascadedDir(inheritChild), '1');
  });

  test('orphan without dir defaults to ltr; missing getAttribute is empty dir', () => {
    const orphan: DOMElement = { nodeType: 1, localName: 'div', tagName: 'DIV' };
    assertDir(orphan, 'ltr', 'orphan default');
    assert.equal(cascadedDir(orphan), '1');

    const noGetter: DOMElement = { nodeType: 1, localName: 'span', tagName: 'SPAN', textContent: 'x' };
    assertDir(noGetter, 'ltr', 'no getAttribute');
  });
});

describe('MC/DC leftover: getElementDirection dir=auto unique-cause RTL ranges', () => {
  // First-strong scan: 0x0590..0x08FF | 0xFB1D..0xFDFF | 0xFE70..0xFEFF
  test('each RTL bound independently yields :dir(rtl) vs fall-through :dir(ltr)', () => {
    const document = documentOf();
    const rows: Array<{ code: number; dir: 'ltr' | 'rtl'; why: string }> = [
      { code: 0x0590, dir: 'rtl', why: '>=0x0590 T && <=0x08FF T' },
      { code: 0x058f, dir: 'ltr', why: '>=0x0590 F unique-cause' },
      { code: 0x08ff, dir: 'rtl', why: '<=0x08FF T' },
      { code: 0x0900, dir: 'ltr', why: '>=0x0590 T && <=0x08FF F unique-cause' },
      { code: 0xfb1d, dir: 'rtl', why: '>=0xFB1D T && <=0xFDFF T' },
      { code: 0xfb1c, dir: 'ltr', why: '>=0xFB1D F unique-cause' },
      { code: 0xfdff, dir: 'rtl', why: '<=0xFDFF T' },
      { code: 0xfe00, dir: 'ltr', why: '>=0xFB1D T && <=0xFDFF F unique-cause' },
      { code: 0xfe70, dir: 'rtl', why: '>=0xFE70 T && <=0xFEFF T' },
      { code: 0xfe6f, dir: 'ltr', why: '>=0xFE70 F unique-cause' },
      { code: 0xfeff, dir: 'rtl', why: '<=0xFEFF T' },
      { code: 0xff00, dir: 'ltr', why: '>=0xFE70 T && <=0xFEFF F unique-cause' },
    ];
    for (const row of rows) {
      const el = add(document, document.body, 'div', { dir: 'auto' }, String.fromCodePoint(row.code));
      assertDir(el, row.dir, `U+${row.code.toString(16)} ${row.why}`);
      assert.equal(cascadedDir(el), row.dir === 'rtl' ? '2' : '1', `cascade U+${row.code.toString(16)}`);
    }
  });

  test('auto skips weak characters then takes first strong RTL or LTR', () => {
    const document = documentOf();
    const weakRtl = add(document, document.body, 'div', { dir: 'auto' }, `123 \t${HEBREW_ALEF}`);
    const weakLtr = add(document, document.body, 'div', { dir: 'auto' }, '123 \tHello');
    const empty = add(document, document.body, 'div', { dir: 'auto' }, '');
    const punct = add(document, document.body, 'div', { dir: 'auto' }, '!!!');
    const autoAscii = add(document, document.body, 'div', { dir: 'AUTO' }, HEBREW_ALEF);
    empty.textContent = '';
    assertDir(weakRtl, 'rtl', 'weak then Hebrew');
    assertDir(weakLtr, 'ltr', 'weak then Latin');
    assertDir(empty, 'ltr', 'auto empty textContent defaults ltr');
    assertDir(punct, 'ltr', 'auto punctuation-only defaults ltr');
    assertDir(autoAscii, 'rtl', 'dir=AUTO ASCII-folded');
    assert.equal(cascadedDir(weakRtl), '2');
    assert.equal(cascadedDir(empty), '1');

    const missingText: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'dir' ? 'auto' : null),
    };
    assertDir(missingText, 'ltr', 'auto with missing textContent');
  });
});

describe('MC/DC leftover: getElementDirection dir=auto unique-cause LTR ranges', () => {
  // First-strong LTR: 0x0041..0x005A | 0x0061..0x007A | 0x00C0..0x02AF
  // Trailing Hebrew distinguishes early LTR return (ignores Hebrew) from fall-through (Hebrew wins).
  test('each LTR bound independently returns early or falls through to Hebrew', () => {
    const document = documentOf();
    const rows: Array<{ lead: number; dir: 'ltr' | 'rtl'; why: string }> = [
      { lead: 0x41, dir: 'ltr', why: 'A >=0x41 T && <=0x5A T' },
      { lead: 0x40, dir: 'rtl', why: '@ >=0x41 F unique-cause then Hebrew' },
      { lead: 0x5a, dir: 'ltr', why: 'Z <=0x5A T' },
      { lead: 0x5b, dir: 'rtl', why: '[ >=0x41 T && <=0x5A F unique-cause then Hebrew' },
      { lead: 0x61, dir: 'ltr', why: 'a >=0x61 T && <=0x7A T' },
      { lead: 0x60, dir: 'rtl', why: '` >=0x61 F unique-cause then Hebrew' },
      { lead: 0x7a, dir: 'ltr', why: 'z <=0x7A T' },
      { lead: 0x7b, dir: 'rtl', why: '{ >=0x61 T && <=0x7A F unique-cause then Hebrew' },
      { lead: 0xc0, dir: 'ltr', why: 'À >=0xC0 T && <=0x02AF T' },
      { lead: 0xbf, dir: 'rtl', why: '¿ >=0xC0 F unique-cause then Hebrew' },
      { lead: 0x02af, dir: 'ltr', why: 'ʯ <=0x02AF T' },
      { lead: 0x02b0, dir: 'rtl', why: 'ʰ >=0xC0 T && <=0x02AF F unique-cause then Hebrew' },
    ];
    for (const row of rows) {
      const text = String.fromCodePoint(row.lead) + HEBREW_ALEF;
      const el = add(document, document.body, 'div', { dir: 'auto' }, text);
      assertDir(el, row.dir, `U+${row.lead.toString(16)} ${row.why}`);
      assert.equal(cascadedDir(el), row.dir === 'rtl' ? '2' : '1', `cascade U+${row.lead.toString(16)}`);
    }
  });
});

describe('MC/DC leftover: getElementDirection input type=tel unique-cause', () => {
  test('input type=tel stays ltr under rtl parent; other inputs inherit', () => {
    const document = documentOf();
    document.documentElement.setAttribute('dir', 'rtl');
    const tel = add(document, document.body, 'input', { id: 'tel', type: 'tel' });
    const telAscii = add(document, document.body, 'input', { id: 'tel-ascii', type: 'TEL' });
    const text = add(document, document.body, 'input', { id: 'text', type: 'text' });
    const search = add(document, document.body, 'input', { id: 'search', type: 'search' });
    const bare = add(document, document.body, 'input', { id: 'bare' });
    const button = add(document, document.body, 'button', { id: 'btn', type: 'tel' });

    assertDir(tel, 'ltr', 'input type=tel');
    assertDir(telAscii, 'ltr', 'input type=TEL');
    assertDir(text, 'rtl', 'input type=text unique-cause tel=F');
    assertDir(search, 'rtl', 'input type=search inherits');
    assertDir(bare, 'rtl', 'input without type inherits');
    assertDir(button, 'rtl', 'button type=tel is not input; inherits');

    assert.equal(cascadedDir(tel), '1');
    assert.equal(cascadedDir(text), '2');
    assert.equal(cascadedDir(bare), '2');
    assert.equal(cascadedDir(button), '2');

    const tagNameOnly: DOMElement = {
      nodeType: 1,
      tagName: 'INPUT',
      getAttribute: (name: string) => (name === 'type' ? 'tel' : null),
    };
    assertDir(tagNameOnly, 'ltr', 'tagName INPUT without localName');

    const rtlParent: DOMElement = {
      nodeType: 1,
      localName: 'div',
      tagName: 'DIV',
      getAttribute: (name: string) => (name === 'dir' ? 'rtl' : null),
      children: [],
    };
    const noTypeGetter: DOMElement = {
      nodeType: 1,
      localName: 'input',
      tagName: 'INPUT',
      parentElement: rtlParent,
    };
    rtlParent.children = [noTypeGetter];
    assertDir(noTypeGetter, 'rtl', 'input missing getAttribute type inherits parent rtl');
  });
});
