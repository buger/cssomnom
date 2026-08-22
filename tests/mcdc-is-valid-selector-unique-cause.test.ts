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
// Verifies: SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-NHZ8, SYS-REQ-260821-H3BD, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SW-REQ-260821-HW77, SYS-REQ-260821-SMW6, SW-REQ-260821-6D9T, SYS-REQ-260821-PJ76
// Leftover unique-cause for src/parser.ts isValidSelector after last recapture
// 11/14 D, 20/24 C, incomplete 3. Hottest seam L1319 start <= end &&
// prelude[start].type === 'whitespace'. Remaining incomplete: L1344
// next > end || type !== 'ident', L1353 next <= end.
// tests/mcdc-parser-still-hot-unique-cause.test.ts unique-causes number /
// dimension / last . # : / delim-hash / colon-next / empty-after-trim via
// parse(), but consumeRule / consumeListOfRules / consumeBlockContents skip
// leading whitespace so L1319 whitespace T never runs on that path.
// Drive consumeQualifiedRule (shipped; parse() cannot feed leading ws),
// parse / parseStyleSheet / CSSStyleSheet.replaceSync, SelectorParser.parse,
// CSS.supports('selector(...)'), querySelector. Prefer real selectors.
// css-syntax-3 § 5.5.3 #consume-qualified-rule / § 5.4.6 #parse-rule,
// selectors-4 #class-selector / #id-selector / #pseudo-classes /
// #pseudo-elements / #typedef-selector-list / § 16 #match-against-tree,
// css-conditional-3 #typedef-supports-selector-fn.
// No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import {
  parse,
  Parser,
  parseStyleSheet,
} from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { SelectorParser } from '../src/SelectorParser.ts';
import { CSS } from '../src/parser-api.ts';
import { querySelector, querySelectorAll } from '../src/matcher.ts';
import {
  CSSStyleRule,
  CSSStyleSheet,
  CSSScopeRule,
} from '../src/CSSOM.ts';
import type { ComponentValue, Rule, SelectorList } from '../src/types.ts';

function valuesOf(css: string): ComponentValue[] {
  return new Parser(tokenize(css)).parseComponentValues();
}

function protoFn(name: string): (...args: unknown[]) => unknown {
  const fn = Reflect.get(Object.getPrototypeOf(new Parser([])), name);
  assert.equal(typeof fn, 'function', name);
  return fn as (...args: unknown[]) => unknown;
}

function isValidSelector(prelude: ComponentValue[]): boolean {
  const result = protoFn('isValidSelector').call(new Parser([]), prelude);
  assert.equal(typeof result, 'boolean');
  return result as boolean;
}

function createStyleRule(prelude: ComponentValue[]): CSSStyleRule | null {
  const result = protoFn('createStyleRule').call(new Parser([]), prelude, [], false);
  if (result === null) return null;
  assert.ok(result instanceof CSSStyleRule);
  return result;
}

function consumeQualifiedRule(css: string, nested?: boolean): CSSStyleRule | null {
  const parser = new Parser(tokenize(css));
  const result =
    nested === undefined
      ? protoFn('consumeQualifiedRule').call(parser)
      : protoFn('consumeQualifiedRule').call(parser, nested);
  if (result === null) return null;
  assert.ok(result instanceof CSSStyleRule);
  return result;
}

function selectors(css: string): string[] {
  return [...parse(css).cssRules].map((r) =>
    r instanceof CSSStyleRule ? r.selectorText : r.constructor.name,
  );
}

function replaceSyncSheet(css: string): CSSStyleSheet {
  const sheet = new CSSStyleSheet();
  sheet.replaceSync(css);
  return sheet;
}

function replaceSelectors(css: string): string[] {
  return [...replaceSyncSheet(css).cssRules].map((r) =>
    r instanceof CSSStyleRule ? r.selectorText : r.constructor.name,
  );
}

function parseSel(css: string): SelectorList {
  return new SelectorParser(valuesOf(css)).parse();
}

function supportsSelector(selector: string): boolean {
  return CSS.supports(`selector(${selector})`);
}

function htmlDoc(source: string) {
  return parseHTML(source).document;
}

function blockSelectors(css: string): string[] {
  return new Parser(tokenize(css)).parseBlockContents().flatMap((r) =>
    r instanceof CSSStyleRule ? [r.selectorText] : [],
  );
}

