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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8, SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-HHVE, SYS-REQ-260821-9YM3, SW-REQ-260821-ARC1
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseRule,
  parseStyleSheet,
  parseRuleInBlock,
  validateDeclarationValue,
  isValidUnicodeRangeValue,
  assembleUnicodeRanges,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import {
  CSSStyleRule,
  CSSImportRule,
  CSSStyleSheet,
  CSSNamespaceRule,
  CSSPropertyRule,
  CSSKeyframesRule,
  CSSPageRule,
  CSSMarginRule,
  CSSFontFaceRule,
  CSSCounterStyleRule,
  CSSFontFeatureValuesRule,
  CSSCustomMediaRule,
  CSSLayerStatementRule,
  CSSLayerBlockRule,
  CSSScopeRule,
  CSSViewTransitionRule,
  CSSStartingStyleRule,
  CSSSupportsRule,
  CSSContainerRule,
  CSSNestedDeclarations,
  CSSAtRule,
} from '../src/CSSOM.ts';
import type { ComponentValue } from '../src/types.ts';

describe('MC/DC branch: parser at-rule support and recovery', () => {
  test('@charset and @mediaall are dropped; vendor keyframes are kept', () => {
    const sheet = parse(`
      @charset "utf-8";
      @mediaall { p { color: red; } }
      @-webkit-keyframes spin { from { opacity: 0; } to { opacity: 1; } }
      .ok { color: green; }
    `);
    assert.equal(sheet.cssRules.length, 2);
    assert.ok(sheet.cssRules[0] instanceof CSSKeyframesRule);
    assert.equal((sheet.cssRules[0] as CSSKeyframesRule).name, 'spin');
    assert.ok(sheet.cssRules[1] instanceof CSSStyleRule);
    assert.equal((sheet.cssRules[1] as CSSStyleRule).selectorText, '.ok');
  });

  test('nested grouping allows @media/@supports/@layer but drops nested @import and @charset', () => {
    const sheet = parse(`
      .host {
        @import "nope.css";
        @charset "utf-8";
        @media (min-width: 1px) { color: blue; }
        @supports (display: grid) { color: navy; }
        @layer nest { color: teal; }
      }
    `);
    const host = sheet.cssRules[0] as CSSStyleRule;
    const nested = [...host.cssRules];
    assert.equal(nested.some((r) => r instanceof CSSImportRule), false);
    assert.ok(nested.some((r) => r instanceof CSSSupportsRule));
    assert.ok(nested.some((r) => r instanceof CSSLayerBlockRule));
  });

  test('parseRule throws SyntaxError on trailing garbage after a valid rule', () => {
    assert.throws(() => parseRule('div { color: red; } leftover'), { name: 'SyntaxError' });
    const ok = parseRule('div { color: red; }');
    assert.ok(ok instanceof CSSStyleRule);
  });

  test('parseDeclaration returns null for a non-ident start and parses after whitespace', () => {
    assert.equal(new Parser(tokenize('123: red')).parseDeclaration(), null);
    const decl = new Parser(tokenize('  color: blue !important ')).parseDeclaration();
    assert.ok(decl);
    assert.equal(decl.name, 'color');
    assert.equal(decl.important, true);
  });

  test('parseComponentValue returns null at EOF after whitespace', () => {
    assert.equal(new Parser(tokenize('   ')).parseComponentValue(), null);
    const value = new Parser(tokenize(' rgb(0, 0, 0) ')).parseComponentValue();
    assert.ok(value);
    assert.equal(value.type, 'function');
  });
});

