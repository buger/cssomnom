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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8, SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-HHVE, SYS-REQ-260821-9YM3, SW-REQ-260821-ARC1, SW-REQ-260822-MN8Z
// Still-hot unique-cause for src/parser.ts leftovers that
// tests/mcdc-branch-parser.test.ts, tests/mcdc-branch-parser-atrules.test.ts,
// and tests/mcdc-branch-parser-leftover.test.ts do not isolate:
// consumeListOfRules CDO/CDC, consumeQualifiedRule, handleImport/Namespace/
// Property/Keyframes/Scope/Layer/FontFeatureValues/CustomMedia/Page,
// isValidSelector / createStyleRule, consumeBlock / consumeFunction,
// parseComponentValue / parseCommaSeparatedList / parseSelector / parseRule /
// ensureEOF, consumeDeclarationsFromBlockContents, validateVarFunction,
// resolveVariables / env, constructor / getAtRuleHandler.
// Drive parse(), Parser public APIs, parseRule, parseStyleSheet, parseRuleInBlock.
// css-syntax-3 § 5.4 / § 5.5, cssom-1 § 6.4, css-nesting-1, css-cascade-5,
// css-fonts-4, css-animations-1, css-cascade-5 @layer, css-cascade-6 @scope,
// css-values-4 #urls, css-variables-1 #using-variables, css-env-1 #env-function.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parse,
  Parser,
  parseRule,
  parseStyleSheet,
  parseRuleInBlock,
  validateDeclarationValue,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ArrayTokenStream } from '../src/TokenStream.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';
import { CSS } from '../src/parser-api.ts';
import {
  CSSStyleRule,
  CSSAtRule,
  CSSNestedDeclarations,
  CSSLayerStatementRule,
  CSSMediaRule,
  CSSSupportsRule,
  CSSImportRule,
  CSSNamespaceRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSPageRule,
  CSSPropertyRule,
  CSSScopeRule,
  CSSMarginRule,
  CSSFontFeatureValuesRule,
  CSSCustomMediaRule,
  CSSViewTransitionRule,
  CSSCounterStyleRule,
  CSSStyleSheet,
} from '../src/CSSOM.ts';

function firstStyle(css: string): CSSStyleRule {
  const sheet = parse(css);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule, `expected style rule for ${JSON.stringify(css)}`);
  return sheet.cssRules[0];
}

function selectors(css: string): string[] {
  return [...parse(css).cssRules].map((r) =>
    r instanceof CSSStyleRule ? r.selectorText : r.constructor.name,
  );
}

describe('MC/DC still-hot unique-cause: consumeListOfRules CDO/CDC (css-syntax-3 § 5.5.1 #consume-stylesheet-contents)', () => {
  test('CDO vs CDC unique-cause of the discard OR at topLevel T', () => {
    // CDO T, CDC F
    const cdo = new Parser(tokenize('<!-- .foo { color: red; }')).consumeListOfRules(true);
    assert.equal(cdo.length, 1);
    assert.ok(cdo[0] instanceof CSSStyleRule);
    assert.equal((cdo[0] as CSSStyleRule).selectorText, '.foo');

    // CDO F, CDC T
    const cdc = new Parser(tokenize('--> .foo { color: red; }')).consumeListOfRules(true);
    assert.equal(cdc.length, 1);
    assert.ok(cdc[0] instanceof CSSStyleRule);
    assert.equal((cdc[0] as CSSStyleRule).selectorText, '.foo');

    // both, then a following rule (whitespace skip unique-cause of the first arm)
    const both = new Parser(tokenize('  <!--  -->  .bar { color: blue; }')).consumeListOfRules(true);
    assert.equal(both.length, 1);
    assert.equal((both[0] as CSSStyleRule).selectorText, '.bar');
  });

  test('topLevel F unique-cause of consumeRule on CDO/CDC (rule null)', () => {
    // Existing cdo-cdc.test.ts uses both tokens together. Isolate each.
    assert.equal(new Parser(tokenize('<!-- .foo { color: red; }')).consumeListOfRules(false).length, 0);
    assert.equal(new Parser(tokenize('--> .foo { color: red; }')).consumeListOfRules(false).length, 0);
    assert.equal(new Parser(tokenize('<!-- { color: red; }')).consumeListOfRules(false).length, 0);
    assert.equal(new Parser(tokenize('--> { color: red; }')).consumeListOfRules(false).length, 0);

    // topLevel T empty / EOF unique-cause of the return-rules arm
    assert.deepEqual(new Parser([]).consumeListOfRules(true), []);
    assert.deepEqual(new Parser(tokenize('   ')).consumeListOfRules(true), []);
  });
});

