/**
 * Reproducer for CRS-0033/C01-C11, C13, C31 (SW-REQ-260821-QV2H).
 *
 * AbstractTokenizer evaluates this.cp / peek(1) / peek(2) eagerly as call
 * arguments (isValidEscape, wouldStartNumber, wouldStartIdentSequence,
 * wouldStartUnicodeRange) before the in-buffer terminator can decide the
 * branch. StreamingTokenizer.cp/peek throw NeedMoreDataError at the end of
 * the available buffer, so a look-ahead past a token TERMINATOR inside the
 * chunk aborts consumeToken. tokenizeLoop then treats every
 * NeedMoreDataError as an incomplete token: it rolls pos back to startPos
 * and breaks without pushing, so a complete token present in the chunk is
 * withheld from getTokens() until close().
 *
 * css-syntax-3 4.3.1 #consume-token terminates an ident-like token as soon
 * as a non-ident code point (for example ';' or '(') is seen; SW-REQ
 * 260821-QV2H requires tokens_available_after_get_tokens whenever
 * complete_token_in_chunk. Each fixture below is decided entirely by code
 * points already inside the chunk. The close() control proves the same
 * bytes emit the expected tokens once EOF is allowed, so the withholding,
 * not the token, is the defect.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StreamingTokenizer } from '../../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream } from '../../src/TokenStream.ts';

function drainAfterChunk(chunk: string, unicodeRangesAllowed = false): string[] {
  const t = new StreamingTokenizer();
  if (unicodeRangesAllowed) {
    (t as unknown as { unicodeRangesAllowed: boolean }).unicodeRangesAllowed = true;
  }
  t.appendChunk(chunk);
  return t.getTokens().map((tok) => `${tok.type}:${tok.value ?? ''}`);
}

function typesAfterChunk(chunk: string): string[] {
  return drainAfterChunk(chunk).map((s) => s.split(':')[0]);
}

test('CRS-0033/C01: ident terminated by semicolon is available before close()', () => {
  assert.deepEqual(typesAfterChunk('foo;'), ['ident', 'semicolon']);
});

test('CRS-0033/C01: function token "foo(" is complete at the open paren', () => {
  assert.deepEqual(typesAfterChunk('foo('), ['function']);
});

test('CRS-0033/C01: dimension terminated by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('10px;'), ['dimension:10', 'semicolon:;']);
});

test('CRS-0033/C01: id hash terminated by semicolon is available', () => {
  assert.deepEqual(typesAfterChunk('#abc;'), ['hash:abc', 'semicolon:;']);
});

test('CRS-0033/C02: number terminated by semicolon is available', () => {
  assert.deepEqual(typesAfterChunk('10;'), ['number:10', 'semicolon:;']);
});

test('CRS-0033/C02+C10: percentage is a finished token at chunk end', () => {
  assert.deepEqual(drainAfterChunk('10%'), ['percentage:10']);
});

test('CRS-0033/C03: plus delim followed by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('+;'), ['delim:+', 'semicolon:;']);
});

test('CRS-0033/C04: hyphen delim followed by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('-;'), ['delim:-', 'semicolon:;']);
});

test('CRS-0033/C05: dot delim followed by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('.;'), ['delim:.', 'semicolon:;']);
});

test('CRS-0033/C06: hash delim followed by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('#;'), ['delim:#', 'semicolon:;']);
});

test('CRS-0033/C06: id hash "a" with terminator is available', () => {
  assert.deepEqual(drainAfterChunk('#a;'), ['hash:a', 'semicolon:;']);
});

test('CRS-0033/C07: at delim followed by semicolon is available', () => {
  assert.deepEqual(drainAfterChunk('@;'), ['delim:@', 'semicolon:;']);
});

test('CRS-0033/C08: ident U terminated by semicolon with unicodeRangesAllowed', () => {
  assert.deepEqual(drainAfterChunk('U;', true), ['ident:U', 'semicolon:;']);
});

test('CRS-0033/C09+C11: leftover complete tokens survive into getTokens', () => {
  // Two complete tokens: the first must not be discarded when the loop stops.
  assert.deepEqual(typesAfterChunk('foo;bar;'), ['ident', 'semicolon', 'ident', 'semicolon']);
});

test('CRS-0033/C13: stream peek surfaces the complete token after appendChunk', () => {
  const t = new StreamingTokenizer();
  t.appendChunk('foo;');
  const stream = new StreamingTokenizerStream(t as unknown as Parameters<typeof StreamingTokenizerStream>[0]);
  const tok = stream.peek();
  assert.equal(`${tok.type}:${tok.value ?? ''}`, 'ident:foo');
});

test('control: the same chunks emit the expected tokens after close()', () => {
  for (const [chunk, expected] of [
    ['foo;', 'ident:foo|semicolon:;'],
    ['10%', 'percentage:10'],
    ['foo(', 'function:foo'],
  ] as const) {
    const t = new StreamingTokenizer();
    t.appendChunk(chunk);
    t.close();
    const joined = t.getTokens().filter((tok) => tok.type !== 'EOF').map((tok) => `${tok.type}:${tok.value ?? ''}`).join('|');
    assert.equal(joined, expected, `close() flush for ${chunk}`);
  }
});
