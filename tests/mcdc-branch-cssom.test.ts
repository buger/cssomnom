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
// Verifies: SYS-REQ-260821-YMEY, SYS-REQ-260821-X3KX, SYS-REQ-260821-GR67, SW-REQ-260821-TF5T, SW-REQ-260821-6951, SW-REQ-260821-PAKB, INT-REQ-260821-30ZA, INT-REQ-260821-ZMZR, INT-REQ-260821-MZW3
import '../src/parser.ts';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, parseRule } from '../src/parser.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { tokenize } from '../src/tokenizer.ts';
import type { Rule } from '../src/types.ts';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSRuleList,
  CSSImportRule,
  CSSNamespaceRule,
  CSSMediaRule,
  CSSKeyframesRule,
  CSSKeyframeRule,
  CSSPageRule,
  CSSPropertyRule,
  CSSLayerStatementRule,
  CSSLayerBlockRule,
  CSSContainerRule,
  CSSScopeRule,
  CSSViewTransitionRule,
  CSSStartingStyleRule,
  CSSCounterStyleRule,
  CSSFontFeatureValuesRule,
  CSSFontFeatureValuesMap,
  CSSCustomMediaRule,
  CSSMarginRule,
  CSSSupportsRule,
  CSSNestedDeclarations,
  StyleSheetList,
  MediaList,
} from '../src/CSSOM.ts';

function astAtRule(name: string): Rule {
  return { type: 'at-rule', name, prelude: [] } as unknown as Rule;
}

function astStyleRule(): Rule {
  return { type: 'style-rule', selectorText: '.a' } as unknown as Rule;
}

describe('MC/DC branch: StyleSheetList, MediaList, StyleSheet', () => {
  test('StyleSheetList item, length, and iterator', () => {
    const a = new CSSStyleSheet();
    const b = new CSSStyleSheet();
    const list = new StyleSheetList([a, b]);
    assert.equal(list.length, 2);
    assert.equal(list.item(0), a);
    assert.equal(list.item(1), b);
    assert.equal(list.item(2), null);
    assert.deepEqual([...list], [a, b]);
  });

  test('MediaList empty setter, append duplicate no-op, deleteMedium errors', () => {
    const media = new MediaList('');
    assert.equal(media.length, 0);
    assert.equal(media.item(0), null);
    assert.equal(media.toString(), '');

    media.mediaText = 'screen, print';
    assert.equal(media.length, 2);
    media.appendMedium('screen');
    assert.equal(media.length, 2);
    media.appendMedium('tv, tty');
    assert.equal(media.length, 2);
    media.appendMedium('speech');
    assert.equal(media.length, 3);
    assert.ok([...media].includes('speech'));

    media.deleteMedium('speech');
    assert.equal(media.length, 2);
    assert.throws(() => media.deleteMedium('speech'), { name: 'NotFoundError' });
    assert.throws(() => media.deleteMedium('screen, print'), { name: 'NotFoundError' });
    assert.throws(() => (media.deleteMedium as (m?: string) => void)(), { name: 'TypeError' });

    media.mediaText = '';
    assert.equal(media.length, 0);
  });

  test('StyleSheet title from ownerNode, media setter variants, disabled', () => {
    const sheet = new CSSStyleSheet({ media: 'screen', disabled: true });
    assert.equal(sheet.disabled, true);
    assert.equal(sheet.media.mediaText, 'screen');
    sheet.disabled = false;
    sheet.media = 'print';
    assert.equal(sheet.media.mediaText, 'print');
    sheet.media = new MediaList('tv');
    assert.equal(sheet.media.mediaText, 'tv');
    sheet.media = null;
    assert.equal(sheet.media.mediaText, '');
    assert.equal(sheet.title, null);

    const owner = { getAttribute: (name: string) => (name === 'title' ? 'brand' : null) };
    (sheet as unknown as { _ownerNode: unknown })._ownerNode = owner;
    assert.equal(sheet.title, 'brand');
    const emptyTitle = { getAttribute: () => '' };
    (sheet as unknown as { _ownerNode: unknown })._ownerNode = emptyTitle;
    assert.equal(sheet.title, null);
  });
});

