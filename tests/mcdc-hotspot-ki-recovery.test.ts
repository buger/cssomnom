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
// Verifies: SYS-REQ-260821-03VA, SW-REQ-260821-YG9J, SW-REQ-260821-9KNX, SYS-REQ-260821-5283, SW-REQ-260821-W8S1, SYS-REQ-260821-8TGB, SW-REQ-260821-HNRG
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, parse } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import { CSSStyleSheet, CSSStyleRule } from '../src/CSSOM.ts';
import { MediaParser, serializeMediaQuery } from '../src/MediaParser.ts';

describe('MC/DC hotspot: parser error recovery', () => {
  test('invalid ident-only declaration is skipped and later declarations remain', () => {
    const css = `
      .container {
        invalid-rule;
        valid-prop: blue;
        another-bad;
        extra-prop: green;
      }
    `;
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const rules = parser.consumeListOfRules(true);
    assert.equal(rules.length, 1);
    const styleRule = rules[0] as unknown as { style: { getPropertyValue(name: string): string }; cssText: string };
    assert.equal(styleRule.style.getPropertyValue('valid-prop'), 'blue');
    assert.equal(styleRule.cssText.includes('extra-prop: green'), true);
    assert.equal(styleRule.cssText.includes('invalid-rule'), false);
  });

  test('after a real declaration, ident-without-colon becomes nested and later decls are kept', () => {
    const css = `
      .container {
        color: red;
        invalid-rule;
        valid-prop: blue;
      }
    `;
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const rules = parser.consumeListOfRules(true);
    const styleRule = rules[0] as unknown as {
      style: { getPropertyValue(name: string): string };
      cssRules: Array<{ cssText: string }>;
      cssText: string;
    };
    assert.equal(styleRule.style.getPropertyValue('color'), 'red');
    const nestedText = [...styleRule.cssRules].map((r) => r.cssText).join('\n');
    assert.equal(nestedText.includes('valid-prop: blue'), true);
    assert.equal(styleRule.cssText.includes('valid-prop: blue'), true);
  });

  test('bang-prefixed junk in a block does not swallow the next style rule', () => {
    const css = `
      .container { !invalid }
      .other { color: green; }
    `;
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const rules = parser.consumeListOfRules(true);
    assert.equal(rules.length, 2);
    const second = rules[1] as unknown as { selectorText: string; style: { getPropertyValue(name: string): string } };
    assert.equal(second.selectorText, '.other');
    assert.equal(second.style.getPropertyValue('color'), 'green');
  });

  test('unclosed function at EOF is reported and does not throw', () => {
    const tokens = tokenize('a { color: rgb(255');
    const parser = new Parser(tokens);
    const sheet = parser.parseStyleSheet();
    assert.ok(sheet.cssRules.length >= 1);
    assert.ok(parser.errors.some((e) => e.message.includes('Unexpected EOF in function')));
  });

  test('unclosed block at EOF is reported and does not throw', () => {
    const tokens = tokenize('a [');
    const parser = new Parser(tokens);
    parser.consumeListOfRules(true);
    assert.ok(parser.errors.some((e) => e.message === 'Unexpected EOF in block'));
  });

  test('bad-url in a declaration is skipped; later declarations survive', () => {
    const css = `a { background-image: url(http://x "y); color: red; }`;
    const sheet = parse(css);
    assert.equal(sheet.cssRules.length, 1);
    const rule = sheet.cssRules[0] as CSSStyleRule;
    assert.equal(rule.style.getPropertyValue('color'), 'red');
  });

  test('unclosed string in a selector does not throw', () => {
    const tokens = tokenize(`a[href^="oops { color: red; } b { color: green; }`);
    const parser = new Parser(tokens);
    const sheet = parser.parseStyleSheet();
    assert.ok(sheet.cssRules.length >= 0);
  });

  test('nested unknown at-rule is skipped and sibling declarations remain', () => {
    const css = `.x { color: red; @foo; valid-prop: 1px; }`;
    const tokens = tokenize(css);
    const parser = new Parser(tokens);
    const rules = parser.consumeListOfRules(true);
    const rule = rules[0] as unknown as { style: { getPropertyValue(name: string): string } };
    assert.equal(rule.style.getPropertyValue('color'), 'red');
    assert.equal(rule.style.getPropertyValue('valid-prop'), '1px');
  });
});

