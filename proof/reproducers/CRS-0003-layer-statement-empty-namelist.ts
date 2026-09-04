/**
 * Reproducer for CRS-0003/C23 (src/parser.ts handleLayerRule).
 * css-cascade-5 #layer-empty defines the statement form as
 * @layer <layer-name>#; - the # multiplier requires one or more names.
 * An @layer statement with an empty name list is grammar-invalid and the
 * rule must be ignored, but handleLayerRule constructs
 * CSSLayerStatementRule([]) and the rule reaches cssRules as '@layer ;'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C23: @layer with an empty name list is ignored', () => {
  const sheet = parse('@layer;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, '@layer; has zero layer names and is invalid');
});

test('CRS-0003/C23: @layer with only whitespace in the prelude is ignored', () => {
  const sheet = parse('@layer   ;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0);
});

test('CRS-0003/C23: @layer with only commas between names is ignored', () => {
  const sheet = parse('@layer , ,;') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 0, 'empty name segments do not satisfy <layer-name>#');
});

test('control: named statements and anonymous blocks still parse', () => {
  const sheet = parse('@layer a, b; @layer c { p { color: red } }') as unknown as { cssRules: unknown[] };
  assert.equal(sheet.cssRules.length, 2);
});
