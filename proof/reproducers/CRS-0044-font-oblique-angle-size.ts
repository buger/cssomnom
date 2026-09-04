/**
 * Reproducer for CRS-0044/C15 (requirement SW-REQ-260822-YBF2,
 * src/shorthands.ts expandFont).
 *
 * The preamble loop records 'oblique' as font-style and continues without
 * peeking at a following <angle>. css-fonts-4 #font-style defines
 * 'oblique <angle>{1,2}', and the font shorthand consumes
 * <'font-style'> as one component. 'font: oblique 10deg 16px Arial'
 * therefore takes 10deg as the font-size (any dimension is accepted) and
 * pushes 16px into the family list. font-style must be 'oblique 10deg' and
 * font-size '16px'. Asserts the intended contract so this command FAILS
 * while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function probe(value: string, longhand: string): string {
  const style = new CSSStyleDeclaration();
  style.setProperty('font', value);
  return style.getPropertyValue(longhand);
}

test('CRS-0044/C15: oblique 10deg stays part of font-style', () => {
  assert.equal(probe('oblique 10deg 16px Arial', 'font-style'), 'oblique 10deg');
});

test('CRS-0044/C15: the size after an oblique angle is the font-size', () => {
  assert.equal(probe('oblique 10deg 16px Arial', 'font-size'), '16px');
});

test('CRS-0044/C15: the family after an oblique angle is the family', () => {
  assert.equal(probe('oblique 10deg 16px Arial', 'font-family'), 'Arial');
});

test('control: bare oblique keeps working', () => {
  assert.equal(probe('oblique 16px Arial', 'font-style'), 'oblique');
  assert.equal(probe('oblique 16px Arial', 'font-size'), '16px');
});