describe('MC/DC hotspot: unclosed media queries serialize as not all (KI-5)', () => {
  function serialized(input: string): string[] {
    return MediaParser.parse(input).map(serializeMediaQuery);
  }

  test('unbalanced parentheses and functions become not all', () => {
    assert.deepEqual(serialized('(('), ['not all']);
    assert.deepEqual(serialized('('), ['not all']);
    assert.deepEqual(serialized('(min-width: 1px'), ['not all']);
    assert.deepEqual(serialized('((min-width: 1px)'), ['not all']);
    assert.deepEqual(serialized('not ('), ['not all']);
    assert.deepEqual(serialized('only ('), ['not all']);
  });

  test('trailing comma and mixed valid/invalid lists', () => {
    assert.deepEqual(serialized('screen, (('), ['screen', 'not all']);
    assert.deepEqual(serialized('(('), ['not all']);
    const mixed = serialized('(color), (');
    assert.equal(mixed[0], '(color)');
    assert.equal(mixed[1], 'not all');
  });

  test('valid queries still serialize as themselves', () => {
    assert.deepEqual(serialized('(color)'), ['(color)']);
    assert.deepEqual(serialized('screen'), ['screen']);
    assert.deepEqual(serialized('&test'), ['not all']);
  });
});

describe('MC/DC hotspot: setProperty("all") (KI-1)', () => {
  test('invalid all after stored var(--x) is a no-op', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('all', 'var(--x)');
    assert.equal(style.getPropertyValue('all'), 'var(--x)');
    style.setProperty('all', 'not-a-css-wide-keyword');
    assert.equal(style.getPropertyValue('all'), 'var(--x)');
    assert.equal(style.cssText.trim(), 'all: var(--x);');
  });

  test('invalid all after stored env() is a no-op', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('all', 'env(safe-area-inset-top)');
    style.setProperty('all', 'nope');
    assert.equal(style.getPropertyValue('all'), 'env(safe-area-inset-top)');
  });

  test('valid css-wide all expands; later invalid all does not drop expanded longhands', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('all', 'unset');
    assert.equal(style.getPropertyValue('color'), 'unset');
    assert.equal(style.getPropertyValue('width'), 'unset');
    style.setProperty('all', 'definitely-not-valid');
    assert.equal(style.getPropertyValue('color'), 'unset');
    assert.equal(style.getPropertyValue('width'), 'unset');
    assert.equal(style.getPropertyValue('all'), 'unset');
  });

  test('all: inherit then all: initial replaces; invalid afterwards keeps initial', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('all', 'inherit');
    assert.equal(style.getPropertyValue('all'), 'inherit');
    style.setProperty('all', 'initial');
    assert.equal(style.getPropertyValue('all'), 'initial');
    style.setProperty('all', '???');
    assert.equal(style.getPropertyValue('all'), 'initial');
    assert.equal(style.getPropertyValue('color'), 'initial');
  });

  test('all with important then invalid non-important does not clear', () => {
    const style = new CSSStyleDeclaration();
    style.setProperty('all', 'revert', 'important');
    assert.equal(style.getPropertyPriority('color'), 'important');
    style.setProperty('all', 'not-valid');
    assert.equal(style.getPropertyValue('all'), 'revert');
    assert.equal(style.getPropertyPriority('color'), 'important');
  });

  test('stylesheet insertRule with all then invalid setProperty keeps longhands', () => {
    const sheet = new CSSStyleSheet();
    sheet.insertRule('.foo { all: unset; color: red; }');
    const rule = sheet.cssRules[0];
    assert.ok(rule instanceof CSSStyleRule);
    rule.style.setProperty('all', 'bogus');
    assert.equal(rule.style.getPropertyValue('color'), 'red');
  });
});