describe('MC/DC still-hot unique-cause: consumeQualifiedRule (css-syntax-3 § 5.5.3 #consume-qualified-rule)', () => {
  test('nested } vs top-level } vs custom-property prelude on `{`', () => {
    // nested T: `}` ends the qualified rule without consuming it into the prelude
    assert.equal(new Parser(tokenize('}')).consumeRule(true), null);
    assert.equal(new Parser(tokenize('  }')).consumeRule(true), null);

    // nested F + leading `}`: SelectorParser throws → createStyleRule null (whole prelude swallowed)
    assert.equal(new Parser(tokenize('} .ok { color: red; }')).consumeRule(false), null);
    assert.equal(selectors('} .ok { color: red; }').length, 0);

    // isCustomPropertyDeclaration T: `--foo:` prelude + `{` is dropped (existing leftover used consumeBlockContents)
    assert.deepEqual(selectors('--foo: { color: red; } .ok { color: green; }'), ['.ok']);

    // isCustomPropertyDeclaration F: `--foo` without colon is a type selector
    assert.deepEqual(selectors('--foo { color: red; } .ok { color: green; }'), ['--foo', '.ok']);

    // ident+colon that is not `--` is not a custom prelude; last-colon isValidSelector F
    assert.deepEqual(selectors('color: { color: red; } .ok { color: green; }'), ['.ok']);

    // EOF without `{`
    assert.equal(new Parser(tokenize('.foo')).consumeRule(false), null);
    assert.equal(new Parser(tokenize('')).consumeRule(false), null);
    assert.equal(new Parser(tokenize('   ')).consumeRule(false), null);
  });
});

describe('MC/DC still-hot unique-cause: handleImportRule (cssom-1 § 6.4.4 #the-cssimportrule-interface, css-cascade-5 #at-import)', () => {
  test('href unique-cause of string vs url-token vs url() function vs neither', () => {
    const str = parse('@import "foo.css";').cssRules[0] as CSSImportRule;
    assert.equal(str.href, 'foo.css');

    const urlTok = parse('@import url(foo.css);').cssRules[0] as CSSImportRule;
    assert.equal(urlTok.href, 'foo.css');

    // quoted url() is a function; string arg unique-cause of find(type===string)
    const fn = parse('@import url( "foo.css" );').cssRules[0] as CSSImportRule;
    assert.equal(fn.href, 'foo.css');

    // first.type === 'function' T, name === 'url' F: URL() is not lowercased here
    const upper = parse('@import URL("foo.css");').cssRules[0] as CSSImportRule;
    assert.ok(upper instanceof CSSImportRule);
    assert.equal(upper.href, '');

    // function that is not url
    const src = parse('@import src("foo.css");').cssRules[0] as CSSImportRule;
    assert.ok(src instanceof CSSImportRule);
    assert.equal(src.href, '');

    // empty prelude
    const empty = parse('@import;').cssRules[0] as CSSImportRule;
    assert.equal(empty.href, '');
    const ws = parse('@import   ;').cssRules[0] as CSSImportRule;
    assert.equal(ws.href, '');
  });

  test('layer / supports mixed-case and remaining media unique-cause', () => {
    // ident layer mixed-case (toLowerCase) vs function LAYER()
    const ident = parse('@import "x.css" LAYER;').cssRules[0] as CSSImportRule;
    assert.equal(ident.layerName, '');
    const fn = parse('@import "x.css" LAYER(base);').cssRules[0] as CSSImportRule;
    assert.equal(fn.layerName, 'base');

    // ident that is not layer: treated as media
    const printOnly = parse('@import "x.css" print;').cssRules[0] as CSSImportRule;
    assert.equal(printOnly.layerName, null);
    assert.equal(printOnly.media.mediaText, 'print');

    // supports without layer (layer F unique-cause) + remaining media
    const supports = parse('@import "x.css" SUPPORTS(display: grid) print;').cssRules[0] as CSSImportRule;
    assert.equal(supports.layerName, null);
    assert.equal(supports.supportsText, 'display: grid');
    assert.equal(supports.media.mediaText, 'print');

    // layer then media, no supports
    const layerMedia = parse('@import "x.css" layer print;').cssRules[0] as CSSImportRule;
    assert.equal(layerMedia.layerName, '');
    assert.equal(layerMedia.supportsText, null);
    assert.equal(layerMedia.media.mediaText, 'print');

    // function that is not supports after layer
    const notSupports = parse('@import "x.css" layer notsupports(color: red);').cssRules[0] as CSSImportRule;
    assert.equal(notSupports.supportsText, null);
  });
});

