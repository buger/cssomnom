/**
 * Reproducer for CRS-0068/C07 (src/parser-api.ts toParserRule declaration arm).
 * The Parser stores !important in Declaration.important and splices the
 * `! important` tokens out of the value. toParserRule maps only decl.value,
 * so the flag never reaches CSSParserDeclaration and
 * parseDeclarationListSync('color: red !important') serializes as
 * 'color: red;'. The WICG CSSParserDeclaration carries name+body only, so
 * the lossless mapping puts the !important tokens back into the body; the
 * internal serializer already emits ` !important` from the same flag.
 * css-syntax-3 #serialization round-trip requirement (~3706-3713): a
 * declaration's importance is part of the data that must survive
 * serialize/re-parse.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDeclarationListSync, parseDeclarationSync } from '../../src/parser-api.ts';

test('CRS-0068/C07: parseDeclarationListSync keeps !important', () => {
  const decls = parseDeclarationListSync('color: red !important');
  assert.equal(decls.length, 1, 'the declaration must parse');
  assert.match(String(decls[0]), /!\s*important/, 'serialization must keep !important');
});

test('CRS-0068/C07: parseDeclarationSync keeps !important', () => {
  const decl = parseDeclarationSync('color: red !important');
  assert.ok(decl, 'the declaration must parse');
  assert.match(String(decl), /!\s*important/);
});

test('control: the unimportant declaration still serializes exactly', () => {
  const decls = parseDeclarationListSync('color: red');
  assert.equal(String(decls[0]), 'color: red;');
});
