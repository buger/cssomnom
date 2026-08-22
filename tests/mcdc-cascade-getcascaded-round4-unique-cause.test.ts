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
// Round-4 leftover unique-cause for src/cascade/index.ts getCascadedStyle
// (26/30 D, 36/41 C, 4 incomplete) after
// tests/mcdc-cascade-getcascaded-round3-unique-cause.test.ts. Hottest
// remaining seam L266 lastDecl.raw && !lastDecl.raw.includes('var(').
// Drive only public getCascadedStyle from ../src/cascade.ts with linkedom
// parseHTML. Collectors never copy MatchedDeclaration.raw, so L266 raw T
// / includes T/F, L268 typeof F, L264 length F, and L174 parsedPseudo F
// stay mute (no //mcdc:ignore). Prefer real CSS/HTML.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSRule, CSSStyleSheet } from '../src/CSSOM.ts';
import type { Rule } from '../src/types.ts';

function cascade(
  html: string,
  css: string,
  selector: string,
  pseudo?: string | null,
): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, parseStyleSheet(css), pseudo);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function box(css: string, pseudo?: string | null): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="t"></div></body></html>',
    css,
    '.t',
    pseudo,
  );
}

function childBox(css: string): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="p"><div class="t"></div></div></body></html>',
    css,
    '.t',
  );
}

type Pv = string | ReturnType<typeof tokenize> | unknown[];

function cssomRule(selectorText: string, decls: Record<string, Pv>, extra: Record<string, unknown> = {}): Rule {
  const names = Object.keys(decls);
  const style = {
    length: names.length,
    item: (i: number) => names[i] ?? '',
    getPropertyValue: (n: string) => decls[n],
    getPropertyPriority: () => '',
    ...extra,
  };
  return {
    type: CSSRule.STYLE_RULE,
    selectorText,
    style,
  } as unknown as Rule;
}

