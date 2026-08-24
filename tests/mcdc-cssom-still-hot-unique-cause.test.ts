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
// Verifies: SYS-REQ-260821-YMEY, SYS-REQ-260821-X3KX, SYS-REQ-260821-GR67, SW-REQ-260821-TF5T, SW-REQ-260821-6951, SW-REQ-260821-PAKB, INT-REQ-260821-30ZA, INT-REQ-260821-ZMZR, INT-REQ-260821-MZW3, INT-REQ-260821-WQX9
// Still-hot unique-cause for src/CSSOM.ts helpers that
// tests/mcdc-branch-cssom.test.ts leftover describes do not isolate:
// isImportRule / isNamespaceRule / isRegularRule, serializeGroupingRule,
// findParentStyleSheet / _getNamespaceContext, normalizeKeyframeSelector,
// parsePageSelectorList. Drive public CSSOM APIs (insertRule / deleteRule /
// replaceSync / selectorText / cssText / keyText) plus constructed ducks for
// string-type Rule helpers. cssom-1 § 6.3 #insert-a-css-rule / § 6.4.3
// #the-cssgroupingrule-interface / § 6.4.4 #dom-cssimportrule-stylesheet /
// § 6.4.5 #the-cssnamespacerule-interface / css-page-3 #at-page-rule /
// css-animations-1 #interface-csskeyframesrule / css-namespaces-3
// #css-namespaces / css-nesting-1 #the-cssnesteddeclarations-interface.
// No //mcdc:ignore.
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseRule } from '../src/parser.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokenize } from '../src/tokenizer.ts';
import type { ComponentValue, Declaration, IdentToken, Rule } from '../src/types.ts';
import {
  CSSAtRule,
  CSSConditionRule,
  CSSContainerRule,
  CSSCounterStyleRule,
  CSSCustomMediaRule,
  CSSFontFaceDescriptors,
  CSSFontFaceRule,
  CSSFontFeatureValuesRule,
  CSSGroupingRule,
  CSSImportRule,
  CSSKeyframesRule,
  CSSLayerBlockRule,
  CSSMediaRule,
  CSSNestedDeclarations,
  CSSPageDescriptors,
  CSSPageRule,
  CSSPropertyRule,
  CSSRule,
  CSSScopeRule,
  CSSStartingStyleRule,
  CSSStyleRule,
  CSSStyleSheet,
  CSSSupportsRule,
  CSSViewTransitionRule,
  MediaList,
  StyleSheet,
} from '../src/CSSOM.ts';

function astAtRule(name: string): Rule {
  return { type: 'at-rule', name, prelude: [] } as unknown as Rule;
}

function astStyleRule(): Rule {
  return { type: 'style-rule', selectorText: '.a' } as unknown as Rule;
}

function ident(value: string): IdentToken {
  return { type: 'ident', value };
}

function decl(name: string, css: string): Declaration {
  return {
    type: 'declaration',
    name,
    value: ParseHooks.parseComponentValues(tokenize(css)),
    important: false,
  };
}

function duckParser(text: string): Rule {
  if (text.includes('@import')) return astAtRule('import');
  if (text.includes('@namespace')) return astAtRule('namespace');
  if (text.includes('@media')) return astAtRule('media');
  if (text.includes('@charset')) return astAtRule('charset');
  if (text.includes('@supports')) return astAtRule('supports');
  return astStyleRule();
}

function hre(fn: () => unknown): void {
  assert.throws(fn, { name: 'HierarchyRequestError' });
}

function ise(fn: () => unknown): void {
  assert.throws(fn, { name: 'InvalidStateError' });
}

