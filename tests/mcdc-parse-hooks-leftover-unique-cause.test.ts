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
// Verifies: SW-REQ-260821-HHVE, INT-REQ-260821-30ZA, INT-REQ-260821-9SGA, INT-REQ-260821-ZMZR, SYS-REQ-260821-YMEY, SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG, SW-REQ-260821-TF5T, SW-REQ-260821-PAKB, SYS-REQ-260821-GR67
// Leftover unique-cause for src/parse-hooks.ts stub bodies (throw / return true)
// vs injected implementations. Snapshot uninjected stubs before parser/CSSOM
// load (Node 24 --test isolates files). Drive public Parser / CSSOM that uses
// ParseHooks: CSSStyleSheet.insertRule / replaceSync, CSSGroupingRule.insertRule,
// CSSStyleDeclaration setProperty / getPropertyValue / cssText,
// CSSStyleRule.selectorText, CSSKeyframesRule.appendRule, CSSPageRule.selectorText,
// parse() @custom-media, CSS.supports, Parser.parseSelector, parseRuleListSync.
// cssom-1 § 6.3 #dom-cssstylesheet-insertrule / § 6.5.1 #dom-cssstylesheet-replacesync
// / § 6.4.3 #the-cssgroupingrule-interface / § 6.6.2 #dom-cssstyledeclaration-csstext
// / § 6.7.1 #set-a-css-declaration, css-syntax-3 § 5.5.1 #consume-a-list-of-rules
// / § 5.4.6 #parse-a-rule, css-nesting-1 § 3 #nest-selector.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type {
  CSSStyleRule as CSSStyleRuleT,
  CSSMediaRule as CSSMediaRuleT,
  CSSKeyframesRule as CSSKeyframesRuleT,
  CSSKeyframeRule as CSSKeyframeRuleT,
  CSSPageRule as CSSPageRuleT,
  CSSCustomMediaRule as CSSCustomMediaRuleT,
  CSSFontFaceRule as CSSFontFaceRuleT,
} from '../src/CSSOM.ts';
import type { CSSStyleDeclaration as CSSStyleDeclarationT } from '../src/CSSStyleDeclaration.ts';

const { ParseHooks } = await import('../src/parse-hooks.ts');

const stubs = {
  parseStyleAttribute: ParseHooks.parseStyleAttribute,
  consumeRule: ParseHooks.consumeRule,
  consumeListOfRules: ParseHooks.consumeListOfRules,
  parseRule: ParseHooks.parseRule,
  parseComponentValues: ParseHooks.parseComponentValues,
  parseSelector: ParseHooks.parseSelector,
  parseSelectorAST: ParseHooks.parseSelectorAST,
  parseMediaQueryList: ParseHooks.parseMediaQueryList,
  validateCustomPropertyValue: ParseHooks.validateCustomPropertyValue,
  validateDeclarationValue: ParseHooks.validateDeclarationValue,
  isValidUnicodeRangeValue: ParseHooks.isValidUnicodeRangeValue,
  assembleUnicodeRanges: ParseHooks.assembleUnicodeRanges,
  isValidDashedIdent: ParseHooks.isValidDashedIdent,
  validatePropertyValue: ParseHooks.validatePropertyValue,
};

assert.throws(() => stubs.parseStyleAttribute([]), /parseStyleAttribute not injected/);
assert.throws(() => stubs.consumeRule([]), /consumeRule not injected/);
assert.throws(() => stubs.consumeListOfRules([], true), /consumeListOfRules not injected/);
assert.throws(() => stubs.parseRule('div{}'), /parseRule not injected/);
assert.throws(() => stubs.parseComponentValues([]), /parseComponentValues not injected/);
assert.throws(() => stubs.parseSelector('div'), /parseSelector not injected/);
assert.throws(() => stubs.parseSelectorAST('div'), /parseSelectorAST not injected/);
assert.throws(() => stubs.parseMediaQueryList('screen'), /parseMediaQueryList not injected/);
assert.throws(() => stubs.validateCustomPropertyValue([]), /validateCustomPropertyValue not injected/);
assert.throws(() => stubs.validateDeclarationValue([]), /validateDeclarationValue not injected/);
assert.throws(() => stubs.isValidUnicodeRangeValue([]), /isValidUnicodeRangeValue not injected/);
assert.throws(() => stubs.assembleUnicodeRanges([]), /assembleUnicodeRanges not injected/);
assert.throws(() => stubs.isValidDashedIdent('--x'), /isValidDashedIdent not injected/);
assert.equal(stubs.validatePropertyValue('width', '-100'), true);

