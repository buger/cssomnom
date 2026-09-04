/**
 * Reproducer for CRS-0002/C14 and CRS-0003/C15 (src/parser.ts
 * assembleUnicodeRanges). When the U+ prefix reaches the assembler as
 * ident/delim/number component values (non-urange tokenization), the hex
 * segment is rebuilt from the number token's numeric value with
 * toString(16), so the decimal digits are re-encoded as if they were hex.
 * css-syntax-3 #consume-unicode-range-token consumes the hex digits as
 * source code points; 'U+26' is code point 0x26, never 0x1A. U+1A is the
 * re-encoding of decimal 26. Live parser paths re-tokenize in urange mode,
 * so the wrong leg only fires for direct/hook callers, and it corrupts any
 * value whose hex digits read as a different decimal number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser, assembleUnicodeRanges } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

function assembleAsNonUrangeTokenization(text: string): string | null {
  const componentValues = new Parser(tokenize(text)).parseComponentValues();
  const assembled = assembleUnicodeRanges(componentValues);
  if (!assembled) return null;
  return (assembled[0] as { value: string }).value;
}

test('CRS-0002/C14: U+26 stays U+26 when tokens arrive split', () => {
  assert.equal(assembleAsNonUrangeTokenization('U+26'), 'U+26');
});

test('CRS-0003/C15: U+10 stays U+10 when tokens arrive split', () => {
  assert.equal(assembleAsNonUrangeTokenization('U+10'), 'U+10');
});

test('control: single unicode-range tokens round-trip', () => {
  assert.equal(assembleAsNonUrangeTokenization('U+2B'), 'U+2B');
});

test('control: the urange-mode path already produces unicode-range tokens', () => {
  const urangeTokens = tokenize('U+26', true);
  assert.equal(urangeTokens[0].type, 'unicode-range');
  assert.equal((urangeTokens[0] as { value: string }).value, 'U+26');
});
