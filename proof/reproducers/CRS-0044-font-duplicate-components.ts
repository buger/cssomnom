/**
 * Reproducer for CRS-0044/C14 and CRS-0044/C22 (requirement
 * SW-REQ-260822-YBF2, src/shorthands.ts expandFont preamble loop).
 *
 * The font preamble loop assigns weightVal/styleVal for every matching token
 * and continues, with no already-set guard. css-fonts-4 #font-prop allows at
 * most one <'font-style'>, <font-variant-css2>, <'font-weight'>, and
 * <font-width-css3> each (the || combinator). 'font: 400 700 16px Arial'
 * stores weight 700, and 'font: italic oblique 16px Arial' stores style
 * oblique; both must reject the whole declaration instead.
 * Asserts the intended contract so this command FAILS while the bug exists.
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

test('CRS-0044/C14: font 400 700 16px Arial is rejected (two weights)', () => {
  assert.equal(probe('400 700 16px Arial', 'font-size'), '');
  assert.equal(probe('400 700 16px Arial', 'font-weight'), '');
});

test('CRS-0044/C14: font bold 400 16px Arial is rejected (keyword plus number weight)', () => {
  assert.equal(probe('bold 400 16px Arial', 'font-size'), '');
});

test('CRS-0044/C22: font italic oblique 16px Arial is rejected (two styles)', () => {
  assert.equal(probe('italic oblique 16px Arial', 'font-size'), '');
  assert.equal(probe('italic oblique 16px Arial', 'font-style'), '');
});

test('control: one of each component still expands', () => {
  assert.equal(probe('italic small-caps bold condensed 16px/1.5 Arial', 'font-size'), '16px');
  assert.equal(probe('italic small-caps bold condensed 16px/1.5 Arial', 'font-style'), 'italic');
});