describe('MC/DC still-hot unique-cause: handleNamespaceRule (css-namespaces-3 #css-namespaces, cssom-1 § 6.4.5)', () => {
  test('extractUri unique-cause of string vs url-token vs url() vs URL() vs empty', () => {
    const str = parse('@namespace "http://s";').cssRules[0] as CSSNamespaceRule;
    assert.equal(str.prefix, '');
    assert.equal(str.namespaceURI, 'http://s');

    const urlTok = parse('@namespace url(http://s);').cssRules[0] as CSSNamespaceRule;
    assert.equal(urlTok.prefix, '');
    assert.ok(urlTok.namespaceURI.includes('http://s'));

    const fn = parse('@namespace url("http://s");').cssRules[0] as CSSNamespaceRule;
    assert.equal(fn.namespaceURI, 'http://s');

    // name === 'url' F
    const upper = parse('@namespace URL("http://s");').cssRules[0] as CSSNamespaceRule;
    assert.equal(upper.namespaceURI, '');

    const empty = parse('@namespace;').cssRules[0] as CSSNamespaceRule;
    assert.equal(empty.prefix, '');
    assert.equal(empty.namespaceURI, '');
  });

  test('tokens.length >= 2 unique-cause of ident prefix vs non-ident first', () => {
    const prefixed = parse('@namespace svg url("http://s");').cssRules[0] as CSSNamespaceRule;
    assert.equal(prefixed.prefix, 'svg');
    assert.equal(prefixed.namespaceURI, 'http://s');

    const prefixedTok = parse('@namespace svg url(http://s);').cssRules[0] as CSSNamespaceRule;
    assert.equal(prefixedTok.prefix, 'svg');

    // URL() after prefix: extractUri name === 'url' F
    const prefixedUpper = parse('@namespace svg URL("http://s");').cssRules[0] as CSSNamespaceRule;
    assert.equal(prefixedUpper.prefix, 'svg');
    assert.equal(prefixedUpper.namespaceURI, '');

    // first of two is not ident → URI from tokens[0], prefix stays ''
    const extra = parse('@namespace "http://a" extra;').cssRules[0] as CSSNamespaceRule;
    assert.equal(extra.prefix, '');
    assert.ok(extra.namespaceURI.includes('http://a'));

    // comments are discarded by the tokenizer so they do not count as tokens
    const commented = parse('@namespace /*c*/ svg /*d*/ "http://s";').cssRules[0] as CSSNamespaceRule;
    assert.equal(commented.prefix, 'svg');
    assert.equal(commented.namespaceURI, 'http://s');
  });
});

describe('MC/DC still-hot unique-cause: handlePropertyRule (css-properties-values-api-1 #the-at-property-rule)', () => {
  // Verifies: SW-REQ-260822-MN8Z
  test('descriptor name case vs value case unique-cause of syntax/inherits/initial-value', () => {
    // INHERITS name folds; value `true` is case-sensitive
    const folded = parse('@property --x { syntax: "*"; INHERITS: true; }');
    assert.equal(folded.cssRules.length, 1);
    assert.ok(folded.cssRules[0] instanceof CSSPropertyRule);
    assert.equal((folded.cssRules[0] as CSSPropertyRule).inherits, true);

    // val === 'true' F / val === 'false' F
    assert.equal(parse('@property --x { syntax: "*"; INHERITS: TRUE; }').cssRules.length, 0);
    assert.equal(parse('@property --x { syntax: "*"; inherits: False; }').cssRules.length, 0);
    assert.equal(parse('@property --x { syntax: "*"; inherits: maybe; }').cssRules.length, 0);

    const falsy = parse('@property --x { syntax: "*"; inherits: false; }');
    assert.equal((falsy.cssRules[0] as CSSPropertyRule).inherits, false);

    // syntax non-string / extra tokens
    assert.equal(parse('@property --x { syntax: *; inherits: false; }').cssRules.length, 0);
    assert.equal(parse('@property --x { syntax: "*" extra; inherits: false; }').cssRules.length, 0);

    // INITIAL-VALUE name folds; extra prelude ident after name still drops
    const init = parse('@property --ok { syntax: "*"; inherits: false; INITIAL-VALUE: 1px; }');
    assert.equal(init.cssRules.length, 1);
    assert.equal((init.cssRules[0] as CSSPropertyRule).initialValue, '1px');
    assert.equal(parse('@property --x y { syntax: "*"; inherits: false; }').cssRules.length, 0);
  });
});

