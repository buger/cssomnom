/**
 * Overlay reproducer for KI-9. Not a product-suite test.
 * css-syntax-3 § 4.3.1 #consume-token emits EOF only at true end of input.
 * css-syntax-3 § 3.3 #input-preprocessing: remnant high-surrogate then CR
 * must keep source order (high then CR), not CR then high.
 * Asserts both contracts so this command FAILS while either hole is present.
 *
 * Reproduces: KI-9
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NeedMoreDataError, StreamingTokenizer } from '../../src/streaming-tokenizer.ts';
import { StreamingTokenizerStream } from '../../src/TokenStream.ts';
import { tokenize } from '../../src/tokenizer.ts';

function formatTokens(tokens: { type: string; value?: string }[]): string {
  return tokens.map((t) => `${t.type}:${JSON.stringify(t.value ?? '')}`).join('|');
}

function ki9Contract(): { setupOk: boolean; holds: boolean; message: string } {
  const tok = new StreamingTokenizer();
  const stream = new StreamingTokenizerStream(tok);
  tok.appendChunk('"hello');
  let peeked: unknown;
  let threwNeedMore = false;
  try {
    peeked = stream.peek();
  } catch (err) {
    threwNeedMore = err instanceof NeedMoreDataError;
    peeked = err instanceof Error ? err.name : err;
  }
  if (!threwNeedMore) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-9: peek() on incomplete string fabricated ${JSON.stringify(peeked)}; intended NeedMoreDataError`,
    };
  }

  const high = '\uD800';
  const low = '\uDC00';
  const full = `x${high}\r${low}y`;
  const oneShot = formatTokens(tokenize(full));
  const st = new StreamingTokenizer();
  st.appendChunk(`x${high}\r`);
  st.appendChunk(`${low}y`);
  st.close();
  const streamed = formatTokens(st.getTokens());
  if (oneShot !== streamed) {
    return {
      setupOk: true,
      holds: false,
      message: `KI-9: remnant high-surrogate+CR order diverged (oneShot=${oneShot} streamed=${streamed})`,
    };
  }
  return { setupOk: true, holds: true, message: 'KI-9 contract holds: peek NeedMoreData; remnant order matches one-shot' };
}

// Reproduces: KI-9
// Verifies: SW-REQ-260821-QV2H
// Verifies: SYS-REQ-260821-SBJ7
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('streaming peek does not fabricate EOF; remnant keeps high-surrogate then CR', () => {
  const outcome = ki9Contract();
  assert.equal(outcome.setupOk, true, outcome.message);
  assert.equal(outcome.holds, true, outcome.message);
});
