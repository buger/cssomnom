/**
 * Reproducer for CRS-0007/C07 (requirement INT-REQ-260821-N2VE, src/parser.ts
 * Parser.consumeBlockContents). css-syntax-3 #consume-block-contents routes
 * a declaration-looking prelude to consume-a-declaration, which on failure
 * (a dashed ident not followed by <colon-token> is a parse error) consumes
 * the remnants of a bad declaration up to the next ';'. The nested isDecl
 * arm in consumeBlockContents treats a leading '--*' ident as a declaration
 * without the colon lookahead, so consumeDeclarationFromStream returns null
 * after eating only the ident, and the leftover 'bar: red;' is re-parsed as
 * a brand-new declaration.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0007/C07: remnants of a bad custom-property declaration are not reparsed', () => {
  const sheet = parse('a { --foo bar: red; color: green; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('bar'), '', 'the bad-declaration remnants must be skipped to the semicolon');
  assert.equal(style.length, 1, 'only color survives');
  assert.equal(style.getPropertyValue('color').trim(), 'green');
});

test('CRS-0007/C07: the same leak at the end of a nested block', () => {
  const sheet = parse('a { --foo bar: red; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.length, 0, 'no phantom declaration may materialize from the remnants');
  assert.equal(style.cssText.trim(), '');
});

test('control: a valid custom property declaration still parses', () => {
  const sheet = parse('a { --foo: red; color: green; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.length, 2);
  assert.equal(style.getPropertyValue('--foo').trim(), 'red');
});
