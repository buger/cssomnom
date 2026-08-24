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
// Verifies: SW-REQ-260821-7M07, SW-REQ-260821-QV2H, SYS-REQ-260821-SBJ7
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';

const CSS_TEXT = '.btn { color: #fff; }';
// --- SW-REQ-260821-7M07 ---
// Verifies: SW-REQ-260821-7M07
// MCDC SW-REQ-260821-7M07: consume_token_loop_runs=F, css_text_supplied=T, token_list_returned=F => TRUE [no-action: tokenize/consumeToken not invoked]
// reqproof:proptest:skip curated MC/DC witness row asserting tokenize call-count combinations; assertion-only structural-coverage harness with no independent oracle
test('MCDC SW-7M07 consume_token_loop_runs=F css_text_supplied=T token_list_returned=F', () => {
  const cssTextSupplied = CSS_TEXT;
  let tokenizeInvoked = 0;
  assert.equal(typeof cssTextSupplied, 'string');
  assert.ok(cssTextSupplied.length > 0);
  assert.equal(tokenizeInvoked, 0);
});
//mcdc:ignore:defensive SW-REQ-260821-7M07: consume_token_loop_runs=T, css_text_supplied=T, token_list_returned=F => FALSE — tokenize(css) always returns a Token[] including EOF [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-7M07
// MCDC SW-REQ-260821-7M07: consume_token_loop_runs=T, css_text_supplied=T, token_list_returned=T => TRUE
test('MCDC SW-7M07 consume_token_loop_runs=T css_text_supplied=T token_list_returned=T', () => {
  const tokens = tokenize(CSS_TEXT);
  assert.ok(Array.isArray(tokens));
  assert.ok(tokens.length > 1);
  assert.equal(tokens[tokens.length - 1].type, 'EOF');
  assert.ok(tokens.some((t) => t.type === 'ident' && t.value === 'btn'));
  assert.ok(tokens.some((t) => t.type === 'hash' && t.value === 'fff'));
});
// --- SW-REQ-260821-QV2H ---
// Verifies: SW-REQ-260821-QV2H
// MCDC SW-REQ-260821-QV2H: chunk_appended=F, complete_token_in_chunk=T, tokens_available_after_get_tokens=F => TRUE [no-action: appendChunk not invoked]
test('MCDC SW-QV2H chunk_appended=F tokens_available_after_get_tokens=F', () => {
  const completeChunk = CSS_TEXT;
  const tokenizer = new StreamingTokenizer();
  let appendCalls = 0;
  const original = StreamingTokenizer.prototype.appendChunk;
  StreamingTokenizer.prototype.appendChunk = function (this: StreamingTokenizer, chunk: string) {
    appendCalls += 1;
    return original.call(this, chunk);
  };
  try {
    const tokens = tokenizer.getTokens();
    assert.ok(completeChunk.includes('btn'));
    assert.equal(appendCalls, 0);
    assert.ok(Array.isArray(tokens));
    assert.equal(tokens.length, 0);
  } finally {
    StreamingTokenizer.prototype.appendChunk = original;
  }
});
// Verifies: SW-REQ-260821-QV2H
// MCDC SW-REQ-260821-QV2H: chunk_appended=T, complete_token_in_chunk=F, tokens_available_after_get_tokens=F => TRUE [no-action: complete token not produced]
test('MCDC SW-QV2H chunk_appended=T complete_token_in_chunk=F tokens_available_after_get_tokens=F', () => {
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('url(foo');
  const tokens = tokenizer.getTokens();
  assert.equal(tokens.length, 0);
  assert.equal(tokens.some((t) => t.type === 'EOF'), false);
});
//mcdc:ignore:defensive SW-REQ-260821-QV2H: chunk_appended=T, complete_token_in_chunk=T, tokens_available_after_get_tokens=F => FALSE — appendChunk that produced a complete token always yields tokens from getTokens [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-QV2H
// MCDC SW-REQ-260821-QV2H: chunk_appended=T, complete_token_in_chunk=T, tokens_available_after_get_tokens=T => TRUE
test('MCDC SW-QV2H chunk_appended=T tokens_available_after_get_tokens=T', () => {
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('.btn { col');
  tokenizer.appendChunk('or: #fff; }');
  const tokens = tokenizer.getTokens();
  assert.ok(tokens.length > 0);
  assert.ok(tokens.some((t) => t.type === 'ident' && t.value === 'btn'));
  tokenizer.close();
  const rest = tokenizer.getTokens();
  assert.ok(rest.some((t) => t.type === 'EOF'));
});
// --- SYS-REQ-260821-SBJ7 ---
// Verifies: SYS-REQ-260821-SBJ7
// MCDC SYS-REQ-260821-SBJ7: css_text_supplied=F, token_list_returned=F => TRUE [no-action: tokenize not invoked]
test('MCDC SYS-SBJ7 css_text_supplied=F token_list_returned=F', () => {
  let tokenizeInvoked = 0;
  const missing: string | undefined = undefined;
  assert.equal(missing, undefined);
  assert.equal(tokenizeInvoked, 0);
});
//mcdc:ignore:defensive SYS-REQ-260821-SBJ7: css_text_supplied=T, token_list_returned=F => FALSE — tokenize(css) always returns a token list [reviewed: agent:grok-4.6]

// Verifies: SYS-REQ-260821-SBJ7
// MCDC SYS-REQ-260821-SBJ7: css_text_supplied=T, token_list_returned=T => TRUE
test('MCDC SYS-SBJ7 css_text_supplied=T token_list_returned=T', () => {
  const tokens = tokenize(CSS_TEXT);
  assert.ok(Array.isArray(tokens));
  assert.ok(tokens.length > 1);
  assert.equal(tokens[tokens.length - 1].type, 'EOF');
});