describe('MC/DC branch: CSSStyleSheet insertRule / deleteRule / replace', () => {
  test('constructed insertRule rejects @import and out-of-range index', () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('div { color: red; }');
    assert.throws(() => sheet.insertRule('@import "x.css";', 0), { name: 'SyntaxError' });
    assert.throws(() => sheet.insertRule('p { color: blue; }', 9), { name: 'IndexSizeError' });
    assert.throws(() => sheet.insertRule('p { color: blue; }', -1), { name: 'IndexSizeError' });
    const idx = sheet.insertRule('span { color: green; }', 1);
    assert.equal(idx, 1);
    assert.equal(sheet.cssRules.length, 2);
  });

  test('non-constructed sheet enforces @import / @namespace / regular order', () => {
    const parsed = parse('@import "a.css"; @namespace ns url("http://n"); .a { color: red; }');
    assert.throws(() => parsed.insertRule('.b { color: blue; }', 0), { name: 'HierarchyRequestError' });
    assert.throws(() => parsed.insertRule('@namespace x url("http://x");', 3), { name: 'InvalidStateError' });
    const importIdx = parsed.insertRule('@import "b.css";', 1);
    assert.equal(importIdx, 1);
    assert.throws(() => parsed.deleteRule(2), { name: 'InvalidStateError' });
    parsed.deleteRule(parsed.cssRules.length - 1);
    assert.equal([...parsed.cssRules].some((r) => r instanceof CSSStyleRule), false);
  });

  test('origin-clean false throws SecurityError on cssRules, insertRule, deleteRule', () => {
    const tainted = CSSStyleSheet.createInternal([], parseRule, false);
    assert.throws(() => tainted.cssRules, { name: 'SecurityError' });
    assert.throws(() => tainted.insertRule('div { color: red; }'), { name: 'SecurityError' });
    assert.throws(() => tainted.deleteRule(0), { name: 'SecurityError' });
  });

  test('replaceSync strips @import; replace populates cssRules before returning', async () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@import "nope.css"; .ok { color: red; }');
    assert.equal(sheet.cssRules.length, 1);
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);

    const pending = sheet.replace('.next { color: blue; }');
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.next');
    const resolved = await pending;
    assert.equal(resolved, sheet);

    const internal = parse('div { color: red; }');
    assert.throws(() => internal.replaceSync('p {}'), { name: 'NotAllowedError' });
    await assert.rejects(() => internal.replace('p {}'), { name: 'NotAllowedError' });
  });

  test('legacy addRule / removeRule and rules alias', () => {
    const sheet = new CSSStyleSheet();
    sheet.addRule('.a', 'color: red', 0);
    assert.equal(sheet.rules.length, 1);
    assert.equal((sheet.rules[0] as CSSStyleRule).selectorText, '.a');
    sheet.addRule('.b', '', 1);
    assert.equal(sheet.cssRules.length, 2);
    sheet.removeRule(0);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.b');
  });

  test('baseURL is resolved; invalid baseURL throws NotAllowedError', () => {
    const sheet = new CSSStyleSheet({ baseURL: 'https://example.com/sheet.css' });
    assert.equal(sheet._baseURL, 'https://example.com/sheet.css');
    assert.equal(sheet.isConstructed, true);
    assert.throws(() => new CSSStyleSheet({ baseURL: 'http://[bad' }), { name: 'NotAllowedError' });
  });

  test('deleteRule unregisters @property names stored on the sheet', () => {
    const sheet = parse('@property --gone { syntax: "*"; inherits: false; initial-value: 0; } .keep { color: red; }');
    assert.ok(sheet.cssRules[0] instanceof CSSPropertyRule);
    sheet.deleteRule(0);
    assert.equal(sheet.cssRules[0] instanceof CSSStyleRule, true);
  });
});

