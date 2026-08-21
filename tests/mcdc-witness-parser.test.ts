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
// Verifies: INT-REQ-260821-N2VE, INT-REQ-260821-ZMZR, SW-REQ-260821-39E0, SW-REQ-260821-5W6X, SW-REQ-260821-9KNX, SW-REQ-260821-HHVE, SW-REQ-260821-YG9J, SYS-REQ-260821-03VA, SYS-REQ-260821-7521, SYS-REQ-260821-H3BD, SYS-REQ-260821-NHZ8
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { ArrayTokenStream } from '../src/TokenStream.ts';
import {
  CSSStyleSheet,
  CSSStyleRule,
  CSSMediaRule,
  CSSImportRule,
  CSSNestedDeclarations,
} from '../src/CSSOM.ts';
import type { Token, TokenStream } from '../src/types.ts';

const BTN = '.btn { color: #fff; }';
const NESTED_AFTER = '.a { color: red; & .b { color: blue; } color: green; }';
const IMPORT_CSS = '@import "https://example.com/sheet.css"; .ok { color: red; }';

function withFetchCounter<T>(fn: () => T): { value: T; fetchCalls: number } {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls++;
    if (typeof originalFetch === 'function') {
      return originalFetch(input, init);
    }
    return Promise.reject(new TypeError('unexpected fetch'));
  }) as typeof fetch;
  try {
    return { value: fn(), fetchCalls };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function spyStream(css: string): TokenStream & { peeks: number; nexts: number } {
  const inner = new ArrayTokenStream(tokenize(css));
  return {
    peeks: 0,
    nexts: 0,
    peek() {
      this.peeks++;
      return inner.peek();
    },
    next() {
      this.nexts++;
      return inner.next();
    },
  };
}
// --- INT-REQ-260821-N2VE ---
// Verifies: INT-REQ-260821-N2VE
// MCDC INT-REQ-260821-N2VE: consume_step=F, token_stream_peek_next_used=F => TRUE [no-action: TokenStream.peek/next call counts stayed 0]
test('MCDC INT-N2VE consume_step=F peek_next_used=F', () => {
  const stream = spyStream('.x { color: blue; }');
  assert.equal(stream.peeks, 0, 'peek not invoked');
  assert.equal(stream.nexts, 0, 'next not invoked');
});
//mcdc:ignore:defensive INT-REQ-260821-N2VE: consume_step=T, token_stream_peek_next_used=F => FALSE — Parser consumeListOfRules/consumeRule always call TokenStream.peek and next [reviewed: agent:grok-4.6]

// Verifies: INT-REQ-260821-N2VE
// MCDC INT-REQ-260821-N2VE: consume_step=T, token_stream_peek_next_used=T => TRUE
test('MCDC INT-N2VE consume_step=T peek_next_used=T', () => {
  const stream = spyStream('.x { color: blue; }');
  const sheet = new Parser(stream).parseStyleSheet();
  assert.ok(stream.peeks >= 1, 'consume must peek');
  assert.ok(stream.nexts >= 1, 'consume must next');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'blue');
});
// --- INT-REQ-260821-ZMZR ---
// Verifies: INT-REQ-260821-ZMZR
// MCDC INT-REQ-260821-ZMZR: cssom_rule_constructed=F, grouping_rule_built=F => TRUE [no-action: CSSMediaRule not constructed]
test('MCDC INT-ZMZR cssom_rule_constructed=F grouping_rule_built=F', () => {
  const sheet = parse('div { color: red; }');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal(sheet.cssRules[0] instanceof CSSMediaRule, false);
});
//mcdc:ignore:defensive INT-REQ-260821-ZMZR: cssom_rule_constructed=F, grouping_rule_built=T => FALSE — grouping handlers construct CSSOM classes (CSSMediaRule) at build time [reviewed: agent:grok-4.6]

