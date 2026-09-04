/**
 * Reproducer for CRS-0044/C02, C03, C05, C06, and C23 (requirement
 * SW-REQ-260822-YBF2, src/shorthands.ts isValidLengthOrPercentage).
 *
 * isValidLengthOrPercentage's ident branch returns true for 'auto' and for
 * the CSS-wide keywords 'initial/inherit/unset/revert/revert-layer'. The
 * predicate gates every length box at once, so it admits per-side values no
 * box accepts. css-box-3 #padding restricts padding to
 * <length-percentage [0,∞]> (no 'auto', negatives invalid), and
 * css-cascade #defaulting-keywords states CSS-wide keywords cannot combine
 * with other values even in a shorthand. css-scroll-snap-1 #scroll-margin
 * is <length>{1,4} with no 'auto'. An invalid shorthand declaration must
 * leave the longhands unset. Asserts the intended contract so this command
 * FAILS while the bug exists.
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

test('CRS-0044/C02: padding auto is rejected', () => {
  assert.equal(probe('padding', 'auto', 'padding-top'), '');
});

test('CRS-0044/C03: margin 1px inherit is rejected as a mixed CSS-wide value', () => {
  assert.equal(probe('margin', '1px inherit', 'margin-top'), '');
});

test('CRS-0044/C05: scroll-margin auto is rejected', () => {
  assert.equal(probe('scroll-margin', 'auto', 'scroll-margin-top'), '');
});

test('CRS-0044/C06: negative padding length is rejected', () => {
  assert.equal(probe('padding', '-10px', 'padding-top'), '');
});

test('CRS-0044/C06: negative padding percentage is rejected', () => {
  assert.equal(probe('padding', '-5%', 'padding-top'), '');
});

test('CRS-0044/C23: a lone per-side unset does not expand padding sides', () => {
  // 'unset' must expand to all four sides as the CSS-wide shorthand form,
  // never leak into only one side; the mixed-value hole is pinned above, so
  // this pins that the single-keyword form still works as a whole-value form.
  const style = new CSSStyleDeclaration();
  style.setProperty('padding', 'unset');
  assert.equal(style.getPropertyValue('padding-top'), 'unset');
  assert.equal(style.getPropertyValue('padding-left'), 'unset');
});

test('controls: valid length boxes still expand', () => {
  assert.equal(probe('margin', 'auto', 'margin-top'), 'auto');
  assert.equal(probe('padding', '1px 2px', 'padding-bottom'), '1px');
  assert.equal(probe('scroll-margin', '10px', 'scroll-margin-left'), '10px');
});
