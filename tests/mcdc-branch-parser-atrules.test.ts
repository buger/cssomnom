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
import { parse, Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { parseStylesheetSync, CSSParserAtRule, CSSParserQualifiedRule } from '../src/parser-api.ts';
import {
  CSSMediaRule,
  CSSSupportsRule,
  CSSContainerRule,
  CSSLayerStatementRule,
  CSSLayerBlockRule,
  CSSScopeRule,
  CSSStartingStyleRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSImportRule,
  CSSNamespaceRule,
  CSSPropertyRule,
  CSSPageRule,
  CSSMarginRule,
  CSSFontFeatureValuesRule,
  CSSCustomMediaRule,
  CSSFontFaceRule,
  CSSAtRule,
  CSSRule,
  CSSStyleRule,
} from '../src/CSSOM.ts';

describe('MC/DC branch: at-rule handlers require a block when the grammar does', () => {
  test('statement form of block-required at-rules is dropped', () => {
    const sheet = parse(`
      @media screen;
      @supports (color: red);
      @container (min-width: 1px);
      @starting-style;
      @scope;
      @view-transition;
      @counter-style thumbs;
      @font-feature-values Font;
      @font-face;
      @page;
      @property --foo;
      @keyframes name;
      @top-left;
      .ok { color: green; }
    `);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as { selectorText?: string }).selectorText, '.ok');
  });

  test('grouping handlers accept @supports, @container without name, @starting-style, and anonymous @layer', () => {
    const sheet = parse(`
      @supports (display: grid) { p { color: red; } }
      @container (min-width: 1px) { p { color: blue; } }
      @starting-style { p { opacity: 0; } }
      @layer { p { color: green; } }
      @layer;
    `);
    assert.ok(sheet.cssRules[0] instanceof CSSSupportsRule);
    assert.ok(sheet.cssRules[1] instanceof CSSContainerRule);
    assert.equal((sheet.cssRules[1] as CSSContainerRule).containerName, '');
    assert.ok(sheet.cssRules[2] instanceof CSSStartingStyleRule);
    assert.ok(sheet.cssRules[3] instanceof CSSLayerBlockRule);
    assert.ok(sheet.cssRules[4] instanceof CSSLayerStatementRule);
    assert.equal((sheet.cssRules[4] as CSSLayerStatementRule).nameList.length, 0);
  });
});

describe('MC/DC branch: @scope handler prelude', () => {
  test('implied scope, start-only, to-without-start, and invalid selectors', () => {
    const sheet = parse(`
      @scope { p { color: red; } }
      @scope (div) { p { color: blue; } }
      @scope to (span) { p { color: green; } }
      @scope (123) { p { color: black; } }
      @scope (div) to (123) { p { color: black; } }
    `);
    const scopes = [...sheet.cssRules].filter((r) => r instanceof CSSScopeRule) as CSSScopeRule[];
    assert.equal(scopes.length, 3);
    assert.equal(scopes[0].startSelector, null);
    assert.equal(scopes[0].endSelector, null);
    assert.equal(scopes[1].startSelector, '(div)');
    assert.equal(scopes[1].endSelector, null);
    assert.equal(scopes[2].startSelector, null);
    assert.ok(scopes[2].endSelector);
    assert.equal(scopes[2].endSelector?.includes('span'), true);
  });
});

describe('MC/DC branch: @keyframes handler name and selector lists', () => {
  test('string name, vendor prefixes, and disallowed idents / extra prelude', () => {
    const sheet = parse(`
      @keyframes "spin" { from { opacity: 0; } }
      @-moz-keyframes moz { from { opacity: 0; } }
      @-o-keyframes o { from { opacity: 0; } }
      @keyframes inherit { from { opacity: 0; } }
      @keyframes initial { from { opacity: 0; } }
      @keyframes unset { from { opacity: 0; } }
      @keyframes revert { from { opacity: 0; } }
      @keyframes default { from { opacity: 0; } }
      @keyframes 123 { from { opacity: 0; } }
      @keyframes spin extra { from { opacity: 0; } }
    `);
    const kf = [...sheet.cssRules].filter((r) => r instanceof CSSKeyframesRule) as CSSKeyframesRule[];
    assert.equal(kf.length, 3);
    assert.equal(kf[0].name, 'spin');
    assert.equal(kf[1].name, 'moz');
    assert.equal(kf[2].name, 'o');
  });

  test('comma-separated from/to and percentages; empty selector lists and leading semicolons are skipped', () => {
    const sheet = parse(`
      @keyframes go {
        from, to { opacity: 1; }
        0%, 100% { color: red; }
        from, { opacity: 0; }
        ident extra { opacity: 0; }
        ; 50% { color: blue; }
      }
    `);
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    assert.ok(kf instanceof CSSKeyframesRule);
    const keys = [...kf.cssRules].map((r) => (r as CSSKeyframeRule).keyText);
    assert.ok(keys.includes('0%, 100%'));
    assert.ok(keys.includes('50%'));
    assert.equal(keys.some((k) => k === ''), false);
  });
});

