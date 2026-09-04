/**
 * Reproducer for CRS-0003/C32 (src/parser.ts handleCustomMediaRule).
 * mediaqueries-5 #custom-mq names custom media with <dashed-ident>.
 * A bare '--' is not an <ident> per css-syntax-3 #would-start-an-
 * identifier (two hyphens must be followed by a name-start code point),
 * so '@custom-media -- true;' is invalid and must be dropped. The handler
 * only checks startsWith('--') and builds CSSCustomMediaRule('--', ...),
 * while Parser.isValidDashedIdent (used elsewhere) already rejects '--'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C32: bare -- is not a dashed-ident', () => {
  assert.equal(Parser.isValidDashedIdent('--'), false, 'own dashed-ident check rejects --');
});

test('CRS-0003/C32: @custom-media -- is dropped as invalid', () => {
  const sheet = parse('@custom-media -- true;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, 'the name -- is not a <dashed-ident>');
});

test('control: a real dashed name still registers', () => {
  const sheet = parse('@custom-media --wide-screen true;') as unknown as {
    cssRules: unknown[];
  };
  assert.equal(sheet.cssRules.length, 1);
});
