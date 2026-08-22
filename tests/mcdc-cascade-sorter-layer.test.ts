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
// Unique-cause leftovers for src/cascade/cascade-sorter.ts,
// src/cascade/layer-manager.ts, and src/cascade/value-processor.ts
// driven only through getCascadedStyle. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet, parseRuleInBlock } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import {
  CSSLayerBlockRule,
  CSSLayerStatementRule,
  CSSRule,
} from '../src/CSSOM.ts';
import type { ASTAtRule, Rule } from '../src/types.ts';

function cascade(html: string, css: string, selector: string): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function box(css: string): CSSStyleDeclaration {
  return cascade('<html><body><div class="t"></div></body></html>', css, '.t');
}

function cascadeRules(html: string, rules: Rule[], selector: string): CSSStyleDeclaration {
  const { document } = parseHTML(html);
  const el = document.querySelector(selector);
  assert.ok(el, `missing ${selector}`);
  const style = getCascadedStyle(el, rules);
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

function boxRules(rules: Rule[]): CSSStyleDeclaration {
  return cascadeRules('<html><body><div class="t"></div></body></html>', rules, '.t');
}

function duckStyle(
  selectorText: string,
  decls: Record<string, string>,
  extra: { cssRules?: unknown } = {},
): Rule {
  const names = Object.keys(decls);
  const style = {
    length: names.length,
    item: (i: number) => names[i] ?? '',
    getPropertyValue: (n: string) => decls[n] ?? '',
    getPropertyPriority: () => '',
  };
  for (let i = 0; i < names.length; i++) {
    (style as Record<number, string>)[i] = names[i];
  }
  const rule: Record<string, unknown> = {
    type: CSSRule.STYLE_RULE,
    selectorText,
    style,
  };
  if ('cssRules' in extra) {
    rule.cssRules = extra.cssRules;
  }
  return rule as unknown as Rule;
}

describe('MC/DC unique-cause: cascade-sorter via getCascadedStyle', { concurrency: false }, () => {
  // css-cascade-5 § 6 #cascade-sort, § 6.1 #cascade-origin
  test('getPrecedence unique-cause important/normal × inline/layered/unlayered', () => {
    const htmlImp = '<html><body><div class="t" style="color: navy !important"></div></body></html>';
    // Unique-cause decl.isInline T in the important bucket (line 33).
    const vsUnlayered = cascade(htmlImp, '.t { color: red !important; }', '.t');
    assert.equal(vsUnlayered.getPropertyValue('color'), 'rgb(0, 0, 128)');
    const vsLayered = cascade(htmlImp, '@layer a { .t { color: red !important; } }', '.t');
    assert.equal(vsLayered.getPropertyValue('color'), 'rgb(0, 0, 128)');

    const htmlNorm = '<html><body><div class="t" style="color: pink"></div></body></html>';
    // Unique-cause decl.isInline T in the normal bucket (line 37).
    const inlineNorm = cascade(htmlNorm, '.t { color: red; }', '.t');
    assert.equal(inlineNorm.getPropertyValue('color'), 'rgb(255, 192, 203)');
    // Unique-cause important unlayered (40) vs important layered (50): layered wins here.
    const layeredImp = box('@layer a { .t { color: red !important; } } .t { color: blue !important; }');
    assert.equal(layeredImp.getPropertyValue('color'), 'rgb(255, 0, 0)');
    // Unique-cause important vs normal: important unlayered beats later normal.
    const impVsNorm = box('.t { color: red !important; } .t { color: blue; }');
    assert.equal(impVsNorm.getPropertyValue('color'), 'rgb(255, 0, 0)');
    // Unique-cause normal unlayered (20) vs normal layered (10).
    const unlayered = box('@layer a { .t { color: red; } } .t { color: blue; }');
    assert.equal(unlayered.getPropertyValue('color'), 'rgb(0, 0, 255)');
  });

  // css-cascade-5 § 6.4 #layer-ordering
  test('compareCascadeDeclarations layer-order unique-cause same vs different, important reverse vs normal', () => {
    // Line 50 T,T,T then a.layerOrder !== b.layerOrder T: important reverse (earlier layer wins).
    const impDiff = box(`
      @layer a, b;
      @layer b { .t { z-index: 2 !important; } }
      @layer a { .t { z-index: 1 !important; } }
    `);
    assert.equal(impDiff.getPropertyValue('z-index'), '1');
    // Line 50 T,T,T then a.layerOrder !== b.layerOrder F: same important layer, specificity then source.
    const impSameSpec = box(`
      @layer a {
        .t { color: red !important; }
        div.t { color: lime !important; }
      }
    `);
    assert.equal(impSameSpec.getPropertyValue('color'), 'rgb(0, 255, 0)');
    const impSameSource = box(`
      @layer a {
        .t { z-index: 1 !important; }
        .t { z-index: 2 !important; }
      }
    `);
    assert.equal(impSameSource.getPropertyValue('z-index'), '2');
    // Line 55 T,T,T: normal layered, later layer wins.
    const normDiff = box(`
      @layer a, b;
      @layer b { .t { z-index: 2; } }
      @layer a { .t { z-index: 1; } }
    `);
    assert.equal(normDiff.getPropertyValue('z-index'), '2');
    const normSame = box(`
      @layer a {
        .t { color: red; }
        .t { color: lime; }
      }
    `);
    assert.equal(normSame.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });
});

describe('MC/DC unique-cause: layer-manager scanLayers via getCascadedStyle', { concurrency: false }, () => {
  // css-cascade-5 § 6.4 #layer-ordering
  test('AST layer statement unique-cause type/name/!block vs CSSOM instanceof', () => {
    const rest = parseStyleSheet(`
      @layer ast-second { .t { color: blue; } }
      @layer ast-first { .t { color: red; } }
    `);
    // Unique-cause: instanceof CSSLayerStatementRule F, type==='at-rule' T,
    // name==='layer' T, !block T, and nameList present so the statement registers.
    const withList: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('ast-first').filter((t) => t.type !== 'EOF'),
      nameList: ['ast-first'],
    } as unknown as ASTAtRule;
    assert.equal(
      boxRules([withList as unknown as Rule, ...rest]).getPropertyValue('color'),
      'rgb(0, 0, 255)',
    );
    // Unique-cause nameList || [] F: AST statement without nameList does not register.
    const noList: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('ast-first').filter((t) => t.type !== 'EOF'),
    };
    assert.equal(
      boxRules([noList as unknown as Rule, ...rest]).getPropertyValue('color'),
      'rgb(255, 0, 0)',
    );
    // Unique-cause name==='layer' F: AST @media is not a layer statement.
    const astMedia: ASTAtRule = {
      type: 'at-rule',
      name: 'media',
      prelude: tokenize('all').filter((t) => t.type !== 'EOF'),
    };
    assert.equal(
      boxRules([astMedia as unknown as Rule, ...rest]).getPropertyValue('color'),
      'rgb(255, 0, 0)',
    );
    // Unique-cause type==='at-rule' F: style-rule duck is not a layer statement.
    const notAt = duckStyle('.t', { 'z-index': '9' });
    const mixed = boxRules([notAt, ...rest]);
    assert.equal(mixed.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(mixed.getPropertyValue('z-index'), '9');
  });

  test('AST layer block unique-cause block T vs statement !block, and childRules walk', () => {
    // Unique-cause line 62: instanceof CSSLayerBlockRule F, type T, name T, block T.
    const astBlock: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('astblk').filter((t) => t.type !== 'EOF'),
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: [] },
      childRules: parseStyleSheet('.t { z-index: 8; }'),
    };
    assert.equal(boxRules([astBlock as unknown as Rule]).getPropertyValue('z-index'), '8');
    // Unique-cause !block F on line 51 / block T on line 62 vs statement without block.
    const astStmt: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      nameList: ['late'],
    } as unknown as ASTAtRule;
    const named = parseStyleSheet(`
      @layer early { .t { z-index: 1; } }
      @layer late { .t { z-index: 2; } }
    `);
    assert.equal(
      boxRules([astStmt as unknown as Rule, ...named]).getPropertyValue('z-index'),
      '1',
    );
  });

  test('registerLayer clean F for empty statement names does not steal a later name', () => {
    // Unique-cause clean F: '' and whitespace names are not registered.
    const empty = new CSSLayerStatementRule(['', '  ', 'named-a']);
    const rest = parseStyleSheet(`
      @layer named-a { .t { z-index: 1; } }
      @layer named-b { .t { z-index: 2; } }
    `);
    assert.equal(boxRules([empty, ...rest]).getPropertyValue('z-index'), '2');
    const filled = new CSSLayerStatementRule(['named-a', 'named-b']);
    assert.equal(boxRules([filled, ...rest]).getPropertyValue('z-index'), '2');
  });

  test('nested @layer statement prefix T vs unprefixed sibling layer', () => {
    // Unique-cause prefix T on statement names: @layer outer { @layer inner; }
    // registers outer.inner, so a later top-level @layer inner is a distinct later layer.
    const prefixed = box(`
      @layer outer {
        @layer inner;
        .t { z-index: 9; }
      }
      @layer inner { .t { z-index: 1; } }
      @layer outer.inner { .t { z-index: 2; } }
    `);
    assert.equal(prefixed.getPropertyValue('z-index'), '1');
    // Unique-cause prefix F: top-level @layer inner; registers inner, not outer.inner.
    const top = box(`
      @layer inner;
      @layer outer { .t { z-index: 9; } }
      @layer inner { .t { z-index: 1; } }
      @layer outer.inner { .t { z-index: 2; } }
    `);
    assert.equal(top.getPropertyValue('z-index'), '2');
  });

  test('anonymous nested layer prefix T vs top-level __anon_ name', () => {
    // Unique-cause prefix T on anonymous fullName: outer.__anon_2, not __anon_2.
    const nestedAnon = box(`
      @layer outer {
        @layer { .t { z-index: 3; } }
      }
      @layer __anon_2 { .t { z-index: 4; } }
      @layer outer.__anon_2 { .t { z-index: 5; } }
    `);
    assert.equal(nestedAnon.getPropertyValue('z-index'), '4');
    const topAnon = box(`
      @layer { .t { z-index: 3; } }
      @layer named { .t { z-index: 6; } }
    `);
    assert.equal(topAnon.getPropertyValue('z-index'), '6');
  });

  test('isInsideStyleRule T skips nested @layer statements so later blocks keep source order', () => {
    // Unique-cause !isInsideStyleRule F: statement inside a style rule is not registered.
    const nested = box(`
      div { @layer later; }
      @layer base { .t { z-index: 1; } }
      @layer later { .t { z-index: 2; } }
    `);
    assert.equal(nested.getPropertyValue('z-index'), '2');
    // Unique-cause !isInsideStyleRule T: the same statement at the top level registers first.
    const top = box(`
      @layer later;
      @layer base { .t { z-index: 1; } }
      @layer later { .t { z-index: 2; } }
    `);
    assert.equal(top.getPropertyValue('z-index'), '1');
  });

  test('style-rule cssRules in/value unique-cause and grouping cssRules F', () => {
    // Unique-cause "cssRules" in r F vs T with value F vs T (scanLayers line 79).
    const missing = duckStyle('div', { 'z-index': '7' });
    assert.equal(boxRules([missing]).getPropertyValue('z-index'), '7');
    const falsy = duckStyle('div', { 'z-index': '7' }, { cssRules: null });
    assert.equal(boxRules([falsy]).getPropertyValue('z-index'), '7');
    const nestedStmt = duckStyle('div', { opacity: '0.2' }, {
      cssRules: [new CSSLayerStatementRule(['from-style'])],
    });
    const rest = parseStyleSheet(`
      @layer base { .t { z-index: 1; } }
      @layer from-style { .t { z-index: 2; } }
    `);
    // Nested statement still skipped (isInsideStyleRule T), from-style is later.
    assert.equal(boxRules([nestedStmt, ...rest]).getPropertyValue('z-index'), '2');

    // Unique-cause r.cssRules F on a CSSGroupingRule layer block (scanLayers line 75).
    const inner = parseStyleSheet('.t { color: pink; }');
    const ghost = new CSSLayerBlockRule('ghost', inner, parseRuleInBlock);
    Object.defineProperty(ghost, 'cssRules', { configurable: true, value: null });
    assert.equal(boxRules([ghost]).getPropertyValue('color'), 'rgb(0, 0, 0)');
    const live = new CSSLayerBlockRule('ghost2', inner, parseRuleInBlock);
    assert.equal(boxRules([live]).getPropertyValue('color'), 'rgb(255, 192, 203)');

    // Unique-cause grouping non-layer cssRules F (scanLayers line 82).
    const media = parseStyleSheet('@media all { .t { z-index: 6; } }');
    assert.equal(boxRules(media).getPropertyValue('z-index'), '6');
    Object.defineProperty(media[0], 'cssRules', { configurable: true, value: null });
    assert.equal(boxRules(media).getPropertyValue('z-index'), '');
  });
});

