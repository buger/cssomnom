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
// Round-4 leftover unique-cause for src/cascade/variable-resolver.ts
// resolveNodes after tests/mcdc-cascade-vars.test.ts,
// tests/mcdc-variable-resolver-still-hot-unique-cause.test.ts, and
// tests/mcdc-resolve-nodes-round3-unique-cause.test.ts
// (33/37 D, 41/46 C, 4 incomplete). Hottest remaining seam L69
// "name" in node / Array.isArray(...); also L112/L115 typeof string F
// and L131 idx !== -1 F. Drive getCascadedStyle + linkedom + real CSS
// var()/env(). L69 Array.isArray F injects through
// Parser.prototype.parseComponentValues only while substituteVariables
// is on the stack (css-syntax-3 § 5.5.10 always emits CSSFunction
// {name, value:[]}; FunctionToken never appears — not getter mutation).
// No //mcdc:ignore.
import { afterEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { Parser, parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleSheet } from '../src/CSSOM.ts';
import type { ComponentValue, CSSFunction, Rule, SimpleBlock, Token } from '../src/types.ts';

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

const origParseComponentValues = Parser.prototype.parseComponentValues;

function restoreParse(): void {
  Parser.prototype.parseComponentValues = origParseComponentValues;
}

function inSubstituteVariables(): boolean {
  return (new Error().stack ?? '').includes('substituteVariables');
}

function withVarAst(map: (values: ComponentValue[]) => ComponentValue[], fn: () => void): void {
  Parser.prototype.parseComponentValues = function (this: Parser): ComponentValue[] {
    const values = origParseComponentValues.call(this);
    if (!inSubstituteVariables()) return values;
    return map(values);
  };
  try {
    fn();
  } finally {
    restoreParse();
  }
}

function mapFns(values: ComponentValue[], mapFn: (fn: CSSFunction) => ComponentValue): ComponentValue[] {
  return values.map((v) => {
    if (v.type === 'function' && 'name' in v) {
      const fn = v as CSSFunction;
      return mapFn({ ...fn, value: mapFns(fn.value, mapFn) });
    }
    if (v.type === 'simple-block') {
      const block = v as SimpleBlock;
      return { ...block, value: mapFns(block.value, mapFn) };
    }
    return v;
  });
}

function isVarOrEnv(fn: CSSFunction): boolean {
  const lower = fn.name.toLowerCase();
  return lower === 'var' || lower === 'env';
}

// L69 T,T,F: type function, name present, Array.isArray(value) F.
// serialize of name+empty-string value is `var()` / `env()` (cssom-1 #serialize-a-css-component-value).
function nameNoArray(fn: CSSFunction): ComponentValue {
  if (!isVarOrEnv(fn)) return fn;
  return { type: 'function', name: fn.name, value: '' } as unknown as ComponentValue;
}

// L69 `"name" in node` F evaluated (type T). JS && short-circuits Array.isArray.
// Empty-array value serializes as `(` via serializeToken function arm.
function namelessEmpty(fn: CSSFunction): ComponentValue {
  if (!isVarOrEnv(fn)) return fn;
  return { type: 'function', value: [] } as unknown as ComponentValue;
}

// FunctionToken shape (css-syntax-3 § 4.3.7 #consume-a-function): type function, value is the name string, no `name`.
function functionToken(fn: CSSFunction): ComponentValue {
  if (!isVarOrEnv(fn)) return fn;
  return { type: 'function', value: fn.name } as unknown as ComponentValue;
}

function smashIdentValues(values: ComponentValue[]): ComponentValue[] {
  return values.map((v) => {
    if (v.type === 'ident') {
      const val = (v as Token).value;
      if (typeof val === 'string' && val.startsWith('--')) {
        return { type: 'ident', value: 123 } as unknown as ComponentValue;
      }
    }
    if (v.type === 'function' && 'name' in v) {
      const fn = v as CSSFunction;
      return { ...fn, value: smashIdentValues(fn.value) };
    }
    if (v.type === 'simple-block') {
      const block = v as SimpleBlock;
      return { ...block, value: smashIdentValues(block.value) };
    }
    return v;
  });
}

describe('MC/DC leftover unique-cause: resolveNodes L69 Array.isArray via getCascadedStyle', { concurrency: false }, () => {
  afterEach(() => {
    restoreParse();
  });

  // css-syntax-3 § 5.5.8 #consume-component-value, § 5.5.10 #consume-function
  // css-variables-1 § 4 #resolving-var-functions
  // css-env-1 § 3.1 #syntax-of-env
  test('L69 T,T,T real CSS var/env/VAR/ENV vs type F ident/url/hash', () => {
    const mixed = box(`
      .t {
        --c: lime;
        color: var(--c);
        background-color: VAR(--c);
        caret-color: ident;
        outline-color: #00ff00;
        list-style-image: url(foo.png);
        padding-top: env(safe-area-inset-top);
        padding-right: ENV(safe-area-inset-right, 99px);
        padding-bottom: env(unknown, 8px);
      }
    `);
    assert.equal(mixed.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(mixed.getPropertyValue('background-color'), 'rgb(0, 255, 0)');
    assert.equal(mixed.getPropertyValue('caret-color'), 'ident');
    assert.equal(mixed.getPropertyValue('outline-color'), 'rgb(0, 255, 0)');
    assert.equal(mixed.getPropertyValue('list-style-image'), 'url("foo.png")');
    assert.equal(mixed.getPropertyValue('padding-top'), '0px');
    assert.equal(mixed.getPropertyValue('padding-right'), '0px');
    assert.equal(mixed.getPropertyValue('padding-bottom'), '8px');

    const fallback = box('.t { color: var(--missing, red); }');
    assert.equal(fallback.getPropertyValue('color'), 'rgb(255, 0, 0)');
  });

  test('L69 T,T,F Array.isArray F with name T: var()/env() not substituted', () => {
    // Unique-cause Array.isArray F while type === 'function' T and "name" in node T.
    // consume-function never emits this; stack-discriminated wrap only rewrites
    // parseComponentValues from substituteVariables (selector parse stays intact).
    withVarAst((values) => mapFns(values, nameNoArray), () => {
      const miss = box('.t { color: var(--missing, red); background-color: var(--c); }');
      assert.equal(miss.getPropertyValue('color'), 'var()');
      assert.equal(miss.getPropertyValue('background-color'), 'var()');

      const known = box('.t { --c: lime; color: var(--c); }');
      assert.equal(known.getPropertyValue('--c'), 'lime');
      assert.equal(known.getPropertyValue('color'), 'var()');

      const envKnown = box('.t { padding-top: env(safe-area-inset-top); padding-right: env(unknown, 8px); }');
      assert.equal(envKnown.getPropertyValue('padding-top'), 'env()');
      assert.equal(envKnown.getPropertyValue('padding-right'), 'env()');

      const inRgb = box('.t { color: rgb(var(--missing, 0), 255, 0); }');
      assert.equal(inRgb.getPropertyValue('color'), 'rgb(var(), 255, 0)');

      const inCalc = box('.t { --g: 3px; width: calc(var(--g)); }');
      assert.equal(inCalc.getPropertyValue('width'), 'calc(var())');

      const block = box('.t { --z: 1; z-index: (var(--z)); opacity: [var(--z)]; }');
      assert.equal(block.getPropertyValue('z-index'), '(var())');
      assert.equal(block.getPropertyValue('opacity'), '[var()]');

      const inherited = child('.p { --c: lime; } .t { color: var(--c); }');
      assert.equal(inherited.getPropertyValue('color'), 'var()');

      const inline = cascade(
        '<html><body><div class="t" style="--c: lime; color: var(--c)"></div></body></html>',
        '',
        '.t',
      );
      assert.equal(inline.getPropertyValue('--c'), 'lime');
      assert.equal(inline.getPropertyValue('color'), 'var()');
    });
  });

  test('L69 "name" in node F evaluated: nameless empty-array function', () => {
    // Unique-cause "name" in node F with type T. JS && skips Array.isArray.
    // T,F,T is impossible under short-circuit; this is T,F,skipped vs T,T,T.
    withVarAst((values) => mapFns(values, namelessEmpty), () => {
      const miss = box('.t { color: var(--missing, red); }');
      assert.equal(miss.getPropertyValue('color'), '(');

      const known = box('.t { --c: lime; color: var(--c); }');
      assert.equal(known.getPropertyValue('color'), '(');

      const envKnown = box('.t { padding-top: env(safe-area-inset-top); padding-right: env(unknown, 8px); }');
      assert.equal(envKnown.getPropertyValue('padding-top'), '(');
      assert.equal(envKnown.getPropertyValue('padding-right'), '(');

      const inRgb = box('.t { color: rgb(var(--missing, 0), 255, 0); }');
      assert.equal(inRgb.getPropertyValue('color'), 'rgb((, 255, 0)');

      const block = box('.t { --z: 1; z-index: (var(--z)); opacity: [var(--z)]; }');
      assert.equal(block.getPropertyValue('z-index'), '(()');
      assert.equal(block.getPropertyValue('opacity'), '[(]');

      const inline = cascade(
        '<html><body><div class="t" style="color: var(--c, red)"></div></body></html>',
        '',
        '.t',
      );
      assert.equal(inline.getPropertyValue('color'), '(');
    });
  });

  test('L69 FunctionToken mute + selector parse not rewritten', () => {
    // FunctionToken {type:'function', value:name} is T,F,skipped — same short-circuit
    // as nameless, not unique-cause of Array.isArray (value is a string).
    withVarAst((values) => mapFns(values, functionToken), () => {
      const color = box('.t { --c: lime; color: var(--c); }');
      assert.equal(color.getPropertyValue('color'), 'var(');
      assert.equal(color.getPropertyValue('--c'), 'lime');

      const env = box('.t { padding-top: env(safe-area-inset-top); }');
      assert.equal(env.getPropertyValue('padding-top'), 'env(');
    });

    // Stack-discriminate: .t still matches while substituteVariables wrap is live.
    withVarAst((values) => mapFns(values, nameNoArray), () => {
      const nested = cascade(
        '<html><body><div class="t"><span class="inner"></span></div></body></html>',
        '.t { --c: lime; color: var(--c); } .inner { color: var(--c); }',
        '.inner',
      );
      assert.equal(nested.getPropertyValue('color'), 'var()');
    });
  });

  test('L69 T,T,F through replaceSync and document style', () => {
    withVarAst((values) => mapFns(values, nameNoArray), () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('.t { --c: lime; color: var(--c); padding-top: env(safe-area-inset-top); }');
      const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
      const el = document.querySelector('.t');
      assert.ok(el);
      const fromSheet = getCascadedStyle(el, [sheet.cssRules[0] as unknown as Rule]);
      assert.equal(fromSheet.getPropertyValue('color'), 'var()');
      assert.equal(fromSheet.getPropertyValue('padding-top'), 'env()');

      const { document: doc2 } = parseHTML(
        '<html><head><style>.t { --c: teal; color: var(--c); }</style></head><body><div class="t"></div></body></html>',
      );
      const docEl = doc2.querySelector('.t');
      assert.ok(docEl);
      const fromDoc = getCascadedStyle(docEl);
      assert.ok(fromDoc instanceof CSSStyleDeclaration);
      assert.equal(fromDoc.getPropertyValue('color'), 'var()');
    });
  });
});

describe('MC/DC leftover unique-cause: resolveNodes L112 / L115 / L131 mute via getCascadedStyle', { concurrency: false }, () => {
  afterEach(() => {
    restoreParse();
  });

  // css-syntax-3 § 5.5.8 #consume-component-value
  // css-variables-1 § 4 #resolving-var-functions, § 4.4 #cycles
  test('L112/L115 ident typeof string: dashed-ident T vs smash ident F (typeof F unpairable)', () => {
    // find() already requires typeof value === 'string' && startsWith('--'),
    // so ident T implies typeof T. Unique-cause typeof F needs ident T.
    const dashed = box('.t { --theme: lime; color: var(--theme); background-color: var({ --theme }); }');
    assert.equal(dashed.getPropertyValue('color'), 'rgb(0, 255, 0)');
    assert.equal(dashed.getPropertyValue('background-color'), 'rgb(0, 255, 0)');

    const notIdent = box(`
      .t {
        color: var(" --theme ", red);
        background-color: var(123, teal);
        caret-color: var(#--x, orange);
        outline-color: var(theme(), lime);
      }
    `);
    assert.equal(notIdent.getPropertyValue('color'), 'rgb(255, 0, 0)');
    assert.equal(notIdent.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    assert.equal(notIdent.getPropertyValue('caret-color'), 'rgb(255, 165, 0)');
    assert.equal(notIdent.getPropertyValue('outline-color'), 'rgb(0, 255, 0)');

    // Numeric ident.value: find fails (typeof F inside find), so ident F and
    // the if's typeof is skipped — not ident T + typeof F.
    withVarAst((values) => smashIdentValues(values), () => {
      const smashed = box('.t { --theme: lime; color: var(--theme, red); background-color: var({ --theme }, teal); }');
      assert.equal(smashed.getPropertyValue('color'), 'rgb(255, 0, 0)');
      assert.equal(smashed.getPropertyValue('background-color'), 'rgb(0, 128, 128)');
    });
  });

  test('L131 idx !== -1 T on self and multi-node cycles; F unpairable', () => {
    // resolvingStack.has(varName) T implies Array.from(stack).indexOf !== -1.
    const self = box('.t { --a: var(--a); color: var(--a, lime); }');
    assert.equal(self.getPropertyValue('--a'), '');
    assert.equal(self.getPropertyValue('color'), 'rgb(0, 255, 0)');

    const two = box('.t { --a: var(--b); --b: var(--a); color: var(--a, teal); }');
    assert.equal(two.getPropertyValue('--a'), '');
    assert.equal(two.getPropertyValue('--b'), '');
    assert.equal(two.getPropertyValue('color'), 'rgb(0, 128, 128)');

    const three = box('.t { --a: var(--b); --b: var(--c); --c: var(--a); color: var(--c, red); }');
    assert.equal(three.getPropertyValue('--a'), '');
    assert.equal(three.getPropertyValue('--b'), '');
    assert.equal(three.getPropertyValue('--c'), '');
    assert.equal(three.getPropertyValue('color'), 'rgb(255, 0, 0)');

    const unusedFb = box('.t { --a: var(--a, lime); color: var(--a, teal); }');
    assert.equal(unusedFb.getPropertyValue('--a'), '');
    assert.equal(unusedFb.getPropertyValue('color'), 'rgb(0, 128, 128)');
  });
});
