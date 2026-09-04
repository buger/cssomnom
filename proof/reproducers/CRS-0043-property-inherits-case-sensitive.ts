/**
 * Reproducer for CRS-0043/C07 (requirement SW-REQ-260822-MN8Z,
 * src/parser.ts handlePropertyRule).
 *
 * handlePropertyRule compares serialize(d.value).trim() with === 'true' /
 * === 'false'. css-values-4 #keywords makes CSS keywords ASCII
 * case-insensitive, and the '@property/inherits' descriptor grammar is
 * 'true | false' (css-properties-values-api #inherits-descriptor), so
 * 'inherits: TRUE' must register inherits=true and keep the rule.
 * The case-sensitive compare leaves inherits null and drops a valid
 * @property rule. Asserts the intended contract so this command FAILS while
 * the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';

function parseProperty(css: string) {
  return new Parser(tokenize(css)).parseStyleSheet();
}

test('CRS-0043/C07: inherits: TRUE keeps the @property rule', () => {
  const sheet = parseProperty('@property --x { syntax: "*"; inherits: TRUE; }');
  assert.equal(sheet.cssRules.length, 1, 'TRUE matches true ASCII case-insensitively');
});

test('CRS-0043/C07: inherits: FALSE registers inherits=false', () => {
  const sheet = parseProperty('@property --x { syntax: "*"; inherits: FALSE; }');
  assert.equal(sheet.cssRules.length, 1);
  const rule = sheet.cssRules[0] as unknown as { inherits: boolean };
  assert.equal(rule.inherits, false, 'FALSE is the keyword false');
});

test('control: lowercase inherits: true keeps the rule', () => {
  const sheet = parseProperty('@property --x { syntax: "*"; inherits: true; }');
  assert.equal(sheet.cssRules.length, 1);
});
