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
// Leftover unique-cause for src/streaming-tokenizer.ts not already in
// tests/streaming.test.ts, tests/syntax-conformance-phase89.test.ts, or
// tests/mcdc-branch-tokenstream-leftover.test.ts.
// Drive StreamingTokenizer.appendChunk / close / getTokens / closed and
// StreamingTokenizerStream.peek. css-syntax-3 § 3.3 #input-preprocessing,
// § 4.3.1 #consume-token. No //mcdc:ignore.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../src/tokenizer.ts';
import { StreamingTokenizer, NeedMoreDataError } from '../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream } from '../src/TokenStream.ts';
import type { Token } from '../src/types.ts';

/** Matches src/streaming-tokenizer.ts safeFromCodePoints / pushCodePoints. */
const CHUNK_SIZE = 4096;

function closedTokens(chunks: string[]): Token[] {
  const tokenizer = new StreamingTokenizer();
  for (const chunk of chunks) tokenizer.appendChunk(chunk);
  tokenizer.close();
  return tokenizer.getTokens();
}

function drain(chunks: string[], close = true): Token[] {
  const tokenizer = new StreamingTokenizer();
  const out: Token[] = [];
  for (const chunk of chunks) {
    tokenizer.appendChunk(chunk);
    out.push(...tokenizer.getTokens());
  }
  if (close) {
    tokenizer.close();
    out.push(...tokenizer.getTokens());
  }
  return out;
}

function assertTokensEq(actual: Token[], expected: Token[], label: string): void {
  assert.equal(actual.length, expected.length, `${label} length`);
  for (let i = 0; i < expected.length; i++) {
    assert.equal(actual[i].type, expected[i].type, `${label} type[${i}]`);
    assert.deepEqual(actual[i].value, expected[i].value, `${label} value[${i}]`);
    assert.equal(actual[i].originalText, expected[i].originalText, `${label} originalText[${i}]`);
  }
}

function assertSameAsTokenize(chunks: string[]): Token[] {
  const streamed = closedTokens(chunks);
  const batched = tokenize(chunks.join(''));
  assertTokensEq(streamed, batched, JSON.stringify(chunks));
  return streamed;
}

function identValue(tokens: Token[]): string {
  const ident = tokens.find((t) => t.type === 'ident');
  assert.ok(ident && ident.type === 'ident', `expected ident in ${tokens.map((t) => t.type).join(',')}`);
  return ident.value;
}

function assertNeedMoreData(fn: () => unknown): void {
  assert.throws(fn, (err: unknown) => err instanceof NeedMoreDataError && err.name === 'NeedMoreDataError');
}

function silentWarn<T>(fn: () => T): T {
  const warn = console.warn;
  console.warn = () => {};
  try {
    return fn();
  } finally {
    console.warn = warn;
  }
}

describe('MC/DC leftover unique-cause: preprocess CR remnant (css-syntax-3 § 3.3 #input-preprocessing)', () => {
  test('!isLast && endsWith CR unique-cause of remnant vs flush vs neither', () => {
    // TT: appendChunk ending in CR buffers the CR (not last).
    // FT: close() flushes that remnant with isLast T so CR is not re-buffered.
    assertSameAsTokenize(['a\r', 'b']);
    assertSameAsTokenize(['a\r']);

    // TF: appendChunk not ending in CR (!isLast T, endsWith CR F).
    assertSameAsTokenize(['ab']);
    assertSameAsTokenize(['a\nb']);

    // FF: close() with no remnant.
    assertSameAsTokenize(['']);
    assertSameAsTokenize([]);

    // CRLF split across chunks vs same-chunk pair vs CR then non-LF.
    assertSameAsTokenize(['a\r', '\nb']);
    assertSameAsTokenize(['a\r\nb']);
    assertSameAsTokenize(['a\r', 'xb']);
    assertSameAsTokenize(['\r']);
    assertSameAsTokenize(['\r\n']);
    assertSameAsTokenize(['\r', '\n']);
  });

  test('CRLF pair vs leftover CR vs FF vs NUL unique-cause', () => {
    // \r\n consumed as one newline (first replace); leftover \r uses the
    // second replace; \f is the third; \0 is U+FFFD.
    assertSameAsTokenize(['a\r\nb']);
    assertSameAsTokenize(['a\rb']);
    assertSameAsTokenize(['a\r\r\nb']);
    assertSameAsTokenize(['a\n\rb']);
    assertSameAsTokenize(['a\fb']);
    assertSameAsTokenize(['a\0b']);
    assertSameAsTokenize(['a\r\n\fb']);
    assertSameAsTokenize(['\f']);
    assertSameAsTokenize(['\0']);
    assertSameAsTokenize(['a\r', '\n', 'b']);
    assertSameAsTokenize(['a\f', 'b']);
    assertSameAsTokenize(['a\0', 'b']);
  });
});

