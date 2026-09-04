/**
 * Reproducer for CRS-0002/C11 and CRS-0003/C09 (src/parser.ts handleImportRule).
 * An @import prelude without a <url> or <string> fails the css-cascade-6
 * #at-import grammar (@import [ <url> | <string> ] ... ; makes the URL
 * mandatory), so the whole rule must be dropped. handleImportRule leaves
 * href '' and still constructs a CSSImportRule, fabricating a rule.
 * Related: KI-43 pins the bad-url leg; this pins the missing-URL leg.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSImportRule } from '../../src/CSSOM.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0002/C11: @import with no URL at all is dropped', () => {
  const sheet = parse('@import;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, '@import; is grammar-invalid and must be ignored');
});

test('CRS-0003/C09: @import followed by only a media condition is dropped', () => {
  const sheet = parse('@import screen;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, '@import screen; lacks the mandatory URL');
});

test('CRS-0003/C09: @import layer with no URL is dropped', () => {
  const sheet = parse('@import layer;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, '@import layer; lacks the mandatory URL');
});

test('control: valid @import with URL and media still parses', () => {
  const sheet = parse('@import url("a.css") screen;') as unknown as { cssRules: CSSImportRule[] };
  assert.equal(sheet.cssRules.length, 1);
  assert.equal(sheet.cssRules[0].href, 'a.css');
});