describe('MC/DC branch: @page margin names and leftover nested declarations', () => {
  test('all 16 margin at-rules are CSSMarginRule children', () => {
    const names = [
      'top-left-corner', 'top-left', 'top-center', 'top-right', 'top-right-corner',
      'bottom-left-corner', 'bottom-left', 'bottom-center', 'bottom-right', 'bottom-right-corner',
      'left-top', 'left-middle', 'left-bottom',
      'right-top', 'right-middle', 'right-bottom',
    ];
    const body = names.map((n) => `@${n} { content: "${n}"; }`).join('\n');
    const sheet = parse(`@page { color: red; ${body} margin: 1cm; }`);
    const page = sheet.cssRules[0] as CSSPageRule;
    assert.ok(page instanceof CSSPageRule);
    const margins = [...page.cssRules].filter((r) => r instanceof CSSMarginRule) as CSSMarginRule[];
    assert.equal(margins.length, 16);
    const got = new Set(margins.map((m) => m.name));
    for (const n of names) {
      assert.equal(got.has(n), true, `missing @${n}`);
    }
    assert.equal(page.style.getPropertyValue('color') !== '', true);
  });
});

describe('MC/DC branch: @font-feature-values aliases and ignored content', () => {
  test('charactervariant / historicalforms aliases; unknown maps and non-at-keyword junk skipped', () => {
    const sheet = parse(`
      @font-feature-values Fancy {
        /* comment */
        @charactervariant { a: 1; }
        @historicalforms { b: 2; }
        @annotation;
        @unknown { c: 3; }
        color: red;
        @stylistic { d: 4; }
      }
    `);
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0] as CSSFontFeatureValuesRule;
    assert.ok(rule instanceof CSSFontFeatureValuesRule);
    assert.deepEqual(rule.characterVariant.get('a'), [1]);
    assert.deepEqual(rule.historicalForms.get('b'), [2]);
    assert.deepEqual(rule.stylistic.get('d'), [4]);
  });
});

describe('MC/DC branch: @property validation failures', () => {
  test('extra prelude, missing initial-value, bad inherits, and syntax mismatch are dropped', () => {
    const sheet = parse(`
      @property --x extra { syntax: "*"; inherits: false; }
      @property --x { syntax: "<length>"; inherits: false; }
      @property --x { syntax: "*"; inherits: maybe; }
      @property --x { syntax: "<color>"; inherits: true; initial-value: 1px; }
      @property --ok { syntax: "*"; inherits: false; }
    `);
    const props = [...sheet.cssRules].filter((r) => r instanceof CSSPropertyRule) as CSSPropertyRule[];
    assert.equal(props.length, 1);
    assert.equal(props[0].name, '--ok');
    assert.equal(props[0].inherits, false);
  });
});

describe('MC/DC branch: @import / @namespace / @custom-media remaining arms', () => {
  test('@import string href, empty url, and empty layer() function', () => {
    const sheet = parse(`
      @import "foo.css";
      @import;
      @import url();
      @import url(bar.css) layer();
    `);
    const rules = [...sheet.cssRules] as CSSImportRule[];
    assert.equal(rules.length, 4);
    assert.ok(rules[0] instanceof CSSImportRule);
    assert.equal(rules[0].href, 'foo.css');
    assert.equal(rules[1].href, '');
    assert.equal(rules[2].href, '');
    assert.equal(rules[3].href.includes('bar.css'), true);
    assert.equal(rules[3].layerName, '');
  });

  test('@namespace url() and non-ident first of two prelude tokens', () => {
    const sheet = parse(`
      @namespace url(http://example.com/ns);
      @namespace url("http://a") extra;
    `);
    assert.equal(sheet.cssRules.length, 2);
    const a = sheet.cssRules[0] as CSSNamespaceRule;
    const b = sheet.cssRules[1] as CSSNamespaceRule;
    assert.ok(a.namespaceURI.includes('example.com'));
    assert.equal(a.prefix, '');
    assert.ok(b.namespaceURI.includes('http://a'));
  });

  test('@custom-media empty remaining, missing dashed name, and invalid query', () => {
    const sheet = parse(`
      @custom-media --x;
      @custom-media;
      @custom-media foo (min-width: 1px);
      @custom-media --bad &&&;
      @custom-media --wide (min-width: 600px);
    `);
    const custom = [...sheet.cssRules].filter((r) => r instanceof CSSCustomMediaRule) as CSSCustomMediaRule[];
    assert.ok(custom.some((r) => r.name === '--x'));
    assert.ok(custom.some((r) => r.name === '--wide'));
    assert.equal(custom.some((r) => r.name === 'foo'), false);
    assert.equal(custom.some((r) => r.name === '--bad'), false);
  });
});