describe('MC/DC branch: @import / @namespace / @property', () => {
  test('@import url() function, layer(), supports(), and media prelude', () => {
    const sheet = parse('@import url("https://example.com/a.css") layer(base) supports(display: grid) screen and (color);');
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0] as CSSImportRule;
    assert.equal(rule.href, 'https://example.com/a.css');
    assert.equal(rule.layerName, 'base');
    assert.equal(rule.supportsText, 'display: grid');
    assert.equal(rule.media.mediaText.includes('screen'), true);
    // cssom-1 § 6.4.3 #dom-cssimportrule-stylesheet: styleSheet is the associated
    // stylesheet object, never null; offline parser never fetches (README documented
    // deviation), so it stays empty until a host populates it via replaceSync().
    assert.ok(rule.styleSheet instanceof CSSStyleSheet);
    assert.equal(rule.styleSheet.cssRules.length, 0);
  });

  test('@import unquoted url() and bare layer ident', () => {
    const sheet = parse('@import url(foo.css) layer print;');
    const rule = sheet.cssRules[0] as CSSImportRule;
    assert.equal(rule.href.includes('foo.css'), true);
    assert.equal(rule.layerName, '');
    assert.equal(rule.media.mediaText, 'print');
  });

  test('@namespace url() with and without prefix, including url() function', () => {
    const sheet = parse(`
      @namespace url("http://www.w3.org/1999/xhtml");
      @namespace svg url("http://www.w3.org/2000/svg");
      @namespace foo url(http://example.com/ns);
    `);
    assert.equal(sheet.cssRules.length, 3);
    const def = sheet.cssRules[0] as CSSNamespaceRule;
    assert.equal(def.prefix, '');
    assert.equal(def.namespaceURI, 'http://www.w3.org/1999/xhtml');
    const svg = sheet.cssRules[1] as CSSNamespaceRule;
    assert.equal(svg.prefix, 'svg');
    assert.equal(svg.namespaceURI, 'http://www.w3.org/2000/svg');
    const foo = sheet.cssRules[2] as CSSNamespaceRule;
    assert.equal(foo.prefix, 'foo');
    assert.ok(foo.namespaceURI.includes('example.com'));
  });

  test('@property requires dashed ident, string syntax, and inherits true/false', () => {
    const ok = parse(`
      @property --ok {
        syntax: "*";
        inherits: false;
        initial-value: 1px;
      }
      @property -- {
        syntax: "*";
        inherits: true;
      }
      @property {
        syntax: "*";
        inherits: true;
      }
      @property --no-string {
        syntax: <length>;
        inherits: true;
      }
      @property --true {
        syntax: "*";
        inherits: true;
      }
    `);
    const names = [...ok.cssRules]
      .filter((r): r is CSSPropertyRule => r instanceof CSSPropertyRule)
      .map((r) => r.name);
    assert.ok(names.includes('--ok'));
    assert.ok(names.includes('--true'));
    assert.equal(names.includes('--'), false);
    const trueRule = [...ok.cssRules].find((r) => r instanceof CSSPropertyRule && r.name === '--true') as CSSPropertyRule;
    assert.equal(trueRule.inherits, true);
  });
});

