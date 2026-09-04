/**
 * Reproducer for CRS-0029/C15, CRS-0029/C17 and CRS-0029/C30
 * (src/parser-api.ts supports / evaluateSupportsDeclaration).
 * The IDL types both supports() arguments as CSSOMString, so WebIDL
 * conversion runs before the algorithm: null and undefined become "null" /
 * "undefined" and a number 0.5 becomes "0.5", which then reaches the
 * declaration overload. supports() dispatches on typeof value === 'string'
 * and trims propertyOrCondition raw, so CSS.supports(null),
 * CSS.supports(undefined, 'red') and CSS.supports('opacity', 0.5) throw
 * TypeErrors or return the one-arg result instead of a boolean.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports } from '../../src/parser-api.ts';

test('control: string arguments return booleans', () => {
  assert.equal(supports('opacity', '0.5'), true);
  assert.equal(supports('color', '0.5'), false);
});

test('CRS-0029/C15: CSS.supports(null) converts instead of throwing', () => {
  let err: unknown;
  let out: unknown = 'unset';
  try {
    out = (supports as unknown as (c: unknown) => boolean)(null);
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `supports(null) threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
  assert.equal(typeof out, 'boolean');
  assert.equal(out, false, 'the condition "null" does not parse as a supports condition');
});

test('CRS-0029/C30: CSS.supports(undefined, "red") converts instead of throwing', () => {
  let err: unknown;
  let out: unknown = 'unset';
  try {
    out = (supports as unknown as (p: unknown, v: string) => boolean)(undefined, 'red');
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `supports(undefined, 'red') threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
  assert.equal(out, false);
});

test('CRS-0029/C17: CSS.supports("opacity", 0.5) reaches the declaration overload', () => {
  const out = (supports as unknown as (p: string, v: unknown) => boolean)('opacity', 0.5);
  assert.equal(out, true, 'WebIDL CSSOMString converts 0.5 to "0.5", which opacity accepts');
});
