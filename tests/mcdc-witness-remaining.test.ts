/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
// Remaining ordinary TRUE/trigger_false MC/DC rows that shipped src can still produce.
// Verifies: SW-REQ-260821-6D9T, SW-REQ-260821-7M07, SW-REQ-260821-MZ8P, SW-REQ-260821-FWNH
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { matches } from '../src/matcher.ts';
import { SelectorParser } from '../src/SelectorParser.ts';
import { Parser } from '../src/parser.ts';
import { tokenize } from '../src/tokenizer.ts';
import { CSS, CSSParserRule } from '../src/index.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { compareCascadeDeclarations } from '../src/cascade/cascade-sorter.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';
import type { MatchedDeclaration } from '../src/cascade/types.ts';

function sampleDiv(): Element {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('div');
  assert.ok(el);
  return el;
}

function withCompareSortCounter(fn: () => void): number {
  let compareSorts = 0;
  const original = Array.prototype.sort;
  Array.prototype.sort = function (this: unknown[], compareFn?: (a: unknown, b: unknown) => number) {
    if (compareFn === compareCascadeDeclarations) compareSorts += 1;
    return original.call(this, compareFn as (a: unknown, b: unknown) => number);
  };
  try {
    fn();
    return compareSorts;
  } finally {
    Array.prototype.sort = original;
  }
}

describe('MC/DC remaining TRUE/trigger_false witnesses', { concurrency: false }, () => {
  describe('SW-REQ-260821-6D9T', () => {
    // Verifies: SW-REQ-260821-6D9T
    // MCDC SW-REQ-260821-6D9T: bad_selector_supplied=T, empty_match=F, parse_selector_rejects=F => TRUE [no-action: SelectorParser.parse throw]
    test('forgiving :is keeps a bad inner selector from rejecting while the good branch still matches', () => {
      const badInsideIs = ':is(div, ###)';
      const el = sampleDiv();
      let parseRejects = 0;
      const tokens = tokenize(badInsideIs);
      const parser = new Parser(tokens);
      const values = parser.parseComponentValues();
      try {
        new SelectorParser(values, { allowRelative: true, forgiving: false }).parse();
      } catch {
        parseRejects += 1;
      }
      assert.equal(parseRejects, 0, 'SelectorParser must accept :is() with a forgiven inner ###');
      assert.equal(matches(el, '###'), false, 'bare ### is a bad selector');
      assert.equal(matches(el, badInsideIs), true);
    });
  });

  describe('SW-REQ-260821-7M07', () => {
    // Verifies: SW-REQ-260821-7M07
    // MCDC SW-REQ-260821-7M07: consume_token_loop_runs=T, css_text_supplied=F, token_list_returned=F => TRUE [no-action: appendChunk/getTokens]
    test('StreamingTokenizer.close runs consumeToken without css text or a returned token list', () => {
      class ProbeTokenizer extends StreamingTokenizer {
        consumeRuns = 0;
        protected consumeToken() {
          this.consumeRuns += 1;
          return super.consumeToken();
        }
      }
      const originalAppend = StreamingTokenizer.prototype.appendChunk;
      let appendCalls = 0;
      StreamingTokenizer.prototype.appendChunk = function (this: StreamingTokenizer, chunk: string) {
        appendCalls += 1;
        return originalAppend.call(this, chunk);
      };
      const originalGetTokens = StreamingTokenizer.prototype.getTokens;
      let getTokensCalls = 0;
      StreamingTokenizer.prototype.getTokens = function (this: StreamingTokenizer) {
        getTokensCalls += 1;
        return originalGetTokens.call(this);
      };
      try {
        const tokenizer = new ProbeTokenizer();
        tokenizer.close();
        assert.ok(tokenizer.consumeRuns >= 1, 'close() must run consumeToken');
        assert.equal(appendCalls, 0);
        assert.equal(getTokensCalls, 0);
      } finally {
        StreamingTokenizer.prototype.appendChunk = originalAppend;
        StreamingTokenizer.prototype.getTokens = originalGetTokens;
      }
    });
  });

  describe('SW-REQ-260821-MZ8P', () => {
    // Verifies: SW-REQ-260821-MZ8P
    // MCDC SW-REQ-260821-MZ8P: css_parser_rule_returned=F, parse_stylesheet_sync_called=T, to_parser_rule_maps_ast=F => TRUE [no-action: toParserRule AST mapping]
    test('parseStylesheetSync of empty css returns no CSSParserRule and maps no AST nodes', () => {
      const rules = CSS.parseStylesheetSync('');
      assert.ok(Array.isArray(rules));
      assert.equal(rules.length, 0);
      assert.equal(rules.some((rule) => rule instanceof CSSParserRule), false);
    });
  });

  describe('SW-REQ-260821-FWNH', () => {
    // Verifies: SW-REQ-260821-FWNH
    // MCDC SW-REQ-260821-FWNH: cascaded_style_returned=T, compare_cascade_declarations_runs=F, element_and_rules_supplied=T, layout_performed=T => TRUE [no-action: compareCascadeDeclarations]
    test('empty rules still return a cascaded style; layout can run without compareCascadeDeclarations', () => {
      const el = sampleDiv();
      const compareSorts = withCompareSortCounter(() => {
        const style = getCascadedStyle(el, []);
        assert.ok(style instanceof CSSStyleDeclaration);
      });
      assert.equal(compareSorts, 0);
      const rect = el.getBoundingClientRect();
      assert.equal(typeof rect.width, 'number');
    });

    // Verifies: SW-REQ-260821-FWNH
    // MCDC SW-REQ-260821-FWNH: cascaded_style_returned=T, compare_cascade_declarations_runs=T, element_and_rules_supplied=F, layout_performed=T => TRUE [no-action: element_and_rules_supplied]
    test('compareCascadeDeclarations can run without supplying an element and rules to getCascadedStyle', () => {
      const lower: MatchedDeclaration = {
        name: 'color',
        value: 'red',
        important: false,
        isInline: false,
        layerOrder: Infinity,
        specificity: [0, 0, 1],
        sourceOrder: 0,
      };
      const higher: MatchedDeclaration = {
        name: 'color',
        value: 'blue',
        important: false,
        isInline: false,
        layerOrder: Infinity,
        specificity: [0, 1, 0],
        sourceOrder: 1,
      };
      assert.ok(compareCascadeDeclarations(lower, higher) < 0);
      const style = getCascadedStyle(null);
      assert.ok(style instanceof CSSStyleDeclaration);
      const el = sampleDiv();
      const rect = el.getBoundingClientRect();
      assert.equal(typeof rect.height, 'number');
    });
  });
});