describe('MC/DC unique-cause: value-processor via getCascadedStyle', { concurrency: false }, () => {
  // css-variables-1 § 3 #variables-in-shorthands, css-cascade-5 § 7
  test('expandShorthandWithVariables var/env, IACVT, nested subShorthand, expanded F', () => {
    // Unique-cause subVal.includes('env(') T with includes('var(') F.
    const envOnly = box('.t { margin: env(safe-area-inset-top); }');
    assert.equal(envOnly.getPropertyValue('margin-top'), '0px');
    const envFb = box('.t { margin: env(unknown, 4px); }');
    assert.equal(envFb.getPropertyValue('margin-top'), '4px');
    // Unique-cause includes('var(') T (env skipped).
    const varSh = box('.t { --m: 2px; margin: var(--m) 3px; }');
    assert.equal(varSh.getPropertyValue('margin-top'), '2px');
    assert.equal(varSh.getPropertyValue('margin-right'), '3px');
    // Unique-cause both F: no substitution.
    const plain = box('.t { margin: 1px; }');
    assert.equal(plain.getPropertyValue('margin-top'), '1px');
    // Unique-cause res === null T: cyclic var in a shorthand is IACVT and dropped.
    const cyclic = box('.t { --a: var(--b); --b: var(--a); margin: var(--a); margin-left: 3px; }');
    assert.equal(cyclic.getPropertyValue('margin-left'), '3px');
    assert.equal(cyclic.getPropertyValue('margin-top'), '');
    // Unique-cause subShorthand T on the CSS-wide path (border-block longhands are shorthands).
    const child = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { border-block: 5px solid lime; } .t { border-block: inherit; }',
      '.t',
    );
    assert.equal(child.getPropertyValue('border-top-width'), '5px');
    assert.equal(child.getPropertyValue('border-bottom-width'), '5px');
    assert.equal(child.getPropertyValue('border-top-style'), 'solid');
    // Unique-cause subShorthand T on the expanded path.
    const expanded = box('.t { border-block: 2px solid lime; }');
    assert.equal(expanded.getPropertyValue('border-top-width'), '2px');
    assert.equal(expanded.getPropertyValue('border-top-color'), 'rgb(0, 255, 0)');
    // Unique-cause subShorthand F on CSS-wide (margin longhands are not shorthands).
    const marginInh = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { margin-top: 9px; } .t { margin: inherit; }',
      '.t',
    );
    assert.equal(marginInh.getPropertyValue('margin-top'), '9px');
    // Unique-cause expanded F: invalid shorthand is kept as the shorthand name.
    const badMargin = box('.t { margin-top: 9px; } .t { margin: red; }');
    assert.equal(badMargin.getPropertyValue('margin-top'), '');
    assert.equal(badMargin.getPropertyValue('margin'), 'red');
    const badFlex = box('.t { flex: foo; }');
    assert.equal(badFlex.getPropertyValue('flex-grow'), '');
    const goodFlex = box('.t { flex: 1; }');
    assert.equal(goodFlex.getPropertyValue('flex-grow'), '1');
  });

  // css-cascade-5 § 6.2 #default, § 6.3 #revert-layer, § 6.3.3 #revert-rule-keyword, § 7.3
  test('processStandardDeclarations CSS-wide keywords unique-cause on standard properties', () => {
    const parented = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      `
        .p { color: lime; width: 40px; visibility: hidden; margin-top: 7px; }
        .t { color: inherit; width: initial; display: unset; visibility: unset; margin-top: unset; }
      `,
      '.t',
    );
    assert.equal(parented.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(parented.getPropertyValue('width'), 'auto');
    assert.equal(parented.getPropertyValue('display'), 'inline');
    assert.equal(parented.getPropertyValue('visibility'), 'hidden');
    assert.equal(parented.getPropertyValue('margin-top'), '0');

    const root = cascade(
      '<html id="root"><body></body></html>',
      '#root { color: inherit; width: unset; display: initial; visibility: revert; }',
      '#root',
    );
    assert.equal(root.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(root.getPropertyValue('width'), 'auto');
    assert.equal(root.getPropertyValue('display'), 'inline');
    assert.equal(root.getPropertyValue('visibility'), 'visible');

    const revertChild = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { color: lime; width: 40px; } .t { color: revert; width: revert; display: revert; }',
      '.t',
    );
    // Unique-cause parentCascaded T × INHERITED T vs F.
    assert.equal(revertChild.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(revertChild.getPropertyValue('width'), 'auto');
    assert.equal(revertChild.getPropertyValue('display'), 'block');

    const revertRoot = cascade(
      '<html id="root"><body></body></html>',
      '#root { color: revert; width: revert; }',
      '#root',
    );
    // Unique-cause parentCascaded F (INHERITED skipped).
    assert.equal(revertRoot.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(revertRoot.getPropertyValue('width'), 'auto');
  });

  test('revert-layer while unique-cause and revert-rule skip on standard properties', () => {
    // Unique-cause while layerOrder >= T then F: skip unlayered twin, take @layer a.
    const skipSame = box(`
      @layer a { .t { color: red; } }
      .t { color: blue; }
      .t { color: revert-layer; }
    `);
    assert.equal(skipSame.getPropertyValue('color'), 'rgb(255, 0, 0)');
    // Unique-cause prevIdx >= 0 T and layerOrder >= F immediately.
    const prevLower = box(`
      @layer a { .t { color: red; } }
      @layer b { .t { color: blue; } }
      @layer c { .t { color: revert-layer; } }
    `);
    assert.equal(prevLower.getPropertyValue('color'), 'rgb(0, 0, 255)');
    // Unique-cause prevIdx >= 0 F, then parentCascaded × INHERITED.
    const onlyInherited = cascade(
      '<html><body><div class="p"><div class="t"></div></div></body></html>',
      '.p { color: lime; } .t { color: revert-layer; width: revert-layer; }',
      '.t',
    );
    assert.equal(onlyInherited.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(onlyInherited.getPropertyValue('width'), 'auto');
    const onlyRoot = cascade(
      '<html id="root"><body></body></html>',
      '#root { color: revert-layer; }',
      '#root',
    );
    assert.equal(onlyRoot.getPropertyValue('color'), 'rgb(0, 0, 0)');
    // Unique-cause revert-rule T: skip and take the previous rule.
    const revertRule = box('.t { color: red; } .t { color: revert-rule; }');
    assert.equal(revertRule.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('IACVT continue, spaced-unit skip, and comment strip unique-cause', () => {
    // Unique-cause subVal === null T: skip the IACVT decl and keep the previous.
    const iacvt = box('.t { color: red; } .t { color: var(--missing); }');
    assert.equal(iacvt.getPropertyValue('color'), 'rgb(255, 0, 0)');
    const iacvtOnly = box('.t { color: var(--missing); }');
    assert.equal(iacvtOnly.getPropertyValue('color'), 'rgb(0, 0, 0)');
    // Unique-cause the spaced-unit / comment-unit regex T vs F.
    const skipSpace = box('.t { padding-top: 8px; } .t { padding-top: 10 px; }');
    assert.equal(skipSpace.getPropertyValue('padding-top'), '8px');
    const skipComment = box('.t { padding-top: 8px; } .t { padding-top: 10/**/px; }');
    assert.equal(skipComment.getPropertyValue('padding-top'), '8px');
    const keep = box('.t { padding-top: 10px; }');
    assert.equal(keep.getPropertyValue('padding-top'), '10px');
    // Unique-cause finalVal comment replacement (not a CSS-wide keyword).
    const comments = box('.t { color: red/**/; }');
    assert.equal(comments.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('getUaDefault / getInitialValue webkit prefix, BODY/DIV/SPAN, tagName vs nodeName', () => {
    // Unique-cause prop.startsWith('-webkit-') T vs F, unPrefixedVal T vs F, EXTRA hit.
    const webkit = box(`
      .t {
        -webkit-opacity: initial;
        -webkit-color: revert;
        -webkit-nope: initial;
        -webkit-text-fill-color: initial;
        color: initial;
      }
    `);
    assert.equal(webkit.getPropertyValue('-webkit-opacity'), '1');
    assert.equal(webkit.getPropertyValue('-webkit-color'), 'rgb(0, 0, 0)');
    assert.equal(webkit.getPropertyValue('-webkit-nope'), '');
    assert.equal(webkit.getPropertyValue('-webkit-text-fill-color'), 'currentcolor');
    assert.equal(webkit.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const body = cascade(
      '<html><body id="b"></body></html>',
      'body { margin: revert; margin-top: revert; display: revert; }',
      '#b',
    );
    assert.equal(body.getPropertyValue('margin'), '8px');
    assert.equal(body.getPropertyValue('margin-top'), '8px');
    assert.equal(body.getPropertyValue('display'), 'block');

    const div = box('.t { margin: revert; display: revert; }');
    assert.equal(div.getPropertyValue('margin'), '0px');
    assert.equal(div.getPropertyValue('display'), 'block');

    const span = cascade(
      '<html><body><span class="t"></span></body></html>',
      '.t { display: revert; margin-left: revert; }',
      '.t',
    );
    assert.equal(span.getPropertyValue('display'), 'inline');
    assert.equal(span.getPropertyValue('margin-left'), '0px');

    // Unique-cause tagName F then nodeName T vs both F, via revert on a mock element.
    const mockBody = getCascadedStyle(
      { nodeName: 'BODY', nodeType: 1 },
      parseStyleSheet('* { margin: revert; display: revert; }'),
    );
    assert.equal(mockBody.getPropertyValue('margin'), '8px');
    assert.equal(mockBody.getPropertyValue('display'), 'block');
    const mockTag = getCascadedStyle(
      { tagName: 'SPAN', nodeType: 1 },
      parseStyleSheet('* { display: revert; }'),
    );
    assert.equal(mockTag.getPropertyValue('display'), 'inline');
    const mockEmpty = getCascadedStyle(
      { nodeType: 1 },
      parseStyleSheet('* { margin: revert; display: revert; }'),
    );
    assert.equal(mockEmpty.getPropertyValue('margin'), '0px');
    assert.equal(mockEmpty.getPropertyValue('display'), 'inline');
  });
});