function droppedThenOk(css: string): void {
  assert.deepEqual(selectors(css), ['.ok']);
  assert.deepEqual(parseStyleSheet(css).map((r) =>
    r instanceof CSSStyleRule ? r.selectorText : r.constructor.name,
  ), ['.ok']);
  assert.deepEqual(replaceSelectors(css), ['.ok']);
}

function kept(css: string, selectorText: string): void {
  assert.deepEqual(selectors(css), [selectorText]);
  const list = parseStyleSheet(css);
  assert.equal(list.length, 1);
  assert.ok(list[0] instanceof CSSStyleRule);
  assert.equal(list[0].selectorText, selectorText);
  assert.deepEqual(replaceSelectors(css), [selectorText]);
}

describe('MC/DC leftover unique-cause: isValidSelector L1319 leading-trim while (css-syntax-3 § 5.5.3)', () => {
  test('start <= end F empty vs T whitespace T vs T whitespace F', () => {
    // F, skipped: empty prelude. consumeRule already discarded leading ws, so
    // parse() `{...}` and ` {...}` are the same empty prelude.
    // css-syntax-3 § 5.5.3 #consume-qualified-rule.
    assert.equal(isValidSelector([]), false);
    assert.equal(createStyleRule([]), null);
    assert.equal(consumeQualifiedRule('{ color: red; }'), null);
    droppedThenOk('{ color: red; } .ok { color: green; }');
    droppedThenOk(' { color: red; } .ok { color: green; }');
    assert.deepEqual(blockSelectors('{ color: red; }'), []);
    assert.deepEqual(blockSelectors(' { color: red; }'), []);
    const scopeEmpty = parse('@scope { { color: red; } .ok { color: green; } }');
    assert.ok(scopeEmpty.cssRules[0] instanceof CSSScopeRule);
    assert.deepEqual(
      [...(scopeEmpty.cssRules[0] as CSSScopeRule).cssRules].map((r: Rule) =>
        r instanceof CSSStyleRule ? r.selectorText : r.constructor.name,
      ),
      ['.ok'],
    );

    // T, F: first non-ws ident. parse() / replaceSync / parseBlockContents.
    assert.equal(isValidSelector(valuesOf('div')), true);
    const identRule = createStyleRule(valuesOf('div'));
    assert.ok(identRule);
    assert.equal(identRule.selectorText, 'div');
    assert.equal(consumeQualifiedRule('div{color:red}')?.selectorText, 'div');
    kept('div { color: red; }', 'div');
    kept('div{color:red}', 'div');
    assert.deepEqual(blockSelectors('div { color: red; }'), ['div']);
    assert.deepEqual(blockSelectors('  div { color: red; }'), ['div']);

    // T, T: leading whitespace in the prelude. parse() cannot feed this
    // (consumeRule skips ws before consumeQualifiedRule). Shipped
    // consumeQualifiedRule + tokenize real selectors unique-cause the enter.
    assert.equal(isValidSelector(valuesOf('  div')), true);
    assert.equal(isValidSelector(valuesOf('\t\ndiv')), true);
    const lead = createStyleRule(valuesOf('  div'));
    assert.ok(lead);
    assert.equal(lead.selectorText, 'div');
    assert.equal(consumeQualifiedRule('  div { color: red; }')?.selectorText, 'div');
    assert.equal(consumeQualifiedRule('\t\ndiv { color: red; }')?.selectorText, 'div');
    assert.equal(consumeQualifiedRule('  .foo { color: red; }')?.selectorText, '.foo');
    assert.equal(consumeQualifiedRule('  :hover { color: red; }')?.selectorText, ':hover');
    kept('  div { color: red; }', 'div');

    // T, T then empty after trim: whitespace-only prelude (not the parse()
    // empty path). L1319 enter then start <= end F; L1320 end >= start F.
    assert.equal(isValidSelector(valuesOf(' ')), false);
    assert.equal(isValidSelector(valuesOf('  ')), false);
    assert.equal(createStyleRule(valuesOf(' ')), null);
    assert.equal(consumeQualifiedRule(' { color: red; }'), null);
    assert.equal(consumeQualifiedRule('  { color: red; }'), null);
  });

  test('L1320 trailing-trim unique-cause vs L1319; SelectorParser / supports / querySelector', () => {
    // L1320 T, T then T, F: trailing ws before `{`. `div{` has no trailing ws.
    const trail = consumeQualifiedRule('div { color: red; }');
    assert.equal(trail?.selectorText, 'div');
    const noTrail = consumeQualifiedRule('div{color:red}');
    assert.equal(noTrail?.selectorText, 'div');
    assert.equal(isValidSelector(valuesOf('div ')), true);
    assert.equal(isValidSelector(valuesOf('  div  ')), true);

    const list = parseSel('div');
    assert.equal(list.selectors.length, 1);
    assert.equal(list.selectors[0].type, 'complex-selector');
    assert.equal(parseSel('  div').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('.foo').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('#id').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('div.foo').selectors[0].type, 'complex-selector');

    assert.equal(supportsSelector('div'), true);
    assert.equal(supportsSelector('.foo'), true);
    assert.equal(supportsSelector('#id'), true);
    assert.equal(supportsSelector('div.foo'), true);
    assert.equal(supportsSelector(''), false);
    assert.equal(supportsSelector(' '), false);

    const document = htmlDoc('<div class="foo" id="id"><span></span></div>');
    assert.equal(querySelector(document, 'div')?.localName, 'div');
    assert.equal(querySelector(document, '.foo')?.id, 'id');
    assert.equal(querySelector(document, '#id')?.id, 'id');
    assert.equal(querySelector(document, 'div.foo')?.id, 'id');
    assert.equal(querySelector(document, 'span')?.localName, 'span');
    assert.equal(querySelector(document, ''), null);
    assert.equal(querySelector(document, ' '), null);
    assert.equal(querySelectorAll(document, 'div').length, 1);
  });
});

