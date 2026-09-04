/**
 * Reproducer for CRS-0044/C04 and CRS-0044/C25 (requirement
 * SW-REQ-260822-YBF2, src/shorthands.ts expandBox isLengthBox gate).
 *
 * expandBox validates side values only when isLengthBox is true, which
 * matches margin/padding/top/scroll-*. border-width (<line-width>{1,4},
 * css-backgrounds-3), border-style (<line-style>{1,4}), and border-color
 * (<color>{1,4}) fail the predicate, so any 1-4 tokens expand into the
 * four longhands with no grammar check. The logical keyword variant
 * (border-color: logical red blue) hits the same hole. Invalid shorthand
 * declarations must leave the longhands unset. Asserts the intended
 * contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function probe(shorthand: string, value: string, longhand: string): string {
  const style = new CSSStyleDeclaration();
  style.setProperty(shorthand, value);
  return style.getPropertyValue(longhand);
}

test('CRS-0044/C04: border-width auto is rejected', () => {
  assert.equal(probe('border-width', 'auto', 'border-top-width'), '');
});

test('CRS-0044/C04: border-color 1px is rejected', () => {
  assert.equal(probe('border-color', '1px', 'border-top-color'), '');
});

test('CRS-0044/C04: border-style foo is rejected', () => {
  assert.equal(probe('border-style', 'foo', 'border-top-style'), '');
});

test('CRS-0044/C25: border-color logical red blue validates the colors', () => {
  const style = new CSSStyleDeclaration();
  style.setProperty('border-color', 'logical not-a-color also-not-a-color');
  assert.equal(style.getPropertyValue('border-block-start-color'), '', 'junk idents are not <color>');
});

test('controls: valid border boxes still expand', () => {
  assert.equal(probe('border-width', 'thin', 'border-top-width'), 'thin');
  assert.equal(probe('border-color', 'red blue', 'border-bottom-color'), 'red');
  assert.equal(probe('border-style', 'solid', 'border-left-style'), 'solid');
});
