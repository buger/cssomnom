/**
 * Reproducer for CRS-0017/C04 + CRS-0017/C05 (requirement SW-REQ-260821-39E0,
 * src/parser.ts consumeBlockContents). Two arms skip the declaration-run flush
 * that css-syntax-3 § 5.5 #consume-block-contents mandates:
 *
 * 1. C04: the nested isDecl arm calls consumeDeclarationFromStream and, when it
 *    returns null, neither restores the mark nor reparses as a qualified rule.
 *    For 'margin: 1px; color: red { x: y; } padding: 2px;' the spec reparses
 *    'color: red { x: y; }' as a qualified rule, rejects its selector as an
 *    invalid rule error and flushes, splitting margin and padding into two
 *    CSSNestedDeclarations runs. The impl keeps one merged run.
 *
 * 2. C05: the at-keyword arm flushes only when the at-rule object is non-null.
 *    The spec flushes BEFORE consuming any at-rule, kept or dropped. For
 *    'color: red; @charset "x"; background: blue;' the dropped @charset must
 *    split the run; the impl merges it.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

function nestedDeclRules(css: string): { ctor: string; text: string }[] {
  const sheet = parse(css);
  const outer = sheet.cssRules[0];
  return Array.from(outer.cssRules).map(r => ({ ctor: r.constructor.name, text: r.cssText }));
}

test('CRS-0017/C04: a declaration-shaped invalid rule flushes the leftover run', () => {
  const kids = nestedDeclRules('.a { .b {} margin: 1px; color: red { x: y; } padding: 2px; }');
  const nested = kids.filter(k => k.ctor === 'CSSNestedDeclarations');
  assert.equal(nested.length, 2,
    `the invalid rule error must split margin from padding, got ${nested.length}: ${JSON.stringify(nested)}`);
  assert.equal(nested[0].text, 'margin: 1px;');
  assert.equal(nested[1].text, 'padding: 2px;');
});

test('CRS-0017/C05: a dropped at-rule still flushes the declaration run', () => {
  const kids = nestedDeclRules('.a { .b {} color: red; @charset "x"; background: blue; }');
  const nested = kids.filter(k => k.ctor === 'CSSNestedDeclarations');
  assert.equal(nested.length, 2,
    `the at-keyword arm flushes before consuming the at-rule, kept or dropped; got ${nested.length}: ${JSON.stringify(nested)}`);
  assert.equal(nested[0].text, 'color: red;');
  assert.equal(nested[1].text, 'background: blue;');
});

test('control: a KEPT at-rule between declarations already splits', () => {
  const kids = nestedDeclRules('.a { .b {} color: red; @media screen {} background: blue; }');
  const nested = kids.filter(k => k.ctor === 'CSSNestedDeclarations');
  assert.equal(nested.length, 2);
});

test('control: a valid selector rule between declarations splits (WPT ident case)', () => {
  const kids = nestedDeclRules('a { & { --x:1; } width: 100px; color:hover {} --y: 2; }');
  assert.deepEqual(kids.map(k => k.ctor), ['CSSStyleRule', 'CSSNestedDeclarations', 'CSSStyleRule', 'CSSNestedDeclarations']);
});
