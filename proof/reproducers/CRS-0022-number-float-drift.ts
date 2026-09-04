/**
 * Reproducer for CRS-0022/C05 (requirement SW-REQ-260821-7M07,
 * src/AbstractTokenizer.ts consumeNumber). css-syntax-3 #consume-a-number
 * step 5 sets value by "interpreting |number part| as a base-10 number", which
 * for 0.3 is the double closest to the decimal literal (Number('0.3') === 0.3).
 * The implementation instead accumulates the significand as an integer and
 * multiplies by Math.pow(10, power), so fractional inputs can drift:
 * 3 * 10^-1 evaluates to 0.30000000000000004. Downstream numeric values then
 * disagree with the literal the author wrote.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0022/C05: 0.3 tokenizes to the decimal literal 0.3', () => {
  const value = (tokenize('0.3')[0] as { value: number }).value;
  assert.ok(value === 0.3, `expected 0.3, got ${value} (Number('0.3') is 0.3)`);
});

test('CRS-0022/C05: 0.6 tokenizes to the decimal literal 0.6', () => {
  const value = (tokenize('0.6')[0] as { value: number }).value;
  assert.ok(value === 0.6, `expected 0.6, got ${value}`);
});

test('CRS-0022/C05: 1.1e-1 tokenizes to the decimal literal 0.11', () => {
  const value = (tokenize('1.1e-1')[0] as { value: number }).value;
  assert.ok(value === 0.11, `expected 0.11, got ${value}`);
});

test('control: exactly representable literals keep their value', () => {
  assert.equal((tokenize('1.5')[0] as { value: number }).value, 1.5);
  assert.equal((tokenize('10')[0] as { value: number }).value, 10);
});
