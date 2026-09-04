/**
 * Reproducer for CRS-0002/C05, CRS-0002/C06, CRS-0003/C08, CRS-0003/C10
 * (src/parser.ts handleImportRule / handleNamespaceRule.extractUri).
 * The url() function-name comparisons use === 'url', so URL("...") and
 * Url("...") preludes miss the branch. css-values-4 #functional-notation
 * states function names are ASCII case-insensitive, and css-syntax-3
 * #consume-ident-like-token matches the url spelling ASCII case-
 * insensitively when producing the function token. The same handlers
 * already lowercase layer()/supports() names, so only url is exact.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('url() name case-insensitivity: @import URL("sheet.css") keeps href', () => {
  const sheet = parse('@import URL("sheet.css");') as unknown as {
    cssRules: { href: string }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @import rule must parse');
  assert.equal(sheet.cssRules[0].href, 'sheet.css', 'URL() must resolve like url()');
});

test('url() name case-insensitivity: @import Url("other.css") keeps href', () => {
  const sheet = parse('@import Url("other.css");') as unknown as {
    cssRules: { href: string }[];
  };
  assert.equal(sheet.cssRules[0].href, 'other.css');
});

test('url() name case-insensitivity: @namespace URL("http://e.example/") keeps URI', () => {
  const sheet = parse('@namespace URL("http://e.example/");') as unknown as {
    cssRules: { namespaceURI: string }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @namespace rule must parse');
  assert.equal(sheet.cssRules[0].namespaceURI, 'http://e.example/', 'URL() must resolve like url()');
});

test('url() name case-insensitivity: prefixed @namespace url case variant', () => {
  const sheet = parse('@namespace svg URL("http://www.w3.org/2000/svg");') as unknown as {
    cssRules: { prefix: string; namespaceURI: string }[];
  };
  assert.equal(sheet.cssRules[0].prefix, 'svg');
  assert.equal(sheet.cssRules[0].namespaceURI, 'http://www.w3.org/2000/svg');
});

test('control: lowercase url() forms round-trip', () => {
  const sheet = parse('@import url("low.css"); @namespace url("http://u.example/");') as unknown as {
    cssRules: { href?: string; namespaceURI?: string }[];
  };
  assert.equal(sheet.cssRules[0].href, 'low.css');
  assert.equal(sheet.cssRules[1].namespaceURI, 'http://u.example/');
});
