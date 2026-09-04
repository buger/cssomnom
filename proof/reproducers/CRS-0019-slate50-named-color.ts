/**
 * Reproducer for CRS-0019/C12 (src/shorthands.ts isColorToken). The named
 * color table lists 'slate50', which is not a CSS named color (css-color
 * named-colors define slateblue, slategray, slategrey). isColorToken drives
 * shorthand parsing, so "background: slate50" is treated as a color and stored
 * instead of being dropped as an invalid declaration.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0019/C12: background: slate50 is dropped as an invalid color', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('background', 'slate50');
  assert.equal(
    decl.getPropertyValue('background-color'),
    '',
    'slate50 is not a css-color named color, so the declaration must not expand'
  );
});

test('CRS-0019/C12: stylesheet path drops slate50 too', () => {
  const sheet = parse('.a{background: slate50}') as unknown as {
    cssRules: { style: { getPropertyValue(n: string): string } }[];
  };
  assert.equal(sheet.cssRules[0].style.getPropertyValue('background-color'), '');
});

test('control: real slate colors parse', () => {
  const sheet = parse('.a{background: slateblue}') as unknown as {
    cssRules: { style: { getPropertyValue(n: string): string } }[];
  };
  assert.equal(sheet.cssRules[0].style.getPropertyValue('background-color'), 'slateblue');
});
