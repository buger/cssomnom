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
// Verifies: INT-REQ-260821-30ZA, INT-REQ-260821-9SGA, INT-REQ-260821-HJVC, INT-REQ-260821-JTY2, INT-REQ-260821-MZW3, INT-REQ-260821-N2VE, INT-REQ-260821-WQX9, INT-REQ-260821-WTPD, INT-REQ-260821-ZMZR, INT-REQ-260821-ZP03
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseHTML } from 'linkedom';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSMediaRule,
  MediaList,
  CSS,
  parse,
  getCascadedStyle,
} from '../src/index.ts';
import { Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ArrayTokenStream } from '../src/TokenStream.ts';
import { ParseHooks } from '../src/parse-hooks.ts';
import { MediaParser } from '../src/MediaParser.ts';
import { PropertyRegistry } from '../src/PropertyRegistry.ts';
import {
  CSSStyleValue,
  CSSUnitValue,
  CSSKeywordValue,
  DOMMatrix,
} from '../src/typed-om.ts';
import {
  parseStylesheetSync,
  CSSParserAtRule,
  CSSParserQualifiedRule,
  CSSParserRule,
} from '../src/parser-api.ts';
import type { Token, TokenStream } from '../src/types.ts';

const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src');

function readSrc(rel: string): string {
  return readFileSync(path.join(srcDir, rel), 'utf8');
}

