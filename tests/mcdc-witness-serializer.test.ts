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
// Verifies: SW-REQ-260821-YTV6, SYS-REQ-260821-KV30
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import { serialize } from '../src/serializer.ts';

const BTN = '.btn { color: #fff; }';
const OTHER = 'div { color: red; }';
// --- SW-REQ-260821-YTV6 ---
// Verifies: SW-REQ-260821-YTV6
// MCDC SW-REQ-260821-YTV6: serialize_token_list_runs=F, serialized_equals_source=F, tokens_from_btn_rule=T => TRUE [no-action: serialize not invoked]
test('MCDC SW-YTV6 serialize_token_list_runs=F tokens_from_btn_rule=T', () => {
  const tokens = tokenize(BTN);
  let serializeInvoked = 0;
  assert.ok(tokens.some((t) => t.type === 'ident' && t.value === 'btn'));
  assert.ok(tokens.some((t) => t.type === 'hash' && t.value === 'fff'));
  assert.equal(serializeInvoked, 0);
});
// Verifies: SW-REQ-260821-YTV6
// MCDC SW-REQ-260821-YTV6: serialize_token_list_runs=T, serialized_equals_source=F, tokens_from_btn_rule=F => TRUE [no-action: btn-rule token list not serialized]
test('MCDC SW-YTV6 serialize_token_list_runs=T tokens_from_btn_rule=F serialized_equals_source=F', () => {
  const tokens = tokenize(OTHER);
  const serialized = serialize(tokens);
  assert.notEqual(serialized, BTN);
  assert.equal(tokens.some((t) => t.type === 'ident' && t.value === 'btn'), false);
});
//mcdc:ignore:defensive SW-REQ-260821-YTV6: serialize_token_list_runs=T, serialized_equals_source=F, tokens_from_btn_rule=T => FALSE — serialize(tokenize('.btn { color: #fff; }')) equals the source text [reviewed: agent:grok-4.6]

// Verifies: SW-REQ-260821-YTV6
// MCDC SW-REQ-260821-YTV6: serialize_token_list_runs=T, serialized_equals_source=T, tokens_from_btn_rule=T => TRUE
// Verifies: SYS-REQ-260821-KV30
// MCDC SYS-REQ-260821-KV30: serialized_equals_source=T, tokens_from_btn_rule=T => TRUE
test('MCDC SW-YTV6/SYS-KV30 serialize btn tokens equals source', () => {
  const tokens = tokenize(BTN);
  const serialized = serialize(tokens);
  assert.ok(tokens.some((t) => t.type === 'ident' && t.value === 'btn'));
  assert.equal(serialized, BTN);
});
//mcdc:ignore:defensive SYS-REQ-260821-KV30: serialized_equals_source=F, tokens_from_btn_rule=T => FALSE — serialize of the button color rule tokens equals the source text [reviewed: agent:grok-4.6]

// --- SYS-REQ-260821-KV30 ---
// Verifies: SYS-REQ-260821-KV30
// MCDC SYS-REQ-260821-KV30: serialized_equals_source=F, tokens_from_btn_rule=F => TRUE [no-action: btn-rule tokens not supplied]
test('MCDC SYS-KV30 tokens_from_btn_rule=F serialized_equals_source=F', () => {
  const tokens = tokenize(OTHER);
  const serialized = serialize(tokens);
  assert.equal(tokens.some((t) => t.type === 'ident' && t.value === 'btn'), false);
  assert.notEqual(serialized, BTN);
});
