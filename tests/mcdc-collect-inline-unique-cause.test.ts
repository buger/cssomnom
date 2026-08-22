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
// Leftover unique-cause for src/cascade/rule-filter.ts collectInlineDeclarations
// (1/6 D, 5/12 C, 5 incomplete). Hottest seam L625 typeof style === "object"
// / typeof cssText === "string". Drive only public getCascadedStyle from
// ../src/cascade.ts with linkedom parseHTML style= attributes and concrete
// duck style shapes (not successive-read getters). css-cascade-5 § 6.2
// #cascade-sort, css-style-attr-1, css-variables-1 § 4 #resolving-var-functions.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { Rule } from '../src/types.ts';

function host(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    classList: { contains: (c: string) => c === 't' },
    isConnected: true,
    ...extra,
  };
}

function pv(element: unknown, prop: string, rules: Rule[] = []): string {
  const style = getCascadedStyle(element, rules);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style.getPropertyValue(prop);
}

type StyleHost = {
  style: { cssText: string; setProperty(name: string, value: string, priority?: string): void };
};

function target(html: string, selector = '.t'): Element & StyleHost {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  return el as Element & StyleHost;
}

function attr(text: string): (n: string) => string | null {
  return (n: string) => (n === 'style' ? text : null);
}

describe('MC/DC leftover unique-cause: collectInlineDeclarations style source', { concurrency: false }, () => {
  // css-cascade-5 § 6.2 #cascade-sort, css-style-attr-1
  // linkedom always exposes style as an object with string cssText (L625 TTT).
  test('linkedom style= / empty / whitespace / live cssText unique-cause', () => {
    const el = target('<html><body><div class="t" style="z-index: 3; cursor: pointer"></div></body></html>');
    assert.equal(pv(el, 'z-index'), '3', 'style= attribute cssText object path');
    assert.equal(pv(el, 'cursor'), 'pointer');

    el.style.cssText = 'z-index: 8; order: 2';
    assert.equal(pv(el, 'z-index'), '8', 'live cssText mutation still collected');
    assert.equal(pv(el, 'order'), '2');
    el.style.setProperty('z-index', '9');
    assert.equal(pv(el, 'z-index'), '9', 'live setProperty cssText still collected');

    const empty = target('<html><body><div class="t" style=""></div></body></html>');
    assert.equal(pv(empty, 'z-index'), '', 'empty style= cssText is "" so L634 styleAttrText F');

    const none = target('<html><body><div class="t"></div></body></html>');
    assert.equal(pv(none, 'z-index'), '', 'missing style= still has object cssText ""');

    const ws = target('<html><body><div class="t" style="   \n\t"></div></body></html>');
    assert.equal(pv(ws, 'z-index'), '', 'linkedom whitespace style= collapses cssText to ""');

    // linkedom cssText drops empty custom, so L639 space fallback does not run
    // on the HTML path; color uses the var() fallback (unique-cause vs duck).
    const emptyCustom = target(
      '<html><body><div class="t" style="--x: ; color: var(--x, red)"></div></body></html>',
    );
    assert.equal(pv(emptyCustom, '--x'), '', 'linkedom cssText omits empty --x');
    assert.equal(pv(emptyCustom, 'color'), 'rgb(255, 0, 0)', 'var() fallback red when --x missing');

    const specified = target(
      '<html><body><div class="t" style="--x: orange; color: var(--x)"></div></body></html>',
    );
    assert.equal(pv(specified, '--x'), 'orange');
    assert.equal(pv(specified, 'color'), 'rgb(255, 165, 0)');
  });

  test('L625 object/cssText vs L627 string vs L629 getAttribute unique-cause', () => {
    // L625 TTT: object style with string cssText wins over a different attribute.
    assert.equal(
      pv(host({ style: { cssText: 'z-index: 3' }, getAttribute: attr('z-index: 99') }), 'z-index'),
      '3',
      'cssText string unique-cause ignores getAttribute',
    );

    // L625 A=F (no style) then L629 TT: getAttribute function.
    assert.equal(pv(host({ getAttribute: attr('z-index: 4') }), 'z-index'), '4');

    // L625 A=T B=F then L627 T: style is a non-empty string.
    assert.equal(
      pv(host({ style: 'z-index: 5', getAttribute: attr('z-index: 99') }), 'z-index'),
      '5',
      'string style unique-cause ignores getAttribute',
    );

    // L627 T with A=F: empty string style (falsy) still typeof "string".
    assert.equal(
      pv(host({ style: '', getAttribute: attr('z-index: 99') }), 'z-index'),
      '',
      'empty string style is L627 T then L634 F, attribute ignored',
    );

    // L625 C=F: object style, cssText not a string → fall through to getAttribute.
    assert.equal(pv(host({ style: { cssText: 1 }, getAttribute: attr('z-index: 6') }), 'z-index'), '6');
    assert.equal(pv(host({ style: { cssText: null }, getAttribute: attr('z-index: 7') }), 'z-index'), '7');
    assert.equal(pv(host({ style: {}, getAttribute: attr('z-index: 8') }), 'z-index'), '8', 'missing cssText');

    // L625 A=T B=F (truthy non-object) then L627 F then L629 TT.
    assert.equal(pv(host({ style: true, getAttribute: attr('z-index: 10') }), 'z-index'), '10');
    assert.equal(pv(host({ style: 1, getAttribute: attr('z-index: 11') }), 'z-index'), '11');

    // L625 A=F (null/0) then L627 F then L629 TT.
    assert.equal(pv(host({ style: null, getAttribute: attr('z-index: 12') }), 'z-index'), '12');
    assert.equal(pv(host({ style: 0, getAttribute: attr('z-index: 13') }), 'z-index'), '13');

    // L629 T,F: getAttribute present but not a function.
    assert.equal(pv(host({ getAttribute: 'nope' }), 'z-index'), '');
    assert.equal(pv(host({ getAttribute: 1 }), 'z-index'), '');
    assert.equal(pv(host({}), 'z-index'), '', 'no style and no getAttribute');

    // L629 TT with null / empty attribute.
    assert.equal(pv(host({ getAttribute: () => null }), 'z-index'), '');
    assert.equal(pv(host({ getAttribute: attr('') }), 'z-index'), '');
  });

  test('L634 styleAttrText && trim unique-cause', () => {
    assert.equal(
      pv(host({ style: { cssText: 'z-index: 21' } }), 'z-index'),
      '21',
      'T,T object cssText',
    );
    assert.equal(
      pv(host({ style: { cssText: '' }, getAttribute: attr('z-index: 99') }), 'z-index'),
      '',
      'empty cssText is L634 F and still wins over getAttribute',
    );
    assert.equal(
      pv(host({ style: { cssText: '   \n\t' }, getAttribute: attr('z-index: 99') }), 'z-index'),
      '',
      'whitespace cssText is L634 T,F (trim F)',
    );
    assert.equal(
      pv(host({ style: '   \n\t', getAttribute: attr('z-index: 99') }), 'z-index'),
      '',
      'whitespace string style is L634 T,F',
    );
    assert.equal(
      pv(host({ getAttribute: attr('   \n\t') }), 'z-index'),
      '',
      'whitespace getAttribute is L634 T,F',
    );
    assert.equal(
      pv(host({ style: { cssText: '/* only comment */' } }), 'z-index'),
      '',
      'comment-only trim T but no declarations',
    );
    assert.equal(
      pv(host({ style: { cssText: '  z-index: 22  ' } }), 'z-index'),
      '22',
      'surrounding whitespace still trim T',
    );
  });
});