describe('MC/DC branch: grouping insertRule, keyframes, page, import cssText', () => {
  test('grouping insertRule rejects @import/@namespace and out of range', () => {
    const sheet = parse('@media all { .a { color: red; } }');
    const media = sheet.cssRules[0] as CSSMediaRule;
    assert.throws(() => media.insertRule('@import "x.css";', 0), { name: 'HierarchyRequestError' });
    assert.throws(() => media.insertRule('div {}', 9), { name: 'IndexSizeError' });
    const idx = media.insertRule('.b { color: blue; }', 1);
    assert.equal(idx, 1);
    media.deleteRule(1);
    assert.equal(media.cssRules.length, 1);
  });

  test('nested style insertRule accepts nested style and rejects @font-face', () => {
    const sheet = parse('.host { color: red; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    host.insertRule('.child { color: blue; }', 0);
    assert.ok(host.cssRules[0] instanceof CSSStyleRule);
    assert.throws(() => host.insertRule('@font-face { font-family: X; src: url(x); }', 0), { name: 'HierarchyRequestError' });
  });

  test('CSSKeyframesRule find/append/delete and invalid selectors', () => {
    const sheet = parse('@keyframes move { from { color: red; } 50% { color: green; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    assert.equal(kf[0] instanceof CSSKeyframeRule, true);
    assert.equal(kf.findRule('FROM')?.keyText, '0%');
    kf.appendRule('to { color: blue; }');
    assert.ok(kf.findRule('100%'));
    kf.appendRule('not-a-selector { color: black; }');
    kf.appendRule('missing-braces');
    assert.equal(kf.findRule('not-a-selector'), null);
    kf.deleteRule('from');
    assert.equal(kf.findRule('0%'), null);
    kf.deleteRule('nope');
    const frame = kf.findRule('50%')!;
    frame.keyText = '40%';
    assert.equal(frame.keyText, '40%');
    assert.throws(() => {
      frame.keyText = 'nope';
    }, { name: 'SyntaxError' });
    kf.name = 'none';
    assert.equal(kf.cssText.includes('"none"') || kf.cssText.includes("'none'"), true);
  });

  test('CSSPageRule selectorText setter ignores invalid lists and serializes :first,:left', () => {
    const sheet = parse('@page :first { margin: 1cm; @top-left { content: "x"; } }');
    const page = sheet.cssRules[0] as CSSPageRule;
    page.selectorText = ':left, :right';
    assert.equal(page.selectorText.includes('left'), true);
    const before = page.selectorText;
    page.selectorText = 'not a valid page selector list';
    assert.equal(page.selectorText, before);
    page.selectorText = '';
    assert.equal(page.selectorText, '');
    assert.ok(page.cssText.startsWith('@page'));
    assert.ok([...page.cssRules].some((r) => r instanceof CSSMarginRule));
  });

  test('CSSImportRule and CSSNamespaceRule cssText and media setter', () => {
    const sheet = parse('@import url("https://ex.com/a.css") layer(base) supports(display: grid) screen; @namespace svg url("http://www.w3.org/2000/svg");');
    const imp = sheet.cssRules[0] as CSSImportRule;
    assert.equal(imp.cssText.includes('layer(base)'), true);
    assert.equal(imp.cssText.includes('supports('), true);
    assert.equal(Object.prototype.toString.call(imp), '[object CSSImportRule]');
    imp.media = 'print';
    assert.equal(imp.media.mediaText, 'print');
    imp.media = null;
    assert.equal(imp.media.mediaText, '');
    imp.media = new MediaList('tv');
    assert.equal(imp.media.mediaText, 'tv');

    const ns = sheet.cssRules[1] as CSSNamespaceRule;
    assert.equal(ns.cssText.includes('svg'), true);
    assert.equal(Object.prototype.toString.call(ns), '[object CSSNamespaceRule]');
    const def = parse('@namespace url("http://www.w3.org/1999/xhtml");');
    assert.equal((def.cssRules[0] as CSSNamespaceRule).cssText.includes('url('), true);
  });
});

describe('MC/DC branch: remaining CSSOM rule types and lists', () => {
  test('CSSRuleList item and iterator over live rules', () => {
    const sheet = parse('.a { color: red; } .b { color: blue; }');
    const list: CSSRuleList = sheet.cssRules;
    assert.equal(list.length, 2);
    assert.equal(list.item(0)?.type, 1);
    assert.equal(list.item(9), null);
    assert.equal([...list].length, 2);
  });

  test('instance CSSRule type constants and parentStyleSheet via parentRule', () => {
    const sheet = parse('@media all { .a { color: red; } }');
    const media = sheet.cssRules[0] as CSSMediaRule;
    const inner = media.cssRules[0] as CSSStyleRule;
    assert.equal(inner.STYLE_RULE, 1);
    assert.equal(inner.IMPORT_RULE, 3);
    assert.equal(inner.MEDIA_RULE, 4);
    assert.equal(inner.parentStyleSheet, sheet);
    assert.equal(media.conditionText, media.media.mediaText);
    inner.selectorText = '.renamed';
    assert.equal(inner.selectorText, '.renamed');
    inner.style = 'color: green';
    assert.equal(inner.style.getPropertyValue('color'), 'green');
  });

  test('layer, container, scope, starting-style, view-transition, custom-media cssText', () => {
    const sheet = parse(`
      @layer a, b;
      @layer named { p { color: red; } }
      @container card (min-width: 10px) { p { color: blue; } }
      @scope (div) to (span) { p { color: green; } }
      @starting-style { p { opacity: 0; } }
      @view-transition { navigation: auto; }
      @custom-media --wide (min-width: 600px);
    `);
    assert.ok((sheet.cssRules[0] as CSSLayerStatementRule).cssText.includes('@layer a, b'));
    assert.ok((sheet.cssRules[1] as CSSLayerBlockRule).cssText.includes('@layer named'));
    const container = sheet.cssRules[2] as CSSContainerRule;
    assert.equal(container.containerName, 'card');
    assert.equal(container.conditionText.includes('card'), true);
    const scope = sheet.cssRules[3] as CSSScopeRule;
    assert.ok(scope.cssText.includes('to'));
    assert.ok((sheet.cssRules[4] as CSSStartingStyleRule).cssText.includes('starting-style'));
    assert.ok((sheet.cssRules[5] as CSSViewTransitionRule).cssText.includes('navigation'));
    assert.ok((sheet.cssRules[6] as CSSCustomMediaRule).cssText.includes('--wide'));
  });

  test('CSSCounterStyleRule descriptors and CSSFontFeatureValuesMap mutators', () => {
    const sheet = parse('@counter-style thumbs { system: cyclic; symbols: "*"; suffix: " "; }');
    const cs = sheet.cssRules[0] as CSSCounterStyleRule;
    cs.name = 'renamed';
    cs.system = 'numeric';
    cs.symbols = '"1"';
    cs.additiveSymbols = '5 "V"';
    cs.negative = '"-"';
    cs.prefix = '"("';
    cs.suffix = '")"';
    cs.range = '1 10';
    cs.pad = '2 "0"';
    cs.speakAs = 'auto';
    cs.fallback = 'decimal';
    assert.equal(cs.name, 'renamed');
    assert.equal(cs.system, 'numeric');
    assert.equal(cs.cssText.includes('@counter-style renamed'), true);
    assert.equal(Object.prototype.toString.call(cs), '[object CSSCounterStyleRule]');

    const map = new CSSFontFeatureValuesMap();
    map.set('swish', 1);
    map.set('pair', [2, 3]);
    assert.equal(map.size, 2);
    assert.equal(map.has('swish'), true);
    assert.deepEqual(map.get('pair'), [2, 3]);
    assert.deepEqual([...map.keys()], ['swish', 'pair']);
    assert.ok([...map.values()].length === 2);
    assert.ok([...map.entries()].length === 2);
    assert.ok([...map].length === 2);
    assert.equal(map.delete('swish'), true);
    map.clear();
    assert.equal(map.size, 0);
    assert.equal(Object.prototype.toString.call(map), '[object CSSFontFeatureValuesMap]');

    const ff = parse('@font-feature-values Fancy { @swash { swishy: 1; } }').cssRules[0] as CSSFontFeatureValuesRule;
    ff.fontFamily = 'Other';
    assert.equal(ff.fontFamily, 'Other');
    assert.ok(ff.cssText.includes('@swash'));
  });

  test('CSSRuleList constructed from a static array still indexes', () => {
    const sheet = parse('.a{} .b{}');
    const frozen = new CSSRuleList([sheet.cssRules[0], sheet.cssRules[1]]);
    assert.equal(frozen.length, 2);
    assert.equal(frozen.item(1)?.type, 1);
  });
});

describe('MC/DC leftover: CSSStyleSheet insertRule unique-cause', () => {
  test('disallow-modification and SyntaxError from consumeRule null', () => {
    const blocked = new CSSStyleSheet();
    (blocked as unknown as { _disallowModificationFlag: boolean })._disallowModificationFlag = true;
    assert.throws(() => blocked.insertRule('div { color: red; }', 0), { name: 'NotAllowedError' });

    const sheet = new CSSStyleSheet();
    assert.throws(() => sheet.insertRule('!!!not-a-rule', 0), { name: 'SyntaxError' });
    assert.throws(() => sheet.insertRule('', 0), { name: 'SyntaxError' });
    const idx = sheet.insertRule('div { color: red; }');
    assert.equal(idx, 0);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, 'div');
  });

  test('@import after a non-import and @namespace before a remaining @import', () => {
    const withNs = parse('@import "a.css"; @namespace ns url("http://n");');
    assert.throws(() => withNs.insertRule('@import "b.css";', 2), { name: 'HierarchyRequestError' });

    const importsOnly = parse('@import "a.css"; @import "b.css";');
    assert.throws(() => importsOnly.insertRule('@namespace x url("http://x");', 0), { name: 'HierarchyRequestError' });
    const nsIdx = importsOnly.insertRule('@namespace x url("http://x");', 2);
    assert.equal(nsIdx, 2);
    assert.ok(importsOnly.cssRules[2] instanceof CSSNamespaceRule);
  });

  test('regular rule at a @namespace index is HierarchyRequestError', () => {
    const sheet = parse('@import "a.css"; @namespace ns url("http://n"); .a { color: red; }');
    assert.throws(() => sheet.insertRule('.b { color: blue; }', 1), { name: 'HierarchyRequestError' });
    const idx = sheet.insertRule('.c { color: green; }', 3);
    assert.equal(idx, 3);
    assert.equal((sheet.cssRules[3] as CSSStyleRule).selectorText, '.c');
  });

  test('AST duck-typed @import/@namespace use the string-type helpers', () => {
    const sheet = CSSStyleSheet.createInternal([], (text: string) => {
      if (text.includes('@import')) return astAtRule('import');
      if (text.includes('@namespace')) return astAtRule('namespace');
      return astStyleRule();
    });
    assert.equal(sheet.insertRule('@import "x.css";', 0), 0);
    assert.equal(sheet.insertRule('@namespace x url("http://x");', 1), 1);
    assert.throws(() => sheet.insertRule('@import "y.css";', 2), { name: 'HierarchyRequestError' });
    assert.throws(() => sheet.insertRule('.a {}', 0), { name: 'HierarchyRequestError' });
    assert.equal(sheet.cssRules.length, 2);
  });

  test('insertRule of @property registers then stays on the sheet', () => {
    const sheet = parse('.keep { color: red; }');
    const idx = sheet.insertRule('@property --mcdc-sheet { syntax: "*"; inherits: false; initial-value: 0; }', 0);
    assert.equal(idx, 0);
    assert.ok(sheet.cssRules[0] instanceof CSSPropertyRule);
    assert.equal((sheet.cssRules[0] as CSSPropertyRule).name, '--mcdc-sheet');
  });
});

describe('MC/DC leftover: CSSStyleSheet deleteRule unique-cause', () => {
  test('disallow-modification and IndexSizeError bounds', () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('.a { color: red; } .b { color: blue; }');
    (sheet as unknown as { _disallowModificationFlag: boolean })._disallowModificationFlag = true;
    assert.throws(() => sheet.deleteRule(0), { name: 'NotAllowedError' });
    (sheet as unknown as { _disallowModificationFlag: boolean })._disallowModificationFlag = false;

    assert.throws(() => sheet.deleteRule(-1), { name: 'IndexSizeError' });
    assert.throws(() => sheet.deleteRule(9), { name: 'IndexSizeError' });
    sheet.deleteRule(0);
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.b');
  });

  test('deleting @namespace is allowed when only imports/namespaces remain', () => {
    const sheet = parse('@import "a.css"; @namespace ns url("http://n");');
    sheet.deleteRule(1);
    assert.equal(sheet.cssRules.length, 1);
    assert.ok(sheet.cssRules[0] instanceof CSSImportRule);
    sheet.deleteRule(0);
    assert.equal(sheet.cssRules.length, 0);
  });

  test('deleteRule of a failed @property register still removes the rule', () => {
    const bad = new CSSPropertyRule('--', 'not-a-syntax', false, null);
    const warn = console.warn;
    console.warn = () => {};
    try {
      const sheet = CSSStyleSheet.createInternal([bad], () => bad);
      assert.equal(sheet.cssRules.length, 1);
      sheet.deleteRule(0);
      assert.equal(sheet.cssRules.length, 0);
    } finally {
      console.warn = warn;
    }
  });
});