describe('MC/DC still-hot unique-cause: handleKeyframesRule (css-animations-1 #interface-csskeyframesrule)', () => {
  test('percentage bounds, FROM/To, number vs percentage, disallowed leftover', () => {
    const mixed = parse('@keyframes go { FROM { color: red; } To { color: blue; } }').cssRules[0] as CSSKeyframesRule;
    assert.deepEqual([...mixed.cssRules].map((k) => (k as CSSKeyframeRule).keyText), ['0%', '100%']);

    // val < 0 / val > 100 independently; 0 and 100 inclusive
    const bounds = parse('@keyframes go { -1% { color: red; } 0% { color: green; } 100% { color: blue; } 101% { color: black; } }');
    const keys = [...(bounds.cssRules[0] as CSSKeyframesRule).cssRules].map((k) => (k as CSSKeyframeRule).keyText);
    assert.deepEqual(keys, ['0%', '100%']);

    // type === 'percentage' F: bare number is dropped
    const num = parse('@keyframes go { 50 { color: red; } 50% { color: blue; } }').cssRules[0] as CSSKeyframesRule;
    assert.deepEqual([...num.cssRules].map((k) => (k as CSSKeyframeRule).keyText), ['50%']);

    // disallowed list leftover: revert-layer is NOT in the list; None is
    assert.ok(parse('@keyframes revert-layer { from { color: red; } }').cssRules[0] instanceof CSSKeyframesRule);
    assert.equal(parse('@keyframes None { from { color: red; } }').cssRules.length, 0);
    assert.equal(parse('@keyframes revert { from { color: red; } }').cssRules.length, 0);

    // prelude comments stripped to whitespace; name still `go`. EOF without `{` skipped
    assert.ok(parse('@keyframes /*c*/ go { from { color: red; } }').cssRules[0] instanceof CSSKeyframesRule);
    assert.equal((parse('@keyframes go { from }').cssRules[0] as CSSKeyframesRule).length, 0);

    // whitespace-trimmed from
    const ws = parse('@keyframes go {   from   { color: red; } }').cssRules[0] as CSSKeyframesRule;
    assert.equal((ws.cssRules[0] as CSSKeyframeRule).keyText, '0%');
  });
});

describe('MC/DC still-hot unique-cause: handleScopeRule (css-cascade-6 #at-ruledef-scope)', () => {
  test('start block token, TO mixed-case, missing paren, invalid empty, nested relative', () => {
    // associatedToken `(` F: `[div]` is not a start selector
    const square = parse('@scope [div] { p { color: red; } }').cssRules[0] as CSSScopeRule;
    assert.ok(square instanceof CSSScopeRule);
    assert.equal(square.startSelector, null);
    assert.equal(square.endSelector, null);

    // empty `()`: SelectorParser throws → whole at-rule null
    assert.equal(parse('@scope () { p { color: red; } }').cssRules.length, 0);

    // ident `to` mixed-case T vs ident `too` F vs `to` without `(`
    const toUpper = parse('@scope TO (span) { p { color: red; } }').cssRules[0] as CSSScopeRule;
    assert.equal(toUpper.startSelector, null);
    assert.equal(toUpper.endSelector, '(span)');
    const too = parse('@scope too (span) { p { color: red; } }').cssRules[0] as CSSScopeRule;
    assert.equal(too.startSelector, null);
    assert.equal(too.endSelector, null);
    const toBare = parse('@scope to span { p { color: red; } }').cssRules[0] as CSSScopeRule;
    assert.equal(toBare.endSelector, null);

    // nested allowRelative T: `> .b` is valid as a relative start
    const host = firstStyle('.a { @scope (> .b) { color: red; } }');
    const nested = [...host.cssRules].find((r) => r instanceof CSSScopeRule) as CSSScopeRule;
    assert.ok(nested);
    assert.equal(nested.startSelector, '(> .b)');
  });
});