describe('MC/DC leftover unique-cause: preprocess surrogate remnant (css-syntax-3 § 3.3 #input-preprocessing)', () => {
  test('!isLast && trailing high-surrogate unique-cause of remnant vs flush vs neither', () => {
    // TT: high at end of a non-last chunk is buffered.
    // FT: close() flushes the remnant high as a lone surrogate → U+FFFD.
    assertSameAsTokenize(['a\uD83D', '\uDE00b']);
    assertSameAsTokenize(['a\uD800']);
    assertSameAsTokenize(['\uD83D']);

    // TF: non-last chunk that does not end in a high surrogate.
    assertSameAsTokenize(['ab']);
    assertSameAsTokenize(['a😀b']);
    assertSameAsTokenize(['a\uDC00b']);

    // High remnant then a non-low continuation (lone high → U+FFFD).
    assertSameAsTokenize(['a\uD83D', 'xb']);
    assertSameAsTokenize(['\uD800', '\uD800']);
  });

  test('high-then-CR remnant unique-cause of non-empty remnant before the high buffer', () => {
    // Same-chunk high+CR: CR branch fills remnant, then the high branch
    // prepends so order stays high-then-CR (not CR-then-high).
    assertSameAsTokenize(['\uD83D\r']);
    assertSameAsTokenize(['\uD83D\r', '\uDE00']);
    assertSameAsTokenize(['x\uD83D\r', 'y']);
    assertSameAsTokenize(['\uD800\r']);

    // Split high then CR: second preprocess still hits CR-then-high-buffer.
    assertSameAsTokenize(['\uD83D', '\r']);
    assertSameAsTokenize(['\uD83D', '\r\n']);
    assertSameAsTokenize(['\uD83D', '\r', '\uDE00']);

    // CR then high is the opposite order (CR remnant from the first chunk,
    // high remnant on the second) — unique-cause of remnant += with
    // remnant already reset to '' at the start of the second call.
    assertSameAsTokenize(['\r', '\uD83D']);
    assertSameAsTokenize(['\r', '\uD83D', '\uDE00']);
    assertSameAsTokenize(['a\r', '\uD83D']);
  });

  test('lone high vs lone low inclusive bounds vs valid pair', () => {
    // First alternative T (lone high): U+D800 / U+DBFF inclusive.
    assertSameAsTokenize(['a\uD800b']);
    assertSameAsTokenize(['a\uDBFFb']);
    // First alternative F just-outside: U+D7FF is an ident code point.
    assertSameAsTokenize(['a\uD7FFb']);
    // Second alternative T (lone low): U+DC00 / U+DFFF inclusive.
    assertSameAsTokenize(['a\uDC00b']);
    assertSameAsTokenize(['a\uDFFFb']);
    // Second alternative F just-outside: U+E000 is a delim.
    assertSameAsTokenize(['a\uE000b']);
    // Both alternatives F: valid pair.
    assertSameAsTokenize(['😀']);
    assertSameAsTokenize(['a😀b']);
    // Both alternatives T on adjacent lone surrogates (low then high).
    assertSameAsTokenize(['a\uDC00\uD800b']);
    assertSameAsTokenize(['\uD800\uD800']);
    assertSameAsTokenize(['\uDC00\uDC00']);
    // Split valid pair leftover vs split at a non-pair boundary.
    assertSameAsTokenize(['\uD83D', '\uDE00']);
    assertSameAsTokenize(['\uD83D\uDE00']);
    assertSameAsTokenize(['\uDE00', '\uD83D']);
  });
});

