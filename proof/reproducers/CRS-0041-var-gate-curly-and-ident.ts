/**
 * Reproducer for CRS-0041/C10+C30 (src/parser.ts validateVarFunction, the
 * same gate as KI-182). css-variables-1 #using-variables types
 * var( <custom-property-name> , <declaration-value>? ); the first argument
 * must be a <dashed-ident>. validateVarFunction returns true for any
 * non-whitespace argument after the empty-name and curly-mix checks: a bare
 * non-dashed ident (var(foo)) and a lone `{}` simple-block (var({ --y }))
 * both pass, so declarations carrying them are retained instead of ignored.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0041/C10: var() with a non-dashed ident argument is ignored at parse time', () => {
  const sheet = parse('.x { color: var(foo); }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('color'), '',
    'css-variables-1: var(<custom-property-name>,...) requires a dashed ident');
});

test('CRS-0041/C10: var() with a numeric argument is ignored at parse time', () => {
  const sheet = parse('.x { color: var(123); }');
  assert.equal(sheet.cssRules[0].style.getPropertyValue('color'), '');
});

test('CRS-0041/C30: var() whose argument is a {} simple-block is ignored', () => {
  const sheet = parse('.x { color: var({ --y }); }');
  assert.equal(sheet.cssRules[0].style.getPropertyValue('color'), '',
    'a {} block is not a <custom-property-name>');
});

test('control: well-formed var() declarations are kept', () => {
  const sheet = parse('.x { color: var(--y, red); }');
  assert.equal(sheet.cssRules[0].style.getPropertyValue('color').trim(), 'var(--y, red)');
});
