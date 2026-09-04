/**
 * Reproducer for CRS-0018/C04 (src/parser.ts Parser.handleImportRule).
 * css-values-4 #url-value: <url> = <url()> | <src()>, and css-cascade-5
 * #at-import grammar is "@import [ <url> | <string> ] ...", so
 * "@import src("foo.css")" is grammar-valid input. handleImportRule accepts
 * only string tokens, url tokens, and functions named url (case-sensitively,
 * KI-161), so the src() form loses href and dumps the function into mediaText.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0018/C04: @import src("foo.css") captures href', () => {
  const sheet = parse('@import src("foo.css");') as unknown as {
    cssRules: { href: string; media: { mediaText: string } }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @import rule must parse');
  assert.equal(sheet.cssRules[0].href, 'foo.css', 'css-values-4: src() is a <url>, so href is foo.css');
  assert.equal(sheet.cssRules[0].media.mediaText, '', 'the src() form is the URL, not a media query');
});

test('control: url() and string forms still capture href', () => {
  const a = parse('@import url("a.css");') as unknown as { cssRules: { href: string }[] };
  const b = parse('@import "b.css";') as unknown as { cssRules: { href: string }[] };
  assert.equal(a.cssRules[0].href, 'a.css');
  assert.equal(b.cssRules[0].href, 'b.css');
});