describe('MC/DC still-hot unique-cause: layer / font-feature-values / custom-media / page', () => {
  test('handleLayerRule nameList filter unique-cause of empty vs kept names', () => {
    const empty = parse('@layer ,,;').cssRules[0] as CSSLayerStatementRule;
    assert.ok(empty instanceof CSSLayerStatementRule);
    assert.deepEqual([...empty.nameList], []);
    const mixed = parse('@layer a, , b;').cssRules[0] as CSSLayerStatementRule;
    assert.deepEqual([...mixed.nameList], ['a', 'b']);
  });

  test('handleFontFeatureValuesRule leftover mixed-case map and number filter', () => {
    const rule = parse(`
      @font-feature-values Fancy {
        @ANNOTATION { a: 1; }
        @stylistic { b: 2 ident; }
        @swash { c: 3 4; }
        @ornaments { d: ident; }
      }
    `).cssRules[0] as CSSFontFeatureValuesRule;
    assert.ok(rule instanceof CSSFontFeatureValuesRule);
    assert.deepEqual(rule.annotation.get('a'), [1]);
    assert.deepEqual(rule.stylistic.get('b'), [2]);
    assert.deepEqual(rule.swash.get('c'), [3, 4]);
    assert.deepEqual(rule.ornaments.get('d'), []);
  });

  test('handleCustomMediaRule TRUE/FALSE mixed-case vs ident query vs number drop', () => {
    const sheet = parse(`
      @custom-media --on TRUE;
      @custom-media --off FALSE;
      @custom-media --True True;
      @custom-media --x screen;
      @custom-media --n 1;
    `);
    const custom = [...sheet.cssRules].filter((r) => r instanceof CSSCustomMediaRule) as CSSCustomMediaRule[];
    assert.equal(custom.find((r) => r.name === '--on')?.query, true);
    assert.equal(custom.find((r) => r.name === '--off')?.query, false);
    assert.equal(custom.find((r) => r.name === '--True')?.query, true);
    const screen = custom.find((r) => r.name === '--x');
    assert.ok(screen);
    assert.notEqual(screen.query, true);
    assert.notEqual(screen.query, false);
    assert.equal(custom.some((r) => r.name === '--n'), false);
  });

  test('handlePageRule isFirst NestedDeclarations flatten vs later leftover', () => {
    const firstDecl = parse('@page { color: red; @top-left { content: "x"; } margin: 1cm; }').cssRules[0] as CSSPageRule;
    assert.equal(firstDecl.style.getPropertyValue('color'), 'red');
    assert.equal(firstDecl.style.getPropertyValue('margin'), '');
    const kids = [...firstDecl.cssRules].map((r) => r.constructor.name);
    assert.ok(kids.includes('CSSMarginRule'));
    assert.ok(kids.includes('CSSNestedDeclarations'));

    // first item is a margin rule (isFirst NestedDeclarations F)
    const firstMargin = parse('@page { @top-left { content: "x"; } color: red; }').cssRules[0] as CSSPageRule;
    assert.equal(firstMargin.style.getPropertyValue('color'), '');
    assert.ok(firstMargin.cssRules[0] instanceof CSSMarginRule);
    assert.ok([...firstMargin.cssRules].some((r) => r instanceof CSSNestedDeclarations));
  });

  test('view-transition / counter-style leftover empty name vs named', () => {
    assert.ok(parse('@view-transition {}').cssRules[0] instanceof CSSViewTransitionRule);
    const anon = parse('@counter-style { system: cyclic; }').cssRules[0] as CSSCounterStyleRule;
    assert.ok(anon instanceof CSSCounterStyleRule);
    assert.equal(anon.name, '');
    const named = parse('@counter-style thumbs { system: cyclic; }').cssRules[0] as CSSCounterStyleRule;
    assert.equal(named.name, 'thumbs');
  });
});

