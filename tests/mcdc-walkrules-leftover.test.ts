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
// Leftover unique-cause for src/cascade/rule-filter.ts walkRules besides
// tests/mcdc-hotspot-math-walk.test.ts. Drive getCascadedStyle and the
// exported collectMatchedDeclarations. css-cascade-5 § 2 #filtering,
// mediaqueries-4 § 3.2 #evaluating-mq-list, css-nesting-1 § 4.1.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../src/parser.ts';
import { parse, parseRuleInBlock } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { collectMatchedDeclarations, getCascadedStyle } from '../src/cascade.ts';
import {
  CSSRule,
  CSSStyleRule,
  CSSLayerBlockRule,
  CSSNestedDeclarations,
  CSSScopeRule,
} from '../src/CSSOM.ts';
import type { ASTAtRule, ComponentValue, Rule } from '../src/types.ts';

function makeDiv(
  html = '<html><body><div id="el" class="t" title="a,b"></div></body></html>',
): { document: Document; el: Element } {
  const { document } = parseHTML(html);
  const el = document.querySelector('div');
  assert.ok(el);
  return { document, el };
}

function decls(css: string) {
  return ParseHooks.parseStyleAttribute(tokenize(css)).declarations;
}

function styleRule(selector: string, css: string): CSSStyleRule {
  return new CSSStyleRule(selector, decls(css), [], parseRuleInBlock);
}

function numberTokens(n: number): ComponentValue[] {
  return tokenize(String(n)).filter((t) => t.type !== 'EOF') as ComponentValue[];
}

function duckStyleRule(selector: string, style: object): Rule {
  return {
    type: CSSRule.STYLE_RULE,
    selectorText: selector,
    style,
  } as unknown as Rule;
}