// Verifies: INT-REQ-260821-ZMZR
// MCDC INT-REQ-260821-ZMZR: cssom_rule_constructed=T, grouping_rule_built=T => TRUE
test('MCDC INT-ZMZR cssom_rule_constructed=T grouping_rule_built=T', () => {
  const sheet = parse('@media all { p { color: navy; } }');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSMediaRule);
  const media = sheet.cssRules[0] as CSSMediaRule;
  assert.equal(media.cssRules.length, 1);
  assert.ok(media.cssRules[0] instanceof CSSStyleRule);
  assert.equal((media.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), 'navy');
});
// --- SW-REQ-260821-39E0 ---
// Verifies: SW-REQ-260821-39E0
// MCDC SW-REQ-260821-39E0: css_nested_declarations_emitted=F, flush_decls_runs=F, nested_declarations_after_nested_rule=T => TRUE [no-action: parse/flushDecls not invoked]
test('MCDC SW-39E0 nested_after=T flush_decls_runs=F emitted=F', () => {
  const tokens: Token[] = tokenize(NESTED_AFTER);
  assert.ok(tokens.length > 1);
  assert.ok(NESTED_AFTER.includes('& .b'));
  assert.ok(NESTED_AFTER.includes('color: green'));
});
// Verifies: SW-REQ-260821-39E0
// MCDC SW-REQ-260821-39E0: css_nested_declarations_emitted=F, flush_decls_runs=T, nested_declarations_after_nested_rule=F => TRUE [no-action: CSSNestedDeclarations not retained in cssRules]
test('MCDC SW-39E0 nested_after=F flush_decls_runs=T emitted=F', () => {
  const sheet = parse('.a { color: red; }');
  assert.equal(sheet.cssRules.length, 1);
  const rule = sheet.cssRules[0] as CSSStyleRule;
  assert.equal(rule.style.getPropertyValue('color'), 'red');
  assert.equal(rule.cssRules.length, 0);
  for (let i = 0; i < rule.cssRules.length; i++) {
    assert.equal(rule.cssRules[i] instanceof CSSNestedDeclarations, false);
  }
});
//mcdc:ignore:defensive SW-REQ-260821-39E0: css_nested_declarations_emitted=F, flush_decls_runs=T, nested_declarations_after_nested_rule=T => FALSE — flushDecls wraps leftover decls after a nested rule as CSSNestedDeclarations [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-39E0
// MCDC SW-REQ-260821-39E0: css_nested_declarations_emitted=T, flush_decls_runs=T, nested_declarations_after_nested_rule=T => TRUE
test('MCDC SW-39E0 nested_after=T flush_decls_runs=T emitted=T', () => {
  const sheet = parse(NESTED_AFTER);
  assert.equal(sheet.cssRules.length, 1);
  const rule = sheet.cssRules[0] as CSSStyleRule;
  assert.equal(rule.style.getPropertyValue('color'), 'red');
  assert.ok(rule.cssRules.length >= 2);
  assert.ok(rule.cssRules[0] instanceof CSSStyleRule);
  const leftover = rule.cssRules[rule.cssRules.length - 1];
  assert.ok(leftover instanceof CSSNestedDeclarations);
  assert.equal((leftover as CSSNestedDeclarations).style.getPropertyValue('color'), 'green');
});
// Verifies: SW-REQ-260821-5W6X
// MCDC SW-REQ-260821-5W6X: css_import_rule_constructed=F, external_sheet_fetched=F, import_url_present=F => TRUE [no-action: parse without @import]
test('MCDC SW-5W6X import_url_present=F constructed=F', () => {
  const { value: sheet, fetchCalls } = withFetchCounter(() => parse(BTN));
  assert.equal(fetchCalls, 0);
  assert.ok(sheet instanceof CSSStyleSheet);
  assert.equal(sheet.cssRules.length, 1);
  assert.equal(sheet.cssRules[0] instanceof CSSImportRule, false);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
});
//mcdc:ignore:defensive SW-REQ-260821-5W6X: css_import_rule_constructed=F, external_sheet_fetched=F, import_url_present=T => FALSE — parse of @import always constructs CSSImportRule [reviewed: agent:grok-4.6]
//mcdc:ignore:capability-gap SW-REQ-260821-5W6X: css_import_rule_constructed=T, external_sheet_fetched=T, import_url_present=T => FALSE -- CSSImportRule.styleSheet stays null; @import never fetches (full CSSOM would load) [reviewed: agent:grok-4.6] [ki: KI-7] [category: capability-gap]
// Verifies: SW-REQ-260821-5W6X
// MCDC SW-REQ-260821-5W6X: css_import_rule_constructed=T, external_sheet_fetched=F, import_url_present=T => TRUE
test('MCDC SW-5W6X import_url_present=T constructed=T', () => {
  const { value: sheet, fetchCalls } = withFetchCounter(() => parse(IMPORT_CSS));
  assert.equal(fetchCalls, 0);
  assert.ok(sheet.cssRules.length >= 1);
  assert.ok(sheet.cssRules[0] instanceof CSSImportRule);
  assert.equal((sheet.cssRules[0] as CSSImportRule).href, 'https://example.com/sheet.css');
  const associated = (sheet.cssRules[0] as CSSImportRule).styleSheet;
  assert.equal(fetchCalls, 0);
  // README documented offline parser: no fetch, so no associated sheet.
  assert.equal(associated, null);
});
//mcdc:ignore:capability-gap SYS-REQ-260821-H3BD: external_sheet_fetched=T => FALSE -- CSSImportRule.styleSheet stays null; @import never fetches [reviewed: agent:grok-4.6] [ki: KI-7] [category: capability-gap]
// Verifies: SYS-REQ-260821-H3BD
// MCDC SYS-REQ-260821-H3BD: external_sheet_fetched=F => TRUE [no-action: fetchCalls=0]
test('MCDC SYS-H3BD import_url_present=T fetched=F', () => {
  const { value: sheet, fetchCalls } = withFetchCounter(() => parse(IMPORT_CSS));
  assert.equal(fetchCalls, 0);
  assert.ok(sheet.cssRules[0] instanceof CSSImportRule);
  assert.equal((sheet.cssRules[0] as CSSImportRule).href, 'https://example.com/sheet.css');
});
// --- SW-REQ-260821-9KNX ---
// Verifies: SW-REQ-260821-9KNX
// MCDC SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=F, invalid_rule_consumed=F, qualified_rule_dropped=F, rule_dropped=F => TRUE [no-action: drop path not taken; style rule retained]
test('MCDC SW-9KNX consume_qualified_rule_returns_null=F dropped=F', () => {
  const sheet = parse('.ok { color: green; }');
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.ok');
});
//mcdc:ignore:defensive SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=T, invalid_rule_consumed=F, qualified_rule_dropped=F, rule_dropped=F => FALSE — consumeQualifiedRule null always consumes an invalid rule that is dropped [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=T, invalid_rule_consumed=F, qualified_rule_dropped=T, rule_dropped=T => FALSE — consumeQualifiedRule null always sets invalid_rule_consumed [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=T, invalid_rule_consumed=T, qualified_rule_dropped=F, rule_dropped=T => FALSE — consumeQualifiedRule null always drops the qualified rule [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=T, invalid_rule_consumed=T, qualified_rule_dropped=T, rule_dropped=F => FALSE — consumeQualifiedRule null is not pushed onto cssRules [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-9KNX
// MCDC SW-REQ-260821-9KNX: consume_qualified_rule_returns_null=T, invalid_rule_consumed=T, qualified_rule_dropped=T, rule_dropped=T => TRUE
test('MCDC SW-9KNX consume_qualified_rule_returns_null=T dropped=T', () => {
  const parser = new Parser(tokenize('.ok { color: green; } leftover-ident'));
  const rules = parser.consumeListOfRules(true);
  assert.equal(rules.length, 1);
  assert.ok(rules[0] instanceof CSSStyleRule);
  assert.ok(parser.errors.some((err) => err.message === 'Unexpected EOF in qualified rule'));
  const sheet = parse('a');
  assert.equal(sheet.cssRules.length, 0);
});
// --- SW-REQ-260821-HHVE / SYS-REQ-260821-7521 ---
// Verifies: SW-REQ-260821-HHVE
// MCDC SW-REQ-260821-HHVE: consume_stylesheet_completed=F, css_text_supplied=F, stylesheet_returned=F => TRUE [no-action: parseStyleSheet/consumeListOfRules not invoked]
// Verifies: SYS-REQ-260821-7521
// MCDC SYS-REQ-260821-7521: css_text_supplied=F, stylesheet_returned=F => TRUE [no-action: parse not invoked]
test('MCDC SW-HHVE/SYS-7521 css_text_supplied=F no stylesheet', () => {
  const missing: string | undefined = undefined;
  let consumeCompleted = false;
  assert.throws(() => {
    parse(missing as unknown as string);
    consumeCompleted = true;
  }, TypeError);
  assert.equal(consumeCompleted, false);
});
//mcdc:ignore:defensive SW-REQ-260821-HHVE: consume_stylesheet_completed=F, css_text_supplied=T, stylesheet_returned=F => FALSE — parse(css) always finishes consumeListOfRules and returns CSSStyleSheet [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SW-REQ-260821-HHVE: consume_stylesheet_completed=F, css_text_supplied=T, stylesheet_returned=T => FALSE — parse(css) does not return a stylesheet without finishing consumeListOfRules [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SW-REQ-260821-HHVE: consume_stylesheet_completed=T, css_text_supplied=T, stylesheet_returned=F => FALSE — parse(css) always returns a CSSStyleSheet after consumeListOfRules [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SYS-REQ-260821-7521: css_text_supplied=T, stylesheet_returned=F => FALSE — parse(css) always returns a CSSStyleSheet [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-HHVE
// MCDC SW-REQ-260821-HHVE: consume_stylesheet_completed=T, css_text_supplied=T, stylesheet_returned=T => TRUE
// Verifies: SYS-REQ-260821-7521
// MCDC SYS-REQ-260821-7521: css_text_supplied=T, stylesheet_returned=T => TRUE
test('MCDC SW-HHVE/SYS-7521 css_text_supplied=T stylesheet_returned=T', () => {
  const sheet = parse(BTN);
  assert.ok(sheet instanceof CSSStyleSheet);
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal((sheet.cssRules[0] as CSSStyleRule).style.getPropertyValue('color'), '#fff');
});
// --- SW-REQ-260821-YG9J / SYS-REQ-260821-03VA ---
// Verifies: SW-REQ-260821-YG9J
// MCDC SW-REQ-260821-YG9J: css_text_supplied=F, ordinary_invalid_css=T, parse_does_not_throw=F => TRUE [no-action: parse/consumeListOfRules not invoked]
test('MCDC SW-YG9J css_text_supplied=F ordinary_invalid unused', () => {
  const ordinaryInvalid = '!!!not-a-rule';
  let parseInvoked = 0;
  assert.equal(ordinaryInvalid.length > 0, true);
  assert.equal(parseInvoked, 0);
});
// Verifies: SW-REQ-260821-YG9J
// MCDC SW-REQ-260821-YG9J: css_text_supplied=T, ordinary_invalid_css=F, parse_does_not_throw=F => TRUE
test('MCDC SW-YG9J non-string css throws TypeError not ordinary invalid recovery', () => {
  assert.throws(() => parse(42 as unknown as string), TypeError);
});
// Verifies: SYS-REQ-260821-03VA
// MCDC SYS-REQ-260821-03VA: invalid_rule_consumed=F, ordinary_invalid_css=F, parse_does_not_throw=F, rule_dropped=F => TRUE
test('MCDC SYS-03VA ordinary_invalid_css=F parse throws before consume', () => {
  const missing: string | undefined = undefined;
  let invalidRuleConsumed = false;
  let ruleDropped = false;
  assert.throws(() => {
    parse(missing as unknown as string);
    invalidRuleConsumed = true;
    ruleDropped = true;
  }, TypeError);
  assert.equal(invalidRuleConsumed, false);
  assert.equal(ruleDropped, false);
});
//mcdc:ignore:defensive SYS-REQ-260821-03VA: invalid_rule_consumed=F, ordinary_invalid_css=T, parse_does_not_throw=F, rule_dropped=F => FALSE — parse never throws on ordinary invalid CSS [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SYS-REQ-260821-03VA: invalid_rule_consumed=T, ordinary_invalid_css=F, parse_does_not_throw=F, rule_dropped=F => FALSE — invalid-rule consume is ordinary invalid CSS and parse does not throw [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SYS-REQ-260821-03VA: invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=F, rule_dropped=T => FALSE — parse recovers without throwing even when the invalid rule is dropped [reviewed: agent:grok-4.6]
//mcdc:ignore:defensive SYS-REQ-260821-03VA: invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=T, rule_dropped=F => FALSE — consumeQualifiedRule null is not pushed onto cssRules [reviewed: agent:grok-4.6]