describe('MC/DC leftover: replace / replaceSync unique-cause', () => {
  test('disallow-modification rejects replace and replaceSync with NotAllowedError', async () => {
    const sheet = new CSSStyleSheet();
    (sheet as unknown as { _disallowModificationFlag: boolean })._disallowModificationFlag = true;
    assert.throws(() => sheet.replaceSync('div { color: red; }'), { name: 'NotAllowedError' });
    await assert.rejects(() => sheet.replace('div { color: red; }'), { name: 'NotAllowedError' });
  });

  test('replace rejects when replaceSync throws from consumeListOfRules', async () => {
    const sheet = new CSSStyleSheet();
    const original = ParseHooks.consumeListOfRules;
    ParseHooks.consumeListOfRules = () => {
      throw new Error('replace-sync-parse-boom');
    };
    try {
      await assert.rejects(() => sheet.replace('div { color: red; }'), { message: 'replace-sync-parse-boom' });
      assert.equal(sheet.cssRules.length, 0);
    } finally {
      ParseHooks.consumeListOfRules = original;
    }
  });

  test('replaceSync strips @import-only input and clears parentStyleSheet on replaced rules', () => {
    const sheet = new CSSStyleSheet();
    sheet.replaceSync('@property --mcdc-gone { syntax: "*"; inherits: false; initial-value: 0; } .a { color: red; }');
    assert.equal(sheet.cssRules.length, 2);
    const previous = sheet.cssRules[1];
    sheet.replaceSync('@import "nope.css";');
    assert.equal(sheet.cssRules.length, 0);
    assert.equal(previous.parentStyleSheet, null);
    assert.equal(previous.parentRule, null);

    sheet.replaceSync('.b { color: blue; }');
    assert.equal(sheet.cssRules.length, 1);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).parentStyleSheet, sheet);
  });
});

