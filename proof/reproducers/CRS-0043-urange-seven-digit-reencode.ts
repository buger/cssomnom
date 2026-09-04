/**
 * Reproducer for CRS-0043/C25 (requirement SW-REQ-260822-MN8Z,
 * src/parser.ts assembleUnicodeRanges).
 *
 * The ident-u branch rebuilds the hex segment from the numeric token value
 * with Math.abs(value).toString(16) and caps nothing on the source digit
 * count; only the rebuilt text is checked against /^u\+([0-9a-f]{1,6})$/i.
 * Seven source decimal digits in [1048576, 1114111] re-encode to six hex
 * chars within U+10FFFF, so 'u+1048576' assembles as U+100000 instead of
 * failing. css-fonts-4 #unicode-range defines <urange> as at most six hex
 * digits taken from the source text. KI-164 pins the sibling symptom
 * (six-digit U+26 rewritten to U+1A); this pins the digit-count bypass.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser, assembleUnicodeRanges } from '../../src/parser.ts';
import type { ComponentValue } from '../../src/types.ts';

function assembleFromNonUrangeTokens(text: string): ReturnType<typeof assembleUnicodeRanges> {
  const componentValues: ComponentValue[] = new Parser(tokenize(text)).parseComponentValues();
  return assembleUnicodeRanges(componentValues);
}

test('CRS-0043/C25: seven source digits (u+1048576) do not assemble into a urange', () => {
  assert.equal(assembleFromNonUrangeTokens('u+1048576'), null, 'urange allows at most 6 source hex digits');
});

test('CRS-0043/C25: seven source digits at the cap (u+1100000) also fail', () => {
  // 1100000 re-encodes to 0x10C8E0, inside U+10FFFF, so nothing else stops it.
  assert.equal(assembleFromNonUrangeTokens('u+1100000'), null);
});

test('CRS-0043/C25: an eight-digit source run fails', () => {
  // 11141120 re-encodes to 0xAA0000 (7 hex chars); the {1,6} regex stops it,
  // pinning that only the 7-digit decimal window is laundered.
  assert.equal(assembleFromNonUrangeTokens('u+11141120'), null);
});

test('control: six source hex letters assemble unchanged', () => {
  const result = assembleFromNonUrangeTokens('u+ab123');
  assert.ok(result);
  assert.equal((result[0] as { value: string }).value, 'U+AB123');
});
