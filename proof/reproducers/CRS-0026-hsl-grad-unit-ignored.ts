/**
 * Reproducer for CRS-0026/C27 (src/cascade/color-resolver.ts parseHue).
 * css-values-4 #angle defines grad as an angle unit (400grad = 360deg), so
 * hsl(100grad, 50%, 50%) has hue 90deg. parseHue only strips deg, rad and
 * turn suffixes; parseFloat('100grad') yields 100, so the parser silently
 * treats 100grad as 100deg and resolves the wrong color instead of failing
 * or converting.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function colorOf(css: string): string {
  const rules = parseStyleSheet(css);
  const doc = parseHTML('<html><body><div class="t" id="t"></div></body></html>').document;
  const el = doc.getElementById('t');
  return getCascadedStyle(el, rules).getPropertyValue('color');
}

test('CRS-0026/C27: hsl(100grad) equals hsl(90deg)', () => {
  const grad = colorOf('.t { color: hsl(100grad, 50%, 50%); }');
  const deg = colorOf('.t { color: hsl(90deg, 50%, 50%); }');
  assert.equal(grad, deg, `100grad must convert to 90deg; got ${grad} vs ${deg}`);
});

test('control: deg values keep resolving', () => {
  assert.equal(colorOf('.t { color: hsl(100deg, 50%, 50%); }'), colorOf('.t { color: hsl(100deg, 50%, 50%); }'));
  assert.equal(colorOf('.t { color: hsl(180deg, 50%, 50%); }'), 'rgb(64, 191, 191)');
});