describe('MC/DC leftover unique-cause: isValidSelector L1344 class-dot next (selectors-4 #class-selector)', () => {
  test('next > end F with ident T vs F; last-dot mute of next > end T', () => {
    // F, F: `.` then ident (class selector). parse / supports / querySelector.
    assert.equal(isValidSelector(valuesOf('div.foo')), true);
    assert.equal(isValidSelector(valuesOf('.foo')), true);
    assert.equal(consumeQualifiedRule('div.foo { color: red; }')?.selectorText, 'div.foo');
    kept('div.foo { color: red; }', 'div.foo');
    kept('.foo { color: red; }', '.foo');
    assert.equal(parseSel('div.foo').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('.foo').selectors[0].type, 'complex-selector');
    assert.equal(supportsSelector('div.foo'), true);
    assert.equal(supportsSelector('.foo'), true);
    const document = htmlDoc('<div class="foo"></div><div class="bar"></div>');
    assert.equal(querySelector(document, 'div.foo')?.className, 'foo');
    assert.equal(querySelector(document, '.foo')?.className, 'foo');
    assert.equal(querySelector(document, 'div.bar')?.className, 'bar');

    // F, T: `.` then not ident (ws / type selector). Still-hot had `div. span`;
    // isolate `. foo` so last token is not the `.` (L1333 does not fire).
    assert.equal(isValidSelector(valuesOf('div. span')), false);
    assert.equal(isValidSelector(valuesOf('. foo')), false);
    assert.equal(createStyleRule(valuesOf('div. span')), null);
    assert.equal(consumeQualifiedRule('div. span { color: red; }'), null);
    assert.equal(consumeQualifiedRule('. foo { color: red; }'), null);
    droppedThenOk('div. span { color: red; } .ok { color: green; }');
    droppedThenOk('. foo { color: red; } .ok { color: green; }');
    assert.equal(supportsSelector('div. span'), false);
    assert.equal(supportsSelector('. foo'), false);
    assert.throws(() => parseSel('div. span'), { name: 'SyntaxError' });
    assert.equal(querySelector(document, 'div. span'), null);
    assert.equal(querySelector(document, '. foo'), null);

    // next > end T is unpairable: last delim `.` / `#` returns at L1333 before
    // the L1342 walk. Mute (no ignore). parse() / consumeQualifiedRule drop.
    assert.equal(isValidSelector(valuesOf('div.')), false);
    assert.equal(isValidSelector(valuesOf('.')), false);
    assert.equal(isValidSelector(valuesOf('div#')), false);
    assert.equal(isValidSelector(valuesOf('#')), false);
    assert.equal(createStyleRule(valuesOf('div.')), null);
    assert.equal(consumeQualifiedRule('div. { color: red; }'), null);
    assert.equal(consumeQualifiedRule('. { color: red; }'), null);
    droppedThenOk('div. { color: red; } .ok { color: green; }');
    droppedThenOk('. { color: red; } .ok { color: green; }');
    droppedThenOk('div# { color: red; } .ok { color: green; }');
    droppedThenOk('# { color: red; } .ok { color: green; }');
    assert.equal(querySelector(document, 'div.'), null);
    assert.equal(querySelector(document, '.'), null);
    assert.equal(querySelector(document, 'div#'), null);
    assert.equal(querySelector(document, '#'), null);
    assert.throws(() => parseSel('#'), { name: 'SyntaxError' });
    assert.throws(() => parseSel('div#'), { name: 'SyntaxError' });
    // SelectorParser.parse currently accepts a trailing class-dot; CSS.supports
    // follows that parser, not Parser.isValidSelector. Do not treat supports
    // as the isValidSelector oracle for this mute arm.
    assert.equal(parseSel('div.').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('.').selectors[0].type, 'complex-selector');
    assert.equal(supportsSelector('div.'), true);
    assert.equal(supportsSelector('.'), true);
  });
});