describe('MC/DC branch: grouping, page, keyframes, font-feature-values', () => {
  test('@keyframes from/to/percentage and invalid selectors are skipped', () => {
    const sheet = parse(`
      @keyframes go {
        from { color: red; }
        50% { color: green; }
        to { color: blue; }
        101% { color: black; }
        nope { color: yellow; }
      }
      @keyframes none { from { color: red; } }
      @keyframes "" { from { color: red; } }
    `);
    const kf = [...sheet.cssRules].filter((r) => r instanceof CSSKeyframesRule) as CSSKeyframesRule[];
    assert.equal(kf.length, 1);
    assert.equal(kf[0].length, 3);
    assert.equal(kf[0].findRule('from')?.keyText, '0%');
    assert.equal(kf[0].findRule('50%')?.keyText, '50%');
    assert.equal(kf[0].findRule('to')?.keyText, '100%');
    assert.equal(kf[0].findRule('101%'), null);
  });

  test('@page with pseudo and nested margin at-rule', () => {
    const sheet = parse(`
      @page :left {
        margin: 1cm;
        @top-center { content: "Header"; }
      }
    `);
    assert.equal(sheet.cssRules.length, 1);
    const page = sheet.cssRules[0] as CSSPageRule;
    assert.equal(page.selectorText.includes('left'), true);
    assert.equal(page.style.getPropertyValue('margin') !== '', true);
    assert.ok([...page.cssRules].some((r) => r instanceof CSSMarginRule));
  });

  test('@font-feature-values maps annotation through historical-forms', () => {
    const sheet = parse(`
      @font-feature-values Font Name {
        @annotation { a: 1; }
        @ornaments { b: 2; }
        @stylistic { c: 3; }
        @swash { d: 4; }
        @character-variant { e: 5; }
        @styleset { f: 6 7; }
        @historical-forms { g: 8; }
      }
    `);
    const rule = sheet.cssRules[0] as CSSFontFeatureValuesRule;
    assert.equal(rule.fontFamily.includes('Font'), true);
    assert.deepEqual(rule.annotation.get('a'), [1]);
    assert.deepEqual(rule.ornaments.get('b'), [2]);
    assert.deepEqual(rule.stylistic.get('c'), [3]);
    assert.deepEqual(rule.swash.get('d'), [4]);
    assert.deepEqual(rule.characterVariant.get('e'), [5]);
    assert.deepEqual(rule.styleset.get('f'), [6, 7]);
    assert.deepEqual(rule.historicalForms.get('g'), [8]);
  });

  test('@counter-style, @font-face, @layer statement/block, @scope, @view-transition, @starting-style, @custom-media', () => {
    const sheet = parse(`
      @counter-style thumbs {
        system: cyclic;
        symbols: "👍";
        suffix: " ";
        negative: "-";
        prefix: "(";
        range: auto;
        pad: 0 "0";
        speak-as: auto;
        fallback: decimal;
        additive-symbols: 5 "V";
      }
      @font-face { font-family: X; src: url(x.woff2); }
      @layer a, b;
      @layer named { p { color: red; } }
      @scope (div) to (span) { p { color: blue; } }
      @view-transition { navigation: auto; }
      @starting-style { p { opacity: 0; } }
      @custom-media --wide (min-width: 600px);
      @custom-media --on true;
      @custom-media --off false;
      @container card (min-width: 100px) { p { color: green; } }
    `);
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSCounterStyleRule));
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSFontFaceRule));
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSLayerStatementRule));
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSLayerBlockRule));
    const scope = [...sheet.cssRules].find((r) => r instanceof CSSScopeRule) as CSSScopeRule;
    assert.ok(scope.startSelector);
    assert.ok(scope.endSelector);
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSViewTransitionRule));
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSStartingStyleRule));
    const custom = [...sheet.cssRules].filter((r) => r instanceof CSSCustomMediaRule) as CSSCustomMediaRule[];
    assert.ok(custom.length >= 2);
    assert.ok(custom.some((r) => r.query === true));
    assert.ok(custom.some((r) => r.query === false));
    const container = [...sheet.cssRules].find((r) => r instanceof CSSContainerRule) as CSSContainerRule;
    assert.equal(container.containerName, 'card');
  });
});

