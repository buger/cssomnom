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
// Witnesses for the INT decomposition children of the under-modeled
// tokenizer/cascade families (2026-08-26 enrichment batch). Each child models
// one causal edge of its SW parent's contract; every assertion was verified
// live before the requirement was authored. Public surfaces only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { parse } from '../src/index.ts';
import { parseStyleSheet } from '../src/parser.ts';
import { getCascadedStyle } from '../src/cascade.ts';
import { CSSStyleDeclaration } from '../src/CSSStyleDeclaration.ts';

function box(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  return getCascadedStyle(el, parseStyleSheet(css));
}

// INT-REQ-260826-GTCS:nominal:nominal
test('batch tokenize returns an EOF-terminated token list', () => {
  const tokens = tokenize('.a { color: red }');
  assert.ok(tokens.length > 0, 'token list returned');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF');
  assert.equal(last.originalText, '');
  assert.equal(tokens.filter(t => t.type === 'EOF').length, 1, 'exactly one EOF');
});

// SW-REQ-260821-QV2H:nominal:negative
// SW-REQ-260821-QV2H:nominal:nominal
test('partial token at a chunk boundary is withheld until completed', () => {
  const st = new StreamingTokenizer();
  st.appendChunk('.a { col');
  const mid = st.getTokens().map(t => `${t.type}:${t.originalText}`);
  // Completed prefix streams; the partial 'col' ident is withheld.
  assert.deepEqual(mid, ['delim:.', 'ident:a', 'whitespace: ', '{:{', 'whitespace: ']);
  st.appendChunk('or: red }');
  st.close();
  const tail = st.getTokens().map(t => `${t.type}:${t.originalText}`);
  assert.ok(tail.includes('ident:color'), 'split ident reassembled');
});

// SW-REQ-260822-7R6Z:nominal:negative
test('escaped hex run stops at 6 digits and preserves the remainder', () => {
  const sheet = parse('.t { content: "\\1234567"; }');
  const value = (sheet.cssRules[0] as { style: { getPropertyValue(k: string): string } }).style.getPropertyValue('content');
  assert.equal(value, '"\uFFFD7"');
});

// SW-REQ-260821-FWNH:nominal:nominal
test('exact sort-key tie is broken by document order', () => {
  const tie = box('.t { color: red; } .t { color: blue; }');
  assert.equal(tie.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// SW-REQ-260821-FWNH:nominal:negative
test('crossing the specificity edge wins over earlier document order', () => {
  const spec = box('#x { color: green; } .t { color: red; } body .t { color: blue; }');
  assert.equal(spec.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// SW-REQ-260824-CAHE:nominal:negative
test('hsl arity gates reject and retain the authored text', () => {
  const two = box('.t { color: hsl(0, 100%); }');
  assert.equal(two.getPropertyValue('color'), 'hsl(0, 100%)');
  const five = box('.t { color: hsl(1, 2, 3, 4, 5); }');
  assert.equal(five.getPropertyValue('color'), 'hsl(1, 2, 3, 4, 5)');
});

// SW-REQ-260824-CAHE:nominal:nominal
test('hsl arity gate admits the 3-4 component forms', () => {
  const three = box('.t { color: hsl(120, 100%, 50%); }');
  assert.equal(three.getPropertyValue('color'), 'rgb(0, 255, 0)');
  const four = box('.t { color: hsl(120 100% 50% / 0.4); }');
  assert.equal(four.getPropertyValue('color'), 'rgba(0, 255, 0, 0.4)');
});
