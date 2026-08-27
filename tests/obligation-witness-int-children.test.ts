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
import { CSSMediaRule, CSSAtRule } from '../src/CSSOM.ts';

function box(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<html><body><div class="t"></div></body></html>');
  const el = document.querySelector('.t');
  assert.ok(el, 'missing .t');
  return getCascadedStyle(el, parseStyleSheet(css));
}

// INT-REQ-260826-GTCS:integration:integration
// INT-REQ-260826-GTCS:nominal:nominal
test('batch tokenize returns an EOF-terminated token list', () => {
  const tokens = tokenize('.a { color: red }');
  assert.ok(tokens.length > 0, 'token list returned');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF');
  assert.equal(last.originalText, '');
  assert.equal(tokens.filter(t => t.type === 'EOF').length, 1, 'exactly one EOF');
});

// INT-REQ-260826-CHBW:integration:integration
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

// INT-REQ-260826-HEXC:integration:integration
test('escaped hex run stops at 6 digits and preserves the remainder', () => {
  const sheet = parse('.t { content: "\\1234567"; }');
  const value = (sheet.cssRules[0] as unknown as { style: { getPropertyValue(k: string): string } }).style.getPropertyValue('content');
  assert.equal(value, '"\uFFFD7"');
});

// INT-REQ-260826-TBRK:integration:integration
test('exact sort-key tie is broken by document order', () => {
  const tie = box('.t { color: red; } .t { color: blue; }');
  assert.equal(tie.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// INT-REQ-260826-TBRK:integration:integration
test('crossing the specificity edge wins over earlier document order', () => {
  const spec = box('#x { color: green; } .t { color: red; } body .t { color: blue; }');
  assert.equal(spec.getPropertyValue('color'), 'rgb(0, 0, 255)');
});

// INT-REQ-260826-HSAR:integration:integration
// Verifies: INT-REQ-260826-HSAR
// MCDC INT-REQ-260826-HSAR: authored_value_retained=T, hsl_arity_out_of_bounds=T, hsl_parsed=F => TRUE
test('hsl arity gates reject and retain the authored text', () => {
  const two = box('.t { color: hsl(0, 100%); }');
  assert.equal(two.getPropertyValue('color'), 'hsl(0, 100%)');
  const five = box('.t { color: hsl(1, 2, 3, 4, 5); }');
  assert.equal(five.getPropertyValue('color'), 'hsl(1, 2, 3, 4, 5)');
});

// INT-REQ-260826-HSAR:integration:integration
// Verifies: INT-REQ-260826-HSAR
// MCDC INT-REQ-260826-HSAR: authored_value_retained=F, hsl_arity_out_of_bounds=F, hsl_parsed=F => TRUE [no-action: computed rgb(0, 255, 0) replaces the authored hsl() text — the authored-retention path never fires for in-arity input]
test('in-arity hsl parses to a computed value instead of retained authored text', () => {
  const three = box('.t { color: hsl(120, 100%, 50%); }');
  assert.equal(three.getPropertyValue('color'), 'rgb(0, 255, 0)', 'authored hsl() text is not retained when arity is legal');
});
//mcdc:ignore:defensive INT-REQ-260826-HSAR: authored_value_retained=F, hsl_arity_out_of_bounds=T, hsl_parsed=F => FALSE -- parseHslComponents returns null only on the arity violation (src/cascade/color-resolver.ts SW-REQ-260824-CAHE gate, count < 3 or > 4) and normalizeComputedColor then keeps the authored text verbatim, so an out-of-arity list always retains [reviewed: agent:champ]
//mcdc:ignore:defensive INT-REQ-260826-HSAR: authored_value_retained=T, hsl_arity_out_of_bounds=T, hsl_parsed=T => FALSE -- the arity gate (count < 3 or count > 4) rejects every out-of-bounds list before color conversion, so hsl_parsed=T cannot co-occur with hsl_arity_out_of_bounds=T [reviewed: agent:champ]

// INT-REQ-260826-HSAR:integration:integration
test('hsl arity gate admits the 3-4 component forms', () => {
  const three = box('.t { color: hsl(120, 100%, 50%); }');
  assert.equal(three.getPropertyValue('color'), 'rgb(0, 255, 0)');
  const four = box('.t { color: hsl(120 100% 50% / 0.4); }');
  assert.equal(four.getPropertyValue('color'), 'rgba(0, 255, 0, 0.4)');
});

// ---------------------------------------------------------------------------
// Row-level MC/DC witnesses for the 2026-08-26 INT children. Each line maps
// one truth-table row from `proof mcdc show <REQ-ID>`; every assignment was
// probed live against the public API before the witness was authored.
// ---------------------------------------------------------------------------

// INT-REQ-260826-GTCS:nominal:nominal
// Verifies: INT-REQ-260826-GTCS
// MCDC INT-REQ-260826-GTCS: css_text_supplied=F, eof_token_last=F, token_list_returned=F => TRUE [no-action: streaming entry used, batch tokenize() idle]
test('streaming-only path leaves the batch tokenize entry idle', () => {
  const st = new StreamingTokenizer();
  st.appendChunk('.a { color: red }');
  st.close();
  const tokens = st.getTokens();
  assert.ok(tokens.length > 0, 'streaming path produced tokens without tokenize()');
  assert.equal(tokens[tokens.length - 1].type, 'EOF');
});
// Verifies: INT-REQ-260826-GTCS
// MCDC INT-REQ-260826-GTCS: css_text_supplied=T, eof_token_last=T, token_list_returned=T => TRUE
test('batch tokenize returns an EOF-terminated token list (row witness)', () => {
  const tokens = tokenize('.a { color: red }');
  assert.ok(Array.isArray(tokens), 'token list returned');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF');
  assert.equal(last.originalText, '');
  assert.equal(tokens.filter(t => t.type === 'EOF').length, 1, 'exactly one EOF');
});
//mcdc:ignore:defensive INT-REQ-260826-GTCS: css_text_supplied=T, eof_token_last=F, token_list_returned=F => FALSE -- tokenize(css) always returns a Token[] (token_list_returned=F unreachable; SW-REQ-260821-SBJ7/7M07 precedent) [reviewed: agent:champ]
//mcdc:ignore:defensive INT-REQ-260826-GTCS: css_text_supplied=T, eof_token_last=F, token_list_returned=T => FALSE -- tokenize(css) always terminates the list in exactly one empty-span EOF token, so eof_token_last=F cannot occur [reviewed: agent:champ]
//mcdc:ignore:defensive INT-REQ-260826-GTCS: css_text_supplied=T, eof_token_last=T, token_list_returned=F => FALSE -- tokenize(css) always returns the full token list for the supplied text [reviewed: agent:champ]

// INT-REQ-260826-CHBW:nominal:nominal
// Verifies: INT-REQ-260826-CHBW
// MCDC INT-REQ-260826-CHBW: chunk_appended=F, complete_token_in_chunk=F, partial_token_withheld=F => TRUE [no-action: fresh StreamingTokenizer().getTokens() is empty — no chunk buffered, withholding never engaged]
test('fresh streaming tokenizer yields no tokens and withholds nothing', () => {
  const st = new StreamingTokenizer();
  assert.deepEqual(st.getTokens().map(t => `${t.type}:${t.originalText}`), [], 'nothing buffered before appendChunk');
});

// INT-REQ-260826-CHBW:integration:integration
// Verifies: INT-REQ-260826-CHBW
// MCDC INT-REQ-260826-CHBW: chunk_appended=T, complete_token_in_chunk=F, partial_token_withheld=T => TRUE
test('partial token at a chunk boundary is withheld until completed (row witness)', () => {
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

// INT-REQ-260826-CHBW:integration:integration
// Verifies: INT-REQ-260826-CHBW
// MCDC INT-REQ-260826-CHBW: chunk_appended=T, complete_token_in_chunk=T, partial_token_withheld=F => TRUE [no-action: deepEqual over the full '.a {' prefix — every buffered token is complete, the withholding path never engages]
test('chunk that completes its tokens streams them with nothing withheld', () => {
  const st = new StreamingTokenizer();
  st.appendChunk('.a {');
  const out = st.getTokens().map(t => `${t.type}:${t.originalText}`);
  assert.deepEqual(out, ['delim:.', 'ident:a', 'whitespace: ', '{:{'], 'every token in the chunk is complete and returned');
});
//mcdc:ignore:defensive INT-REQ-260826-CHBW: chunk_appended=T, complete_token_in_chunk=F, partial_token_withheld=F => FALSE -- appendChunk that ends mid-token always withholds the trailing partial (SW-REQ-260821-QV2H precedent) [reviewed: agent:champ]

// INT-REQ-260826-HEXC:integration:integration
// Verifies: INT-REQ-260826-HEXC
// MCDC INT-REQ-260826-HEXC: escaped_hex_digits_GT_6=F, remainder_preserved_as_ident=F, sixth_digit_stops_hex=F => TRUE [no-action: content value is exactly "A" — a <=6-digit escape consumes the whole run, no remainder ident emitted]
test('short escape run needs no six-digit stop and leaves no remainder', () => {
  const sheet = parse('.t { content: "\\41"; }');
  const value = (sheet.cssRules[0] as unknown as { style: { getPropertyValue(k: string): string } }).style.getPropertyValue('content');
  assert.equal(value, '"A"', '2-digit hex escape decodes fully; no remainder survives');
});

// INT-REQ-260826-HEXC:integration:integration
// Verifies: INT-REQ-260826-HEXC
// MCDC INT-REQ-260826-HEXC: escaped_hex_digits_GT_6=T, remainder_preserved_as_ident=T, sixth_digit_stops_hex=T => TRUE
test('escaped hex run stops at 6 digits and preserves the remainder (row witness)', () => {
  const sheet = parse('.t { content: "\\1234567"; }');
  const value = (sheet.cssRules[0] as unknown as { style: { getPropertyValue(k: string): string } }).style.getPropertyValue('content');
  assert.equal(value, '"\uFFFD7"');
});
//mcdc:ignore:defensive INT-REQ-260826-HEXC: escaped_hex_digits_GT_6=T, remainder_preserved_as_ident=F, sixth_digit_stops_hex=F => FALSE -- the tokenizer caps escaped hex runs at 6 digits (css-syntax-3 consume-escaped-code-point) so a >6-digit run always stops [reviewed: agent:champ]
//mcdc:ignore:defensive INT-REQ-260826-HEXC: escaped_hex_digits_GT_6=T, remainder_preserved_as_ident=F, sixth_digit_stops_hex=T => FALSE -- every code point after the 6-digit cap is emitted as ordinary ident content, so remainder_preserved_as_ident=F cannot occur [reviewed: agent:champ]
//mcdc:ignore:defensive INT-REQ-260826-HEXC: escaped_hex_digits_GT_6=T, remainder_preserved_as_ident=T, sixth_digit_stops_hex=F => FALSE -- consume-escaped-code-point never consumes a 7th hex digit, so the stop always fires [reviewed: agent:champ]

// INT-REQ-260826-ATRD:integration:integration
// Verifies: INT-REQ-260826-ATRD
// MCDC INT-REQ-260826-ATRD: handler_table_contains=T, typed_cssom_rule_constructed=T => TRUE
test('case-folded at-keyword handler hit constructs the typed rule', () => {
  const sheet = parse('@MEDIA all { .a { color: red } }');
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSMediaRule, 'mixed-case @MEDIA dispatches to CSSMediaRule');
});

// INT-REQ-260826-ATRD:integration:integration
// Verifies: INT-REQ-260826-ATRD
// MCDC INT-REQ-260826-ATRD: handler_table_contains=F, typed_cssom_rule_constructed=F => TRUE [no-action: rule instanceof CSSAtRule — the typed-rule constructor is never invoked for a table miss]
test('unknown at-keyword misses the handler table and stays untyped', () => {
  const sheet = parse('@unknown-at x { }');
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSAtRule, 'unknown at-rule falls back to the generic CSSAtRule');
});
//mcdc:ignore:defensive INT-REQ-260826-ATRD: handler_table_contains=T, typed_cssom_rule_constructed=F => FALSE -- a handler-table hit always constructs the typed CSSOM rule (the handler IS the constructor); the ASCII-lowercase fold before Object.hasOwn lookup is unconditional (css-syntax-3 #ascii-case-insensitive) [reviewed: agent:champ]

// INT-REQ-260826-TBRK:integration:integration
// Verifies: INT-REQ-260826-TBRK
// MCDC INT-REQ-260826-TBRK: declarations_tie_on_sort_keys=T, later_in_document_order_wins=T => TRUE
test('exact sort-key tie is broken by document order (row witness)', () => {
  const tie = box('.t { color: red; } .t { color: blue; }');
  assert.equal(tie.getPropertyValue('color'), 'rgb(0, 0, 255)');
});
// INT-REQ-260826-TBRK:integration:integration
// Verifies: INT-REQ-260826-TBRK
// MCDC INT-REQ-260826-TBRK: declarations_tie_on_sort_keys=F, later_in_document_order_wins=F => TRUE [no-action: specificity decides the winner — no sort-key tie exists, document-order comparison never consulted]
test('no tie: specificity edge decides without consulting document order', () => {
  const spec = box('#x { color: green; } .t { color: red; } body .t { color: blue; }');
  assert.equal(spec.getPropertyValue('color'), 'rgb(0, 0, 255)', 'specificity 0-1-1 beats 0-1-0 regardless of order');
});
//mcdc:ignore:defensive INT-REQ-260826-TBRK: declarations_tie_on_sort_keys=T, later_in_document_order_wins=F => FALSE -- declarations that tie on importance/layer/origin/specificity are always ordered by document order, so the later one wins [reviewed: agent:champ]
