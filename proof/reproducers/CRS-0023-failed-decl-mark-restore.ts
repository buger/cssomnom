/**
 * Reproducer for CRS-0023/C07 and CRS-0023/C15 (requirement
 * SW-REQ-260821-9KNX, src/parser.ts consumeBlockContents isDecl arm and
 * consumeDeclarationFromStream). css-syntax-3 #consume-block-contents
 * "anything else" arm marks the stream, tries consume-a-declaration, and on
 * nothing RESTORES the mark before reparsing the construct as a qualified rule.
 * #consume-a-declaration also consumes the remnants of a bad declaration when
 * the token after the ident is not a colon. The isDecl arm forces isDecl for
 * every '--*' ident, consumeDeclarationFromStream returns null after eating
 * only the ident (no remnants, no mark restore), so the '--foo' token is
 * swallowed and the tail re-parses as a separate nested rule instead of the
 * spec's single '--foo .child' qualified rule.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

function childSelectors(css: string): string[] {
  const sheet = parse(css);
  const parent = sheet.cssRules[0] as { cssRules: { selectorText?: string }[] };
  return Array.from(parent.cssRules, r => r.selectorText ?? '');
}

test('CRS-0023/C07: a failed --* declaration reparses with its ident intact', () => {
  const selectors = childSelectors('.parent { --foo .child { color: red } }');
  assert.equal(selectors.length, 1, `one reparsed qualified rule, got ${JSON.stringify(selectors)}`);
  assert.ok(
    selectors[0].includes('--foo'),
    `the '--foo' token must stay in the reparsed selector, got ${JSON.stringify(selectors[0])}`,
  );
});

test('CRS-0023/C15: a dashed ident without a colon does not eat the construct head', () => {
  const selectors = childSelectors('.parent { --foo bar { color: red } }');
  assert.equal(selectors.length, 1, `one reparsed qualified rule, got ${JSON.stringify(selectors)}`);
  assert.ok(
    selectors[0].includes('--foo'),
    `the '--foo' token must stay in the reparsed selector, got ${JSON.stringify(selectors[0])}`,
  );
});

test('control: a real custom property declaration still parses', () => {
  const sheet = parse('.parent { --foo: red; }');
  const parent = sheet.cssRules[0] as { style: { getPropertyValue(k: string): string } };
  assert.equal(parent.style.getPropertyValue('--foo').trim(), 'red');
});