describe('MC/DC leftover unique-cause: isValidSelector L1353 colon-next (selectors-4 #pseudo-classes / #pseudo-elements)', () => {
  test('next <= end T ident / function / colon vs other; last-colon mute of F', () => {
    // T: colon is not last. next ident / function / colon keep the rule;
    // whitespace / simple-block fail the inner 3-way AND.
    assert.equal(isValidSelector(valuesOf(':hover')), true);
    assert.equal(isValidSelector(valuesOf('div:hover')), true);
    assert.equal(isValidSelector(valuesOf(':is(.a)')), true);
    assert.equal(isValidSelector(valuesOf('::before')), true);
    assert.equal(isValidSelector(valuesOf('div::before')), true);
    assert.equal(isValidSelector(valuesOf('div: [foo]')), false);
    assert.equal(isValidSelector(valuesOf(': [foo]')), false);
    assert.equal(consumeQualifiedRule(':hover { color: red; }')?.selectorText, ':hover');
    assert.equal(consumeQualifiedRule(':is(.a) { color: red; }')?.selectorText, ':is(.a)');
    assert.equal(consumeQualifiedRule('::before { color: red; }')?.selectorText, '::before');
    assert.equal(consumeQualifiedRule('div: [foo] { color: red; }'), null);
    kept(':hover { color: red; }', ':hover');
    kept(':is(.a) { color: red; }', ':is(.a)');
    kept('::before { color: red; }', '::before');
    kept('div:hover { color: red; }', 'div:hover');
    kept('div::before { color: red; }', 'div::before');
    droppedThenOk('div: [foo] { color: red; } .ok { color: green; }');

    assert.equal(parseSel(':hover').selectors[0].type, 'complex-selector');
    assert.equal(parseSel(':is(.a)').selectors[0].type, 'complex-selector');
    assert.equal(parseSel('::before').selectors[0].type, 'complex-selector');
    assert.equal(supportsSelector(':hover'), true);
    assert.equal(supportsSelector(':is(.a)'), true);
    assert.equal(supportsSelector('::before'), true);
    assert.equal(supportsSelector('div: [foo]'), false);
    assert.throws(() => parseSel('div: [foo]'), { name: 'SyntaxError' });

    const document = htmlDoc('<div class="a"></div>');
    assert.equal(querySelector(document, ':is(.a)')?.className, 'a');
    assert.equal(querySelector(document, 'div: [foo]'), null);

    // next <= end F is unpairable: last colon returns at L1336 before the
    // L1351 walk. Mute (no ignore). `::` is two colons with last still colon.
    assert.equal(isValidSelector(valuesOf('div:')), false);
    assert.equal(isValidSelector(valuesOf('::')), false);
    assert.equal(createStyleRule(valuesOf('div:')), null);
    assert.equal(consumeQualifiedRule('div: { color: red; }'), null);
    assert.equal(consumeQualifiedRule(':: { color: red; }'), null);
    droppedThenOk('div: { color: red; } .ok { color: green; }');
    droppedThenOk(':: { color: red; } .ok { color: green; }');
    assert.equal(supportsSelector('div:'), false);
    assert.throws(() => parseSel('div:'), { name: 'SyntaxError' });
    assert.equal(querySelector(document, 'div:'), null);
    assert.equal(querySelector(document, '::'), null);
  });
});
