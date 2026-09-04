/**
 * Reproducer for CRS-0064/C15 (src/parser-api.ts evalSupportsInParens
 * declaration arm). The declaration arm slices the value tokens after the colon
 * and hands them to evaluateSupportsDeclaration verbatim, so the "! important"
 * delims reach matchesSyntax and the declaration reports unsupported.
 * css-conditional-3 #supports-decl defines <supports-decl> = "( <declaration> )",
 * and a css-syntax-3 declaration carries an optional !important flag. WPT
 * css-conditional/css-supports-004.xht asserts that
 * "@supports (color: green !important)" applies its block, so the condition form
 * must return true while the two-argument form stays false.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports } from '../../src/parser-api.ts';

test('CRS-0064/C15: supports("(color: red !important)") accepts the declaration', () => {
  assert.equal(supports('(color: red !important)'), true);
});

test('CRS-0064/C15: supports("(width: 10px !IMPORTANT)") accepts the declaration', () => {
  assert.equal(supports('(width: 10px !IMPORTANT)'), true);
});

test('control: the two-argument form still rejects !important in the value', () => {
  assert.equal(supports('color', 'red !important'), false);
});

test('control: plain parenthesized declarations keep evaluating', () => {
  assert.equal(supports('(color: red)'), true);
  assert.equal(supports('(color: not-a-color)'), false);
});