function importsParserModule(source: string): boolean {
  return /from\s+['"](?:\.\.\/)*parser\.ts['"]/.test(source) || /from\s+['"]\.\/parser\.ts['"]/.test(source);
}

// Verifies: INT-REQ-260821-30ZA
// INT-REQ-260821-30ZA:integration:integration
// INT-REQ-260821-30ZA:error_handling:nominal
// INT-REQ-260821-30ZA:malformed_input:nominal
// INT-REQ-260821-30ZA:error_handling:negative
// INT-REQ-260821-30ZA:malformed_input:negative
test('INT-30ZA insertRule calls ParseHooks.consumeRule without CSSOM importing Parser', () => {
  assert.equal(importsParserModule(readSrc('CSSOM.ts')), false);

  const original = ParseHooks.consumeRule;
  let consumeCalls = 0;
  ParseHooks.consumeRule = (tokens: Token[]) => {
    consumeCalls++;
    return original(tokens);
  };
  try {
    const sheet = new CSSStyleSheet();
    const index = sheet.insertRule('div { color: red; }', 0);
    assert.equal(index, 0);
    assert.ok(consumeCalls >= 1, 'insertRule must call ParseHooks.consumeRule');
    assert.equal(sheet.cssRules.length, 1);
    assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
    assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'red');
    assert.throws(() => {
      sheet.insertRule('!!!not-a-rule', 1);
    }, (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError');
  } finally {
    ParseHooks.consumeRule = original;
  }
});

// Verifies: INT-REQ-260821-9SGA
// INT-REQ-260821-9SGA:integration:integration
// INT-REQ-260821-9SGA:error_handling:nominal
// MCDC INT-REQ-260821-9SGA: parse_hooks_component_values_called=T, parse_style_value=T, parser_imported=F => TRUE
test('INT-9SGA typed OM parse calls ParseHooks.parseComponentValues without importing Parser', () => {
  assert.equal(importsParserModule(readSrc('typed-om.ts')), false);
  assert.equal(importsParserModule(readSrc('typed-om/values/style-value-parser.ts')), false);
  assert.equal(importsParserModule(readSrc('typed-om/values/CSSStyleValue.ts')), false);

  const original = ParseHooks.parseComponentValues;
  let parseCalls = 0;
  ParseHooks.parseComponentValues = (tokens: Token[]) => {
    parseCalls++;
    return original(tokens);
  };
  try {
    const color = CSSStyleValue.parse('color', 'red');
    assert.ok(color instanceof CSSKeywordValue);
    assert.equal(color.toString(), 'red');
    const width = CSSStyleValue.parse('width', '10px');
    assert.ok(width instanceof CSSUnitValue);
    assert.equal((width as CSSUnitValue).value, 10);
    assert.equal((width as CSSUnitValue).unit, 'px');
    assert.ok(parseCalls >= 2, 'CSSStyleValue.parse must call ParseHooks.parseComponentValues');
  } finally {
    ParseHooks.parseComponentValues = original;
  }
});

// Verifies: INT-REQ-260821-N2VE
// INT-REQ-260821-N2VE:integration:integration
// INT-REQ-260821-N2VE:error_handling:nominal
test('INT-N2VE parser consume path uses TokenStream peek/next and EOF sentinel', () => {
  const inner = new ArrayTokenStream(tokenize('.x { color: blue; }'));
  const spy: TokenStream & { peeks: number; nexts: number; eofSeen: boolean } = {
    peeks: 0,
    nexts: 0,
    eofSeen: false,
    peek() {
      this.peeks++;
      const token = inner.peek();
      if (token.type === 'EOF') this.eofSeen = true;
      return token;
    },
    next() {
      this.nexts++;
      const token = inner.next();
      if (token.type === 'EOF') this.eofSeen = true;
      return token;
    },
  };

  const sheet = new Parser(spy).parseStyleSheet();
  assert.ok(spy.peeks >= 1, 'consume must peek the stream');
  assert.ok(spy.nexts >= 1, 'consume must next the stream');
  assert.equal(spy.eofSeen, true, 'tokenizer stream must supply EOF sentinel');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'blue');
});

// Verifies: INT-REQ-260821-ZMZR
// INT-REQ-260821-ZMZR:integration:integration
// INT-REQ-260821-ZMZR:error_handling:nominal
// INT-REQ-260821-ZMZR:nominal:nominal
test('INT-ZMZR parser constructs CSSOM grouping rules and passes insertRule parse callback', () => {
  const sheet = parse('@media all { }');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSMediaRule);
  const media = sheet.cssRules[0] as CSSMediaRule;
  type GroupingParse = { _parseRuleInBlock: (text: string, nested?: boolean) => unknown };
  const grouping = media as unknown as GroupingParse;
  const originalParse = grouping._parseRuleInBlock;
  let parseCallbackCalls = 0;
  grouping._parseRuleInBlock = (text, nested) => {
    parseCallbackCalls++;
    return originalParse(text, nested);
  };
  try {
    const index = media.insertRule('p { color: navy; }', 0);
    assert.equal(index, 0);
    assert.ok(parseCallbackCalls >= 1, 'grouping insertRule must call construction-time _parseRuleInBlock');
    assert.equal(media.cssRules.length, 1);
    assert.ok(media.cssRules[0] instanceof CSSStyleRule);
    assert.equal((media.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'navy');
  } finally {
    grouping._parseRuleInBlock = originalParse;
  }
});

// Verifies: INT-REQ-260821-WQX9
// INT-REQ-260821-WQX9:integration:integration
// INT-REQ-260821-WQX9:error_handling:nominal
// INT-REQ-260821-WQX9:error_handling:negative
test('INT-WQX9 StylePropertyMap duck-types CSSStyleDeclaration setProperty/getPropertyValue', () => {
  const sheet = parse('.a { color: red; }');
  const rule = sheet.cssRules[0] as CSSStyleRule;

  rule.styleMap.set('color', 'green');
  assert.equal(rule.style.getPropertyValue('color'), 'green');

  rule.style.setProperty('background-color', 'blue');
  assert.equal(rule.styleMap.get('background-color')?.toString(), 'blue');

  rule.styleMap.set('width', '10px');
  assert.equal(rule.style.getPropertyValue('width'), '10px');
  assert.throws(() => {
    rule.styleMap.set('width', 'not-a-width');
  }, TypeError);
  assert.equal(rule.style.getPropertyValue('width'), '10px');
  assert.equal(rule.styleMap.get('width')?.toString(), '10px');
});

// Verifies: INT-REQ-260821-HJVC
// INT-REQ-260821-HJVC:integration:integration
// INT-REQ-260821-HJVC:malformed_recovers_or_errors_loudly:nominal
// INT-REQ-260821-HJVC:malformed_recovers_or_errors_loudly:negative
// MCDC INT-REQ-260821-HJVC: blue_from_chroma=F, cascaded_style_requested=T, green_from_chroma=F, hsl_component_count_GE_3=T, hsl_parsed=T, hue_degrees_LT_60=T, matcher_and_media_consulted=T, red_from_chroma=T => TRUE
test('INT-HJVC cascade walks CSSOM rules and consults matcher, MediaParser, and supports', () => {
  const { document } = parseHTML('<html><body><div class="target"></div></body></html>');
  const el = document.querySelector('.target');
  assert.ok(el);

  // Unmatched `span` is later and !important: if matcher did not drop it, blue would win.
  const matcherSheet = parse(`
    .target { color: hsl(0, 100%, 50%); }
    span { color: blue !important; }
  `);
  assert.equal(
    getCascadedStyle(el, matcherSheet.cssRules).getPropertyValue('color'),
    'rgb(255, 0, 0)',
  );

  // Inner `.target { color: blue }` is later, same specificity: if MediaParser were skipped, blue would win.
  const mediaSheet = parse(`
    .target { color: hsl(0, 100%, 50%); }
    @media not all { .target { color: blue; } }
  `);
  assert.equal(
    getCascadedStyle(el, mediaSheet.cssRules).getPropertyValue('color'),
    'rgb(255, 0, 0)',
  );

  // Passing @supports overrides yellow. Later failing @supports would paint black if admitted.
  const supportsSheet = parse(`
    .target { color: yellow; }
    @supports (display: block) { .target { color: lime; } }
    @supports (display: not-a-real-value) { .target { color: black; } }
  `);
  assert.equal(
    getCascadedStyle(el, supportsSheet.cssRules).getPropertyValue('color'),
    'rgb(0, 255, 0)',
  );
});

// Verifies: INT-REQ-260821-WTPD
// INT-REQ-260821-WTPD:integration:integration
// INT-REQ-260821-WTPD:malformed_recovers_or_errors_loudly:nominal
test('INT-WTPD parser_api adapts Parser AST to CSSParserRule nodes', () => {
  const rules = parseStylesheetSync('@media all { div { color: red; } }');
  assert.equal(rules.length, 1);
  assert.ok(rules[0] instanceof CSSParserAtRule);
  assert.ok(rules[0] instanceof CSSParserRule);
  assert.equal(rules[0] instanceof CSSStyleRule, false);
  assert.equal(rules[0] instanceof CSSMediaRule, false);
  const at = rules[0] as CSSParserAtRule;
  assert.equal(at.name, 'media');
  assert.equal(at.body?.length, 1);
  assert.ok(at.body?.[0] instanceof CSSParserQualifiedRule);
  const qualified = at.body[0] as CSSParserQualifiedRule;
  assert.ok(qualified.prelude.map((t) => t.toString()).join('').includes('div'));
});

// Verifies: INT-REQ-260821-MZW3
// INT-REQ-260821-MZW3:integration:integration
// INT-REQ-260821-MZW3:malformed_recovers_or_errors_loudly:nominal
// INT-REQ-260821-MZW3:malformed_recovers_or_errors_loudly:negative
test('INT-MZW3 MediaList.mediaText calls MediaParser.parse including invalid-to-not-all', () => {
  const original = MediaParser.parse;
  let parseCalls = 0;
  MediaParser.parse = (mediaText: string) => {
    parseCalls++;
    return original.call(MediaParser, mediaText);
  };
  try {
    const list = new MediaList();
    list.mediaText = '&test, speech';
    assert.ok(parseCalls >= 1, 'MediaList setter must call MediaParser.parse');
    assert.equal(list.length, 2);
    assert.equal(list.item(0), 'not all');
    assert.equal(list.item(1), 'speech');
    assert.equal(list.mediaText, 'not all, speech');
  } finally {
    MediaParser.parse = original;
  }
});

// Verifies: INT-REQ-260821-ZP03
// INT-REQ-260821-ZP03:integration:integration
// INT-REQ-260821-ZP03:error_handling:nominal
test('INT-ZP03 CSS.registerProperty and @property share PropertyRegistry', () => {
  PropertyRegistry.clear();
  try {
    CSS.registerProperty({
      name: '--shared-int-zp03',
      syntax: '*',
      inherits: false,
    });
    const sheet = new CSSStyleSheet();
    sheet.replaceSync(`
      @property --shared-int-zp03 {
        syntax: "<length>";
        inherits: true;
        initial-value: 0px;
      }
      @property --from-css-int-zp03 {
        syntax: "<color>";
        inherits: false;
        initial-value: red;
      }
    `);
    const jsDef = PropertyRegistry.get('--shared-int-zp03');
    assert.ok(jsDef);
    assert.equal(jsDef.syntax, '*');
    assert.equal(jsDef.inherits, false);
    const cssDef = PropertyRegistry.get('--from-css-int-zp03');
    assert.ok(cssDef);
    assert.equal(cssDef.syntax, '<color>');
    assert.equal(cssDef.initialValue, 'red');
  } finally {
    PropertyRegistry.clear();
  }
});

// Verifies: INT-REQ-260821-JTY2
// INT-REQ-260821-JTY2:integration:integration
// INT-REQ-260821-JTY2:error_handling:nominal
// INT-REQ-260821-JTY2:malformed_input:nominal
// INT-REQ-260821-JTY2:error_handling:negative
// INT-REQ-260821-JTY2:malformed_input:negative
// MCDC INT-REQ-260821-JTY2: matrix_index_LE_3=T, native_matrix_string=F, transform_string_parsed=T, typed_om_transform_hook_used=T => TRUE
test('INT-JTY2 DOMMatrix string ctor uses the typed_om transform parse hook', () => {
  const translated = new DOMMatrix('translate(10px, 20px)');
  assert.equal(translated.is2D, true);
  assert.equal(translated.e, 10);
  assert.equal(translated.f, 20);
  const product = translated.multiply(new DOMMatrix('translate(1px, 2px)'));
  assert.equal(product.e, 11);
  assert.equal(product.f, 22);
  assert.throws(() => {
    new DOMMatrix('nope(1)');
  }, (err: unknown) => err instanceof DOMException && err.name === 'SyntaxError');
});
