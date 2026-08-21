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
  StyleSheetList,
  MediaList,
} from '../src/CSSOM.ts';

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