function sheetOf(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

const PSEUDO_SHEET = `
  .p { color: lime; }
  .t { width: 100px; color: green; }
  .t::before { width: 50px; content: "x"; }
  .t::after { width: 40px; }
  .t::picker(select) { width: 14px; }
`;

describe('MC/DC round4 unique-cause: getCascadedStyle lastDecl.raw F string path', { concurrency: false }, () => {
  // css-variables-1 § 3 #using / § 4 #resolving-var-functions
  // css-cascade-5 § 7 #cascaded-values
  // Collectors stringify MatchedDeclaration.value and never copy .raw, so
  // L266 lastDecl.raw is always F (includes skipped). Unique-cause the
  // stored string: includes('var(') analog on that string is case-sensitive.
  test('mixed-case VAR( vs var( vs var space vs quoted vs attr/env/url', () => {
    const substituted = box('.t { --y: lime; --x: var(--y); color: var(--x); }');
    assert.equal(substituted.getPropertyValue('--x'), 'lime');
    assert.equal(substituted.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // VAR( / Var( / vaR( do not match includes('var('); specified text kept.
    const upper = box('.t { --y: lime; --x: VAR(--y); color: var(--x); }');
    assert.equal(upper.getPropertyValue('--x'), 'VAR(--y)');
    assert.equal(upper.getPropertyValue('color'), 'var(--y)');

    const mixed = box('.t { --y: lime; --x: Var(--y); color: var(--x); }');
    assert.equal(mixed.getPropertyValue('--x'), 'Var(--y)');
    assert.equal(mixed.getPropertyValue('color'), 'var(--y)');

    const tail = box('.t { --y: lime; --x: vaR(--y); color: var(--x); }');
    assert.equal(tail.getPropertyValue('--x'), 'vaR(--y)');
    assert.equal(tail.getPropertyValue('color'), 'var(--y)');

    // Function token requires '(' immediately; `var (` is ident + block.
    const spaced = box('.t { --y: lime; --x: var (--y); color: var(--x, red); }');
    assert.equal(spaced.getPropertyValue('--x'), 'var (--y)');
    assert.equal(spaced.getPropertyValue('color'), 'var (--y)');

    // Quoted "var(--y)" contains the substring but is not a var() function.
    const quoted = box('.t { --y: lime; --x: "var(--y)"; color: var(--x); }');
    assert.equal(quoted.getPropertyValue('--x'), '"var(--y)"');
    assert.equal(quoted.getPropertyValue('color'), '"var(--y)"');

    // env()/attr() are not var(); specified text is stored (round3 env-only).
    const attrOnly = box('.t { --x: attr(data-x); color: var(--x, red); }');
    assert.equal(attrOnly.getPropertyValue('--x'), 'attr(data-x)');
    assert.equal(attrOnly.getPropertyValue('color'), 'attr(data-x)');

    const envOnly = box('.t { --x: env(safe-area-inset-top); color: var(--x, red); }');
    assert.equal(envOnly.getPropertyValue('--x'), 'env(safe-area-inset-top)');
    assert.equal(envOnly.getPropertyValue('color'), '0px');

    const urlOnly = box('.t { --x: url(foo.png); background-image: var(--x); }');
    assert.equal(urlOnly.getPropertyValue('--x'), 'url(foo.png)');
    assert.equal(urlOnly.getPropertyValue('background-image'), 'url("foo.png")');

    // var() whitespace/comment inside the function still substitutes.
    const innerWs = box('.t { --y: lime; --x: var( --y ); color: var(--x); }');
    assert.equal(innerWs.getPropertyValue('--x'), 'lime');
    const innerComment = box('.t { --y: lime; --x: var(/*c*/--y); color: var(--x); }');
    assert.equal(innerComment.getPropertyValue('--x'), 'lime');
    assert.equal(innerComment.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });

  test('last-wins VAR vs var; constructed CSSStyleSheet; inline style=', () => {
    const lastUpper = box('.t { --y: lime; --x: var(--y); --x: VAR(--y); color: var(--x); }');
    assert.equal(lastUpper.getPropertyValue('--x'), 'VAR(--y)');
    assert.equal(lastUpper.getPropertyValue('color'), 'var(--y)');

    const lastLower = box('.t { --y: lime; --x: VAR(--y); --x: var(--y); color: var(--x); }');
    assert.equal(lastLower.getPropertyValue('--x'), 'lime');
    assert.equal(lastLower.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    const constructedUpper = getCascadedStyle(
      el,
      sheetOf('.t { --y: lime; --x: VAR(--y); color: var(--x); }').cssRules,
    );
    assert.equal(constructedUpper.getPropertyValue('--x'), 'VAR(--y)');
    assert.equal(constructedUpper.getPropertyValue('color'), 'var(--y)');

    const constructedLower = getCascadedStyle(
      el,
      sheetOf('.t { --y: orange; --x: VAR(--y); --x: var(--y); color: var(--x); }').cssRules,
    );
    assert.equal(constructedLower.getPropertyValue('--x'), 'orange');
    assert.equal(constructedLower.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const inlineUpper = cascade(
      '<html><body><div class="t" style="--y: lime; --x: VAR(--y); color: var(--x)"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inlineUpper.getPropertyValue('--x'), 'VAR(--y)');
    assert.equal(inlineUpper.getPropertyValue('color'), 'var(--y)');

    const inlineLower = cascade(
      '<html><body><div class="t" style="--y: lime; --x: var(--y); color: var(--x)"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inlineLower.getPropertyValue('--x'), 'lime');
    assert.equal(inlineLower.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });

  test('AST / duck CSSOM still stringify (raw T unpairable); length NaN declarations path', () => {
    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    // length NaN is not >= 0, so collection uses style.declarations and
    // serialize(d.value), still dropping d.raw (L266 raw T mute).
    const rawOrange = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          length: Number.NaN,
          declarations: [
            { name: '--x', value: tokenize('lime'), important: false, raw: 'orange' },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(rawOrange.getPropertyValue('--x'), 'lime');
    assert.equal(rawOrange.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const rawVarValueLime = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          length: -1,
          declarations: [
            { name: '--x', value: tokenize('lime'), important: false, raw: 'var(--y)' },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(rawVarValueLime.getPropertyValue('--x'), 'lime');
    assert.equal(rawVarValueLime.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const duckUpper = getCascadedStyle(el, [
      cssomRule('.t', { '--y': 'lime', '--x': 'VAR(--y)', color: 'var(--x)' }),
    ]);
    assert.equal(duckUpper.getPropertyValue('--x'), 'VAR(--y)');
    assert.equal(duckUpper.getPropertyValue('color'), 'var(--y)');

    const duckQuoted = getCascadedStyle(el, [
      cssomRule('.t', { '--y': 'lime', '--x': '"var(--y)"', color: 'var(--x)' }),
    ]);
    assert.equal(duckQuoted.getPropertyValue('--x'), '"var(--y)"');
    assert.equal(duckQuoted.getPropertyValue('color'), '"var(--y)"');
  });
});

describe('MC/DC round4 unique-cause: getCascadedStyle L268 typeof / L264 startsWith leftover', { concurrency: false }, () => {
  // css-variables-1 § 3 #using, css-cascade-5 § 7 #cascaded-values
  test('typeof string F mute: empty array / boxed String serialize empty; length 0 vs NaN', () => {
    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    // Collectors stringify before L268, so typeof === 'string' stays T.
    // Empty array / boxed String serialize to '' → custom space fallback.
    const emptyArr = getCascadedStyle(el, [
      cssomRule('.t', { '--x': [], color: 'var(--x, red)' }),
    ]);
    assert.equal(emptyArr.getPropertyValue('--x'), ' ');
    assert.equal(emptyArr.getPropertyValue('color'), 'rgb(0, 0, 0)');

    // Boxed primitive: typeof !== 'string' so collection serializes it empty.
    const boxed = getCascadedStyle(el, [
      {
        type: CSSRule.STYLE_RULE,
        selectorText: '.t',
        style: {
          length: 2,
          item: (i: number) => ['--x', 'color'][i] ?? '',
          getPropertyValue: (n: string) => (n === '--x' ? Object('lime') : 'var(--x, red)'),
          getPropertyPriority: () => '',
        },
      } as unknown as Rule,
    ]);
    assert.equal(boxed.getPropertyValue('--x'), ' ');
    assert.equal(boxed.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const tokens = getCascadedStyle(el, [
      cssomRule('.t', { '--x': tokenize('navy'), color: 'var(--x)' }),
    ]);
    assert.equal(tokens.getPropertyValue('--x'), 'navy');
    assert.equal(tokens.getPropertyValue('color'), 'rgb(0, 0, 128)');

    // length 0 is >= 0 so the CSSOM item loop runs 0 times and never
    // falls through to style.declarations (teal/raw orange must not win).
    const lengthZero = getCascadedStyle(el, [
      {
        type: CSSRule.STYLE_RULE,
        selectorText: '.t',
        style: {
          length: 0,
          item: () => '--x',
          getPropertyValue: () => 'lime',
          getPropertyPriority: () => '',
          declarations: [
            { name: '--x', value: tokenize('teal'), important: false, raw: 'orange' },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(lengthZero.getPropertyValue('--x'), '');
    assert.equal(lengthZero.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const duckEmpty = getCascadedStyle(el, [
      cssomRule('.t', { '--x': '', color: 'var(--x, red)' }),
    ]);
    assert.equal(duckEmpty.getPropertyValue('--x'), ' ');
    assert.equal(duckEmpty.getPropertyValue('color'), 'rgb(0, 0, 0)');
  });

  test('prop.startsWith("--") leftover names; decls.length > 0 F mute', () => {
    // L264 T,T: numeric / mixed-case custom keys. groupDeclarationsByProperty
    // never stores [], so length F with startsWith T is mute.
    const numeric = box('.t { --0: lime; color: var(--0); z-index: 4; }');
    assert.equal(numeric.getPropertyValue('--0'), 'lime');
    assert.equal(numeric.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(numeric.getPropertyValue('z-index'), '4');

    const mixed = box('.t { --X: lime; color: var(--X); }');
    assert.equal(mixed.getPropertyValue('--X'), 'lime');
    assert.equal(mixed.getPropertyValue('--x'), '');
    assert.equal(mixed.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const mismatch = box('.t { --x: lime; color: var(--X, red); }');
    assert.equal(mismatch.getPropertyValue('--x'), 'lime');
    assert.equal(mismatch.getPropertyValue('--X'), '');
    assert.equal(mismatch.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // L264 F: -webkit- is one hyphen, not a custom property.
    const webkit = box('.t { -webkit-foo: lime; color: red; }');
    assert.equal(webkit.getPropertyValue('-webkit-foo'), 'lime');
    assert.equal(webkit.getPropertyValue('--webkit-foo'), '');
    assert.equal(webkit.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // Parser drops invalid `--` (css-variables-1 dashed-ident); duck injects it.
    const dropped = box('.t { --: lime; color: var(--, red); }');
    assert.equal(dropped.getPropertyValue('--'), '');
    assert.equal(dropped.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);
    const duckDash = getCascadedStyle(el, [
      cssomRule('.t', { '--': 'lime', color: 'var(--)' }),
    ]);
    assert.equal(duckDash.getPropertyValue('--'), '');
    assert.equal(duckDash.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Empty item() name is skipped (if (!name) continue); later --x still T.
    const emptyName = getCascadedStyle(el, [
      {
        type: CSSRule.STYLE_RULE,
        selectorText: '.t',
        style: {
          length: 3,
          item: (i: number) => ['', '--x', 'color'][i] ?? '',
          getPropertyValue: (n: string) => (n === '--x' ? 'lime' : n === 'color' ? 'var(--x)' : 'ignored'),
          getPropertyPriority: () => '',
        },
      } as unknown as Rule,
    ]);
    assert.equal(emptyName.getPropertyValue('--x'), 'lime');
    assert.equal(emptyName.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const inherited = childBox('.p { --X: orange; --x: lime; } .t { color: var(--X); }');
    assert.equal(inherited.getPropertyValue('--X'), 'orange');
    assert.equal(inherited.getPropertyValue('--x'), 'lime');
    assert.equal(inherited.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const onlyStandard = box('.t { color: lime; z-index: 4; }');
    assert.equal(onlyStandard.getPropertyValue('--x'), '');
    assert.equal(onlyStandard.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });
});

describe('MC/DC round4 unique-cause: getCascadedStyle L174 parsedPseudo leftover', { concurrency: false }, () => {
  // cssom-1 § 6.2 / WPT getComputedStyle-pseudo.html
  // css-pseudo-4 § 4 #treelike-pseudo / § 3.1 #legacy-alias
  // css-syntax-3 § 4.3.2 #consume-comments discards comments, so
  // `::before/*c*/` tokenizes as length-3 ident (known) vs extra tokens.
  // normalizePseudoElement returns null only without leading `:`, already
  // filtered at L169, so L174 parsedPseudo F is mute.
  test('comment-stripped known vs leading-space originating vs fullwidth colon', () => {
    const html = '<html><body><div class="p"><div class="t" style="z-index: 7"></div></div></body></html>';

    const known = cascade(html, PSEUDO_SHEET, '.t', '::before');
    assert.equal(known.getPropertyValue('width'), '50px');
    assert.equal(known.getPropertyValue('z-index'), '');
    assert.equal(known.getPropertyValue('content'), '"x"');
    assert.equal(known.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Comments discarded: still valid known (length === 3 ident).
    const commentBefore = cascade(html, PSEUDO_SHEET, '.t', '::before/*c*/');
    assert.equal(commentBefore.getPropertyValue('width'), '50px');
    assert.equal(commentBefore.getPropertyValue('content'), '"x"');
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', ':before/*c*/').getPropertyValue('width'), '50px');
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', '::Before/*C*/').getPropertyValue('width'), '50px');
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', '::after/*x*//*y*/').getPropertyValue('width'), '40px');
    const pickerComment = cascade(html, PSEUDO_SHEET, '.t', '::picker(select)/*c*/');
    assert.equal(pickerComment.getPropertyValue('width'), '14px');
    assert.equal(pickerComment.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Extra tokens: !valid T (parsedPseudo T).
    const extra = cascade(html, PSEUDO_SHEET, '.t', ':before extra');
    assert.equal(extra.length, 0);
    assert.equal(extra.getPropertyValue('width'), '');
    assert.equal(extra.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', ':before ').length, 0);
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', '::before\t').length, 0);
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', ': before').length, 0);
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', ':: before').length, 0);
    assert.equal(cascade(html, PSEUDO_SHEET, '.t', ':::before').length, 0);

    // startsWith(':') F: colon is not first code point → originating element.
    const leading = cascade(html, PSEUDO_SHEET, '.t', ' :before');
    assert.equal(leading.getPropertyValue('width'), '100px');
    assert.equal(leading.getPropertyValue('z-index'), '7');
    assert.equal(leading.getPropertyValue('color'), 'rgb(0, 128, 0)');
    const tab = cascade(html, PSEUDO_SHEET, '.t', '\t:before');
    assert.equal(tab.getPropertyValue('width'), '100px');
    assert.equal(tab.getPropertyValue('z-index'), '7');
    const fullwidth = cascade(html, PSEUDO_SHEET, '.t', '\uFF1Abefore');
    assert.equal(fullwidth.getPropertyValue('width'), '100px');
    assert.equal(fullwidth.getPropertyValue('z-index'), '7');

    // Ident-only still originating (L169 F; parsedPseudo never called).
    const identOnly = cascade(html, PSEUDO_SHEET, '.t', 'before');
    assert.equal(identOnly.getPropertyValue('width'), '100px');
    assert.equal(identOnly.getPropertyValue('z-index'), '7');
  });
});