describe('MC/DC leftover unique-cause: appendChunk / close / getTokens (SW-REQ-260821-QV2H)', () => {
  test('text.length > 0 unique-cause of empty chunk, remnant-only chunk, and flush', () => {
    // F: empty chunk skips pushCodePoints (appendChunk isLast F).
    assertSameAsTokenize(['ab', '', 'c']);
    assertSameAsTokenize(['']);
    assertSameAsTokenize(['a', '', '', 'b']);

    // F via remnant-only: the whole chunk is buffered, processed text is empty.
    const crOnly = new StreamingTokenizer();
    crOnly.appendChunk('\r');
    assert.equal(crOnly.getTokens().length, 0);
    crOnly.close();
    assertSameAsTokenize(['\r']);

    const highOnly = new StreamingTokenizer();
    highOnly.appendChunk('\uD83D');
    assert.equal(highOnly.getTokens().length, 0);
    highOnly.close();
    assertSameAsTokenize(['\uD83D']);

    // T: non-empty processed text.
    assertSameAsTokenize(['x']);
    // T on close: remnant CR / high is flushed with text.length > 0.
    const flushCr = new StreamingTokenizer();
    flushCr.appendChunk('a\r');
    assert.equal(flushCr.getTokens().length, 0);
    flushCr.close();
    const flushed = flushCr.getTokens();
    assert.equal(identValue(flushed), 'a');
    assert.ok(flushed.some((t) => t.type === 'whitespace'));

    // F on close: no remnant, close() tokenizeLoop still emits EOF.
    const emptyClose = new StreamingTokenizer();
    emptyClose.close();
    const eofOnly = emptyClose.getTokens();
    assert.equal(eofOnly.length, 1);
    assert.equal(eofOnly[0].type, 'EOF');
    assert.equal(eofOnly[0].startIndex, 0);
    assert.equal(eofOnly[0].endIndex, 0);
    assert.equal(eofOnly[0].originalText, '');
  });

  test('CHUNK_SIZE unique-cause of spread vs chunked push and originalText', () => {
    // T: length <= 4096 uses spread in pushCodePoints and safeFromCodePoints.
    const eq = 'a'.repeat(CHUNK_SIZE);
    const eqTok = closedTokens([eq]);
    assert.equal(identValue(eqTok), eq);
    assert.equal(eqTok[0].originalText, eq);
    assertSameAsTokenize([eq]);
    assertSameAsTokenize(['abc']);

    // F: 4097 uses the i += CHUNK_SIZE loop once past the first slice.
    const over = 'a'.repeat(CHUNK_SIZE + 1);
    const overTok = closedTokens([over]);
    assert.equal(identValue(overTok), over);
    assert.equal(overTok[0].originalText, over);
    assertSameAsTokenize([over]);

    // Exact two chunks (8192) and three-iteration leftover (8193).
    const two = 'a'.repeat(CHUNK_SIZE * 2);
    const twoTok = closedTokens([two]);
    assert.equal(identValue(twoTok), two);
    assert.equal(twoTok[0].originalText, two);

    const three = 'a'.repeat(CHUNK_SIZE * 2 + 1);
    const threeTok = closedTokens([three]);
    assert.equal(identValue(threeTok), three);
    assert.equal(threeTok[0].originalText, three);

    // pushCodePoints onto a non-empty target with a chunked source.
    const mixed = new StreamingTokenizer();
    mixed.appendChunk('z');
    mixed.appendChunk('a'.repeat(CHUNK_SIZE + 1));
    mixed.close();
    assert.equal(identValue(mixed.getTokens()), 'z' + over);

    // Two chunked pushes.
    assertSameAsTokenize(['a'.repeat(CHUNK_SIZE + 1), 'b'.repeat(CHUNK_SIZE + 1)]);
  });

  test('getTokens pos > 0 truncation unique-cause vs already-drained pos == 0', () => {
    // T: complete tokens leave pos at the incomplete tail; getTokens slices it.
    const tokenizer = new StreamingTokenizer();
    tokenizer.appendChunk('div {');
    const first = tokenizer.getTokens();
    assert.deepEqual(first.map((t) => t.type), ['ident', 'whitespace', '{']);
    assert.equal(first[0].value, 'div');

    // F: second drain with no new input (pos already 0 after truncation).
    assert.deepEqual(tokenizer.getTokens(), []);

    tokenizer.appendChunk(' color: red; }');
    tokenizer.close();
    const rest = tokenizer.getTokens();
    assert.ok(rest.some((t) => t.type === 'ident' && t.value === 'color'));
    assert.equal(rest[rest.length - 1].type, 'EOF');

    // F leftover: never-appended getTokens (pos == 0, no tokens).
    assert.deepEqual(new StreamingTokenizer().getTokens(), []);

    // F leftover: incomplete first token rolls back to pos 0.
    const incomplete = new StreamingTokenizer();
    incomplete.appendChunk('url(foo');
    assert.deepEqual(incomplete.getTokens(), []);
    const closed = silentWarn(() => {
      incomplete.close();
      return incomplete.getTokens();
    });
    assert.equal(closed[0].type, 'url');
    assert.equal(closed[0].value, 'foo');
  });
});

