/**
 * Reproducer for CRS-0015/C10 (requirement SW-REQ-260821-3553, src/parser-api.ts
 * parseDeclarationSync). css-syntax-3 § 5.4.7 #parse-a-declaration normalizes,
 * discards whitespace, then consumes ONE declaration; when consume-a-declaration
 * returns nothing the entry point returns a syntax error. A leading at-keyword is
 * not an ident, so consume-a-declaration consumes the remnants of a bad
 * declaration and returns nothing: '@media all { } color: red' is a syntax error.
 * parseDeclarationSync reuses the declaration-LIST parser and returns list[0],
 * so the at-rule prefix is skipped and 'color: red' comes back instead of an
 * error; unparseable input comes back as null rather than an error.
 * Note: returning the FIRST declaration of a multi-declaration string is
 * conformant (§ 5.4.7 has no EOF check); this reproducer pins only the
 * at-rule-prefix and null-signaling legs.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeclarationSync } from '../../src/parser-api.ts';

test('CRS-0015/C10: an at-rule prefix is not a declaration', () => {
  assert.throws(() => parseDeclarationSync('@media all { } color: red'),
    (e: unknown) => (e as { name?: string }).name === 'SyntaxError',
    'css-syntax-3 5.4.7 returns a syntax error when consume-a-declaration returns nothing');
});

test('CRS-0015/C10: unparseable input signals an error instead of null', () => {
  assert.throws(() => parseDeclarationSync('div'),
    (e: unknown) => (e as { name?: string }).name === 'SyntaxError',
    'an ident without a colon is a bad declaration, so parse-a-declaration fails');
});

test('control: the first declaration of a multi-declaration string still wins', () => {
  assert.equal(String(parseDeclarationSync('color: red; background: blue')), 'color: red;',
    '5.4.7 returns the first consumed declaration without an EOF check');
});

test('control: a clean declaration parses', () => {
  assert.equal(String(parseDeclarationSync('color: red')), 'color: red;');
});
