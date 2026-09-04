/**
 * Reproducer for CRS-0026/C18 (src/cascade/rule-filter.ts
 * collectMatchedDeclarations walkRules media branch). The @media viewport is
 * derived from the frame element's style/width attribute via bare
 * parseFloat, so percentage and em widths silently become pixel counts:
 * style width '100%' feeds 100px and '50em' feeds 50px into MediaParser.
 * mediaqueries-4 #evaluating requires the used pixel viewport; a
 * non-pixel width must not be treated as its leading number.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function colorWithFrameWidth(width: string): string {
  const rules = parseStyleSheet('@media (max-width: 150px) { #t { color: red; } }');
  const doc = parseHTML('<html><body><div id="t"></div></body></html>').document;
  Object.defineProperty(doc, 'defaultView', {
    value: { frameElement: { style: { width } } },
    configurable: true,
  });
  const el = doc.getElementById('t');
  return getCascadedStyle(el, rules).getPropertyValue('color');
}

test('CRS-0026/C18: 100% frame width is not 100px', () => {
  assert.notEqual(colorWithFrameWidth('100%'), 'rgb(255, 0, 0)',
    'a percentage width must not be read as its leading number');
});

test('CRS-0026/C18: 50em frame width is not 50px', () => {
  assert.notEqual(colorWithFrameWidth('50em'), 'rgb(255, 0, 0)');
});

test('control: an explicit pixel frame width still applies', () => {
  assert.equal(colorWithFrameWidth('100px'), 'rgb(255, 0, 0)');
});