describe('MC/DC leftover unique-cause: collectInlineDeclarations raw / custom / important', { concurrency: false }, () => {
  // css-variables-1 § 4 #resolving-var-functions
  // Parser sets Declaration.raw only on --* (getOriginalText). Standard
  // properties keep raw undefined so L638 d.raw F skips includes('var(').
  test('L638 d.raw && !includes(var() unique-cause via custom vs standard', () => {
    // d.raw F: standard property serialize path.
    assert.equal(pv(host({ style: { cssText: 'z-index: 3; cursor: pointer' } }), 'z-index'), '3');
    assert.equal(pv(host({ style: { cssText: 'z-index: 3; cursor: pointer' } }), 'cursor'), 'pointer');

    // d.raw T, includes F: --x: orange uses raw (no "var(").
    const orange = host({ style: { cssText: '--x: orange; color: var(--x)' } });
    assert.equal(pv(orange, '--x'), 'orange');
    assert.equal(pv(orange, 'color'), 'rgb(255, 165, 0)');

    // d.raw T, includes T: --x: var(--y) serialize path still substitutes.
    const viaVar = host({ style: { cssText: '--x: var(--y); --y: lime; color: var(--x)' } });
    assert.equal(pv(viaVar, '--x'), 'lime');
    assert.equal(pv(viaVar, 'color'), 'rgb(0, 255, 0)');

    // Unique-cause of includes('var(') F vs T on a custom: uppercase VAR(--y)
    // is raw without the literal "var(" substring, so it is not substituted.
    const upper = host({ style: { cssText: '--x: VAR(--y); --y: lime; color: var(--x)' } });
    assert.equal(pv(upper, '--x'), 'VAR(--y)', 'raw path keeps VAR(--y)');
    assert.equal(pv(upper, 'color'), 'var(--y)', 'VAR() is not substituted');

    // linkedom HTML also hits raw T / includes T and F.
    const htmlOrange = target(
      '<html><body><div class="t" style="--x: orange; color: var(--x)"></div></body></html>',
    );
    assert.equal(pv(htmlOrange, '--x'), 'orange');
    const htmlVar = target(
      '<html><body><div class="t" style="--x: var(--y); --y: lime; color: var(--x)"></div></body></html>',
    );
    assert.equal(pv(htmlVar, '--x'), 'lime');
    assert.equal(pv(htmlVar, 'color'), 'rgb(0, 255, 0)');
  });

  test('L639 isCustom && !valStr space fallback unique-cause', () => {
    // T,T: empty custom serializes to "" then collectInlineDeclarations stores " ".
    const empty = host({ style: { cssText: '--x: ; color: var(--x, red)' } });
    assert.equal(pv(empty, '--x'), ' ', 'empty custom space fallback');
    assert.equal(
      pv(empty, 'color'),
      'rgb(0, 0, 0)',
      'specified space is not IACVT so var() fallback is skipped',
    );

    const colonOnly = host({ style: { cssText: '--x:; color: var(--x, red)' } });
    assert.equal(pv(colonOnly, '--x'), ' ');

    const commentOnly = host({ style: { cssText: '--x: /*c*/; color: var(--x, red)' } });
    assert.equal(pv(commentOnly, '--x'), ' ', 'comment-only custom still empty after serialize');

    const viaAttr = host({ getAttribute: attr('--x: ; color: var(--x, red)') });
    assert.equal(pv(viaAttr, '--x'), ' ', 'getAttribute empty custom also space-fills');

    const viaString = host({ style: '--x: ; color: var(--x, red)' });
    assert.equal(pv(viaString, '--x'), ' ');

    // T,F: non-empty custom.
    const orange = host({ style: { cssText: '--x: orange' } });
    assert.equal(pv(orange, '--x'), 'orange');

    // F: standard property isCustom F.
    const standard = host({ style: { cssText: 'z-index: 4' } });
    assert.equal(pv(standard, 'z-index'), '4');
    assert.equal(pv(standard, '--x'), '');
  });

  test('important / last-wins / shorthand / inline beats stylesheet unique-cause', () => {
    const sheet = parseStyleSheet('.t { z-index: 99; color: blue !important; margin-top: 50px; }');

    const inline = host({ style: { cssText: 'z-index: 3' } });
    assert.equal(pv(inline, 'z-index', sheet), '3', 'inline origin beats unlayered stylesheet');

    const imp = host({ style: { cssText: 'color: lime !important' } });
    assert.equal(pv(imp, 'color', sheet), 'rgb(0, 255, 0)', 'inline important beats stylesheet important');

    const last = host({ style: { cssText: 'z-index: 1; z-index: 2' } });
    assert.equal(pv(last, 'z-index'), '2', 'later inline declaration wins');

    const sh = host({ style: { cssText: 'margin: 10px' } });
    assert.equal(pv(sh, 'margin-top'), '10px', 'parseStyleAttribute expands shorthand');
    assert.equal(pv(sh, 'margin-left'), '10px');

    const htmlImp = target(
      '<html><body><div class="t" style="z-index: 4 !important"></div></body></html>',
    );
    assert.equal(pv(htmlImp, 'z-index', sheet), '4');
  });
});
