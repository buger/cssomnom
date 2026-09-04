/**
 * Reproducer for CRS-0003/C11 (src/parser.ts handleNamespaceRule).
 * css-namespaces-3 #syntax requires @namespace <prefix>? [ <string> |
 * <url> ] ; and says a syntactically invalid @namespace rule must be
 * ignored. handleNamespaceRule never checks that a URI was found, so
 * '@namespace foo;' fabricates a CSSNamespaceRule with an empty
 * namespaceURI and registers the prefix as declared.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C11: @namespace with prefix but no URI is ignored', () => {
  const sheet = parse('@namespace foo;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, '@namespace foo; is syntactically invalid');
});

test('CRS-0003/C11: bare @namespace with nothing is ignored', () => {
  const sheet = parse('@namespace;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0);
});

test('CRS-0003/C11: prefix followed by junk (no URI) is ignored', () => {
  const sheet = parse('@namespace foo bar;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, 'two idents are not a <string> | <url>');
});

test('control: valid @namespace declarations still parse', () => {
  const sheet = parse('@namespace "http://e.example/"; @namespace svg "http://www.w3.org/2000/svg";') as unknown as {
    cssRules: { prefix: string; namespaceURI: string }[];
  };
  assert.equal(sheet.cssRules.length, 2);
  assert.equal(sheet.cssRules[0].namespaceURI, 'http://e.example/');
  assert.equal(sheet.cssRules[1].prefix, 'svg');
});