describe('MC/DC leftover unique-cause: tokenizeLoop / cp / peek / consume (css-syntax-3 § 4.3.1 #consume-token)', () => {
  test('tokenizeLoop unique-cause of non-EOF continue vs EOF vs NeedMoreData vs other throw', () => {
    // token.type === 'EOF' F: complete non-EOF tokens without close.
    const open = new StreamingTokenizer();
    open.appendChunk('url(x)');
    const complete = open.getTokens();
    assert.equal(complete.length, 1);
    assert.equal(complete[0].type, 'url');
    assert.equal(complete[0].value, 'x');
    assert.equal(complete.some((t) => t.type === 'EOF'), false);

    // Loop continues across several complete tokens in one chunk.
    const multi = drain(['div { color: red; }'], false);
    assert.ok(multi.length > 1);
    assert.equal(multi.some((t) => t.type === 'EOF'), false);

    // token.type === 'EOF' T: close() emits the sentinel and breaks.
    open.close();
    const eof = open.getTokens();
    assert.equal(eof[eof.length - 1].type, 'EOF');
    assertSameAsTokenize(['']);

    // NeedMoreDataError T: incomplete token is swallowed, pos rewound.
    const need = new StreamingTokenizer();
    need.appendChunk('"hello');
    assert.deepEqual(need.getTokens(), []);
    need.appendChunk(' world"');
    const str = need.getTokens();
    assert.equal(str[0].type, 'string');
    if (str[0].type === 'string') assert.equal(str[0].value, 'hello world');

    // NeedMoreDataError F: a non-NeedMoreData throw is rethrown.
    class BoomTokenizer extends StreamingTokenizer {
      protected consumeToken(): Token {
        throw new Error('not-need-more-data');
      }
    }
    const boom = new BoomTokenizer();
    assert.throws(
      () => boom.appendChunk('a'),
      (err: unknown) => err instanceof Error && err.message === 'not-need-more-data' && !(err instanceof NeedMoreDataError),
    );
  });

  test('cp / peek isEOF T returns -1 vs F throws NeedMoreData, peek offset 1 vs 2', () => {
    // Hash lookahead: `#` at end of an open buffer peeks this.cp past the
    // buffer (isEOF F → NeedMoreData). close() makes the same peek return -1.
    const hashOpen = new StreamingTokenizer();
    const hashStream = new StreamingTokenizerStream(hashOpen);
    hashOpen.appendChunk('#');
    assertNeedMoreData(() => hashStream.peek());
    assert.equal(hashOpen.closed, false);
    hashOpen.close();
    assert.equal(hashOpen.closed, true);
    const hashTok = hashStream.peek();
    assert.equal(hashTok.type, 'delim');
    assert.equal(hashTok.value, '#');

    // Slash: consumeComments peeks +1. Open `/` is NeedMoreData; close is delim.
    const slashOpen = new StreamingTokenizer();
    const slashStream = new StreamingTokenizerStream(slashOpen);
    slashOpen.appendChunk('/');
    assertNeedMoreData(() => slashStream.peek());
    slashOpen.close();
    assert.equal(slashStream.peek().type, 'delim');
    assert.equal(slashStream.peek().value, '/');

    // CDO peek(2): `<!-` open needs the fourth code point; close is three delims.
    const cdoOpen = new StreamingTokenizer();
    const cdoStream = new StreamingTokenizerStream(cdoOpen);
    cdoOpen.appendChunk('<!-');
    assertNeedMoreData(() => cdoStream.peek());
    cdoOpen.close();
    assert.equal(cdoStream.next().type, 'delim');
    assert.equal(cdoStream.next().type, 'delim');
    assert.equal(cdoStream.next().type, 'delim');

    // peek(2) T: the fourth `-` completes CDO. peek(1) T via `<!` then `--`.
    assertSameAsTokenize(['<!-', '-']);
    assertSameAsTokenize(['<!', '--']);
    assertSameAsTokenize(['<', '!--']);
    assertSameAsTokenize(['<!--']);
    assertSameAsTokenize(['<!-']);
    assertSameAsTokenize(['<!']);
    assertSameAsTokenize(['<']);

    // `+` / `.` wouldStartNumber peek vs delim at EOF.
    assertSameAsTokenize(['+']);
    assertSameAsTokenize(['+12']);
    assertSameAsTokenize(['+', '12']);
    assertSameAsTokenize(['.']);
    assertSameAsTokenize(['.5']);
    assertSameAsTokenize(['.', '5']);
  });

  test('consume cp !== -1 F at EOF, closed unique-cause, append after close', () => {
    // consume at EOF does not increment (empty close: startIndex === endIndex).
    const empty = new StreamingTokenizer();
    assert.equal(empty.closed, false);
    empty.close();
    assert.equal(empty.closed, true);
    const eof = empty.getTokens();
    assert.equal(eof[0].type, 'EOF');
    assert.equal(eof[0].startIndex, 0);
    assert.equal(eof[0].endIndex, 0);

    // consume T then EOF: ident `a` advances pos; EOF sits at 1.
    const one = closedTokens(['a']);
    assert.equal(one[0].type, 'ident');
    assert.equal(one[0].endIndex, 1);
    assert.equal(one[1].type, 'EOF');
    assert.equal(one[1].startIndex, 1);
    assert.equal(one[1].endIndex, 1);

    // closed F after appendChunk, T after close.
    const tokenizer = new StreamingTokenizer();
    tokenizer.appendChunk('div {');
    assert.equal(tokenizer.closed, false);
    tokenizer.close();
    assert.equal(tokenizer.closed, true);

    // isEOF T with remaining data: append after close still tokenizes
    // because pos < length unique-causes the outer cp/peek guard F.
    const after = new StreamingTokenizer();
    after.appendChunk('foo');
    after.close();
    const first = after.getTokens();
    assert.equal(identValue(first), 'foo');
    after.appendChunk('bar');
    const second = after.getTokens();
    assert.equal(identValue(second), 'bar');
    assert.equal(second[second.length - 1].type, 'EOF');
    assert.equal(after.closed, true);

    // reconsume pos > 0 T: numeric reconsume after `+` (css-syntax-3 § 4.3.3).
    // pos > 0 F is unreachable through appendChunk/close (consume runs first).
    assertSameAsTokenize(['+12']);
    assertSameAsTokenize(['-3.5']);
    assertSameAsTokenize(['.25']);
  });
});