const { parse, Parser } = await import('../src/parser.ts');
const {
  CSSStyleSheet,
  CSSStyleRule,
  CSSMediaRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSPageRule,
  CSSCustomMediaRule,
  CSSFontFaceRule,
} = await import('../src/CSSOM.ts');
const { CSSStyleDeclaration } = await import('../src/CSSStyleDeclaration.ts');
const { CSS, parseRuleListSync } = await import('../src/parser-api.ts');

assert.notEqual(ParseHooks.consumeRule, stubs.consumeRule);
assert.notEqual(ParseHooks.validatePropertyValue, stubs.validatePropertyValue);

type HookName = keyof typeof stubs;

function withStub(name: HookName, fn: () => void): void {
  const prev = ParseHooks[name];
  (ParseHooks[name] as typeof stubs[typeof name]) = stubs[name];
  try {
    fn();
  } finally {
    (ParseHooks[name] as typeof prev) = prev;
  }
}

function notInjected(err: unknown, hook: string): boolean {
  return err instanceof Error && err.message === `${hook} not injected`;
}

function style(): CSSStyleDeclarationT {
  return new CSSStyleDeclaration();
}

describe('MC/DC leftover unique-cause: ParseHooks via public Parser/CSSOM', { concurrency: false }, () => {
  describe('consumeRule (cssom-1 § 6.3 #dom-cssstylesheet-insertrule, INT-REQ-260821-30ZA)', () => {
    test('insertRule unique-cause of stub throw vs injected consumeRule null vs rule', () => {
      const sheet = new CSSStyleSheet();
      withStub('consumeRule', () => {
        assert.throws(() => sheet.insertRule('div { color: red; }'), (err: unknown) => notInjected(err, 'consumeRule'));
        assert.equal(sheet.cssRules.length, 0);
      });

      assert.throws(() => sheet.insertRule(''), { name: 'SyntaxError' });
      assert.throws(() => sheet.insertRule(';'), { name: 'SyntaxError' });
      assert.equal(sheet.cssRules.length, 0);

      const index = sheet.insertRule('div { color: red; }');
      assert.equal(index, 0);
      assert.equal(sheet.cssRules.length, 1);
      assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
      assert.equal((sheet.cssRules[0] as CSSStyleRuleT).style.getPropertyValue('color'), 'red');
    });
  });

  describe('consumeListOfRules (cssom-1 § 6.5.1 #dom-cssstylesheet-replacesync, css-syntax-3 § 5.5.1)', () => {
    test('replaceSync unique-cause of stub throw vs injected topLevel CDO/CDC discard', () => {
      const sheet = new CSSStyleSheet();
      withStub('consumeListOfRules', () => {
        assert.throws(() => sheet.replaceSync('.x { color: red; }'), (err: unknown) => notInjected(err, 'consumeListOfRules'));
        assert.equal(sheet.cssRules.length, 0);
      });

      sheet.replaceSync('<!-- .x { color: red; } -->');
      assert.equal(sheet.cssRules.length, 1);
      assert.equal((sheet.cssRules[0] as CSSStyleRuleT).selectorText, '.x');
      assert.equal((sheet.cssRules[0] as CSSStyleRuleT).style.getPropertyValue('color'), 'red');

      sheet.replaceSync('--> .y { color: blue; } <!--');
      assert.equal(sheet.cssRules.length, 1);
      assert.equal((sheet.cssRules[0] as CSSStyleRuleT).selectorText, '.y');

      sheet.replaceSync('');
      assert.equal(sheet.cssRules.length, 0);
    });

    test('parseRuleListSync unique-cause of topLevel=F CDO/CDC consumeRule returning null', () => {
      // css-syntax-3 § 5.5.1: when topLevel is F, CDO/CDC are not discarded;
      // consumeRule starting at CDO/CDC returns null (rule=F unique-cause).
      assert.equal(parseRuleListSync('<!--').length, 0);
      assert.equal(parseRuleListSync('-->').length, 0);
      assert.equal(parseRuleListSync('<!-- .x { color: red; } -->').length, 0);
      assert.equal(parseRuleListSync('--> .y { color: blue; }').length, 0);

      const top = parseRuleListSync('.z { color: green; }');
      assert.equal(top.length, 1);
    });
  });

  describe('parseRule (cssom-1 § 6.4.3 #the-cssgroupingrule-interface, SW-REQ-260821-TF5T)', () => {
    test('grouping insertRule unique-cause of stub throw vs trailing garbage vs valid vs @import', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('@media all { }');
      const media = sheet.cssRules[0] as CSSMediaRuleT;
      assert.ok(media instanceof CSSMediaRule);

      withStub('parseRule', () => {
        const index = media.insertRule('.a { color: red; }', 0);
        assert.equal(index, 0);
        assert.equal(media.cssRules.length, 1);
      });
      media.deleteRule(0);
      assert.equal(media.cssRules.length, 0);

      assert.throws(() => media.insertRule('.a { color: red; } .b { color: blue; }'), { name: 'SyntaxError' });
      assert.equal(media.cssRules.length, 0);

      const index = media.insertRule('.a { color: red; }', 0);
      assert.equal(index, 0);
      assert.equal((media.cssRules[0] as CSSStyleRuleT).selectorText, '.a');

      assert.throws(() => media.insertRule('@import "x.css";', 1), { name: 'HierarchyRequestError' });
      assert.equal(media.cssRules.length, 1);
    });
  });

  describe('parseStyleAttribute (cssom-1 § 6.6.2 #dom-cssstyledeclaration-csstext)', () => {
    test('cssText unique-cause of stub throw no-op vs injected apply, appendRule throw vs keep', () => {
      const decl = style();
      decl.setProperty('color', 'red');
      withStub('parseStyleAttribute', () => {
        decl.cssText = 'color: blue; display: block;';
        assert.equal(decl.getPropertyValue('color'), 'red');
        assert.equal(decl.getPropertyValue('display'), '');
      });
      decl.cssText = 'color: blue; display: block;';
      assert.equal(decl.getPropertyValue('color'), 'blue');
      assert.equal(decl.getPropertyValue('display'), 'block');

      const sheet = new CSSStyleSheet();
      sheet.replaceSync('@keyframes k { }');
      const frames = sheet.cssRules[0] as CSSKeyframesRuleT;
      assert.ok(frames instanceof CSSKeyframesRule);
      withStub('parseStyleAttribute', () => {
        assert.throws(() => frames.appendRule('to { color: red; }'), (err: unknown) => notInjected(err, 'parseStyleAttribute'));
        assert.equal(frames.cssRules.length, 0);
      });
      frames.appendRule('to { color: red; }');
      assert.equal(frames.cssRules.length, 1);
      assert.ok(frames.cssRules[0] instanceof CSSKeyframeRule);
      assert.equal((frames.cssRules[0] as CSSKeyframeRuleT).style.getPropertyValue('color'), 'red');
    });
  });

  describe('parseComponentValues (cssom-1 § 6.7.1 #set-a-css-declaration, INT-REQ-260821-9SGA)', () => {
    test('setProperty / page selectorText / CSS.supports unique-cause of stub throw vs injected', () => {
      const decl = style();
      withStub('parseComponentValues', () => {
        assert.throws(() => decl.setProperty('color', 'red'), (err: unknown) => notInjected(err, 'parseComponentValues'));
        assert.equal(decl.getPropertyValue('color'), '');
        assert.throws(() => CSS.supports('color', 'red'), (err: unknown) => notInjected(err, 'parseComponentValues'));
      });
      decl.setProperty('color', 'red');
      assert.equal(decl.getPropertyValue('color'), 'red');
      assert.equal(CSS.supports('color', 'red'), true);
      assert.equal(CSS.supports('color', ''), false);

      const sheet = parse('@page { margin: 1px; }');
      const page = sheet.cssRules[0] as CSSPageRuleT;
      assert.ok(page instanceof CSSPageRule);
      withStub('parseComponentValues', () => {
        assert.throws(() => {
          page.selectorText = ':first';
        }, (err: unknown) => notInjected(err, 'parseComponentValues'));
        assert.equal(page.selectorText, '');
      });
      page.selectorText = ':first';
      assert.equal(page.selectorText, ':first');
      const before = page.selectorText;
      page.selectorText = 'not a valid page selector';
      assert.equal(page.selectorText, before);
    });
  });

  describe('parseSelectorAST (css-nesting-1 § 3 #nest-selector)', () => {
    test('selectorText unique-cause of stub throw no-op vs invalid vs nested relative vs namespace', () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync('@namespace svg url("http://www.w3.org/2000/svg"); .a { color: red; }');
      const rule = sheet.cssRules[1] as CSSStyleRuleT;
      assert.ok(rule instanceof CSSStyleRule);

      withStub('parseSelectorAST', () => {
        rule.selectorText = '.renamed';
        assert.equal(rule.selectorText, '.a');
      });

      rule.selectorText = '###';
      assert.equal(rule.selectorText, '.a');
      rule.selectorText = '.renamed';
      assert.equal(rule.selectorText, '.renamed');

      rule.selectorText = 'svg|rect';
      assert.equal(rule.selectorText.includes('rect'), true);

      rule.insertRule('& .b { color: blue; }', 0);
      const inner = rule.cssRules[0] as CSSStyleRuleT;
      assert.ok(inner instanceof CSSStyleRule);
      inner.selectorText = '> .c';
      assert.ok(inner.selectorText.includes('.c'));
      inner.selectorText = '###';
      assert.ok(inner.selectorText.includes('.c'));
    });
  });

  describe('parseSelector (css-syntax-3 § 5.3.3 #parse-a-selector)', () => {
    test('Parser.parseSelector unique-cause of stub unused vs injected empty/invalid/valid', () => {
      withStub('parseSelector', () => {
        assert.equal(Parser.parseSelector('div'), 'div');
        assert.equal(Parser.parseSelector(''), null);
      });
      assert.equal(Parser.parseSelector('div.class'), 'div.class');
      assert.equal(Parser.parseSelector(''), null);
      assert.equal(Parser.parseSelector('{'), null);
    });
  });

  describe('parseMediaQueryList (css-conditional-3 / mediaqueries-5 #custom-mq)', () => {
    test('parse @custom-media unique-cause of hook skip vs stub throw vs invalid vs valid', () => {
      const empty = parse('@custom-media --x;');
      assert.ok(empty.cssRules[0] instanceof CSSCustomMediaRule);
      const t = parse('@custom-media --x true;');
      assert.ok(t.cssRules[0] instanceof CSSCustomMediaRule);
      const f = parse('@custom-media --x false;');
      assert.ok(f.cssRules[0] instanceof CSSCustomMediaRule);

      withStub('parseMediaQueryList', () => {
        assert.throws(() => parse('@custom-media --x screen;'), (err: unknown) => notInjected(err, 'parseMediaQueryList'));
        const skipped = parse('@custom-media --y true;');
        assert.ok(skipped.cssRules[0] instanceof CSSCustomMediaRule);
      });

      const dropped = parse('@custom-media --x not not;');
      assert.equal(dropped.cssRules.length, 0);

      const ok = parse('@custom-media --x screen and (color);');
      assert.equal(ok.cssRules.length, 1);
      assert.ok(ok.cssRules[0] instanceof CSSCustomMediaRule);
      assert.equal((ok.cssRules[0] as CSSCustomMediaRuleT).name, '--x');
    });
  });

  describe('isValidDashedIdent (css-variables-1 § 2 #custom-property)', () => {
    test('getPropertyValue / setProperty unique-cause of stub throw vs -- vs whitespace vs valid', () => {
      const decl = style();
      withStub('isValidDashedIdent', () => {
        assert.throws(() => decl.setProperty('--foo', '1'), (err: unknown) => notInjected(err, 'isValidDashedIdent'));
        assert.throws(() => decl.getPropertyValue('--foo'), (err: unknown) => notInjected(err, 'isValidDashedIdent'));
        decl.setProperty('color', 'red');
        assert.equal(decl.getPropertyValue('color'), 'red');
      });

      decl.setProperty('--', '1');
      assert.equal(decl.getPropertyValue('--'), '');
      decl.setProperty('--foo bar', '1');
      assert.equal(decl.getPropertyValue('--foo bar'), '');
      decl.setProperty('--foo', '1');
      assert.equal(decl.getPropertyValue('--foo'), '1');
      assert.equal(decl.getPropertyValue('--FOO'), '');
    });
  });

  describe('validateCustomPropertyValue (css-variables-1 § 2 #custom-property, CSS.supports)', () => {
    test('setProperty / supports unique-cause of stub throw vs unmatched closer vs nested function true', () => {
      const decl = style();
      withStub('validateCustomPropertyValue', () => {
        assert.throws(() => decl.setProperty('--ok', '1'), (err: unknown) => notInjected(err, 'validateCustomPropertyValue'));
        assert.throws(() => CSS.supports('--ok', '1'), (err: unknown) => notInjected(err, 'validateCustomPropertyValue'));
      });

      decl.setProperty('--ok', '1');
      assert.equal(decl.getPropertyValue('--ok'), '1');
      decl.setProperty('--ok', ')');
      assert.equal(decl.getPropertyValue('--ok'), '1');
      decl.setProperty('--ok', ']');
      assert.equal(decl.getPropertyValue('--ok'), '1');

      decl.setProperty('--fn', 'rgb(1, 2, 3)');
      assert.equal(decl.getPropertyValue('--fn'), 'rgb(1, 2, 3)');
      decl.setProperty('--fn', 'foo(bar)');
      assert.equal(decl.getPropertyValue('--fn'), 'foo(bar)');
      decl.setProperty('--fn', 'foo(])');
      assert.equal(decl.getPropertyValue('--fn'), 'foo(bar)');

      assert.equal(CSS.supports('--ok', '1'), true);
      assert.equal(CSS.supports('--ok', ')'), false);
      assert.equal(CSS.supports('--fn', 'rgb(1, 2, 3)'), true);
      assert.equal(CSS.supports('--', '1'), false);
    });
  });

  describe('validateDeclarationValue (css-syntax-3 § 5.4.5 #consume-a-declaration)', () => {
    test('shorthand var() unique-cause of stub throw vs invalid var vs nested function true', () => {
      const decl = style();
      withStub('validateDeclarationValue', () => {
        assert.throws(() => decl.setProperty('margin', 'var(--x)'), (err: unknown) => notInjected(err, 'validateDeclarationValue'));
        assert.equal(decl.getPropertyValue('margin-top'), '');
      });

      decl.setProperty('margin', 'var(--x)');
      assert.equal(decl.getPropertyValue('margin'), 'var(--x)');
      decl.cssText = '';
      decl.setProperty('margin', 'var(--x, env(--y))');
      assert.ok(decl.getPropertyValue('margin').includes('var('));
      decl.cssText = '';
      decl.setProperty('margin', 'var()');
      assert.equal(decl.getPropertyValue('margin'), '');
      decl.setProperty('margin', 'var(--x, var())');
      assert.equal(decl.getPropertyValue('margin'), '');
      decl.setProperty('margin', '1px');
      assert.equal(decl.getPropertyValue('margin-top'), '1px');
    });
  });

  describe('assembleUnicodeRanges / isValidUnicodeRangeValue (css-fonts-4 #unicode-range-desc)', () => {
    test('font-face unicode-range unique-cause of stub throw vs invalid vs leftover comma list', () => {
      const sheet = parse('@font-face { font-family: X; src: url(x); unicode-range: U+26; }');
      const face = sheet.cssRules[0] as CSSFontFaceRuleT;
      assert.ok(face instanceof CSSFontFaceRule);

      withStub('assembleUnicodeRanges', () => {
        assert.throws(() => face.style.setProperty('unicode-range', 'U+27'), (err: unknown) => notInjected(err, 'assembleUnicodeRanges'));
        assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+26');
      });

      withStub('isValidUnicodeRangeValue', () => {
        face.style.setProperty('unicode-range', 'U+27');
        assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+27');
      });

      face.style.setProperty('unicode-range', 'bogus');
      assert.equal(face.style.getPropertyValue('unicode-range').trim(), 'U+27');
      face.style.setProperty('unicode-range', 'U+26, U+4??, U+0-7F');
      assert.ok(face.style.getPropertyValue('unicode-range').includes('U+26'));
      assert.ok(face.style.getPropertyValue('unicode-range').includes('U+400-4FF'));
    });
  });

  describe('validatePropertyValue (cssom-1 § 6.7.1 #set-a-css-declaration, SW-REQ-260821-HNRG)', () => {
    test('setProperty unique-cause of stub return-true vs injected reject vs css-wide', () => {
      const decl = style();
      withStub('validatePropertyValue', () => {
        decl.setProperty('width', '-100');
        assert.equal(decl.getPropertyValue('width'), '-100');
      });
      decl.removeProperty('width');
      decl.setProperty('width', '-100');
      assert.equal(decl.getPropertyValue('width'), '');
      decl.setProperty('width', '10px');
      assert.equal(decl.getPropertyValue('width'), '10px');
      decl.setProperty('width', 'inherit');
      assert.equal(decl.getPropertyValue('width'), 'inherit');
      decl.setProperty('color', 'red');
      assert.equal(decl.getPropertyValue('color'), 'red');
    });
  });
});
