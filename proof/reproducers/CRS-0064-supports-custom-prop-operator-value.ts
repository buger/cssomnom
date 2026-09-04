/**
 * Reproducer for CRS-0064/C06 (src/parser-api.ts evalSupportsInParens).
 * The hasTopLevelOp heuristic scans every ident inside the parenthesized block,
 * including the declaration value, so "(--x: not)" routes into
 * evalSupportsConditionValues instead of the supports-decl arm. css-conditional-3
 * #supports-condition grammar makes <supports-decl> = "( <declaration> )", and a
 * custom property accepts any <declaration-value>, including the bare idents
 * and/or/not. The two-argument form already accepts those values, so the
 * condition form must agree and return true.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports } from '../../src/parser-api.ts';

test('CRS-0064/C06: supports("(--x: not)") accepts the custom property declaration', () => {
  assert.equal(supports('(--x: not)'), true);
});

test('CRS-0064/C06: supports("(--x: and)") accepts the custom property declaration', () => {
  assert.equal(supports('(--x: and)'), true);
});

test('CRS-0064/C06: supports("(--foo: or)") accepts the custom property declaration', () => {
  assert.equal(supports('(--foo: or)'), true);
});

test('control: the two-argument form already accepts the same values', () => {
  assert.equal(supports('--x', 'not'), true);
  assert.equal(supports('--x', 'and'), true);
});

test('control: a standard property whose value is the ident not still fails', () => {
  assert.equal(supports('(color: not)'), false);
});
