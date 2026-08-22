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
// Round-3 leftover unique-cause for src/cascade/index.ts getCascadedStyle
// (24/30 D, 34/41 C, 6 incomplete) after
// tests/mcdc-cascade-still-hot-unique-cause.test.ts. Hottest remaining
// seam L266 lastDecl.raw && !lastDecl.raw.includes('var('). Drive only
// public getCascadedStyle from ../src/cascade.ts with linkedom parseHTML.
// No //mcdc:ignore.
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
): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function box(css: string): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="t"></div></body></html>',
    css,
    '.t',
  );
}

function childBox(css: string): CSSStyleDeclaration {
  return cascade(
    '<html><body><div class="p"><div class="t"></div></div></body></html>',
    css,
    '.t',
  );
}

/** Which physical margin received margin-inline-start: 10px. */
function inlineStartSide(style: CSSStyleDeclaration): string {
  if (style.getPropertyValue('margin-top') === '10px') return 'top';
  if (style.getPropertyValue('margin-bottom') === '10px') return 'bottom';
  if (style.getPropertyValue('margin-left') === '10px') return 'left';
  if (style.getPropertyValue('margin-right') === '10px') return 'right';
  return '';
}

type Duck = {
  nodeType: number;
  tagName: string;
  localName: string;
  className: string;
  classList: { contains(c: string): boolean };
  isConnected: boolean | 0 | undefined;
  parentElement: unknown;
  parentNode: unknown;
  ownerDocument: unknown;
  getRootNode?: () => unknown;
};

function duckT(document: unknown, extra: Partial<Duck> = {}): Duck {
  return {
    nodeType: 1,
    tagName: 'DIV',
    localName: 'div',
    className: 't',
    classList: { contains: (c: string) => c === 't' },
    isConnected: true,
    parentElement: null,
    parentNode: null,
    ownerDocument: document,
    ...extra,
  };
}