describe('MC/DC still-hot unique-cause: isValidSelector / createStyleRule (selectors-4, css-syntax-3 § 5.5.3)', () => {
  test('number / dimension / last . # : / colon-next / delim-hash independently drop the rule', () => {
    assert.deepEqual(selectors('1 { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('1px { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('. { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('# { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('div: { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('div. { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('div# { color: red; } .ok { color: green; }'), ['.ok']);

    // delim `.` next is whitespace, last is ident (not the last-token `.` arm)
    assert.deepEqual(selectors('div. span { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('div.foo { color: red; }'), ['div.foo']);

    // delim `#` anywhere (not last-token only)
    assert.deepEqual(selectors('# #id { color: red; } .ok { color: green; }'), ['.ok']);
    assert.deepEqual(selectors('#id { color: red; }'), ['#id']);

    // colon next ident / function / colon T vs simple-block F
    assert.deepEqual(selectors(':hover { color: red; }'), [':hover']);
    assert.deepEqual(selectors(':is(.a) { color: red; }'), [':is(.a)']);
    assert.deepEqual(selectors('::before { color: red; }'), ['::before']);
    assert.deepEqual(selectors('div: [foo] { color: red; } .ok { color: green; }'), ['.ok']);

    // empty after trim
    assert.deepEqual(selectors(' { color: red; } .ok { color: green; }'), ['.ok']);
  });
});

describe('MC/DC still-hot unique-cause: consumeBlock / consumeFunction / parseComponentValue (css-syntax-3 § 5.5.8–5.5.10)', () => {
  test('`{` vs `[` vs `(` unique-cause of consumeBlock, function vs unclosed vs extra', () => {
    const curly = new Parser(tokenize('{a}')).parseComponentValue();
    assert.equal(curly?.type, 'simple-block');
    assert.equal((curly as { associatedToken: { type: string } }).associatedToken.type, '{');

    const square = new Parser(tokenize('[a]')).parseComponentValue();
    assert.equal(square?.type, 'simple-block');
    assert.equal((square as { associatedToken: { type: string } }).associatedToken.type, '[');

    const paren = new Parser(tokenize('(a)')).parseComponentValue();
    assert.equal(paren?.type, 'simple-block');
    assert.equal((paren as { associatedToken: { type: string } }).associatedToken.type, '(');

    const unclosed = new Parser(tokenize('['));
    const ublock = unclosed.parseComponentValue();
    assert.equal(ublock?.type, 'simple-block');
    assert.equal((ublock as { unclosed?: boolean }).unclosed, true);
    assert.ok(unclosed.errors.some((e) => e.message === 'Unexpected EOF in block'));

    const ufn = new Parser(tokenize('rgb('));
    const fn = ufn.parseComponentValue();
    assert.equal(fn?.type, 'function');
    assert.equal((fn as { name: string }).name, 'rgb');
    assert.equal((fn as { unclosed?: boolean }).unclosed, true);
    assert.ok(ufn.errors.some((e) => e.message === 'Unexpected EOF in function'));

    const closedFn = new Parser(tokenize('rgb(0, 0, 0)')).parseComponentValue();
    assert.equal(closedFn?.type, 'function');
    assert.equal((closedFn as { unclosed?: boolean }).unclosed, undefined);

    // extra tokens after the value (trailing ws then ident)
    assert.equal(new Parser(tokenize('[a] extra')).parseComponentValue(), null);
    // trailing whitespace then EOF unique-cause of the final EOF check T
    const trail = new Parser(tokenize('  red  ')).parseComponentValue();
    assert.equal(trail?.type, 'ident');
    assert.equal(new Parser(tokenize('   ')).parseComponentValue(), null);
  });
});

describe('MC/DC still-hot unique-cause: parseCommaSeparatedList / parseSelector / parseRule / ensureEOF', () => {
  test('comma unique-cause of split vs no-comma vs trailing vs only-comma', () => {
    const none = new Parser(tokenize('red')).parseCommaSeparatedListOfComponentValues();
    assert.equal(none.length, 1);
    assert.equal(none[0][0]?.type, 'ident');

    const trail = new Parser(tokenize('red,')).parseCommaSeparatedListOfComponentValues();
    assert.equal(trail.length, 2);
    assert.equal(trail[1].length, 0);

    const only = new Parser(tokenize(',')).parseCommaSeparatedListOfComponentValues();
    assert.equal(only.length, 2);
    assert.equal(only[0].length, 0);
    assert.equal(only[1].length, 0);
  });

  test('parseSelector leftover of empty serialize vs `{` / `}` / at-keyword', () => {
    assert.equal(Parser.parseSelector('   '), null);
    assert.equal(Parser.parseSelector(''), null);
    assert.equal(Parser.parseSelector('{'), null);
    assert.equal(Parser.parseSelector('}'), null);
    assert.equal(Parser.parseSelector('@media'), null);
    assert.equal(Parser.parseSelector('div.class'), 'div.class');
  });

  test('parseRule vs parseRuleText unique-cause of consumeRule null vs trailing garbage', () => {
    // instance parseRule returns null; parseRuleText throws
    assert.equal(new Parser([]).parseRule(''), null);
    assert.equal(new Parser(tokenize('x')).parseRule('   '), null);
    assert.throws(() => parseRule(''), { name: 'SyntaxError' });

    const ok = new Parser([]).parseRule('div { color: red; }  ');
    assert.ok(ok instanceof CSSStyleRule);
    assert.ok(parseRule('div { color: red; }   ') instanceof CSSStyleRule);

    assert.throws(() => new Parser([]).parseRule('div { color: red; } leftover'), { name: 'SyntaxError' });
    assert.throws(() => parseRule('div { color: red; } leftover'), { name: 'SyntaxError' });

    const p = new Parser(tokenize('  '));
    p.ensureEOF();
    assert.throws(() => new Parser(tokenize('x')).ensureEOF(), { name: 'SyntaxError' });

    assert.equal(parseStyleSheet('div { color: red; }').length, 1);
    assert.equal(new Parser(tokenize('div { color: red; }')).parseStyleSheetContents().length, 1);
    assert.equal(Parser.parseStyleSheetText('div { color: red; }').length, 1);
  });
});

describe('MC/DC still-hot unique-cause: consumeDeclarationsFromBlockContents (css-syntax-3 § 5.5.5)', () => {
  test('`}` vs EOF vs semicolon unique-cause of the stop OR and bad-decl consume', () => {
    // `}` after a finished declaration stops the list (background not parsed)
    const rbrace = new Parser(tokenize('color: red; } background: blue')).parseStyleAttribute();
    assert.equal(rbrace.getPropertyValue('color'), 'red');
    assert.equal(rbrace.getPropertyValue('background'), '');

    // EOF T (no `}`)
    const eof = new Parser(tokenize('color: red; background: blue')).parseStyleAttribute();
    assert.equal(eof.getPropertyValue('background'), 'blue');

    // `}` inside the value is not a terminator of consumeDeclarationFromStream
    const inValue = new Parser(tokenize('color: red } background: blue')).parseStyleAttribute();
    assert.equal(inValue.getPropertyValue('color').includes('red'), true);
    assert.equal(inValue.getPropertyValue('background'), '');

    // bad-decl consume until `}` vs semicolon vs EOF
    const badBrace = new Parser(tokenize('123: red } color: blue')).parseStyleAttribute();
    assert.equal(badBrace.getPropertyValue('color'), '');
    const badSemi = new Parser(tokenize('123: red; color: blue')).parseStyleAttribute();
    assert.equal(badSemi.getPropertyValue('color'), 'blue');
    const badEof = new Parser(tokenize('123: red color: blue')).parseStyleAttribute();
    assert.equal(badEof.getPropertyValue('color'), '');
  });
});

describe('MC/DC still-hot unique-cause: validateVarFunction (css-variables-1 § 3 #using-variables)', () => {
  test('name case, empty vs nonempty curly, mixed curly, comments-only, not-var', () => {
    assert.equal(validateDeclarationValue(new Parser(tokenize('VAR(--x)')).parseComponentValues()), true);
    assert.equal(validateDeclarationValue(new Parser(tokenize('rgb(0, 0, 0)')).parseComponentValues()), true);

    assert.equal(validateDeclarationValue(new Parser(tokenize('var()')).parseComponentValues()), false);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var({})')).parseComponentValues()), false);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var({x})')).parseComponentValues()), true);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var(--x {})')).parseComponentValues()), false);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var(--x, {})')).parseComponentValues()), true);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var([ --x ])')).parseComponentValues()), true);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var(/*c*/)')).parseComponentValues()), false);
    assert.equal(validateDeclarationValue(new Parser(tokenize('var( /*c*/ --x )')).parseComponentValues()), true);
  });
});