describe('MC/DC leftover: cssRules origin-clean unique-cause', () => {
  test('createInternal default origin-clean allows cssRules, insertRule, deleteRule', () => {
    const clean = CSSStyleSheet.createInternal([], parseRule);
    assert.equal(clean.cssRules.length, 0);
    assert.equal(clean.rules.length, 0);
    const idx = clean.insertRule('.a { color: red; }', 0);
    assert.equal(idx, 0);
    assert.equal(clean.cssRules[0] instanceof CSSStyleRule, true);
    clean.deleteRule(0);
    assert.equal(clean.cssRules.length, 0);
  });

  test('origin-clean false also throws SecurityError via the rules alias', () => {
    const tainted = CSSStyleSheet.createInternal([], parseRule, false);
    assert.throws(() => tainted.rules, { name: 'SecurityError' });
    assert.throws(() => tainted.insertRule('.a {}', 0), { name: 'SecurityError' });
    assert.throws(() => tainted.deleteRule(0), { name: 'SecurityError' });
  });
});

describe('MC/DC leftover: CSSMediaRule insertRule / deleteRule / cssText', () => {
  test('empty vs filled cssText, empty condition, and cssText setter no-op', () => {
    const emptyMedia = parse('@media {}').cssRules[0] as CSSMediaRule;
    assert.equal(emptyMedia.type, 4);
    assert.equal(emptyMedia.conditionText, '');
    assert.equal(emptyMedia.media.mediaText, '');
    assert.equal(emptyMedia.cssText, '@media {\n}');

    const namedEmpty = parse('@media all {}').cssRules[0] as CSSMediaRule;
    assert.equal(namedEmpty.cssText, '@media all {\n}');

    const filled = parse('@media screen { .a { color: red; } }').cssRules[0] as CSSMediaRule;
    const before = filled.cssText;
    filled.cssText = '@media print { .b { color: blue; } }';
    assert.equal(filled.cssText, before);
    filled.media.mediaText = 'print';
    assert.equal(filled.conditionText, 'print');
    assert.equal(filled.cssText.startsWith('@media print'), true);
  });

  test('top-level media rejects @namespace, negative index, and bare declarations', () => {
    const sheet = parse('@media all { .a { color: red; } }');
    const media = sheet.cssRules[0] as CSSMediaRule;
    assert.throws(() => media.insertRule('@namespace x url("http://x");', 0), { name: 'HierarchyRequestError' });
    assert.throws(() => media.insertRule('.b {}', -1), { name: 'IndexSizeError' });
    assert.throws(() => media.insertRule('!!!', 0), { name: 'SyntaxError' });
    assert.throws(() => media.insertRule('', 0), { name: 'SyntaxError' });
    assert.throws(() => media.insertRule('color: red;', 0), { name: 'SyntaxError' });
    const idx = media.insertRule('.b { color: blue; }', 1);
    assert.equal(idx, 1);
    assert.throws(() => media.deleteRule(-1), { name: 'IndexSizeError' });
    assert.throws(() => media.deleteRule(9), { name: 'IndexSizeError' });
    media.deleteRule(1);
    assert.equal(media.cssRules.length, 1);
  });

  test('nested media isNested via parentRule; grouping names are insertable', () => {
    const sheet = parse('.host { @media all {} }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    const media = host.cssRules[0] as CSSMediaRule;
    assert.equal(media.parentRule, host);
    assert.throws(
      () => media.insertRule('@font-face { font-family: X; src: url(x); }', 0),
      { name: 'HierarchyRequestError' },
    );
    assert.equal(media.insertRule('@media print { .c { color: teal; } }', 0), 0);
    assert.ok(media.cssRules[0] instanceof CSSMediaRule);
    assert.equal(host.insertRule('@supports (display: grid) { .d {} }', 1), 1);
    assert.ok(host.cssRules[1] instanceof CSSSupportsRule);
    assert.equal(host.insertRule('@layer nest { .e {} }', 2), 2);
    assert.ok(host.cssRules[2] instanceof CSSLayerBlockRule);
    assert.equal(host.insertRule('@container (min-width: 1px) { .f {} }', 3), 3);
    assert.ok(host.cssRules[3] instanceof CSSContainerRule);
    assert.equal(host.insertRule('@scope (div) { .g {} }', 4), 4);
    assert.ok(host.cssRules[4] instanceof CSSScopeRule);
    assert.equal(host.insertRule('@starting-style { .h { opacity: 0; } }', 5), 5);
    assert.ok(host.cssRules[5] instanceof CSSStartingStyleRule);
  });

  test('nested declarations: custom property ok, unsupported name SyntaxError', () => {
    const sheet = parse('.host { color: red; }');
    const host = sheet.cssRules[0] as CSSStyleRule;
    assert.throws(() => host.insertRule('not-a-real-property: 1px;', 0), { name: 'SyntaxError' });
    const idx = host.insertRule('--mcdc-nested: 1;', 0);
    assert.equal(idx, 0);
    assert.ok(host.cssRules[0] instanceof CSSNestedDeclarations);
    assert.equal((host.cssRules[0] as CSSNestedDeclarations).style.getPropertyValue('--mcdc-nested'), '1');
  });

  test('constructed CSSMediaRule: null parse result and nested-declarations into top-level', () => {
    const nullParser = new CSSMediaRule('all', [], () => null as unknown as Rule);
    assert.throws(() => nullParser.insertRule('.a { color: red; }', 0), { name: 'SyntaxError' });

    const decls = ParseHooks.parseStyleAttribute(tokenize('color: red')).declarations;
    const nested = new CSSNestedDeclarations(decls);
    const top = new CSSMediaRule('all', [], () => nested);
    assert.throws(() => top.insertRule('color: red;', 0), { name: 'SyntaxError' });
  });

  test('grouping parseRule AST name-list unique-cause without instanceof CSSGroupingRule', () => {
    const sheet = parse('.host {}');
    const host = sheet.cssRules[0] as CSSStyleRule;
    const original = ParseHooks.parseRule;
    ParseHooks.parseRule = () => astAtRule('media');
    try {
      const idx = host.insertRule('@media all { .c { color: navy; } }', 0);
      assert.equal(idx, 0);
      assert.ok(host.cssRules[0] instanceof CSSMediaRule);
    } finally {
      ParseHooks.parseRule = original;
    }
  });
});

describe('MC/DC leftover: CSSKeyframesRule find/append/delete / cssText', () => {
  test('length, proxy leftover keys, type, and cssText for remaining disallowed names', () => {
    const sheet = parse('@keyframes move { from { color: red; } to { color: blue; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    assert.equal(kf.type, 7);
    assert.equal(kf.length, 2);
    assert.ok(kf[0] instanceof CSSKeyframeRule);
    assert.equal(kf[9], undefined);
    assert.equal(kf[-1], undefined);
    assert.equal(kf['1.5'], undefined);
    assert.equal(kf.name, 'move');
    assert.equal(kf.cssText.includes('@keyframes move'), true);

    const before = kf.cssText;
    kf.cssText = '@keyframes other { from { color: green; } }';
    assert.equal(kf.cssText, before);
    assert.equal(kf.name, 'move');

    for (const name of ['initial', 'inherit', 'unset', 'revert', 'default', 'NONE']) {
      const quoted = new CSSKeyframesRule(name, []);
      assert.equal(quoted.cssText, `@keyframes ${JSON.stringify(name)} { }`);
    }
    assert.equal(new CSSKeyframesRule('spin', []).cssText, '@keyframes spin { }');
  });

  test('findRule last-match, normalized miss, and invalid selector catch', () => {
    const sheet = parse('@keyframes move { from { color: red; } from { color: blue; } 50% { color: green; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    assert.equal(kf.findRule('0%')?.style.getPropertyValue('color'), 'blue');
    assert.equal(kf.findRule('FROM')?.style.getPropertyValue('color'), 'blue');
    assert.equal(kf.findRule('75%'), null);
    assert.equal(kf.findRule('nope'), null);
    assert.equal(kf.findRule('110%'), null);
    assert.equal(kf.findRule('%'), null);
  });

  test('appendRule unique-cause missing braces, inverted braces, and comma selectors', () => {
    const sheet = parse('@keyframes move { from { color: red; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    kf.appendRule('to { color: blue');
    kf.appendRule('} to { color: green; }');
    kf.appendRule('from color: x; }');
    kf.appendRule('110% { color: black; }');
    kf.appendRule('% { color: black; }');
    kf.appendRule('not-a-selector { color: black; }');
    assert.equal(kf.length, 1);
    kf.appendRule('50% { color: navy; }');
    kf.appendRule('from, to { color: pink; }');
    assert.equal(kf.length, 3);
    assert.ok(kf.findRule('50%'));
    assert.equal(kf.findRule('from, to')?.keyText, '0%, 100%');
  });

  test('deleteRule last duplicate, normalized miss, and invalid catch', () => {
    const sheet = parse('@keyframes move { from { color: red; } from { color: blue; } }');
    const kf = sheet.cssRules[0] as CSSKeyframesRule;
    kf.deleteRule('75%');
    kf.deleteRule('nope');
    kf.deleteRule('from');
    assert.equal(kf.length, 1);
    assert.equal((kf.cssRules[0] as CSSKeyframeRule).style.getPropertyValue('color'), 'red');
  });

  test('CSSKeyframeRule keyText range, comma list, empty body, style and cssText setter', () => {
    const frame = new CSSKeyframeRule('from, to', []);
    assert.equal(frame.keyText, '0%, 100%');
    assert.equal(frame.type, 8);
    assert.equal(frame.cssText, '0%, 100% {}');
    frame.style = 'opacity: 0';
    assert.equal(frame.style.getPropertyValue('opacity'), '0');
    const textBefore = frame.cssText;
    frame.cssText = 'to { color: blue; }';
    assert.equal(frame.cssText, textBefore);
    assert.equal(frame.keyText, '0%, 100%');

    const live = parse('@keyframes move { from { color: red; } }').cssRules[0] as CSSKeyframesRule;
    const k = live.findRule('from')!;
    assert.throws(() => {
      k.keyText = '-10%';
    }, { name: 'SyntaxError' });
    assert.throws(() => {
      k.keyText = '110%';
    }, { name: 'SyntaxError' });
    assert.throws(() => {
      k.keyText = '%';
    }, { name: 'SyntaxError' });
    assert.throws(() => {
      k.keyText = 'NaN%';
    }, { name: 'SyntaxError' });
    assert.equal(k.keyText, '0%');
    k.keyText = '40%';
    assert.equal(k.keyText, '40%');
  });
});