function sheetOf(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

/**
 * Omit the rules argument so collectStyleSheetsAndRules walks getRootNode
 * sheets. Parent isConnected === false returns empty CSSStyleDeclaration
 * (no SVG computed defaults), which is the only public path to pWm/pDir F.
 */
function omitRules(
  css: string,
  parentConnected: boolean | 0 | undefined,
): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body></body></html>');
  const root = { styleSheets: [sheetOf(css)] };
  const parent = duckT(document, {
    className: 'p',
    classList: { contains: (c: string) => c === 'p' },
    isConnected: parentConnected,
    getRootNode: () => root,
  });
  const child = duckT(document, {
    parentElement: parent,
    parentNode: parent,
    getRootNode: () => root,
  });
  const style = getCascadedStyle(child);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function cssomRule(selectorText: string, decls: Record<string, string | ReturnType<typeof tokenize>>): Rule {
  const names = Object.keys(decls);
  const style = {
    length: names.length,
    item: (i: number) => names[i] ?? '',
    getPropertyValue: (n: string) => decls[n],
    getPropertyPriority: () => '',
  };
  return {
    type: CSSRule.STYLE_RULE,
    selectorText,
    style,
  } as unknown as Rule;
}

describe('MC/DC leftover unique-cause: getCascadedStyle pWm / pDir F', { concurrency: false }, () => {
  // css-writing-modes-4 § 3 #writing-mode / § 2 #text-direction
  // css-logical-1 § 2 #logical-prop-mapping
  // css-cascade-5 § 7.2 #computed-values
  // SVG presentation defaults on CSSComputedStyleDeclaration make
  // getPropertyValue('writing-mode') / ('direction') always truthy
  // (horizontal-tb / ltr). The F rows only run when parentCascaded is
  // the empty CSSStyleDeclaration from collectStyleSheetsAndRules null
  // (parent isConnected === false, rules omitted).
  test('pWm F vs T-default vs T vertical-rl via disconnected parent', () => {
    const mis = '.t { margin-inline-start: 10px; }';

    // pWm F: empty parent style, mapping keeps initialized horizontal-tb.
    const wmF = omitRules(mis, false);
    assert.equal(inlineStartSide(wmF), 'left');
    assert.equal(wmF.getPropertyValue('writing-mode'), 'horizontal-tb');
    assert.equal(wmF.getPropertyValue('direction'), 'ltr');

    // pWm T default: CSSComputed parent with no writing-mode declaration
    // still returns SVG initial 'horizontal-tb' (same mapping as F).
    const wmDefault = omitRules(mis, true);
    assert.equal(inlineStartSide(wmDefault), 'left');
    assert.equal(wmDefault.getPropertyValue('writing-mode'), 'horizontal-tb');

    // isConnected 0 is not === false, so parent still collects (T default).
    const wmZero = omitRules(mis, 0);
    assert.equal(inlineStartSide(wmZero), 'left');

    // pWm T specified vertical-rl (parent connected; direction stays ltr).
    const wmRl = omitRules(`.p { writing-mode: vertical-rl; } ${mis}`, true);
    assert.equal(inlineStartSide(wmRl), 'top');
    assert.equal(wmRl.getPropertyValue('writing-mode'), 'vertical-rl');

    // Same specified T with rules-arg live parent (still-hot path).
    const liveRl = childBox(`.p { writing-mode: vertical-rl; } ${mis}`);
    assert.equal(inlineStartSide(liveRl), 'top');

    // F vs specified T: disconnected parent ignores .p writing-mode.
    const wmFIgnore = omitRules(`.p { writing-mode: vertical-rl; } ${mis}`, false);
    assert.equal(inlineStartSide(wmFIgnore), 'left');
    assert.equal(wmFIgnore.getPropertyValue('writing-mode'), 'horizontal-tb');
  });

  test('pDir F vs T-default vs T rtl via disconnected parent', () => {
    const mis = '.t { margin-inline-start: 10px; }';

    // pDir F: empty parent style, mapping keeps initialized ltr.
    const dirF = omitRules(mis, false);
    assert.equal(inlineStartSide(dirF), 'left');
    assert.equal(dirF.getPropertyValue('direction'), 'ltr');

    // pDir T default: CSSComputed parent returns SVG initial 'ltr'.
    const dirDefault = omitRules(mis, true);
    assert.equal(inlineStartSide(dirDefault), 'left');
    assert.equal(dirDefault.getPropertyValue('direction'), 'ltr');

    // pDir T specified rtl (writing-mode stays horizontal-tb).
    const dirRtl = omitRules(`.p { direction: rtl; } ${mis}`, true);
    assert.equal(inlineStartSide(dirRtl), 'right');
    assert.equal(dirRtl.getPropertyValue('direction'), 'rtl');

    const liveRtl = childBox(`.p { direction: rtl; } ${mis}`);
    assert.equal(inlineStartSide(liveRtl), 'right');

    // F vs specified T: disconnected parent ignores .p direction.
    const dirFIgnore = omitRules(`.p { direction: rtl; } ${mis}`, false);
    assert.equal(inlineStartSide(dirFIgnore), 'left');
    assert.equal(dirFIgnore.getPropertyValue('direction'), 'ltr');

    // Both specified T: vertical-rl + rtl → bottom.
    const both = omitRules(
      `.p { writing-mode: vertical-rl; direction: rtl; } ${mis}`,
      true,
    );
    assert.equal(inlineStartSide(both), 'bottom');
    const bothF = omitRules(
      `.p { writing-mode: vertical-rl; direction: rtl; } ${mis}`,
      false,
    );
    assert.equal(inlineStartSide(bothF), 'left');
  });
});

describe('MC/DC leftover unique-cause: getCascadedStyle lastDecl.raw / typeof / decls.length', { concurrency: false }, () => {
  // css-variables-1 § 3 #using / § 4 #resolving-var-functions
  // css-cascade-5 § 7 #cascaded-values
  test('lastDecl.raw F string path: no-var vs var vs env vs empty vs last-wins', () => {
    // Collectors stringify MatchedDeclaration.value and never copy .raw, so
    // L266 lastDecl.raw is always F and L268 typeof === 'string' is always T.
    // Unique-cause the string used as rawCustomProps.
    const noVar = box('.t { --x: lime; color: var(--x); }');
    assert.equal(noVar.getPropertyValue('--x'), 'lime');
    assert.equal(noVar.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const withVar = box('.t { --y: lime; --x: var(--y); color: var(--x); }');
    assert.equal(withVar.getPropertyValue('--x'), 'lime');
    assert.equal(withVar.getPropertyValue('--y'), 'lime');
    assert.equal(withVar.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // env() is not var(); L266 includes is skipped (raw F) and the specified
    // env() text is stored as the custom (used-value 0px is not substituted here).
    const envOnly = box('.t { --x: env(safe-area-inset-top); color: var(--x, red); }');
    assert.equal(envOnly.getPropertyValue('--x'), 'env(safe-area-inset-top)');
    // env() substitutes at use; color is not IACVT so the 0px used value lands.
    assert.equal(envOnly.getPropertyValue('color'), '0px');

    const envUnknown = box('.t { --x: env(unknown, inherit); color: var(--x, red); }');
    assert.equal(envUnknown.getPropertyValue('--x'), 'env(unknown, inherit)');
    assert.equal(envUnknown.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const empty = box('.t { --x: ; color: var(--x, red); }');
    assert.equal(empty.getPropertyValue('--x'), ' ');
    assert.equal(empty.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const lastNoVar = box('.t { --x: var(--y); --y: red; --x: lime; color: var(--x); }');
    assert.equal(lastNoVar.getPropertyValue('--x'), 'lime');
    assert.equal(lastNoVar.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const lastVar = box('.t { --x: lime; --y: orange; --x: var(--y); color: var(--x); }');
    assert.equal(lastVar.getPropertyValue('--x'), 'orange');
    assert.equal(lastVar.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });

  test('inline custom vs stylesheet: still string, raw not copied', () => {
    const inline = cascade(
      '<html><body><div class="t" style="--x: orange; color: var(--x)"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inline.getPropertyValue('--x'), 'orange');
    assert.equal(inline.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const inlineVar = cascade(
      '<html><body><div class="t" style="--x: var(--y); color: var(--x)"></div></body></html>',
      '.t { --y: lime; }',
      '.t',
    );
    assert.equal(inlineVar.getPropertyValue('--x'), 'lime');
    assert.equal(inlineVar.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Inline empty custom does not take collectInlineDeclarations' space
    // fallback the way a stylesheet `--x: ;` does (unique-cause of the
    // two stringify paths, both still lastDecl.raw F).
    const inlineEmpty = cascade(
      '<html><body><div class="t" style="--x: ; color: var(--x, red)"></div></body></html>',
      '',
      '.t',
    );
    assert.equal(inlineEmpty.getPropertyValue('--x'), '');
    assert.equal(inlineEmpty.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('duck CSSOM / AST raw / token values still stringify (raw T unpairable)', () => {
    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    const cssom = getCascadedStyle(el, [
      cssomRule('.t', { '--x': 'lime', color: 'var(--x)' }),
    ]);
    assert.equal(cssom.getPropertyValue('--x'), 'lime');
    assert.equal(cssom.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // AST declarations copy serialize(d.value), not d.raw.
    const withRaw = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          declarations: [
            { name: '--x', value: tokenize('lime'), important: false, raw: 'orange' },
            { name: 'color', value: tokenize('var(--x)'), important: false, raw: 'pink' },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(withRaw.getPropertyValue('--x'), 'lime');
    assert.equal(withRaw.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const tokensOnly = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          declarations: [
            { name: '--x', value: tokenize('teal'), important: false },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(tokensOnly.getPropertyValue('--x'), 'teal');
    assert.equal(tokensOnly.getPropertyValue('color'), 'rgb(0, 128, 128)');

    // Non-string getPropertyValue is serialized at collection (L268 F mute).
    const tokenPv = getCascadedStyle(el, [
      cssomRule('.t', { '--x': tokenize('navy'), color: 'var(--x)' }),
    ]);
    assert.equal(tokenPv.getPropertyValue('--x'), 'navy');
    assert.equal(tokenPv.getPropertyValue('color'), 'rgb(0, 0, 128)');

    const block = getCascadedStyle(el, [
      {
        type: 'qualified-rule',
        prelude: tokenize('.t'),
        block: { value: tokenize(' --x: lime; color: var(--x); ') },
      } as unknown as Rule,
    ]);
    assert.equal(block.getPropertyValue('--x'), 'lime');
    assert.equal(block.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });

  test('prop.startsWith("--") T vs F; decls.length > 0 F unpairable', () => {
    // L264 T,T: custom key always has length > 0 (groupDeclarationsByProperty
    // never stores []). L264 F: standard property skips the rawCustomProps loop.
    const custom = box('.t { --x: lime; color: var(--x); z-index: 4; }');
    assert.equal(custom.getPropertyValue('--x'), 'lime');
    assert.equal(custom.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(custom.getPropertyValue('z-index'), '4');

    const onlyStandard = box('.t { color: lime; z-index: 4; }');
    assert.equal(onlyStandard.getPropertyValue('--x'), '');
    assert.equal(onlyStandard.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(onlyStandard.getPropertyValue('z-index'), '4');

    const mixed = childBox('.p { --x: orange; color: red; } .t { color: var(--x); }');
    assert.equal(mixed.getPropertyValue('--x'), 'orange');
    assert.equal(mixed.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });
});
