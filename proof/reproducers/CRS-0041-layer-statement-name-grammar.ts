/**
 * Reproducer for CRS-0041/C29 (src/parser.ts handleLayerRule).
 * css-cascade-5 #layer-empty types the @layer statement as
 * `@layer <layer-name># ;` where <layer-name> = <ident> [ '.' <ident> ]*.
 * `@layer foo bar;` is not a layer-name list, so the rule must be ignored.
 * handleLayerRule statement arm splits the serialized prelude on ',' and
 * constructs CSSLayerStatementRule unconditionally, so the invalid name list
 * survives into cssRules (with a name that is not an identifier).
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSLayerStatementRule } from '../../src/CSSOM.ts';

test('CRS-0041/C29: @layer foo bar is dropped, not kept as a bogus name list', () => {
  const sheet = parse('@layer foo bar;');
  assert.equal(sheet.cssRules.length, 0,
    'two space-separated idents are not a <layer-name># list');
});

test('CRS-0041/C29: other malformed layer statement names are dropped too', () => {
  assert.equal(parse('@layer 12px;').cssRules.length, 0, 'a dimension is not a <layer-name>');
  assert.equal(parse('@layer foo. ;').cssRules.length, 0, 'a dangling dot is not a <layer-name>');
});

test('control: valid layer statements still parse', () => {
  const sheet = parse('@layer foo.bar, baz;');
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSLayerStatementRule);
  assert.deepEqual((rule as CSSLayerStatementRule).nameList, ['foo.bar', 'baz']);
});