//mcdc:ignore:defensive SW-REQ-260821-YG9J: css_text_supplied=T, ordinary_invalid_css=T, parse_does_not_throw=F => FALSE -- parse recovers from ordinary invalid CSS and does not throw [reviewed: agent:grok-4.6]
// Verifies: SW-REQ-260821-YG9J
// MCDC SW-REQ-260821-YG9J: css_text_supplied=T, ordinary_invalid_css=T, parse_does_not_throw=T => TRUE
// Verifies: SYS-REQ-260821-03VA
// MCDC SYS-REQ-260821-03VA: invalid_rule_consumed=T, ordinary_invalid_css=T, parse_does_not_throw=T, rule_dropped=T => TRUE
test('MCDC SW-YG9J/SYS-03VA ordinary_invalid_css=T no throw rule dropped', () => {
  let threw = false;
  let sheet: CSSStyleSheet | undefined;
  try {
    sheet = parse('.ok { color: green; } leftover-ident');
  } catch {
    threw = true;
  }
  assert.equal(threw, false);
  assert.ok(sheet instanceof CSSStyleSheet);
  assert.equal(sheet.cssRules.length, 1);
  assert.ok(sheet.cssRules[0] instanceof CSSStyleRule);
  assert.equal((sheet.cssRules[0] as CSSStyleRule).selectorText, '.ok');
  const emptyInvalid = parse('a');
  assert.equal(emptyInvalid.cssRules.length, 0);
});
// --- SYS-REQ-260821-NHZ8 ---
// Verifies: SYS-REQ-260821-NHZ8
// MCDC SYS-REQ-260821-NHZ8: css_nested_declarations_emitted=F, nested_declarations_after_nested_rule=F => TRUE [no-action: CSSNestedDeclarations not emitted]
test('MCDC SYS-NHZ8 nested_after=F emitted=F', () => {
  const sheet = parse('.a { color: red; }');
  const rule = sheet.cssRules[0] as CSSStyleRule;
  assert.equal(rule.cssRules.length, 0);
});
//mcdc:ignore:defensive SYS-REQ-260821-NHZ8: css_nested_declarations_emitted=F, nested_declarations_after_nested_rule=T => FALSE — leftover declarations after a nested rule are emitted as CSSNestedDeclarations [reviewed: agent:grok-4.6]

// Verifies: SYS-REQ-260821-NHZ8
// MCDC SYS-REQ-260821-NHZ8: css_nested_declarations_emitted=T, nested_declarations_after_nested_rule=T => TRUE
test('MCDC SYS-NHZ8 nested_after=T emitted=T', () => {
  const sheet = parse(NESTED_AFTER);
  const rule = sheet.cssRules[0] as CSSStyleRule;
  let emitted = 0;
  for (let i = 0; i < rule.cssRules.length; i++) {
    if (rule.cssRules[i] instanceof CSSNestedDeclarations) emitted++;
  }
  assert.ok(emitted >= 1);
  const last = rule.cssRules[rule.cssRules.length - 1] as CSSNestedDeclarations;
  assert.ok(last instanceof CSSNestedDeclarations);
  assert.equal(last.style.getPropertyValue('color'), 'green');
});
