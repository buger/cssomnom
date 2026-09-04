/**
 * Reproducer for CRS-0002/C22 and CRS-0003/C13 (src/parser.ts
 * handlePropertyRule). The inherits descriptor holds CSS keywords
 * (css-properties-values-api-1 #property-rule grammar: inherits true |
 * false), and css-values-4 #keywords requires keywords to match ASCII
 * case-insensitively. The handler compares serialize(value) === 'true' /
 * 'false' verbatim, so inherits: True leaves inherits null and the whole
 * @property rule is discarded with a SyntaxError on insertRule.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleSheet } from '../../src/CSSOM.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0002/C22: @property inherits: True parses as true', () => {
  const sheet = parse('@property --tc1 { syntax: "*"; inherits: True; }') as unknown as {
    cssRules: { inherits: boolean }[];
  };
  assert.equal(sheet.cssRules.length, 1, 'mixed-case true must keep the @property rule');
  assert.equal(sheet.cssRules[0].inherits, true);
});

test('CRS-0003/C13: @property inherits: FALSE parses as false', () => {
  const sheet = parse('@property --tc2 { syntax: "<length>"; inherits: FALSE; initial-value: 1px; }') as unknown as {
    cssRules: { inherits: boolean }[];
  };
  assert.equal(sheet.cssRules.length, 1, 'mixed-case false must keep the @property rule');
  assert.equal(sheet.cssRules[0].inherits, false);
});

test('CRS-0002/C22: insertRule accepts @property inherits: True', () => {
  const sheet = new CSSStyleSheet();
  sheet.insertRule('@property --tc3 { syntax: "*"; inherits: True; }');
  assert.equal(sheet.cssRules.length, 1);
});

test('control: lowercase inherits still parses', () => {
  const sheet = parse('@property --tc4 { syntax: "*"; inherits: true; }') as unknown as {
    cssRules: { inherits: boolean }[];
  };
  assert.equal(sheet.cssRules.length, 1);
  assert.equal(sheet.cssRules[0].inherits, true);
});
