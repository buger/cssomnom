/**
 * Reproducer for CRS-0022/C01 (requirement SW-REQ-260821-7M07,
 * src/AbstractTokenizer.ts parseError). The tokenizer obligation list includes
 * denial_of_service_resistant, so error recording must stay in memory. parseError
 * calls console.warn on every parse error, so a hostile stylesheet with N bad
 * strings performs N synchronous host writes during tokenize(): stdout volume
 * grows with input size with no cap. Recording N errors in the errors[] array
 * is the spec-conformant behavior; host I/O is not.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';

function countWarnCalls(input: string): { warns: number; tokens: number } {
  const original = console.warn;
  let warns = 0;
  console.warn = () => { warns++; };
  try {
    const tokens = tokenize(input);
    return { warns, tokens: tokens.length };
  } finally {
    console.warn = original;
  }
}

test('CRS-0022/C01: tokenize records parse errors without host I/O', () => {
  const { warns } = countWarnCalls('"\n'.repeat(200));
  assert.equal(warns, 0, `tokenize must not console.warn per parse error, saw ${warns} writes`);
});

test('control: the bad strings are still recorded as errors and tokens', () => {
  const errors: { message: string }[] = [];
  const tokens = tokenize('"\n'.repeat(3), false, errors);
  assert.ok(tokens.some(t => t.type === 'bad-string'));
  assert.ok(errors.length > 0, 'parse errors are still collected in the errors array');
});