describe('MC/DC still-hot unique-cause: resolveVariables / env (css-variables-1 #replace-a-var, css-env-1 #env-function)', { concurrency: false }, () => {
  test('empty value, nested function/block, dashed-ident, trim-empty custom', () => {
    const empty = new CSSStyleDeclaration();
    assert.equal(Parser.resolveVariables(empty, 'color'), '');
    empty.setProperty('color', '   ');
    assert.equal(Parser.resolveVariables(empty, 'color').trim(), '');

    const st = new CSSStyleDeclaration();
    st.setProperty('--x', 'red');
    st.setProperty('color', 'rgb(var(--x), 0, 0)');
    assert.equal(Parser.resolveVariables(st, 'color').includes('red'), true);
    st.setProperty('color', '[var(--x)]');
    assert.equal(Parser.resolveVariables(st, 'color').includes('red'), true);
    st.setProperty('color', 'calc(var(--x))');
    assert.equal(Parser.resolveVariables(st, 'color').includes('red'), true);

    st.setProperty('--empty', '   ');
    st.setProperty('color', 'var(--empty, blue)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'blue');
    st.setProperty('color', 'var(--empty)');
    assert.equal(Parser.resolveVariables(st, 'color'), '');

    st.setProperty('color', 'var(1px, red)');
    assert.equal(Parser.resolveVariables(st, 'color'), '');
    st.setProperty('color', 'var(, red)');
    assert.equal(Parser.resolveVariables(st, 'color'), '');
    st.setProperty('color', 'red');
    assert.equal(Parser.resolveVariables(st, 'color'), 'red');

    assert.equal(Parser.isValidDashedIdent('--foo\tbar'), false);
    assert.equal(Parser.isValidDashedIdent('--foo\nbar'), false);
    assert.equal(Parser.isValidDashedIdent('--foo'), true);
  });

  test('cycle ident, registered * without initial, css-wide leftover, syntax fail', () => {
    PropertyRegistry.clear();
    const cyc = new CSSStyleDeclaration();
    cyc.setProperty('--a', 'var(--a, 10px)');
    cyc.setProperty('color', 'var(--a, blue)');
    // seen starts with `color`; inner var(--a) hits seen and color uses its own fallback
    assert.equal(Parser.resolveVariables(cyc, 'color').trim(), 'blue');
    assert.equal(Parser.resolveVariables(cyc, '--a'), '');

    cyc.setProperty('color', 'var(--a)');
    assert.equal(Parser.resolveVariables(cyc, 'color'), '');

    cyc.setProperty('--a', 'var(--b)');
    cyc.setProperty('--b', 'var(--a)');
    cyc.setProperty('color', 'var(--a, green)');
    assert.equal(Parser.resolveVariables(cyc, 'color').trim(), 'green');

    CSS.registerProperty({ name: '--star-noinit', syntax: '*', inherits: false });
    cyc.setProperty('color', 'var(--star-noinit)');
    assert.equal(Parser.resolveVariables(cyc, 'color'), '');
    cyc.setProperty('color', 'var(--star-noinit, lime)');
    assert.equal(Parser.resolveVariables(cyc, 'color').trim(), 'lime');

    CSS.registerProperty({ name: '--len', syntax: '<length>', inherits: false, initialValue: '1px' });
    cyc.setProperty('--len', 'red');
    cyc.setProperty('width', 'var(--len)');
    assert.equal(Parser.resolveVariables(cyc, 'width').trim(), '1px');
    cyc.setProperty('--len', 'inherit');
    assert.equal(Parser.resolveVariables(cyc, 'width').trim(), 'inherit');
    cyc.setProperty('--len', 'UNSET');
    assert.equal(Parser.resolveVariables(cyc, 'width').trim(), 'UNSET');
    cyc.setProperty('--len', 'revert-layer');
    assert.equal(Parser.resolveVariables(cyc, 'width').trim(), 'revert-layer');
    cyc.setProperty('--len', '2em');
    assert.equal(Parser.resolveVariables(cyc, 'width').trim(), '2em');
    PropertyRegistry.clear();
  });

  test('env() unique-cause of missing ident, indices, map miss/hit, empty fallback', () => {
    const st = new CSSStyleDeclaration();
    st.setProperty('margin', 'env()');
    assert.equal(Parser.resolveVariables(st, 'margin', {}).trim(), 'env()');

    st.setProperty('margin', 'env(safe-area-inset-top)');
    assert.equal(Parser.resolveVariables(st, 'margin'), '');
    st.setProperty('margin', 'env(safe-area-inset-top, 9px)');
    assert.equal(Parser.resolveVariables(st, 'margin').trim(), '9px');
    assert.equal(Parser.resolveVariables(st, 'margin', { 'safe-area-inset-top': '3px' }).trim(), '3px');

    st.setProperty('margin', 'env(safe-area-inset-top 0 1, 9px)');
    assert.equal(Parser.resolveVariables(st, 'margin', { 'safe-area-inset-top': '3px' }).trim(), '9px');
    assert.equal(Parser.resolveVariables(st, 'margin', { 'safe-area-inset-top 0 1': '4px' }).trim(), '4px');

    st.setProperty('margin', 'env(safe-area-inset-top 0 1)');
    assert.equal(Parser.resolveVariables(st, 'margin', { 'safe-area-inset-top': '3px' }), '');

    st.setProperty('margin', 'env(foo, )');
    assert.equal(Parser.resolveVariables(st, 'margin', {}).trim(), '');
  });

  test('custom-property AST cache hit vs eviction at MAX_CACHE_SIZE', () => {
    const st = new CSSStyleDeclaration();
    st.setProperty('--c', 'a');
    st.setProperty('color', 'var(--c)');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'a');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'a');
    st.setProperty('--c', 'b');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'b');
    st.setProperty('--c', 'a');
    assert.equal(Parser.resolveVariables(st, 'color').trim(), 'a');

    for (let i = 0; i < 1001; i++) {
      st.setProperty('--c', `v${i}`);
      assert.equal(Parser.resolveVariables(st, 'color').trim(), `v${i}`);
    }
  });
});

