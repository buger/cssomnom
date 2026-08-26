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
// Boundary witnesses for SW-REQ-260821-QV2H (streaming tokenizer): tokens
// split across chunk boundaries are the edge of the streaming contract. A
// partial token buffered at a chunk edge yields NO token until the completing
// chunk (or close) arrives, and the reassembled token is byte-identical to the
// batch tokenize() of the same text. Public surface only (StreamingTokenizer).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamingTokenizer } from '../src/streaming-tokenizer.ts';
import { tokenize } from '../src/tokenizer.ts';

function firstIdent(tokens: { type: string; originalText?: string }[]): string {
  const ident = tokens.find(t => t.type === 'ident');
  assert.ok(ident, 'expected an ident token');
  return ident.originalText ?? '';
}

// SW-REQ-260821-QV2H:boundary:nominal
test('ident split at a chunk boundary yields nothing until the completing chunk', () => {
  const st = new StreamingTokenizer();
  st.appendChunk('.a { col');
  // Completed prefix tokens stream incrementally; the trailing PARTIAL ident
  // 'col' must be withheld — no token may be fabricated from the prefix.
  const mid = st.getTokens().map(t => `${t.type}:${t.originalText}`);
  assert.deepEqual(mid, ['delim:.', 'ident:a', 'whitespace: ', '{:{', 'whitespace: ']);
  assert.ok(!mid.some(e => e.startsWith('ident:col')), 'partial ident withheld');
  st.appendChunk('or: red }');
  st.close();
  // getTokens() is an incremental cursor: accumulate across calls. The
  // reassembled stream is identical to batch tokenize() (modulo EOF).
  const streamed = [...mid, ...st.getTokens().map(t => `${t.type}:${t.originalText}`)];
  const batch = tokenize('.a { color: red }').map(t => `${t.type}:${t.originalText}`);
  assert.deepEqual(
    streamed.filter(e => !e.startsWith('EOF:')),
    batch.filter(e => !e.startsWith('EOF:'))
  );
  assert.ok(streamed.includes('ident:color'), 'split ident reassembled');
});

// SW-REQ-260821-QV2H:boundary:negative
test('comment and string split across chunk boundaries do not close early', () => {
  // This tokenizer converts comments to whitespace tokens (css-syntax-3
  // § 4.2 #tokenizer-definitions); the reassembled comment must span BOTH
  // chunks in its originalText, proving it did not close early.
  const st = new StreamingTokenizer();
  st.appendChunk('/* not yet');
  assert.equal(st.getTokens().length, 0, 'open comment withheld');
  st.appendChunk(' closed */ x');
  st.close();
  const tokens = st.getTokens();
  const comment = tokens.find(t => t.type === 'whitespace' && (t.originalText ?? '').includes('/*'));
  assert.ok(comment, 'reassembled comment surface');
  assert.equal(comment.originalText, '/* not yet closed */ ');
  assert.equal(firstIdent(tokens), 'x');

  // A string split at the quote-content boundary stays a single string token.
  const st2 = new StreamingTokenizer();
  st2.appendChunk('"half');
  assert.equal(st2.getTokens().length, 0, 'open string withheld');
  st2.appendChunk(' of it"');
  st2.close();
  const str = st2.getTokens().find(t => t.type === 'string');
  assert.ok(str, 'reassembled string token');
  assert.equal(str.originalText, '"half of it"');
});
