/**
 * Reproducer for CRS-0003/C24 (src/parser.ts normalizeNestedSelector).
 * A selector list ending in a comma is invalid (selectors-4 #grouping:
 * an empty selector in the list invalidates it). normalizeNestedSelector
 * never pushes the trailing empty segment, silently dropping the comma;
 * on non-nested block parsing (e.g. inside @media) the repaired selector
 * then parses and the rule is kept instead of dropped.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C24: trailing comma in a @media child selector drops the rule', () => {
  const sheet = parse('@media all { .foo, { color: red } }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules[0].cssRules.length, 0, 'an empty selector segment invalidates the list');
});

test('CRS-0003/C24: trailing comma with nesting selector also drops the rule', () => {
  const sheet = parse('@media all { &.foo, { color: red } }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules[0].cssRules.length, 0);
});

test('CRS-0003/C24: double comma mid-list drops the rule', () => {
  const sheet = parse('@media all { .a,,.b { color: red } }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules[0].cssRules.length, 0);
});

test('control: valid selector lists still parse inside @media', () => {
  const sheet = parse('@media all { .foo { color: red } .a, .b { color: blue } }') as unknown as {
    cssRules: { cssRules: unknown[] }[];
  };
  assert.equal(sheet.cssRules[0].cssRules.length, 2);
});