describe('MC/DC leftover unique-cause: walkRules besides existing walk tests', { concurrency: false }, () => {
  // css-cascade-5 § 2 #filtering, selectors-4 § 17 #specificity
  test('comma lists unique-cause maxSpecificity null vs compareSpecificity > 0', () => {
    const { el } = makeDiv();
    const emptyMap = new Map<string, number>();

    const firstOnly = collectMatchedDeclarations(
      el,
      [styleRule('span, .t', 'z-index: 1')],
      emptyMap,
      null,
    );
    const firstZ = firstOnly.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(firstZ);
    assert.deepEqual(firstZ.specificity, [0, 1, 0]);

    const higherSecond = collectMatchedDeclarations(
      el,
      [styleRule('div, #el', 'z-index: 1')],
      emptyMap,
      null,
    );
    const highZ = higherSecond.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(highZ);
    assert.deepEqual(highZ.specificity, [1, 0, 0]);

    const lowerSecond = collectMatchedDeclarations(
      el,
      [styleRule('#el, div', 'z-index: 1')],
      emptyMap,
      null,
    );
    const keptId = lowerSecond.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(keptId);
    assert.deepEqual(keptId.specificity, [1, 0, 0]);

    const equalSecond = collectMatchedDeclarations(
      el,
      [styleRule('.t, [class=t]', 'z-index: 1')],
      emptyMap,
      null,
    );
    const equalZ = equalSecond.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(equalZ);
    assert.deepEqual(equalZ.specificity, [0, 1, 0]);

    assert.equal(getCascadedStyle(el, parse('div, #el { z-index: 1 } .t { z-index: 2 }').cssRules).getPropertyValue('z-index'), '1');
    assert.equal(getCascadedStyle(el, parse('#el, div { z-index: 1 } .t { z-index: 2 }').cssRules).getPropertyValue('z-index'), '1');
    assert.equal(getCascadedStyle(el, parse('div, span { z-index: 1 } .t { z-index: 2 }').cssRules).getPropertyValue('z-index'), '2');
  });

  test('duck style unique-cause length >= 0, non-string value, declarations array, missing block', () => {
    const { el } = makeDiv();

    const skipArray = duckStyleRule('div', {
      length: 0,
      declarations: [
        { type: 'declaration', name: 'z-index', value: numberTokens(9), important: false },
      ],
    });
    assert.equal(getCascadedStyle(el, [skipArray]).getPropertyValue('z-index'), '');

    const negativeLen = duckStyleRule('div', {
      length: -1,
      declarations: [
        { type: 'declaration', name: 'z-index', value: numberTokens(4), important: false },
      ],
    });
    assert.equal(getCascadedStyle(el, [negativeLen]).getPropertyValue('z-index'), '4');

    const notArray = duckStyleRule('div', {
      length: -1,
      declarations: 'z-index: 7',
    });
    assert.equal(getCascadedStyle(el, [notArray]).getPropertyValue('z-index'), '');

    const noLengthNotArray = duckStyleRule('div', { declarations: { name: 'z-index' } });
    assert.equal(getCascadedStyle(el, [noLengthNotArray]).getPropertyValue('order'), '');

    const tokenValue = duckStyleRule('div', {
      length: 1,
      item() {
        return 'z-index';
      },
      getPropertyValue() {
        return numberTokens(8);
      },
      getPropertyPriority() {
        return 'important';
      },
    });
    const tokenStyle = getCascadedStyle(el, [tokenValue]);
    assert.equal(tokenStyle.getPropertyValue('z-index'), '8');

    const stringValue = duckStyleRule('div', {
      length: 1,
      0: 'opacity',
      opacity: '0.25',
    });
    assert.equal(getCascadedStyle(el, [stringValue]).getPropertyValue('opacity'), '0.25');

    const matchingNoStyle: Rule = { type: 'style-rule', selectorText: 'div' } as unknown as Rule;
    assert.equal(getCascadedStyle(el, [matchingNoStyle]).getPropertyValue('z-index'), '');

    const emptyBlock: Rule = {
      type: 'qualified-rule',
      selectorText: 'div',
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' } },
    } as unknown as Rule;
    assert.equal(getCascadedStyle(el, [emptyBlock]).getPropertyValue('z-index'), '');

    const baseline = duckStyleRule('div', {
      length: 1,
      0: 'order',
      order: '3',
    });
    assert.equal(getCascadedStyle(el, [matchingNoStyle, emptyBlock, baseline]).getPropertyValue('order'), '3');
  });

  test('layer name ternary unique-cause without _assignedLayerName', () => {
    const { el } = makeDiv();
    const innerAnon = new CSSLayerBlockRule('', [styleRule('.t', 'z-index: 1; opacity: 0.1')], parseRuleInBlock);
    const innerNamed = new CSSLayerBlockRule('inner', [styleRule('.t', 'z-index: 2; order: 6')], parseRuleInBlock);
    const outer = new CSSLayerBlockRule('outer', [innerAnon, innerNamed], parseRuleInBlock);
    const order = new Map<string, number>([
      ['outer', 1],
      ['outer.inner', 2],
    ]);
    const nested = collectMatchedDeclarations(el, [outer], order, null);
    const z = nested.matchedDeclarations.filter((d) => d.name === 'z-index');
    assert.equal(z.length, 2);
    assert.equal(z[0].value, '1');
    assert.equal(z[0].layerOrder, 1);
    assert.equal(z[1].value, '2');
    assert.equal(z[1].layerOrder, 2);
    assert.equal(getCascadedStyle(el, [outer]).getPropertyValue('z-index'), '2');

    const topNamed = new CSSLayerBlockRule('solo', [styleRule('.t', 'z-index: 4')], parseRuleInBlock);
    const namedOnly = collectMatchedDeclarations(el, [topNamed], new Map([['solo', 5]]), null);
    const namedZ = namedOnly.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(namedZ);
    assert.equal(namedZ.layerOrder, 5);

    const topAnon = new CSSLayerBlockRule('', [styleRule('.t', 'z-index: 7')], parseRuleInBlock);
    const anonOnly = collectMatchedDeclarations(el, [topAnon], new Map(), null);
    const anonZ = anonOnly.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(anonZ);
    assert.equal(anonZ.layerOrder, Infinity);

    const astInner: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('kid').filter((t) => t.type !== 'EOF'),
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: [] },
      childRules: [styleRule('.t', 'isolation: isolate') as unknown as Rule],
    };
    const astOuter: ASTAtRule = {
      type: 'at-rule',
      name: 'layer',
      prelude: tokenize('parent').filter((t) => t.type !== 'EOF'),
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: [] },
      childRules: [astInner as unknown as Rule],
    };
    // ASTAtRule.name is the at-keyword (`layer`), so the walkRules rawName
    // fallback cannot see the prelude; nested AST layers compose `layer.layer`.
    const astMatched = collectMatchedDeclarations(
      el,
      [astOuter as unknown as Rule],
      new Map([['layer.layer', 3]]),
      null,
    );
    const iso = astMatched.matchedDeclarations.find((d) => d.name === 'isolation');
    assert.ok(iso);
    assert.equal(iso.layerOrder, 3);
    assert.equal(iso.value, 'isolate');
  });

  test('@media env unique-cause NaN, missing frame size, empty style, portrait vs landscape', () => {
    const mq = parse(`
      .t { z-index: 0; }
      @media (min-width: 700px) { .t { z-index: 7; } }
      @media (max-width: 400px) { .t { z-index: 2; } }
      @media (orientation: portrait) { .t { order: 1; } }
      @media (orientation: landscape) { .t { order: 2; } }
      @media (min-height: 500px) { .t { opacity: 0.5; } }
    `);

    const classDiv = (view: object) => ({
      nodeType: 1 as const,
      tagName: 'DIV',
      localName: 'div',
      className: 't',
      classList: { contains(c: string) { return c === 't'; } },
      getAttribute(name: string) {
        return name === 'class' ? 't' : null;
      },
      hasAttribute(name: string) {
        return name === 'class';
      },
      parentElement: null,
      parentNode: null,
      ownerDocument: { defaultView: view },
    });
    const styleOf = (view: object) => getCascadedStyle(classDiv(view), mq.cssRules);

    const nanWidth = styleOf({ innerWidth: Number.NaN, innerHeight: 600 });
    assert.equal(nanWidth.getPropertyValue('z-index'), '7');
    assert.equal(nanWidth.getPropertyValue('order'), '2');

    const finiteWidth = styleOf({ innerWidth: 300, innerHeight: Number.NaN });
    assert.equal(finiteWidth.getPropertyValue('z-index'), '2');
    assert.equal(finiteWidth.getPropertyValue('opacity'), '0.5');

    const portrait = styleOf({ innerWidth: 320, innerHeight: 800 });
    assert.equal(portrait.getPropertyValue('order'), '1');
    assert.equal(portrait.getPropertyValue('z-index'), '2');

    const square = styleOf({ innerWidth: 800, innerHeight: 800 });
    assert.equal(square.getPropertyValue('order'), '1');
    assert.equal(square.getPropertyValue('z-index'), '7');

    const landscape = styleOf({ innerWidth: 900, innerHeight: 400 });
    assert.equal(landscape.getPropertyValue('order'), '2');

    const attrOnly = styleOf({
      innerWidth: 100,
      innerHeight: 100,
      frameElement: {
        getAttribute(name: string) {
          return name === 'width' ? '800' : name === 'height' ? '200' : null;
        },
      },
    });
    assert.equal(attrOnly.getPropertyValue('z-index'), '7');
    assert.equal(attrOnly.getPropertyValue('order'), '2');

    const numericNoStyle = styleOf({
      innerWidth: 100,
      innerHeight: 100,
      frameElement: { style: {}, width: 750, height: 100 },
    });
    assert.equal(numericNoStyle.getPropertyValue('z-index'), '7');
    assert.equal(numericNoStyle.getPropertyValue('order'), '2');

    const emptyFrame = styleOf({
      innerWidth: 100,
      innerHeight: 100,
      frameElement: { style: {} },
    });
    assert.equal(emptyFrame.getPropertyValue('z-index'), '2');
    assert.equal(emptyFrame.getPropertyValue('order'), '1');

    const badParse = styleOf({
      innerWidth: 100,
      innerHeight: 600,
      frameElement: { style: { width: 'nope', height: '0px' } },
    });
    assert.equal(badParse.getPropertyValue('z-index'), '2');
    assert.equal(badParse.getPropertyValue('opacity'), '0.5');
    assert.equal(badParse.getPropertyValue('order'), '1');

    const negWidth = styleOf({
      innerWidth: 100,
      innerHeight: 600,
      frameElement: { style: { width: '-10px', height: 'abc' } },
    });
    assert.equal(negWidth.getPropertyValue('z-index'), '2');
    assert.equal(negWidth.getPropertyValue('opacity'), '0.5');
    assert.equal(negWidth.getPropertyValue('order'), '1');
  });

  test('@scope isElement false, missing closest, and implied-scope non-element', () => {
    const { el, document } = makeDiv(
      '<html><body><div class="card"><p class="inner t"></p></div></body></html>',
    );
    const inner = document.querySelector('.inner');
    assert.ok(inner);

    const scoped = parse(`
      @scope (.card) {
        .inner { order: 9; isolation: isolate; }
      }
      .t { z-index: 1; }
    `);
    const inCard = getCascadedStyle(inner, scoped.cssRules);
    assert.equal(inCard.getPropertyValue('order'), '9');
    assert.equal(inCard.getPropertyValue('isolation'), 'isolate');
    assert.equal(inCard.getPropertyValue('z-index'), '1');

    const notElement = { ownerDocument: { defaultView: document.defaultView } };
    assert.equal(getCascadedStyle(notElement, scoped.cssRules).getPropertyValue('order'), '');
    assert.equal(getCascadedStyle(notElement, scoped.cssRules).getPropertyValue('z-index'), '');

    const duckNoClosest = {
      nodeType: 1,
      tagName: 'P',
      localName: 'p',
      className: 'inner t',
      classList: { contains(c: string) { return c === 'inner' || c === 't'; } },
      getAttribute(name: string) {
        if (name === 'class') return 'inner t';
        return null;
      },
      hasAttribute(name: string) {
        return name === 'class';
      },
      parentElement: null,
      parentNode: null,
      ownerDocument: { defaultView: document.defaultView },
    };
    const duckStyle = getCascadedStyle(duckNoClosest, scoped.cssRules);
    assert.equal(duckStyle.getPropertyValue('z-index'), '1');
    assert.equal(duckStyle.getPropertyValue('order'), '');
    assert.equal(duckStyle.getPropertyValue('isolation'), 'auto');

    const implied = new CSSScopeRule(null, null, [new CSSNestedDeclarations(decls('z-index: 4'))], parseRuleInBlock);
    const impliedOnEl = collectMatchedDeclarations(el, [implied], new Map(), null);
    const impliedZ = impliedOnEl.matchedDeclarations.find((d) => d.name === 'z-index');
    assert.ok(impliedZ);
    assert.deepEqual(impliedZ.specificity, [0, 0, 0]);
    assert.equal(impliedZ.value, '4');

    const impliedMiss = collectMatchedDeclarations(notElement, [implied], new Map(), null);
    assert.equal(impliedMiss.matchedDeclarations.length, 0);

    const startMiss = new CSSScopeRule('(.missing)', null, [styleRule('.t', 'order: 8')], parseRuleInBlock);
    const startOnDuck = collectMatchedDeclarations(duckNoClosest, [startMiss], new Map(), null);
    assert.equal(startOnDuck.matchedDeclarations.length, 0);
  });

  test('CSSNestedDeclarations pseudoElement startsWith(::) unique-cause via collectMatchedDeclarations', () => {
    const { el, document } = makeDiv();
    const nested = new CSSNestedDeclarations(decls('opacity: 0.4; z-index: 3'));
    const host = new CSSStyleRule('.t::before', decls('content: "x"'), [nested], parseRuleInBlock);
    const emptyMap = new Map<string, number>();

    const double = collectMatchedDeclarations(el, [host], emptyMap, '::before');
    assert.equal(double.matchedDeclarations.find((d) => d.name === 'opacity')?.value, '0.4');

    const single = collectMatchedDeclarations(el, [host], emptyMap, ':before');
    assert.equal(single.matchedDeclarations.find((d) => d.name === 'opacity')?.value, '0.4');
    assert.equal(single.matchedDeclarations.find((d) => d.name === 'z-index')?.value, '3');

    const bare = collectMatchedDeclarations(el, [host], emptyMap, 'before');
    assert.equal(bare.matchedDeclarations.find((d) => d.name === 'opacity')?.value, '0.4');

    const other = collectMatchedDeclarations(el, [host], emptyMap, ':after');
    assert.equal(other.matchedDeclarations.find((d) => d.name === 'opacity'), undefined);

    assert.notEqual(getCascadedStyle(el, [host], 'before').getPropertyValue('opacity'), '0.4');
    assert.equal(getCascadedStyle(el, [host], '::before').getPropertyValue('opacity'), '0.4');
    assert.notEqual(getCascadedStyle(document.documentElement, [host], '::before').getPropertyValue('opacity'), '0.4');
  });

  test('splitSelectorList leftover: escapes, empty commas, braces, extra closers, quotes', () => {
    const { el } = makeDiv(
      '<html><body><div class="t" title="a&quot;b,c" data-x="{,}" data-q="p"></div></body></html>',
    );

    const escaped = styleRule('.t, [title="a\\"b,c"]', 'z-index: 2');
    assert.equal(getCascadedStyle(el, [escaped]).getPropertyValue('z-index'), '2');

    const trailingEscape = styleRule('.t, [title="x\\', 'order: 5');
    assert.equal(getCascadedStyle(el, [trailingEscape]).getPropertyValue('order'), '5');

    const emptyComma = styleRule('.t, , div', 'opacity: 0.3');
    assert.equal(getCascadedStyle(el, [emptyComma]).getPropertyValue('opacity'), '0.3');

    const extraCloser = styleRule('div), .t', 'isolation: isolate');
    assert.equal(getCascadedStyle(el, [extraCloser]).getPropertyValue('isolation'), 'isolate');

    const braces = styleRule('.t, [data-x="{,}"]', 'caret-color: rgb(255, 0, 0)');
    assert.equal(getCascadedStyle(el, [braces]).getPropertyValue('caret-color'), 'rgb(255, 0, 0)');

    const singles = styleRule("[data-q='p,q'], .t", 'z-index: 8');
    assert.equal(getCascadedStyle(el, [singles]).getPropertyValue('z-index'), '8');

    const emptySel = styleRule('', 'z-index: 1');
    assert.equal(getCascadedStyle(el, [emptySel]).getPropertyValue('z-index'), '');
  });

  test('nested qualified-rule / at-rule objects inside block.value without cssRules', () => {
    const { document } = parseHTML('<html><body><div class="host"><span class="inner t"></span></div></body></html>');
    const inner = document.querySelector('.inner');
    assert.ok(inner);

    const nestedQual: Rule = {
      type: 'qualified-rule',
      prelude: tokenize('.inner').filter((t) => t.type !== 'EOF'),
      block: {
        type: 'simple-block',
        associatedToken: { type: '{', value: '{' },
        value: tokenize('z-index: 9;').filter((t) => t.type !== 'EOF'),
      },
    } as unknown as Rule;

    const nestedMedia: ASTAtRule = {
      type: 'at-rule',
      name: 'media',
      prelude: tokenize('all').filter((t) => t.type !== 'EOF'),
      block: { type: 'simple-block', associatedToken: { type: '{', value: '{' }, value: [] },
      childRules: [styleRule('.inner', 'opacity: 0.4') as unknown as Rule],
    };

    const outer: Rule = {
      type: 'qualified-rule',
      selectorText: 'div.host',
      style: { length: 0 },
      block: {
        type: 'simple-block',
        associatedToken: { type: '{', value: '{' },
        value: [nestedQual, nestedMedia],
      },
    } as unknown as Rule;

    const style = getCascadedStyle(inner, [outer]);
    assert.equal(style.getPropertyValue('z-index'), '9');
    assert.equal(style.getPropertyValue('opacity'), '0.4');

    const skippedToken: Rule = {
      type: 'qualified-rule',
      selectorText: 'div.host',
      style: { length: 0 },
      block: {
        type: 'simple-block',
        associatedToken: { type: '{', value: '{' },
        value: tokenize('z-index: 1;').filter((t) => t.type !== 'EOF'),
      },
    } as unknown as Rule;
    assert.equal(getCascadedStyle(inner, [skippedToken]).getPropertyValue('z-index'), '');
  });
});
