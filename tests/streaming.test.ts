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
// Verifies: SYS-REQ-260821-SBJ7, SW-REQ-260821-QV2H, SW-REQ-260821-7M07
import { test } from 'node:test';
import assert from 'node:assert';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizer, NeedMoreDataError } from '../src/streaming-tokenizer.ts';
import type { Token } from '../src/types.ts';
import { Parser } from '../src/parser.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';

function assertTokensEqual(actual: Token[], expected: Token[]) {
  assert.strictEqual(actual.length, expected.length, `Expected \${expected.length} tokens, got \${actual.length}`);
  for (let i = 0; i < actual.length; i++) {
    assert.deepStrictEqual(actual[i], expected[i], `Token at index \${i} mismatch`);
  }
}

// SYS-REQ-260821-SBJ7:nominal:nominal
// SYS-REQ-260821-SBJ7:denial_of_service_resistant:nominal
// SW-REQ-260821-QV2H:nominal:nominal
// SW-REQ-260821-QV2H:denial_of_service_resistant:nominal
test('streaming: single chunk', () => {
  const input = 'div { color: red; }';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk(input);
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split identifier', () => {
  const input = 'ident';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('id');
  tokenizer.appendChunk('ent');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split string', () => {
  const input = '"hello world"';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('"hello ');
  tokenizer.appendChunk('world"');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split number', () => {
  const input = '123.456';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('123');
  tokenizer.appendChunk('.456');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split comment', () => {
  const input = '/* comment */';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('/* com');
  tokenizer.appendChunk('ment */');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split CDO', () => {
  const input = '<!--';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('<!');
  tokenizer.appendChunk('--');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split CDC', () => {
  const input = '-->';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('--');
  tokenizer.appendChunk('>');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: split escape', () => {
  const input = '\\\\21 ';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('\\\\');
  tokenizer.appendChunk('21 ');
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

test('streaming: character by character', () => {
  const input = 'div { color: red; } /* comment */ 123.45e-2 "str"';
  const expectedTokens = tokenize(input);
  
  const tokenizer = new StreamingTokenizer();
  for (const char of input) {
    tokenizer.appendChunk(char);
  }
  tokenizer.close();
  const actualTokens = tokenizer.getTokens();
  
  assertTokensEqual(actualTokens, expectedTokens);
});

// SW-REQ-260821-QV2H:nominal:nominal
test('streaming: incomplete chunk getTokens yields no tokens (NeedMoreData, not EOF)', () => {
  // css-syntax-3 § 4.3.6 #consume-url-token / § 4.3.5 #consume-a-string-token:
  // an unclosed url( or "string is not a completed token until ) / closing quote or true EOF.
  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk('url(foo');
  const tokens = tokenizer.getTokens();
  assert.equal(tokens.length, 0);
  assert.equal(tokens.some((t) => t.type === 'EOF'), false);
});

// SW-REQ-260821-QV2H:nominal:nominal
test('streaming: peek on incomplete chunk is NeedMoreData, not a fabricated EOF', () => {
  const tokenizer = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tokenizer);
  tokenizer.appendChunk('"hello');
  assert.throws(
    () => {
      stream.peek();
    },
    (err: unknown) => err instanceof NeedMoreDataError,
    'peek must not invent EOF while the tokenizer is still open and the token is incomplete',
  );

  tokenizer.appendChunk(' world"');
  const token = stream.peek();
  assert.notEqual(token.type, 'EOF');
  assert.equal(token.type, 'string');
  if (token.type === 'string') {
    assert.equal(token.value, 'hello world');
  }

  tokenizer.close();
  stream.next();
  const eof = stream.peek();
  assert.equal(eof.type, 'EOF');
});

// SW-REQ-260821-QV2H:nominal:nominal
// SYS-REQ-260821-SBJ7:nominal:nominal
test('streaming: remnant high-surrogate then CR keeps source order (not CR then high)', () => {
  // css-syntax-3 § 3.3 #input-preprocessing: CR/FF → LF, then surrogate code
  // points → U+FFFD. A trailing CR must be buffered before a trailing high
  // surrogate is buffered, but remnant concat must keep source order
  // (high then CR). Reversing that pairs a following low surrogate into a
  // scalar instead of two U+FFFD around a newline.
  const high = '\uD800';
  const low = '\uDC00';
  const full = `x${high}\r${low}y`;
  const expected = tokenize(full);
  assert.ok(
    expected.some((t) => typeof t.value === 'string' && t.value.includes('\uFFFD')),
    'one-shot preprocess must replace the split surrogates with U+FFFD',
  );

  const tokenizer = new StreamingTokenizer();
  tokenizer.appendChunk(`x${high}\r`);
  tokenizer.appendChunk(`${low}y`);
  tokenizer.close();
  assertTokensEqual(tokenizer.getTokens(), expected);
});

test('streaming: parser integration', () => {
  const input = 'div { color: red; } @media (min-width: 600px) { .bar { color: green; } }';
  
  // Non-streaming baseline
  const normalTokens = tokenize(input);
  const normalParser = new Parser(normalTokens);
  const normalSheet = normalParser.parseStyleSheet();
  
  // Streaming
  const tokenizer = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tokenizer);
  const streamingParser = new Parser(stream);
  
  tokenizer.appendChunk('div { color: red; } ');
  tokenizer.appendChunk('@media (min-width: 600px) { .bar { color: green; } }');
  tokenizer.close();
  
  const streamingSheet = streamingParser.parseStyleSheet();
  
  const getRulesText = (sheet: { cssRules: ArrayLike<{ cssText: string }> }) => Array.from(sheet.cssRules).map(r => r.cssText);
  assert.deepStrictEqual(getRulesText(streamingSheet), getRulesText(normalSheet));
});
