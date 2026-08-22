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
// Still-hot unique-cause leftovers for src/cascade/variable-resolver.ts
// resolveNodes / resolveCustomProp after tests/mcdc-cascade-vars.test.ts.
// Drive only through getCascadedStyle. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

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

describe('MC/DC still-hot unique-cause: resolveNodes via getCascadedStyle', { concurrency: false }, () => {
  // css-syntax-3 § 5.5.8 #consume-component-value, § 5.5.10 #consume-function
  // css-variables-1 § 4 #resolving-var-functions
  test('function vs ident vs number vs simple-block vs comment vs hash vs percentage', () => {
    // Unique-cause node.type === 'function' T (CSSFunction, has name + array children)
    // vs F (ident / number / simple-block / comment / hash / percentage / string).
    // `"name" in node` F and Array.isArray F cannot unique-cause through parseComponentValues:
    // consume-function always emits {type:'function', name, value: ComponentValue[]}.
    const mixed = box(`
      .t {
        --x: lime;
        --n: 5;
        --v: ident 10px var(--x) (block) /*c*/ #fff 50% "s";
        color: var(--v);
        z-index: var(--n);
        opacity: (var(--n));
      }
    `);
    assert.equal(mixed.getPropertyValue('--v'), 'ident 10px lime (block) /*c*/ #fff 50% "s"');
    assert.equal(mixed.getPropertyValue('color'), 'ident 10px lime (block)  #fff 50% "s"');
    assert.equal(mixed.getPropertyValue('z-index'), '5');
    assert.equal(mixed.getPropertyValue('opacity'), '(5)');

    const onlyFn = box('.t { --c: lime; color: var(--c); }');
    assert.equal(onlyFn.getPropertyValue('color'), 'rgb(0, 255, 0)');
  });

  test('var() name-token length !== 1 with leading brace simple-block', () => {
    // Unique-cause L109 length === 1 F while type === 'simple-block' T and associatedToken `{` T.
    // T,T,T (braced dashed-ident) is in mcdc-cascade-vars; this is the F,T,T pair.
    const extra = box('.t { --theme: lime; --v: var({ --theme } extra, red); color: var(--v); }');
    assert.equal(extra.getPropertyValue('--v'), 'red');
    assert.equal(extra.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const other = box('.t { --theme: lime; --other: blue; --v: var({ --theme } --other); color: var(--v); }');
    assert.equal(other.getPropertyValue('--v'), 'blue');
    assert.equal(other.getPropertyValue('color'), 'rgb(0, 0, 255)');

    const commentExtra = box('.t { --theme: lime; --v: var({ --theme } /*c*/ extra, teal); color: var(--v); }');
    assert.equal(commentExtra.getPropertyValue('--v'), 'teal');
    assert.equal(commentExtra.getPropertyValue('color'), 'rgb(0, 128, 128)');
  });

  test('comments in var() / env() names and fallbacks unique-cause comment filter', () => {
    // Unique-cause t.type !== 'comment' F (filtered) independently of whitespace.
    const varComments = box('.t { --x: lime; color: var(/*c*/ --x /*d*/); background-color: var(--no, /*c*/ teal); }');
    assert.equal(varComments.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(varComments.getPropertyValue('background-color'), 'rgb(0, 128, 128)');

    const braceComments = box('.t { --theme: lime; color: var({ /*c*/ --theme /*d*/ }); }');
    assert.equal(braceComments.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const envComments = box('.t { padding-top: env(/*c*/ safe-area-inset-top /*d*/); padding-right: env(unknown, /*c*/ 12px); }');
    assert.equal(envComments.getPropertyValue('padding-top'), '0px');
    assert.equal(envComments.getPropertyValue('padding-right'), '12px');
  });

  test('!varName fallback resolvedFallback === null T vs F', () => {
    // Unique-cause L121 T: ident is not a dashed-ident, fallback var() is also IACVT.
    const miss = box('.t { color: var(foo, var(--missing)); caret-color: var(123, var(--missing, lime)); outline-color: var(foo, currentcolor); }');
    assert.equal(miss.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(miss.getPropertyValue('caret-color'), 'rgb(0, 255, 0)');
    assert.equal(miss.getPropertyValue('outline-color'), 'currentcolor');
  });

  // css-variables-1 § 4.4 #cycles
  test('cyclicProps.has fallback resolvedFallback === null T vs F', () => {
    // Unique-cause L143 T: --a already cyclic from self-ref; fallback var(--missing) is null.
    const cyclic = box('.t { --a: var(--a); color: var(--a, var(--missing)); background-color: var(--a, lime); }');
    assert.equal(cyclic.getPropertyValue('--a'), '');
    assert.equal(cyclic.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(cyclic.getPropertyValue('background-color'), 'rgb(0, 255, 0)');
  });

  test('custom-prop var() substitution fail fallback resolvedFallback === null T vs F', () => {
    // Unique-cause L170 T: --x raw includes var(), substitution is IACVT, outer fallback also null.
    const via = box('.t { --x: var(--missing); color: var(--x, var(--also)); background-color: var(--x, teal); caret-color: var(--x); }');
    assert.equal(via.getPropertyValue('--x'), '');
    assert.equal(via.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(via.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    assert.equal(via.getPropertyValue('caret-color'), '');
  });

  test('fallback comma lists and nested non-var functions', () => {
    // Unique-cause comma tokens inside fallback lists; funcNameLower === 'var' F with nested var().
    const commas = box('.t { font-family: var(--missing, "A", sans-serif); }');
    assert.equal(commas.getPropertyValue('font-family'), 'A, sans-serif');

    const nested = box('.t { --r: 0; color: rgb(var(--r), var(--missing, 255), 0); }');
    assert.equal(nested.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const calcEnv = box('.t { --g: 3px; height: calc(10px + var(--g) + env(safe-area-inset-top)); }');
    assert.equal(calcEnv.getPropertyValue('height'), 'calc(10px + 3px + 0px)');
  });
});

describe('MC/DC still-hot unique-cause: resolveCustomProp via getCascadedStyle', { concurrency: false }, () => {
  // css-variables-1 § 3.1 #guaranteed-invalid, § 4 #resolving-var-functions
  test('decl.raw missing: plain custom vs var() in custom unique-cause includes(var()', () => {
    // MatchedDeclaration.raw is never copied by collectMatchedDeclarations / collectInlineDeclarations,
    // so L248 decl.raw is always F (includes short-circuits). Unique-cause the value path:
    // rawVal.includes('var(') F (plain) vs T (var in custom).
    const plain = box('.t { --plain: 10px; --ref: var(--plain); width: var(--plain); height: var(--ref); }');
    assert.equal(plain.getPropertyValue('--plain'), '10px');
    assert.equal(plain.getPropertyValue('--ref'), '10px');
    assert.equal(plain.getPropertyValue('width'), '10px');
    assert.equal(plain.getPropertyValue('height'), '10px');

    const envOnly = box('.t { --x: env(safe-area-inset-top); padding-top: var(--x); }');
    assert.equal(envOnly.getPropertyValue('--x'), 'env(safe-area-inset-top)');
    assert.equal(envOnly.getPropertyValue('padding-top'), '0px');
  });

  test('IACVT continue cyclicProps.has F vs cycle return, empty subVal, parent inherit', () => {
    // Unique-cause L258 F: winning decl is IACVT but not cyclic → continue to previous cascade decl.
    const rollback = box('.t { --x: orange; } .t { --x: var(--missing); color: var(--x); }');
    assert.equal(rollback.getPropertyValue('--x'), 'orange');
    assert.equal(rollback.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const three = box('.t { --x: red; } .t { --x: orange; } .t { --x: var(--no); color: var(--x); }');
    assert.equal(three.getPropertyValue('--x'), 'orange');
    assert.equal(three.getPropertyValue('color'), 'rgb(255, 165, 0)');

    const inline = cascade(
      '<html><body><div class="t" style="--x: var(--no)"></div></body></html>',
      '.t { --x: orange; color: var(--x); }',
      '.t',
    );
    assert.equal(inline.getPropertyValue('--x'), 'orange');
    assert.equal(inline.getPropertyValue('color'), 'rgb(255, 165, 0)');

    // Unique-cause L258 T remains cycle (no continue): --a empty, fallback on the use site.
    const cycle = box('.t { --a: var(--a); color: var(--a, lime); }');
    assert.equal(cycle.getPropertyValue('--a'), '');
    assert.equal(cycle.getPropertyValue('color'), 'rgb(0, 255, 0)');

    // Unique-cause L294 subVal === '' T: empty fallback substitutes to '' then stored as space.
    const emptyFb = box('.t { --x: var(--missing,); color: var(--x, red); background-color: var(--x); }');
    assert.equal(emptyFb.getPropertyValue('--x'), ' ');
    assert.equal(emptyFb.getPropertyValue('color'), 'rgb(0, 0, 0)');
    assert.equal(emptyFb.getPropertyValue('background-color'), 'rgba(0, 0, 0, 0)');

    // Unique-cause L301 parentCascaded F: root IACVT falls through to inherit with no parent.
    const atRoot = root('#root { --x: var(--missing); color: var(--x, red); }');
    assert.equal(atRoot.getPropertyValue('--x'), '');
    assert.equal(atRoot.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // Unique-cause L302 parentVal F: child IACVT, parent has no --x.
    const noParentVal = child('.t { --x: var(--missing); color: var(--x, red); }');
    assert.equal(noParentVal.getPropertyValue('--x'), '');
    assert.equal(noParentVal.getPropertyValue('color'), 'rgb(255, 0, 0)');

    // decls F path: inherited custom with no local declaration.
    const inherited = child('.p { --x: orange; } .t { color: var(--x); }');
    assert.equal(inherited.getPropertyValue('--x'), 'orange');
    assert.equal(inherited.getPropertyValue('color'), 'rgb(255, 165, 0)');

    // IACVT local then inherit parentVal T.
    const inheritAfterIacvt = child('.p { --x: orange; } .t { --x: var(--missing); color: var(--x); }');
    assert.equal(inheritAfterIacvt.getPropertyValue('--x'), 'orange');
    assert.equal(inheritAfterIacvt.getPropertyValue('color'), 'rgb(255, 165, 0)');
  });
});