describe('MC/DC still-hot unique-cause: constructor TokenStream vs Array and getAtRuleHandler', () => {
  test('Array.isArray T vs TokenStream else, empty sheet', () => {
    const fromArray = new Parser(tokenize('.a { color: red; }')).parseStyleSheet();
    assert.equal((fromArray.cssRules[0] as CSSStyleRule).selectorText, '.a');
    const fromStream = new Parser(new ArrayTokenStream(tokenize('.a { color: red; }'))).parseStyleSheet();
    assert.equal((fromStream.cssRules[0] as CSSStyleRule).selectorText, '.a');
    assert.equal(new Parser([]).parseStyleSheet().cssRules.length, 0);
    assert.ok(new Parser(tokenize('.a { color: red; }'), {}).parseStyleSheet() instanceof CSSStyleSheet);
  });

  test('endsWith(-keyframes) vs exact keyframes vs unknown leftover', () => {
    assert.ok(parse('@x-keyframes spin { from { color: red; } }').cssRules[0] instanceof CSSKeyframesRule);
    assert.ok(parse('@-WEBkit-KEYFRAMES spin { from { color: red; } }').cssRules[0] instanceof CSSKeyframesRule);
    assert.ok(parse('@KEYFRAMES spin { from { color: red; } }').cssRules[0] instanceof CSSKeyframesRule);
    assert.ok(parse('@notkeyframes spin { from { color: red; } }').cssRules[0] instanceof CSSAtRule);
    assert.ok(parse('@unknown { color: red; }').cssRules[0] instanceof CSSAtRule);
  });

  test('parseRuleInBlock leftover arity-0 / grouping already covered; empty nested', () => {
    assert.throws(() => parseRuleInBlock('', true), { name: 'SyntaxError' });
    const media = parseRuleInBlock('@media all { color: red; }', true);
    assert.ok(media instanceof CSSMediaRule);
    const supports = parseRuleInBlock('@supports (color: red) { color: blue; }', false);
    assert.ok(supports instanceof CSSSupportsRule);
  });
});