describe('MC/DC branch: nested declarations, custom properties, var(), unicode-range', () => {
  test('nested leftover declarations after a nested rule become CSSNestedDeclarations', () => {
    const sheet = parse('.a { color: red; & .b { color: blue; } margin-top: 1px; }');
    const rule = sheet.cssRules[0] as CSSStyleRule;
    const leftover = [...rule.cssRules].filter((r) => r instanceof CSSNestedDeclarations);
    assert.ok(leftover.length >= 1);
    assert.equal((leftover[leftover.length - 1] as CSSNestedDeclarations).style.getPropertyValue('margin-top'), '1px');
  });

  test('nested selector comma delim splits and implicit nesting is preserved', () => {
    const sheet = parse('.a { .b, .c { color: red; } }');
    const parent = sheet.cssRules[0] as CSSStyleRule;
    assert.ok(parent.cssRules.length >= 1);
    const nested = parent.cssRules[0] as CSSStyleRule;
    assert.equal(nested.selectorText.includes('.b'), true);
    assert.equal(nested.selectorText.includes('.c'), true);
  });

  test('custom property named -- is rejected; valid --foo is kept', () => {
    const sheet = parse('.a { --: red; --foo: green; }');
    const style = (sheet.cssRules[0] as CSSStyleRule).style;
    assert.equal(style.getPropertyValue('--foo'), 'green');
    assert.equal(style.getPropertyValue('--'), '');
  });

  test('custom property values reject bad-string / unmatched closers', () => {
    assert.equal(Parser.validateCustomPropertyValue(tokenize('"oops\n') as unknown as ComponentValue[]), false);
    const unmatched = tokenize('foo ]') as unknown as ComponentValue[];
    assert.equal(Parser.validateCustomPropertyValue(unmatched.filter((t) => t.type !== 'EOF')), false);
    const ok = tokenize('green') as unknown as ComponentValue[];
    assert.equal(Parser.validateCustomPropertyValue(ok.filter((t) => t.type !== 'EOF')), true);
    assert.equal(Parser.isValidDashedIdent('--ok'), true);
    assert.equal(Parser.isValidDashedIdent('--'), false);
    assert.equal(Parser.isValidDashedIdent('--foo bar'), false);
    assert.equal(Parser.isValidDashedIdent(1 as unknown as string), false);
  });

  test('var() empty name, empty curly name, and mixed curly block are invalid values', () => {
    const empty = parse('.a { color: var(); }');
    assert.equal((empty.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), '');

    const emptyCurly = parse('.a { color: var({}); }');
    assert.equal((emptyCurly.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), '');

    const mixed = parse('.a { color: var(--x {}); }');
    assert.equal((mixed.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), '');

    const fallback = parse('.a { color: var(--x, blue); }');
    assert.equal((fallback.cssRules[0] as CSSStyleRule).style.getPropertyValue('color').includes('var'), true);
  });

  test('unicode-range descriptor accepts U+ ranges and rejects junk', () => {
    const ok = parse('@font-face { unicode-range: U+26; }');
    assert.ok(ok.cssRules[0] instanceof CSSFontFaceRule);
    const bad = parse('@font-face { unicode-range: not-a-range; font-family: X; }');
    const face = bad.cssRules[0] as CSSFontFaceRule;
    assert.equal(face.style.getPropertyValue('unicode-range'), '');
    assert.equal(isValidUnicodeRangeValue(tokenize('U+26', true).filter((t) => t.type !== 'EOF')), true);
    assert.equal(assembleUnicodeRanges(tokenize('U+110000', true).filter((t) => t.type !== 'EOF')), null);
  });

  test('top-level prelude that looks like a custom property with a block is dropped', () => {
    const sheet = parse('--foo: { color: red; } .ok { color: green; }');
    assert.ok([...sheet.cssRules].some((r) => r instanceof CSSStyleRule && (r as CSSStyleRule).selectorText === '.ok'));
  });

  test('validateDeclarationValue rejects nested bad-string and invalid var()', () => {
    const tokens = new Parser(tokenize('foo var()')).parseComponentValues();
    assert.equal(validateDeclarationValue(tokens), false);
    const ok = new Parser(tokenize('1px solid red')).parseComponentValues();
    assert.equal(validateDeclarationValue(ok), true);
  });
});

describe('MC/DC branch: parser static entry points and unknown at-rules', () => {
  test('parseStyleSheet / parseRuleInBlock / parse() agree on a simple rule', () => {
    const rules = parseStyleSheet('div { color: red; }');
    assert.equal(rules.length, 1);
    const nested = parseRuleInBlock('color: blue;', true);
    assert.ok(nested instanceof CSSStyleRule || nested instanceof CSSNestedDeclarations);
    const sheet = parse('div { color: red; }');
    assert.equal(sheet.cssRules.length, 1);
  });

  test('unknown top-level at-rule is kept as CSSAtRule; nested unknown is dropped', () => {
    const sheet = parse('@unknown foo { p { color: red; } } .host { @unknown { color: blue; } color: green; }');
    assert.ok(sheet.cssRules[0] instanceof CSSAtRule);
    const host = sheet.cssRules[1] as CSSStyleRule;
    assert.equal(host.style.getPropertyValue('color'), 'green');
  });

  test('isCustomPropertyDeclaration detects --name: prelude', () => {
    const prelude = new Parser(tokenize('--x : ')).parseComponentValues();
    assert.equal(Parser.isCustomPropertyDeclaration(prelude), true);
    assert.equal(Parser.isCustomPropertyDeclaration(new Parser(tokenize('div ')).parseComponentValues()), false);
  });

  test('qualified rule unexpected } at top level is consumed into the prelude', () => {
    const tokens = tokenize('} .ok { color: red; }');
    const parser = new Parser(tokens);
    parser.consumeListOfRules(true);
    assert.ok(parser.errors.some((e) => e.message.includes('Unexpected }')));
    const nested = parse('.a { } .b { color: green; }');
    assert.equal((nested.cssRules[1] as CSSStyleRule).style.getPropertyValue('color'), 'green');
  });
});
