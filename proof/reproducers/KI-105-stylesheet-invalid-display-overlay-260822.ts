/**
 * Overlay reproducer for KI-105.
 *
 * Reproduces: KI-105
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';

// Reproduces: KI-105
test('KI-105: stylesheet parsing drops a display value outside the display grammar', () => {
  // css-syntax-3 § 5.4.5 #parse-a-css-declaration-block: parse each
  // declaration according to its property specification and drop it when the
  // whole declaration is invalid. css-display-3 § 2 #the-display-properties
  // defines the finite display value grammar.
  const sheet = parse('.target { display: definitely-not-a-display-value; color: red; }');
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('display'), '',
    'property-grammar-invalid display declaration must be dropped');
  assert.equal(style.getPropertyValue('color'), 'red',
    'a neighboring valid declaration must remain after the invalid one');
});