describe('MC/DC leftover unique-cause: unclosed constructs at close vs NeedMoreData (css-syntax-3 § 4.3.2 / § 4.3.5 / § 4.3.6)', () => {
  test('unclosed comment / string / url unique-cause of EOF vs NeedMoreData', () => {
    // Open buffer: NeedMoreData, no tokens. close(): EOF-in-construct parseError.
    const comment = new StreamingTokenizer();
    comment.appendChunk('/* not closed');
    assert.deepEqual(comment.getTokens(), []);
    silentWarn(() => {
      comment.close();
      const tokens = comment.getTokens();
      assert.equal(tokens[tokens.length - 1].type, 'EOF');
    });

    const str = new StreamingTokenizer();
    str.appendChunk('"hello');
    assert.deepEqual(str.getTokens(), []);
    silentWarn(() => {
      str.close();
      const tokens = str.getTokens();
      assert.equal(tokens[0].type, 'string');
      if (tokens[0].type === 'string') assert.equal(tokens[0].value, 'hello');
    });

    const url = new StreamingTokenizer();
    url.appendChunk('url(foo');
    assert.deepEqual(url.getTokens(), []);
    silentWarn(() => {
      url.close();
      const tokens = url.getTokens();
      assert.equal(tokens[0].type, 'url');
      assert.equal(tokens[0].value, 'foo');
    });

    // Closed comment/string/url unique-cause F of the unclosed arms.
    assertSameAsTokenize(['/* closed */ ident']);
    assertSameAsTokenize(['"hello"']);
    assertSameAsTokenize(["'hello'"]);
    assertSameAsTokenize(['url(foo)']);
    assertSameAsTokenize(['/* a */', '/* b */ x']);
  });
});
