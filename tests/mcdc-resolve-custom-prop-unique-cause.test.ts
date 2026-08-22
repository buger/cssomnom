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
// Leftover unique-cause for src/cascade/variable-resolver.ts resolveCustomProp
// after tests/mcdc-cascade-vars.test.ts and
// tests/mcdc-variable-resolver-still-hot-unique-cause.test.ts
// (18/25 D, 7 incomplete). Drive only through getCascadedStyle + linkedom.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSRule } from '../src/CSSOM.ts';
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

function root(css: string): CSSStyleDeclaration {
  return cascade('<html id="root"><body></body></html>', css, '#root');
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

describe('MC/DC leftover unique-cause: resolveCustomProp via getCascadedStyle', { concurrency: false }, () => {
  // css-variables-1 § 3.1 #guaranteed-invalid, § 4 #resolving-var-functions
  // css-cascade-5 § 6.2 #default, § 6.3 #revert-layer, § 6.3.3 #revert-rule-keyword
  test('CSS-wide keywords unique-cause after var() substitution vs specified tokens', () => {
    // Unique-cause L253 rawVal.includes('var(') T then trimmed keyword T.
    // cascade-vars unique-caused the same keywords with L253 F (specified inherit).
    const inheritFb = child('.p { --x: orange; } .t { --x: var(--missing, inherit); color: var(--x); }');
    assert.equal(inheritFb.getPropertyValue('--x'), 'orange');
    assert.equal(inheritFb.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const unsetFb = child('.p { --x: teal; } .t { --x: var(--missing, unset); color: var(--x); }');
    assert.equal(unsetFb.getPropertyValue('--x'), 'teal');
    assert.equal(unsetFb.getPropertyValue('color'), 'rgb(0, 128, 128)');

    const initialFb = child('.p { --x: orange; } .t { --x: var(--missing, initial); color: var(--x, red); }');
    assert.equal(initialFb.getPropertyValue('--x'), '');
    assert.equal(initialFb.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const revertFb = child('.p { --x: orange; } .t { --x: var(--missing, revert); color: var(--x); }');
    assert.equal(revertFb.getPropertyValue('--x'), 'orange');
    assert.equal(revertFb.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const revertRuleFb = box('.t { --x: first; } .t { --x: var(--missing, revert-rule); color: var(--x); }');
    assert.equal(revertRuleFb.getPropertyValue('--x'), 'first');
    assert.equal(revertRuleFb.getPropertyValue('color'), 'first');

    const revertLayerFb = box(`
      @layer a { .t { --x: from-a; } }
      .t { --x: from-unlayered; }
      .t { --x: var(--missing, revert-layer); color: var(--x); }
    `);
    assert.equal(revertLayerFb.getPropertyValue('--x'), 'from-a');
    assert.equal(revertLayerFb.getPropertyValue('color'), 'from-a');

    // L253 F control: specified keyword without var() (already in cascade-vars).
    const specified = child('.p { --x: orange; } .t { --x: inherit; color: var(--x); }');
    assert.equal(specified.getPropertyValue('--x'), 'orange');
    assert.equal(specified.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });

  test('parentVal empty vs space vs value for inherit, unset, revert, revert-layer', () => {
    // Unique-cause parentVal T with empty-custom space vs F empty vs T orange,
    // independently on inherit / unset / revert / revert-layer (no previous layer).
    const inheritSpace = child('.p { --x: ; } .t { --x: inherit; color: var(--x, red); }');
    assert.equal(inheritSpace.getPropertyValue('--x'), ' ');
    assert.equal(inheritSpace.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const inheritEmpty = child('.t { --x: inherit; color: var(--x, red); }');
    assert.equal(inheritEmpty.getPropertyValue('--x'), '');
    assert.equal(inheritEmpty.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const inheritVal = child('.p { --x: orange; } .t { --x: inherit; color: var(--x); }');
    assert.equal(inheritVal.getPropertyValue('--x'), 'orange');
    assert.equal(inheritVal.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const unsetSpace = child('.p { --x: ; } .t { --x: unset; color: var(--x, red); }');
    assert.equal(unsetSpace.getPropertyValue('--x'), ' ');
    assert.equal(unsetSpace.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const revertSpace = child('.p { --x: ; } .t { --x: revert; color: var(--x, red); }');
    assert.equal(revertSpace.getPropertyValue('--x'), ' ');
    assert.equal(revertSpace.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const revertVal = child('.p { --x: orange; } .t { --x: revert; color: var(--x); }');
    assert.equal(revertVal.getPropertyValue('--x'), 'orange');
    assert.equal(revertVal.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const layerSpace = child('.p { --x: ; } .t { --x: revert-layer; color: var(--x, red); }');
    assert.equal(layerSpace.getPropertyValue('--x'), ' ');
    assert.equal(layerSpace.getPropertyValue('color'), 'rgb(0, 0, 0)');

    const layerVal = child('.p { --x: orange; } .t { --x: revert-layer; color: var(--x); }');
    assert.equal(layerVal.getPropertyValue('--x'), 'orange');
    assert.equal(layerVal.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const layerEmpty = child('.t { --x: revert-layer; color: var(--x, red); }');
    assert.equal(layerEmpty.getPropertyValue('--x'), '');
    assert.equal(layerEmpty.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // L301 parentCascaded F on the same keywords (root has no parent).
    const atRoot = root('#root { --x: inherit; --y: revert; --z: revert-layer; }');
    assert.equal(atRoot.getPropertyValue('--x'), '');
    assert.equal(atRoot.getPropertyValue('--y'), '');
    assert.equal(atRoot.getPropertyValue('--z'), '');
  });

  test('IACVT continue then CSS-wide previous; extra tokens F; trim comments', () => {
    // Unique-cause L258 F continue onto a previous inherit / revert-rule, not a plain value.
    const iacvtThenInherit = child(
      '.p { --x: orange; } .t { --x: inherit; } .t { --x: var(--missing); color: var(--x); }',
    );
    assert.equal(iacvtThenInherit.getPropertyValue('--x'), 'orange');
    assert.equal(iacvtThenInherit.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const iacvtThenRevertRule = child(
      '.p { --x: orange; } .t { --x: inherit; } .t { --x: revert-rule; color: var(--x); }',
    );
    assert.equal(iacvtThenRevertRule.getPropertyValue('--x'), 'orange');
    assert.equal(iacvtThenRevertRule.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const inlineIacvtInherit = cascade(
      '<html><body><div class="p"><div class="t" style="--x: var(--no)"></div></div></body></html>',
      '.p { --x: orange; } .t { --x: inherit; color: var(--x); }',
      '.t',
    );
    assert.equal(inlineIacvtInherit.getPropertyValue('--x'), 'orange');
    assert.equal(inlineIacvtInherit.getPropertyValue('color'), 'rgb(255, 165, 0)');

    // Unique-cause trimmed === 'inherit' F: extra tokens after inherit.
    const extra = child('.p { --x: orange; } .t { --x: inherit orange; color: var(--x); }');
    assert.equal(extra.getPropertyValue('--x'), 'inherit orange');
    assert.equal(extra.getPropertyValue('color'), 'inherit orange');

    // Unique-cause trim() of surrounding whitespace / comments (parser strips comments).
    const padded = child('.p { --x: orange; } .t { --x:   inherit  ; color: var(--x); }');
    assert.equal(padded.getPropertyValue('--x'), 'orange');
    assert.equal(padded.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const commented = child('.p { --x: orange; } .t { --x: /*c*/ inherit /*d*/; color: var(--x); }');
    assert.equal(commented.getPropertyValue('--x'), 'orange');
    assert.equal(commented.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });

  test('revert-layer skip two unlayered twins then previous lower layer', () => {
    // Unique-cause while layerOrder >= T twice (u1, u2) then F (take @layer a).
    const skipTwo = box(`
      @layer a { .t { --x: from-a; } }
      .t { --x: u1; }
      .t { --x: u2; }
      .t { --x: revert-layer; color: var(--x); }
    `);
    assert.equal(skipTwo.getPropertyValue('--x'), 'from-a');
    assert.equal(skipTwo.getPropertyValue('color'), 'from-a');

    const skipIacvtUnlayered = box(`
      @layer a { .t { --x: from-a; } }
      .t { --x: var(--missing); }
      .t { --x: revert-layer; color: var(--x); }
    `);
    assert.equal(skipIacvtUnlayered.getPropertyValue('--x'), 'from-a');
    assert.equal(skipIacvtUnlayered.getPropertyValue('color'), 'from-a');

    const threeLayers = box(`
      @layer a { .t { --x: from-a; } }
      @layer b { .t { --x: from-b; } }
      @layer c { .t { --x: from-c; } }
      @layer d { .t { --x: revert-layer; color: var(--x); } }
    `);
    assert.equal(threeLayers.getPropertyValue('--x'), 'from-c');
    assert.equal(threeLayers.getPropertyValue('color'), 'from-c');
  });

  test('cyclicProps.has T on the second name of a two-node cycle', () => {
    // Unique-cause L226 T: --a discovers the cycle; --b starts with cyclicProps.has T.
    const two = box('.t { --a: var(--b); --b: var(--a); color: var(--b, lime); background-color: var(--a, teal); }');
    assert.equal(two.getPropertyValue('--a'), '');
    assert.equal(two.getPropertyValue('--b'), '');
    assert.equal(two.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(two.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    const three = box('.t { --a: var(--b); --b: var(--c); --c: var(--a); color: var(--c, red); }');
    assert.equal(three.getPropertyValue('--a'), '');
    assert.equal(three.getPropertyValue('--b'), '');
    assert.equal(three.getPropertyValue('--c'), '');
    assert.equal(three.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('document style tag, important custom, env-only does not take var() keyword path', () => {
    const { document } = parseHTML(
      '<html><head><style>.t { --x: lime; color: var(--x); }</style></head><body><div class="t"></div></body></html>',
    );
    const fromDoc = getCascadedStyle(document.querySelector('.t'));
    assert.ok(fromDoc instanceof CSSStyleDeclaration);
    assert.equal(fromDoc.getPropertyValue('--x'), 'lime');
    assert.equal(fromDoc.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const important = box('.t { --x: lime !important; } .t { --x: red; color: var(--x); }');
    assert.equal(important.getPropertyValue('--x'), 'lime');
    assert.equal(important.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // env() is not var(); L253 F so inherit fallback stays specified env() text.
    const envInherit = child('.p { --x: orange; } .t { --x: env(unknown, inherit); color: var(--x, red); }');
    assert.equal(envInherit.getPropertyValue('--x'), 'env(unknown, inherit)');
    assert.equal(envInherit.getPropertyValue('color'), 'rgb(0, 0, 0)');
  });

  test('duck CSSOM length vs AST declarations do not copy MatchedDeclaration.raw', () => {
    // L248 decl.raw T and L250 typeof value === 'string' F cannot unique-cause:
    // collectMatchedDeclarations / collectInlineDeclarations always stringify
    // into MatchedDeclaration.value and never copy .raw.
    const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
    const el = document.querySelector('.t');
    assert.ok(el);

    const cssom = getCascadedStyle(el, [
      duckStyle('.t', { '--x': 'lime', color: 'var(--x)' }),
    ]);
    assert.equal(cssom.getPropertyValue('--x'), 'lime');
    assert.equal(cssom.getPropertyValue('color'), 'rgb(0, 255, 0)');

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
    // raw 'orange' is dropped; serialized ident lime wins.
    assert.equal(withRaw.getPropertyValue('--x'), 'lime');
    assert.equal(withRaw.getPropertyValue('color'), 'rgb(0, 255, 0)');

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
});