describe('MC/DC branch: at-rule name ASCII case-insensitivity', () => {
  test('@MEDIA / @SUPPORTS / @Import / @KEYFRAMES / @Layer dispatch to typed handlers', () => {
    const sheet = parse(`
      @MEDIA all { p { color: red; } }
      @SUPPORTS (display: grid) { p { color: blue; } }
      @Import "x.css";
      @KEYFRAMES spin { from { opacity: 0; } }
      @Layer a, b;
      @Font-Face { font-family: X; src: url(x); }
    `);
    assert.ok(sheet.cssRules[0] instanceof CSSMediaRule);
    assert.ok(sheet.cssRules[1] instanceof CSSSupportsRule);
    assert.ok(sheet.cssRules[2] instanceof CSSImportRule);
    assert.ok(sheet.cssRules[3] instanceof CSSKeyframesRule);
    assert.ok(sheet.cssRules[4] instanceof CSSLayerStatementRule);
    assert.ok(sheet.cssRules[5] instanceof CSSFontFaceRule);
    assert.equal([...sheet.cssRules].some((r) => r instanceof CSSAtRule), false);
  });

  test('@TOP-LEFT / @Top-Center store ASCII-lowercase CSSMarginRule.name and cssText', () => {
    const sheet = parse(`
      @page {
        @TOP-LEFT { content: "a"; }
        @Top-Center { content: "b"; }
      }
    `);
    const page = sheet.cssRules[0] as CSSPageRule;
    assert.ok(page instanceof CSSPageRule);
    const margins = [...page.cssRules].filter((r) => r instanceof CSSMarginRule) as CSSMarginRule[];
    assert.equal(margins.length, 2);
    assert.equal(margins[0].name, 'top-left');
    assert.equal(margins[1].name, 'top-center');
    assert.equal(margins[0].cssText.startsWith('@top-left'), true);
    assert.equal(margins[1].cssText.startsWith('@top-center'), true);
    assert.equal(margins[0].cssText.includes('TOP-LEFT'), false);
    assert.equal(margins[1].cssText.includes('Top-Center'), false);
  });

  test('options.atRules { foo: rule } matches @FOO', () => {
    const css = '@FOO { div { color: red; } }';
    const folded = parseStylesheetSync(css, { atRules: { foo: 'rule' } });
    assert.equal(folded.length, 1);
    assert.ok(folded[0] instanceof CSSParserAtRule);
    const at = folded[0] as CSSParserAtRule;
    assert.ok(at.body && at.body.length >= 1);
    assert.ok(at.body.some((r) => r instanceof CSSParserQualifiedRule));

    const viaParser = new Parser(tokenize(css), { atRules: { foo: 'rule' } }).parseStyleSheet();
    assert.equal(viaParser.cssRules.length, 1);
    const ast = viaParser.cssRules[0] as unknown as { type?: string; childRules?: unknown[] };
    assert.equal(ast.type, 'at-rule');
    assert.ok(Array.isArray(ast.childRules));
    assert.ok(ast.childRules.some((r) => r instanceof CSSStyleRule));
  });

  test('@constructor / @toString / @__proto__ fall through as unknown at-rules', () => {
    let sheet: ReturnType<typeof parse> | undefined;
    assert.doesNotThrow(() => {
      sheet = parse(`
        @constructor { color: red; }
        @toString { color: blue; }
        @__proto__ { color: green; }
        @constructor;
        @toString;
        @__proto__;
      `);
    });
    assert.ok(sheet);
    assert.equal(sheet.cssRules.length, 6);
    for (const rule of sheet.cssRules) {
      assert.ok(rule instanceof CSSRule);
      assert.ok(rule instanceof CSSAtRule);
      assert.equal(rule instanceof Parser, false);
      assert.equal(typeof rule, 'object');
    }
    const names = [...sheet.cssRules].map((r) => (r as CSSAtRule).name);
    assert.deepEqual(names, [
      'constructor',
      'toString',
      '__proto__',
      'constructor',
      'toString',
      '__proto__',
    ]);
  });
});
