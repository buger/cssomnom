/**
 * Reproducer for CRS-0056/C17 (src/CSSOM.ts CSSPropertyRule.cssText).
 * cssom-1 #serializing-css-declarations requires each declaration to
 * serialize as its name, ": ", value, then "; ". The cssText getter
 * concatenates `initial-value:` directly after `inherits: <v>;` with no
 * separating space, producing "inherits: false;initial-value: 0;", which
 * is neither canonical nor re-parseable @property text.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0056/C17: CSSPropertyRule.cssText separates descriptors with a space', () => {
  const sheet = parse('@property --crs0056c17 { syntax: "*"; inherits: false; initial-value: 0; }') as unknown as {
    cssRules: { cssText: string }[];
  };
  const text = sheet.cssRules[0]?.cssText;
  assert.ok(text, 'control: the rule is present');
  assert.ok(
    text!.includes('inherits: false; initial-value:'),
    `each descriptor must be followed by "; " — got ${JSON.stringify(text)}`,
  );
});

test('control: descriptors without initial-value serialize unchanged', () => {
  const sheet = parse('@property --crs0056ctl { syntax: "*"; inherits: false; }') as unknown as {
    cssRules: { cssText: string }[];
  };
  assert.ok(sheet.cssRules[0]?.cssText.includes('syntax: "*"; inherits: false;'));
});
