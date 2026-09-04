/**
 * Reproducer for CRS-0014/C11 (requirement SW-REQ-260821-2Z0N session packet
 * src/parser-api.ts parseComponentValueSync).
 *
 * css-syntax-3 5.4.8 #parse-a-component-value step 3: "If input is empty
 * [after discarding whitespace], return a syntax error." The same function
 * already implements step 6 (leftover tokens throw), so the empty arm is an
 * internal inconsistency as well. It returns null today.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComponentValueSync } from '../../src/parser-api.ts';

function assertSyntaxError(css: string): void {
  let returned: unknown = 'no-throw';
  try {
    returned = parseComponentValueSync(css);
  } catch (e) {
    assert.ok(e instanceof DOMException, `${JSON.stringify(css)} must raise a DOMException`);
    assert.equal((e as DOMException).name, 'SyntaxError');
    return;
  }
  assert.fail(`parseComponentValueSync(${JSON.stringify(css)}) returned ${JSON.stringify(String(returned))} instead of a syntax error`);
}

test('CRS-0014/C11: empty and whitespace-only input is a syntax error', () => {
  assertSyntaxError('');
  assertSyntaxError('   ');
  assertSyntaxError('/*c*/');
});

// control: a lone value parses and trailing garbage already throws.
test('control: one component value parses, leftover tokens throw', () => {
  assert.equal(String(parseComponentValueSync('1px')), '1px');
  assert.throws(() => parseComponentValueSync('1px 2px'), DOMException);
});
