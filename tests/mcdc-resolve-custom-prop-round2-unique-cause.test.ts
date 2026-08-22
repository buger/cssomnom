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
// Round-2 leftover unique-cause for src/cascade/variable-resolver.ts
// resolveCustomProp after tests/mcdc-resolve-custom-prop-unique-cause.test.ts
// (still 18/25 D, 22/30 C, 7 incomplete; that round did not move Proof).
// Drive only through getCascadedStyle + linkedom. Prefer real CSS.
// No getter mutation. No //mcdc:ignore.
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

function child(css: string): CSSStyleDeclaration {
  return cascade('<html><body><div class="p"><div class="t"></div></div></body></html>', css, '.t');
}

function duckStyle(selectorText: string, decls: Record<string, string>): Rule {
  const names = Object.keys(decls);
  const style = {
    length: names.length,
    item: (i: number) => names[i] ?? '',
    getPropertyValue: (n: string) => decls[n] ?? '',
    getPropertyPriority: () => '',
  };
  return {
    type: CSSRule.STYLE_RULE,
    selectorText,
    style,
  } as unknown as Rule;
}

describe('MC/DC round2 unique-cause: resolveCustomProp via getCascadedStyle', { concurrency: false }, () => {
  // css-variables-1 § 3.1 #guaranteed-invalid, § 4 #resolving-var-functions
  // css-cascade-5 § 6.2 #default, § 6.3 #revert-layer, § 6.3.3 #revert-rule-keyword
  test('IACVT continue onto previous revert / initial / unset / revert-layer', () => {
    // Round 1 unique-caused L258 F continue onto inherit / revert-rule.
    // Pair the remaining CSS-wide previous decls independently.
    const thenRevert = child(
      '.p { --x: orange; } .t { --x: revert; } .t { --x: var(--missing); color: var(--x); }',
    );
    assert.equal(thenRevert.getPropertyValue('--x'), 'orange');
    assert.equal(thenRevert.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const thenInitial = child(
      '.p { --x: orange; } .t { --x: initial; } .t { --x: var(--missing); color: var(--x, red); }',
    );
    assert.equal(thenInitial.getPropertyValue('--x'), '');
    assert.equal(thenInitial.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const thenUnset = child(
      '.p { --x: orange; } .t { --x: unset; } .t { --x: var(--missing); color: var(--x); }',
    );
    assert.equal(thenUnset.getPropertyValue('--x'), 'orange');
    assert.equal(thenUnset.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const thenLayer = child(
      '.p { --x: orange; } .t { --x: revert-layer; } .t { --x: var(--missing); color: var(--x); }',
    );
    assert.equal(thenLayer.getPropertyValue('--x'), 'orange');
    assert.equal(thenLayer.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });

  test('cyclicProps.has T with non-null substituted fallback then L258 return', () => {
    // Unique-cause L257 cyclic T independently of subVal === null:
    // `--x: var(--y, lime)` takes the lime fallback while --x is already
    // on the cycle via --y: var(--x), then L258 returns null.
    const cyclicFb = box(
      '.t { --x: var(--y, lime); --y: var(--x); color: var(--x, red); background-color: var(--y, teal); }',
    );
    assert.equal(cyclicFb.getPropertyValue('--x'), '');
    assert.equal(cyclicFb.getPropertyValue('--y'), '');
    assert.equal(cyclicFb.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(cyclicFb.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    const reversed = box(
      '.t { --y: var(--x); --x: var(--y, lime); color: var(--x, red); }',
    );
    assert.equal(reversed.getPropertyValue('--x'), '');
    assert.equal(reversed.getPropertyValue('--y'), '');
    assert.equal(reversed.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // Self-ref ignores its own fallback (resolvingStack pre-adds the name).
    const selfFb = box('.t { --a: var(--a, lime); color: var(--a, red); }');
    assert.equal(selfFb.getPropertyValue('--a'), '');
    assert.equal(selfFb.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('revert-rule only, double revert-rule, var() fallback revert-rule only', () => {
    // Unique-cause L263 T continue with no previous local, then inherit.
    const only = child('.p { --x: orange; } .t { --x: revert-rule; color: var(--x); }');
    assert.equal(only.getPropertyValue('--x'), 'orange');
    assert.equal(only.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const twice = box(
      '.t { --x: first; } .t { --x: revert-rule; } .t { --x: revert-rule; color: var(--x); }',
    );
    assert.equal(twice.getPropertyValue('--x'), 'first');
    assert.equal(twice.getPropertyValue('color'), 'first');

    const viaVar = child(
      '.p { --x: orange; } .t { --x: var(--missing, revert-rule); color: var(--x); }',
    );
    assert.equal(viaVar.getPropertyValue('--x'), 'orange');
    assert.equal(viaVar.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });

  test('specified inherit/unset then --y: var(--x) takes CSS-wide via rawCustomProps', () => {
    // Substitution reads rawCustomProps, not resolvedCustomProps, so
    // `--y: var(--x)` with `--x: inherit` substitutes the ident inherit
    // (L253 T then L288 T for --y). Parent has no --y → empty.
    const inheritChain = child(
      '.p { --x: orange; } .t { --x: inherit; --y: var(--x); color: var(--y, red); }',
    );
    assert.equal(inheritChain.getPropertyValue('--x'), 'orange');
    assert.equal(inheritChain.getPropertyValue('--y'), '');
    assert.equal(inheritChain.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const unsetChain = child(
      '.p { --x: teal; } .t { --x: unset; --y: var(--x); color: var(--y, red); }',
    );
    assert.equal(unsetChain.getPropertyValue('--x'), 'teal');
    assert.equal(unsetChain.getPropertyValue('--y'), '');
    assert.equal(unsetChain.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const revertChain = child(
      '.p { --x: orange; } .t { --x: revert; --y: var(--x); color: var(--y, red); }',
    );
    assert.equal(revertChain.getPropertyValue('--x'), 'orange');
    assert.equal(revertChain.getPropertyValue('--y'), '');
    assert.equal(revertChain.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('mixed-case CSS-wide keywords are specified text (L288/L280/L285 F)', () => {
    // css-cascade-5 § 6.2 #default is ASCII case-insensitive, but
    // resolveCustomProp compares trimmed === 'inherit' etc. Mixed-case
    // unique-causes the keyword F path without extra tokens.
    const inheritUc = child('.p { --x: orange; } .t { --x: INHERIT; color: var(--x, red); }');
    assert.equal(inheritUc.getPropertyValue('--x'), 'INHERIT');
    assert.equal(inheritUc.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const inheritTitle = child('.p { --x: orange; } .t { --x: Inherit; color: var(--x, red); }');
    assert.equal(inheritTitle.getPropertyValue('--x'), 'Inherit');
    assert.equal(inheritTitle.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const revertUc = child('.p { --x: orange; } .t { --x: REVERT; color: var(--x, red); }');
    assert.equal(revertUc.getPropertyValue('--x'), 'REVERT');
    assert.equal(revertUc.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const unsetUc = child('.p { --x: orange; } .t { --x: UNSET; color: var(--x, red); }');
    assert.equal(unsetUc.getPropertyValue('--x'), 'UNSET');
    assert.equal(unsetUc.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const initialUc = child('.p { --x: orange; } .t { --x: INITIAL; color: var(--x, red); }');
    assert.equal(initialUc.getPropertyValue('--x'), 'INITIAL');
    assert.equal(initialUc.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const viaVar = child('.p { --x: orange; } .t { --x: var(--missing, INHERIT); color: var(--x, red); }');
    assert.equal(viaVar.getPropertyValue('--x'), 'INHERIT');
    assert.equal(viaVar.getPropertyValue('color'), 'rgb(0, 0, 0)');
  });

  test('inline inherit, constructed CSSStyleSheet, document style tag', () => {
    const inline = cascade(
      '<html><body><div class="p"><div class="t" style="--x: inherit; color: var(--x)"></div></div></body></html>',
      '.p { --x: orange; }',
      '.t',
    );
    assert.equal(inline.getPropertyValue('--x'), 'orange');
    assert.equal(inline.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.t { --x: lime; color: var(--x); }');
    const fromSheet = getCascadedStyle(el, [sheet.cssRules[0] as unknown as Rule]);
    assert.equal(fromSheet.getPropertyValue('--x'), 'lime');
    assert.equal(fromSheet.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const { document: doc2 } = parseHTML(
      '<html><head><style>.t { --x: teal; color: var(--x); }</style></head><body><div class="t"></div></body></html>',
    );
    const fromDoc = getCascadedStyle(doc2.querySelector('.t'));
    assert.ok(fromDoc instanceof CSSStyleDeclaration);
    assert.equal(fromDoc.getPropertyValue('--x'), 'teal');
    assert.equal(fromDoc.getPropertyValue('color'), 'rgb(0, 128, 128)');
  });

  test('revert-layer IACVT previous layer, same named layer, nested layers', () => {
    const skipIacvtLayer = box(`
      @layer a { .t { --x: from-a; } }
      @layer b { .t { --x: var(--missing); } }
      @layer c { .t { --x: revert-layer; color: var(--x); } }
    `);
    assert.equal(skipIacvtLayer.getPropertyValue('--x'), 'from-a');
    assert.equal(skipIacvtLayer.getPropertyValue('color'), 'from-a');

    // Same named layer has no previous lower layer → inherit nothing.
    const sameLayer = box(`
      @layer a {
        .t { --x: first; }
        .t { --x: revert-layer; color: var(--x, red); }
      }
    `);
    assert.equal(sameLayer.getPropertyValue('--x'), '');
    assert.equal(sameLayer.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const nested = box(`
      @layer a {
        @layer b { .t { --x: from-ab; } }
      }
      @layer a.c { .t { --x: revert-layer; color: var(--x); } }
    `);
    assert.equal(nested.getPropertyValue('--x'), 'from-ab');
    assert.equal(nested.getPropertyValue('color'), 'from-ab');

    // Unlayered !important beats later revert-layer (cascade sort).
    const important = box(`
      @layer a { .t { --x: from-a; } }
      .t { --x: from-unlayered !important; }
      .t { --x: revert-layer; color: var(--x); }
    `);
    assert.equal(important.getPropertyValue('--x'), 'from-unlayered');
    assert.equal(important.getPropertyValue('color'), 'from-unlayered');
  });

  test('mute: L227/L228/L244/L248/L250 structurally unpairable on public path', () => {
    // L227 resolvedCustomProps.has T: resolveCustomProp never re-enters.
    // `--b: var(--a)` reads rawCustomProps, not the resolved cache.
    const noReentry = box('.t { --a: lime; --b: var(--a); color: var(--b); }');
    assert.equal(noReentry.getPropertyValue('--a'), 'lime');
    assert.equal(noReentry.getPropertyValue('--b'), 'lime');
    assert.equal(noReentry.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // L228 callStack.has T / L231 / L232: cycles go through substituteVariables.
    const cycle = box('.t { --a: var(--b); --b: var(--a); color: var(--a, lime); }');
    assert.equal(cycle.getPropertyValue('--a'), '');
    assert.equal(cycle.getPropertyValue('--b'), '');
    assert.equal(cycle.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // L244 decls.length > 0 F with decls T: groupDeclarationsByProperty
    // never stores []. Inherited-only is Map.get undefined (decls F).
    const inherited = child('.p { --x: orange; } .t { color: var(--x); }');
    assert.equal(inherited.getPropertyValue('--x'), 'orange');
    assert.equal(inherited.getPropertyValue('color'), 'rgb(255, 165, 0)');
    const local = box('.t { --x: orange; color: var(--x); }');
    assert.equal(local.getPropertyValue('--x'), 'orange');
    assert.equal(local.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    // L248 decl.raw T: collectors never copy .raw. AST raw: orange dropped.
    const astRaw = getCascadedStyle(el, [
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
    assert.equal(astRaw.getPropertyValue('--x'), 'lime');
    assert.equal(astRaw.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // raw would have been includes('var(') T if copied; serialize lime still wins.
    const astRawVar = getCascadedStyle(el, [
      {
        type: 'style-rule',
        selectorText: '.t',
        style: {
          declarations: [
            { name: '--x', value: tokenize('lime'), important: false, raw: 'var(--missing)' },
            { name: 'color', value: tokenize('var(--x)'), important: false },
          ],
        },
      } as unknown as Rule,
    ]);
    assert.equal(astRawVar.getPropertyValue('--x'), 'lime');
    assert.equal(astRawVar.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // CSSOM style.raw is not copied either.
    const styleRaw = getCascadedStyle(el, [
      duckStyle('.t', { '--x': 'lime', color: 'var(--x)' }),
    ]);
    assert.equal(styleRaw.getPropertyValue('--x'), 'lime');
    assert.equal(styleRaw.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // L250 typeof value === 'string' F: token getPropertyValue is serialized
    // in collectMatchedDeclarations before resolveCustomProp sees it.
    const tok = getCascadedStyle(el, [
      {
        type: CSSRule.STYLE_RULE,
        selectorText: '.t',
        style: {
          length: 2,
          item: (i: number) => (i === 0 ? '--x' : i === 1 ? 'color' : ''),
          getPropertyValue: (n: string) => (n === '--x' ? tokenize('lime') : tokenize('var(--x)')),
          getPropertyPriority: () => '',
        },
      } as unknown as Rule,
    ]);
    assert.equal(tok.getPropertyValue('--x'), 'lime');
    assert.equal(tok.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });
});