describe('MC/DC still-hot unique-cause: isImportRule / isNamespaceRule / isRegularRule', () => {
  // cssom-1 § 6.5.3 #insert-a-css-rule / § 6.5.4 #remove-a-css-rule
  // Leftover AST ducks only used name === 'import'/'namespace'. Unique-cause
  // the string-type AND when type === 'at-rule' but name is neither.
  test('string-type at-rule that is not import/namespace is a regular rule', () => {
    const sheet = CSSStyleSheet.createInternal([], duckParser);
    assert.equal(sheet.insertRule('@media all {}', 0), 0);
    assert.equal(sheet.insertRule('@charset "utf-8";', 1), 1);
    // name === 'import' F unique-cause: preceding at-rule is media, not import
    hre(() => sheet.insertRule('@import "x.css";', 2));
    assert.equal(sheet.insertRule('@import "x.css";', 0), 0);
    // isRegularRule T unique-cause via AST media/charset: namespace insert ISE
    ise(() => sheet.insertRule('@namespace x url("http://x");', 3));
    // follow-scan isImportRule/isNamespaceRule both F for AST media
    assert.equal(sheet.insertRule('.z {}', 2), 2);
    sheet.deleteRule(2);
    // delete @namespace is allowed only when no regular rules remain; AST
    // media/charset count as regular so a later namespace cannot be inserted,
    // and deleting the import is fine.
    sheet.deleteRule(0);
    assert.equal(sheet.cssRules.length, 2);
  });

  test('replaceSync strips AST @import and skips parent pointers on duck rules', () => {
    const sheet = new CSSStyleSheet();
    const original = ParseHooks.consumeListOfRules;
    ParseHooks.consumeListOfRules = () => [astAtRule('import'), astAtRule('media'), astStyleRule()];
    try {
      sheet.replaceSync('div { color: red; }');
    } finally {
      ParseHooks.consumeListOfRules = original;
    }
    // isImportRule string-path T dropped; remaining ducks are not CSSRule so
    // instanceof CSSRule F unique-cause of the parentStyleSheet loop.
    assert.equal(sheet.cssRules.length, 2);
    assert.equal((sheet.cssRules[0] as unknown as { type: string }).type, 'at-rule');
    assert.equal((sheet.cssRules[1] as unknown as { type: string }).type, 'style-rule');
  });

  test('grouping hierarchy unique-cause of remaining AST names and parseRule throw', () => {
    const sheet = parse('.host { color: red; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    const original = ParseHooks.parseRule;
    try {
      for (const name of ['supports', 'container', 'layer', 'scope', 'starting-style', 'style']) {
        ParseHooks.parseRule = () => astAtRule(name);
        const before = host.cssRules.length;
        const idx = host.insertRule('.n { color: navy; }', 0);
        assert.equal(idx, 0);
        assert.equal(host.cssRules.length, before + 1);
        host.deleteRule(0);
      }
      // name not in grouping list and not CSSStyleRule → HRE
      ParseHooks.parseRule = () => astAtRule('font-face');
      hre(() => host.insertRule('@font-face { font-family: X; src: url(x); }', 0));
      // catch path: parseRule throw leaves topRule null, insert still parses
      ParseHooks.parseRule = () => {
        throw new Error('parseRule-boom');
      };
      assert.equal(host.insertRule('.caught { color: teal; }', 0), 0);
      assert.equal((host.cssRules[0] as CSSStyleRule).selectorText.includes('.caught'), true);
    } finally {
      ParseHooks.parseRule = original;
    }
  });
});

describe('MC/DC still-hot unique-cause: serializeGroupingRule', () => {
  // cssom-1 § 6.4.3 #the-cssgroupingrule-interface
  // Leftover covered empty @media {\n} and empty @keyframes { }. Unique-cause
  // atKeyword === 'scope' T (keyframes F) and remaining empty at-keywords.
  test('empty scope vs starting-style / layer / supports / container', () => {
    const emptyScope = new CSSScopeRule(null, null, [], parseRule);
    assert.equal(emptyScope.cssText, '@scope { }');
    assert.equal(new CSSScopeRule('(div)', null, [], parseRule).cssText, '@scope (div) { }');
    assert.equal(new CSSScopeRule(null, '(span)', [], parseRule).cssText, '@scope to (span) { }');
    assert.equal(new CSSScopeRule('(div)', '(span)', [], parseRule).cssText, '@scope (div) to (span) { }');

    assert.equal(new CSSStartingStyleRule('', [], parseRule).cssText, '@starting-style {\n}');
    assert.equal(new CSSLayerBlockRule('', [], parseRule).cssText, '@layer {\n}');
    assert.equal(new CSSLayerBlockRule('named', [], parseRule).cssText, '@layer named {\n}');
    assert.equal(new CSSSupportsRule('', [], parseRule).cssText, '@supports {\n}');
    assert.equal(new CSSSupportsRule('(display: grid)', [], parseRule).cssText, '@supports (display: grid) {\n}');
    assert.equal(new CSSContainerRule('(min-width: 1px)', [], parseRule).cssText, '@container (min-width: 1px) {\n}');
    // condition F unique-cause with atKeyword === 'keyframes' T (empty name)
    assert.equal(new CSSKeyframesRule('', []).cssText, '@keyframes { }');
  });

  test('empty nested cssText is filtered; mixed empty/non-empty unique-cause', () => {
    const empty = new CSSNestedDeclarations([]);
    assert.equal(empty.cssText, '');
    const onlyEmpty = new CSSMediaRule('all', [empty], parseRule);
    assert.equal(onlyEmpty.cssText, '@media all {\n}');

    const inner = parse('.a { color: red; }').cssRules[0] as CSSStyleRule;
    const mixed = new CSSMediaRule('screen', [empty, inner], parseRule);
    assert.equal(mixed.cssText, '@media screen {\n  .a { color: red; }\n}');

    const hostEmpty = new CSSStyleRule('.host', [], [empty], parseRule);
    assert.equal(hostEmpty.cssText, '.host { }');
    const decls = ParseHooks.parseStyleAttribute(tokenize('color: red')).declarations;
    const hostDecls = new CSSStyleRule('.host', decls, [empty], parseRule);
    assert.equal(hostDecls.cssText.includes('color: red'), true);
    assert.equal(hostDecls.cssText.includes('.host { }'), false);
  });

  test('CSSAtRule type switch and serializeGroupingRule vs empty/prelude/block', () => {
    assert.equal(new CSSAtRule('import', []).type, CSSRule.IMPORT_RULE);
    assert.equal(new CSSAtRule('charset', []).type, CSSRule.CHARSET_RULE);
    assert.equal(new CSSAtRule('namespace', []).type, CSSRule.NAMESPACE_RULE);
    assert.equal(new CSSAtRule('page', []).type, CSSRule.PAGE_RULE);
    assert.equal(new CSSAtRule('font-face', []).type, CSSRule.FONT_FACE_RULE);
    assert.equal(new CSSAtRule('supports', []).type, CSSRule.SUPPORTS_RULE);
    assert.equal(new CSSAtRule('layer', []).type, 0);
    assert.equal(new CSSAtRule('unknown', []).type, 0);
    assert.equal(new CSSAtRule('IMPORT', []).type, 0);

    assert.equal(new CSSAtRule('unknown', []).cssText, '@unknown;');
    assert.equal(new CSSAtRule('media', [ident('all')]).cssText, '@media all;');

    const emptyBlock = new CSSAtRule('media', [ident('all')], { value: [] as ComponentValue[] });
    assert.equal(emptyBlock.cssText, '@media all { }');

    const filledBlock = new CSSAtRule('media', [], { value: tokenize('color: red') });
    assert.equal(filledBlock.cssText.startsWith('@media {'), true);
    assert.equal(filledBlock.cssText.includes('color'), true);

    const child = parse('.a { color: blue; }').cssRules[0] as CSSStyleRule;
    const grouped = new CSSAtRule('media', [ident('print')], { value: [] as ComponentValue[] }, [child]);
    assert.equal(grouped.cssText, '@media print {\n  .a { color: blue; }\n}');
  });
});

describe('MC/DC still-hot unique-cause: findParentStyleSheet / _getNamespaceContext', () => {
  // cssom-1 § 6.4 #dom-cssrule-parentstylesheet / css-namespaces-3 #css-namespaces
  test('namespace context unique-cause of default prefix, same URI alias, and no sheet', () => {
    const both = parse(`
      @namespace url("http://def");
      @namespace svg url("http://def");
      @namespace other url("http://other");
      div { color: red; }
    `);
    const div = both.cssRules[3] as CSSStyleRule;
    assert.equal(div.selectorText, 'div');
    div.selectorText = 'svg|span';
    assert.equal(div.selectorText, 'span');
    div.selectorText = 'other|span';
    assert.equal(div.selectorText, 'other|span');

    const prefixedOnly = parse('@namespace ns url("http://n"); .a { color: red; }');
    const a = prefixedOnly.cssRules[1] as CSSStyleRule;
    a.selectorText = 'ns|div';
    assert.equal(a.selectorText, 'ns|div');

    const noNs = parse('.a { color: red; } .b { color: blue; }');
    const style = noNs.cssRules[0] as CSSStyleRule;
    style.selectorText = '.z';
    assert.equal(style.selectorText, '.z');

    const orphan = new CSSStyleRule('.orphan', [], [], parseRule);
    orphan.selectorText = '.renamed';
    assert.equal(orphan.selectorText, '.renamed');
    assert.equal(orphan.parentStyleSheet, null);
  });

  test('findParentStyleSheet unique-cause of !sheet vs curr walk', () => {
    const sheet = parse('.host { .mid { .leaf { color: red; } } }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    const mid = host.cssRules[0] as CSSStyleRule;
    const leaf = mid.cssRules[0] as CSSStyleRule;

    Object.defineProperty(leaf, 'parentStyleSheet', { configurable: true, get() { return null; } });
    // parentRule has a sheet: while !sheet F, return immediately
    leaf.selectorText = '.immediate';
    assert.equal(leaf.selectorText.includes('.immediate'), true);

    Object.defineProperty(mid, 'parentStyleSheet', { configurable: true, get() { return null; } });
    // parentRule has parentRule with a sheet: while curr T, then sheet T
    leaf.selectorText = '.walk-once';
    assert.equal(leaf.selectorText.includes('.walk-once'), true);

    Object.defineProperty(host, 'parentStyleSheet', { configurable: true, get() { return null; } });
    // whole chain has no sheet: while curr T then F, return null (orphan context)
    leaf.selectorText = '.walk-none';
    assert.equal(leaf.selectorText.includes('.walk-none'), true);
  });

  test('nested selectorText unique-cause of combinator, implicit &, and ancestor style', () => {
    const sheet = parse('.host { color: red; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    host.insertRule('.child { color: blue; }', 0);
    const child = host.cssRules[0] as CSSStyleRule;
    child.selectorText = '> .x';
    assert.equal(child.selectorText.includes('>'), true);
    child.selectorText = '& .y';
    assert.equal(child.selectorText.includes('&') || child.selectorText.includes('.y'), true);
    child.selectorText = '.z';
    assert.equal(child.selectorText.includes('.z'), true);
    const before = child.selectorText;
    child.selectorText = '###';
    assert.equal(child.selectorText, before);

    const wrapped = parse('.host { @media all { .inner { color: red; } } }');
    const inner = ((wrapped.cssRules[0] as CSSStyleRule).cssRules[0] as CSSMediaRule).cssRules[0] as CSSStyleRule;
    inner.selectorText = '.renamed';
    assert.equal(inner.selectorText.includes('.renamed'), true);

    // constructor.name === 'CSSStyleRule' unique-cause when type !== 1
    const named = { type: 0, constructor: { name: 'CSSStyleRule' }, parentRule: null, parentStyleSheet: sheet } as unknown as CSSRule;
    child.parentRule = named;
    child.selectorText = '.via-name';
    assert.equal(child.selectorText.includes('.via-name'), true);
    child.parentRule = host;
  });
});

describe('MC/DC still-hot unique-cause: normalizeKeyframeSelector', () => {
  // css-animations-1 #dom-csskeyframerule-keytext / #dom-csskeyframesrule-appendrule
  test('inclusive 0%/100% bounds, whitespace, empty comma part, and decimal', () => {
    const sheet = parse('@keyframes move { from { color: red; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    const frame = kf.findRule('from')!;
    frame.keyText = '0%';
    assert.equal(frame.keyText, '0%');
    frame.keyText = '100%';
    assert.equal(frame.keyText, '100%');
    frame.keyText = ' 50% ';
    assert.equal(frame.keyText, '50%');
    frame.keyText = ' to ';
    assert.equal(frame.keyText, '100%');
    frame.keyText = '50.5%';
    assert.equal(frame.keyText, '50.5%');
    frame.keyText = '+0%';
    assert.equal(frame.keyText, '0%');
    frame.keyText = 'FROM, TO';
    assert.equal(frame.keyText, '0%, 100%');
    assert.throws(() => {
      frame.keyText = 'from,';
    }, { name: 'SyntaxError' });
    assert.throws(() => {
      frame.keyText = 'from,,to';
    }, { name: 'SyntaxError' });
    assert.equal(kf.findRule('from,'), null);
    kf.appendRule('0%, 100% { opacity: 0; }');
    assert.ok(kf.findRule('0%, 100%'));
  });
});

describe('MC/DC still-hot unique-cause: parsePageSelectorList', () => {
  // css-page-3 #at-page-rule / #page-selectors / cssom-1 § 6.4.5
  test(':blank / comments / trailing comma / hash / colon-only vs constructor keep-raw', () => {
    const sheet = parse('@page {}');
    const page = sheet.cssRules[0] as CSSPageRule;
    page.selectorText = ':blank';
    assert.equal(page.selectorText, ':blank');
    page.selectorText = ':BLANK';
    assert.equal(page.selectorText, ':blank');
    page.selectorText = ':right';
    assert.equal(page.selectorText, ':right');
    page.selectorText = 'named:blank';
    assert.equal(page.selectorText, 'named:blank');
    page.selectorText = ':first:blank';
    assert.equal(page.selectorText, ':first:blank');
    page.selectorText = '/*c*/:first/*d*/';
    assert.equal(page.selectorText, ':first');
    page.selectorText = ':first, :blank';
    assert.equal(page.selectorText, ':first, :blank');

    const keep = page.selectorText;
    page.selectorText = ':first,';
    assert.equal(page.selectorText, keep);
    page.selectorText = ',:first';
    assert.equal(page.selectorText, keep);
    page.selectorText = 'foo:';
    assert.equal(page.selectorText, keep);
    page.selectorText = '#ident';
    assert.equal(page.selectorText, keep);
    page.selectorText = '1';
    assert.equal(page.selectorText, keep);
    page.selectorText = '/* only */';
    assert.equal(page.selectorText, keep);
    // comments are dropped before the helper; `foo/*x*/:first` is ident+colon+ident
    page.selectorText = 'foo/*x*/:first';
    assert.equal(page.selectorText, 'foo:first');
    const afterComment = page.selectorText;
    page.selectorText = ':first,   ';
    assert.equal(page.selectorText, afterComment);
    page.selectorText = '   , :left';
    assert.equal(page.selectorText, afterComment);

    const raw = new CSSPageRule('not a valid page selector', [], [], parseRule);
    assert.equal(raw.selectorText, 'not a valid page selector');
    const empty = new CSSPageRule('', [], [], parseRule);
    assert.equal(empty.selectorText, '');
    const joined = new CSSPageRule('  Foo:First, :LEFT ', [], [], parseRule);
    assert.equal(joined.selectorText, 'Foo:first, :left');
  });

  test('cssText unique-cause of sel / decls / margin rules combinations', () => {
    const empty = new CSSPageRule('', [], [], parseRule);
    assert.equal(empty.cssText, '@page { }');
    const named = new CSSPageRule(':first', [], [], parseRule);
    assert.equal(named.cssText, '@page :first { }');

    const declsOnly = parse('@page { margin: 1cm; }').cssRules[0] as CSSPageRule;
    assert.equal(declsOnly.cssText.includes('margin'), true);
    assert.equal(declsOnly.cssText.includes('@top-'), false);

    const rulesOnly = parse('@page { @top-left { content: "x"; } }').cssRules[0] as CSSPageRule;
    assert.equal(rulesOnly.style.cssText.trim(), '');
    assert.equal(rulesOnly.cssText.includes('@top-left'), true);

    const both = parse('@page :left { margin: 2cm; @top-right { content: "y"; } }').cssRules[0] as CSSPageRule;
    assert.equal(both.cssText.includes('margin'), true);
    assert.equal(both.cssText.includes('@top-right'), true);
    const before = both.cssText;
    both.cssText = '@page {}';
    assert.equal(both.cssText, before);
  });
});

describe('MC/DC still-hot unique-cause: CSSContainerRule constructor / conditionText', () => {
  // css-conditional-5 § 4 #the-csscontainerrule-interface
  test('reserved name unique-cause of not/and/or/none vs name-only vs explicit', () => {
    const and = new CSSContainerRule('and (width > 1px)', [], parseRule);
    assert.equal(and.containerName, '');
    assert.equal(and.containerQuery, 'and (width > 1px)');
    const or = new CSSContainerRule('or (width > 1px)', [], parseRule);
    assert.equal(or.containerName, '');
    const none = new CSSContainerRule('none (width > 1px)', [], parseRule);
    assert.equal(none.containerName, '');
    const notUpper = new CSSContainerRule('NOT (width > 1px)', [], parseRule);
    assert.equal(notUpper.containerName, '');
    const paren = new CSSContainerRule('(inline-size > 1px)', [], parseRule);
    assert.equal(paren.containerName, '');
    assert.equal(paren.conditionText, '(inline-size > 1px)');

    const nameOnly = new CSSContainerRule('card', [], parseRule);
    assert.equal(nameOnly.containerName, 'card');
    assert.equal(nameOnly.containerQuery, '');
    assert.equal(nameOnly.conditionText, 'card');

    const reservedSingle = new CSSContainerRule('not', [], parseRule);
    assert.equal(reservedSingle.containerName, '');
    assert.equal(reservedSingle.containerQuery, 'not');

    const empty = new CSSContainerRule('', [], parseRule);
    assert.equal(empty.containerName, '');
    assert.equal(empty.containerQuery, '');
    assert.equal(empty.conditionText, '');

    const explicit = new CSSContainerRule('ignored (q)', [], parseRule, 'keep');
    assert.equal(explicit.containerName, 'keep');
    assert.equal(explicit.containerQuery, 'ignored (q)');
    assert.equal(explicit.conditionText, 'keep ignored (q)');

    const nameAndQuery = new CSSContainerRule('card (min-width: 1px)', [], parseRule);
    assert.equal(nameAndQuery.containerName, 'card');
    assert.equal(nameAndQuery.containerQuery, '(min-width: 1px)');
    assert.equal(nameAndQuery.conditionText, 'card (min-width: 1px)');
  });
});

describe('MC/DC still-hot unique-cause: CSSImportRule / CSSCustomMediaRule / CSSViewTransitionRule cssText helpers', () => {
  test('layerName empty vs null, supportsText empty vs null, mediaStr F', () => {
    const bare = new CSSImportRule('a.css');
    assert.equal(bare.cssText, '@import url("a.css");');
    assert.equal(bare.layerName, null);
    assert.equal(bare.supportsText, null);
    // cssom-1 § 6.4.3 #dom-cssimportrule-stylesheet: the associated stylesheet
    // object exists once the rule exists (never null); offline parser never
    // fetches, so it is empty until a host populates it via replaceSync().
    assert.ok(bare.styleSheet instanceof CSSStyleSheet);
    assert.equal(bare.styleSheet.ownerRule, bare);
    assert.equal(bare.styleSheet.cssRules.length, 0);

    const anon = new CSSImportRule('a.css', '', '');
    assert.equal(anon.layerName, '');
    assert.equal(anon.cssText, '@import url("a.css") layer;');

    const supportsEmpty = new CSSImportRule('a.css', '', null, '');
    assert.equal(supportsEmpty.supportsText, '');
    assert.equal(supportsEmpty.cssText, '@import url("a.css") supports();');

    const full = new CSSImportRule('a.css', 'screen', 'base', 'display: grid');
    assert.equal(full.cssText, '@import url("a.css") layer(base) supports(display: grid) screen;');
  });

  test('custom-media boolean vs empty MediaList vs filled', () => {
    assert.equal(new CSSCustomMediaRule('--x', true).cssText, '@custom-media --x true;');
    assert.equal(new CSSCustomMediaRule('--x', false).cssText, '@custom-media --x false;');
    assert.equal(new CSSCustomMediaRule('--x', new MediaList('')).cssText, '@custom-media --x;');
    assert.equal(new CSSCustomMediaRule('--x', new MediaList('screen')).cssText, '@custom-media --x screen;');
  });

  test('view-transition navigation missing vs other decl vs navigation', () => {
    assert.equal(new CSSViewTransitionRule([]).navigation, 'none');
    assert.equal(new CSSViewTransitionRule([decl('other', 'auto')]).navigation, 'none');
    assert.equal(new CSSViewTransitionRule([decl('navigation', 'auto')]).navigation, 'auto');
  });
});

describe('MC/DC still-hot unique-cause: remaining CSSOM helper getters / constructors', () => {
  test('StyleSheet title unique-cause of missing getAttribute / null / _titleVal', () => {
    const sheet = new CSSStyleSheet();
    assert.equal(sheet.title, null);
    (sheet as unknown as { _titleVal: string })._titleVal = 'from-field';
    assert.equal(sheet.title, 'from-field');

    (sheet as unknown as { _ownerNode: unknown })._ownerNode = { notGetAttribute: true };
    assert.equal(sheet.title, 'from-field');

    const nullTitle = { getAttribute: (_name: string) => null };
    (sheet as unknown as { _ownerNode: unknown })._ownerNode = nullTitle;
    assert.equal(sheet.title, null);

    const viaMediaList = new CSSStyleSheet({ media: new MediaList('tv'), disabled: false, baseURL: null });
    assert.equal(viaMediaList.media.mediaText, 'tv');
    assert.equal(viaMediaList._baseURL, null);
    assert.equal(viaMediaList.disabled, false);
  });

  test('addRule defaults, parentStyleSheet via ownerRule, CSSRule parent walk', () => {
    const sheet = new CSSStyleSheet();
    sheet.addRule();
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, 'undefined');
    sheet.addRule('.only-selector');
    assert.equal(sheet.cssRules.length, 2);
    sheet.removeRule();
    assert.equal(sheet.cssRules.length, 1);

    const child = new CSSStyleSheet();
    const parent = parse('.a { color: red; }');
    (child as unknown as { _ownerRule: CSSRule })._ownerRule = parent.cssRules[0];
    assert.equal(child.parentStyleSheet, parent);

    const nested = parse('@media all { .a { color: red; } }');
    const media = nested.cssRules[0] as CSSMediaRule;
    const inner = media.cssRules[0] as CSSStyleRule;
    assert.equal(inner.parentStyleSheet, nested);
    inner.parentStyleSheet = null;
    assert.equal(inner.parentStyleSheet, nested);
    inner.parentRule = null;
    assert.equal(inner.parentStyleSheet, null);
  });

  test('nested declarations supported property, CSSPropertyRule null initial, font-face empty', () => {
    const sheet = parse('.host { color: red; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    const idx = host.insertRule('color: blue;', 0);
    assert.equal(idx, 0);
    assert.ok(host.cssRules[0] instanceof CSSNestedDeclarations);
    assert.equal((host.cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('color'), 'blue');

    const noInit = new CSSPropertyRule('--x', '*', false, null);
    assert.equal(noInit.cssText.includes('initial-value'), false);
    const withInit = new CSSPropertyRule('--x', '*', true, '0');
    assert.equal(withInit.cssText.includes('initial-value: 0'), true);

    assert.equal(new CSSFontFaceRule([]).cssText, '@font-face {}');
    const ff = parse('@font-face { font-family: X; src: url(x); font-display: swap; }').cssRules[0] as CSSFontFaceRule;
    assert.equal(ff.cssText.includes('font-display'), true);
    const desc = new CSSFontFaceDescriptors();
    desc.setProperty('font-display', 'optional');
    assert.equal(desc.getPropertyValue('font-display'), 'optional');
    desc.setProperty('color', 'red');
    assert.equal(desc.getPropertyValue('color'), 'red');
    const pageDesc = new CSSPageDescriptors();
    pageDesc.setProperty('size', 'A4');
    assert.equal(pageDesc.getPropertyValue('size'), 'A4');
    pageDesc.setProperty('marks', 'crop');
    assert.equal(pageDesc.getPropertyValue('marks'), 'crop');
  });

  test('counter-style string/non-array values, empty cssText, font-feature maps leftover', () => {
    const mixed = new CSSCounterStyleRule('x', [
      { type: 'declaration', name: 'system', value: 'cyclic' as unknown as ComponentValue[], important: false },
      { type: 'declaration', name: 'symbols', value: 1 as unknown as ComponentValue[], important: false },
      { type: 'declaration', name: 'unknown', value: tokenize('*'), important: false },
    ]);
    assert.equal(mixed.system, 'cyclic');
    assert.equal(mixed.symbols, '');
    assert.equal(new CSSCounterStyleRule('empty').cssText, '@counter-style empty {}');

    const emptyFf = new CSSFontFeatureValuesRule('Fancy');
    assert.equal(emptyFf.cssText, '@font-feature-values Fancy {}');
    emptyFf.annotation.set('a', 1);
    emptyFf.ornaments.set('o', [2]);
    emptyFf.stylistic.set('s', 3);
    emptyFf.characterVariant.set('cv', [4, 5]);
    emptyFf.styleset.set('ss', 6);
    emptyFf.historicalForms.set('h', 7);
    const text = emptyFf.cssText;
    assert.equal(text.includes('@annotation'), true);
    assert.equal(text.includes('@ornaments'), true);
    assert.equal(text.includes('@stylistic'), true);
    assert.equal(text.includes('@character-variant'), true);
    assert.equal(text.includes('@styleset'), true);
    assert.equal(text.includes('@historical-forms'), true);

    assert.equal(new CSSConditionRule([], parseRule).conditionText, '');
    assert.ok(new CSSMediaRule('all', [], parseRule) instanceof CSSGroupingRule);
  });

  test('StyleSheet media setter remaining and CSSStyleRule cssText no-rules body', () => {
    const sheet = new CSSStyleSheet();
    sheet.media = 'screen';
    assert.equal(sheet.media.mediaText, 'screen');
    const asSheet: StyleSheet = sheet;
    asSheet.media = new MediaList('print');
    assert.equal(sheet.media.mediaText, 'print');

    const empty = parse('.a {}').cssRules[0] as CSSStyleRule;
    assert.equal(empty.cssText, '.a { }');
    const decls = parse('.a { color: red; }').cssRules[0] as CSSStyleRule;
    assert.equal(decls.cssText, '.a { color: red; }');
    const nested = parse('.a { .b { color: blue; } }').cssRules[0] as CSSStyleRule;
    assert.equal(nested.cssText.includes('.b'), true);
    const both = parse('.a { color: red; .b { color: blue; } }').cssRules[0] as CSSStyleRule;
    assert.equal(both.cssText.includes('color: red'), true);
    assert.equal(both.cssText.includes('.b'), true);
  });
});
