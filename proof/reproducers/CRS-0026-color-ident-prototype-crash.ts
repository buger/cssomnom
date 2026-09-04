/**
 * Reproducer for CRS-0026/C16 (src/cascade/color-resolver.ts
 * normalizeComputedColor). normalizeComputedColor tests `lower in
 * NAMED_COLORS` with a prototype-bearing object literal. CSS identifiers
 * like `constructor` or `valueOf` collide with Object.prototype keys, so the
 * membership check passes, NAMED_COLORS[lower] yields a function, and the
 * destructuring `const [r,g,b,a] = NAMED_COLORS[lower]` throws a TypeError
 * that escapes getCascadedStyle for `color: constructor`.
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
  const s = getCascadedStyle(el, rules);
  return s.getPropertyValue('color');
}

test('CRS-0026/C16: color: constructor does not crash the cascade', () => {
  let out = '';
  assert.doesNotThrow(() => { out = colorOf('.t { color: constructor; }'); },
    'an unknown ident must not reach a prototype value');
  assert.ok(!out.includes('undefined'), `got ${JSON.stringify(out)}`);
});

test('CRS-0026/C16: color: valueOf does not crash the cascade', () => {
  assert.doesNotThrow(() => { colorOf('.t { color: valueOf; }'); });
});

test('control: real colors still resolve', () => {
  assert.equal(colorOf('.t { color: red; }'), 'rgb(255, 0, 0)');
  assert.equal(colorOf('.t { color: green; }'), 'rgb(0, 128, 0)');
});
