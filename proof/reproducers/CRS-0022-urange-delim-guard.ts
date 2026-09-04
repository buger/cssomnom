/**
 * Reproducer for CRS-0022/C07, CRS-0022/C08, and CRS-0022/C09 (requirement
 * SW-REQ-260821-7M07, src/AbstractTokenizer.ts consumeUnicodeRangeToken).
 * css-syntax-3 #consume-a-unicode-range-token steps 3, 5.3, and 6 always return
 * a <<unicode-range-token>> once the stream would start a unicode-range; the
 * algorithm never validates that start <= end <= 10FFFF (that check belongs to
 * the @font-face descriptor layer). The implementation instead returns a
 * {type:'delim', value:'U'} after the U, +, hex digits, question marks, and any
 * hyphen range were already consumed, so those code points vanish from the
 * token stream and the token list is not the css-syntax-3 token list.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0022/C07: question-mark range U+A????? stays a unicode-range token', () => {
  const toks = tokenize('U+A?????', true);
  assert.equal(toks[0].type, 'unicode-range', 'step 3.3 returns a unicode-range token');
  assert.equal((toks[0] as { unicodeRangeStart?: number }).unicodeRangeStart, 0xa00000);
  assert.equal((toks[0] as { unicodeRangeEnd?: number }).unicodeRangeEnd, 0xafffff);
});

test('CRS-0022/C08: hex start above U+10FFFF stays a unicode-range token', () => {
  const toks = tokenize('U+110000', true);
  assert.equal(toks[0].type, 'unicode-range', 'step 6 returns a unicode-range token');
  assert.equal((toks[0] as { unicodeRangeStart?: number }).unicodeRangeStart, 0x110000);
});

test('CRS-0022/C09: inverted range U+10-5 stays a unicode-range token', () => {
  const toks = tokenize('U+10-5', true);
  assert.equal(toks[0].type, 'unicode-range', 'step 5.3 returns a unicode-range token');
  assert.equal((toks[0] as { unicodeRangeStart?: number }).unicodeRangeStart, 0x10);
  assert.equal((toks[0] as { unicodeRangeEnd?: number }).unicodeRangeEnd, 0x5);
});

test('CRS-0022/C09: out-of-range end U+1-110000 stays a unicode-range token', () => {
  const toks = tokenize('U+1-110000', true);
  assert.equal(toks[0].type, 'unicode-range');
  assert.equal((toks[0] as { unicodeRangeEnd?: number }).unicodeRangeEnd, 0x110000);
});

test('controls: ordinary unicode-range tokens keep working', () => {
  const t1 = tokenize('U+26', true)[0] as { unicodeRangeStart?: number };
  assert.equal(t1.unicodeRangeStart, 0x26);
  const t2 = tokenize('U+26-2C', true)[0] as { unicodeRangeEnd?: number };
  assert.equal(t2.unicodeRangeEnd, 0x2c);
});
