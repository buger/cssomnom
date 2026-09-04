/**
 * Reproducer for CRS-0026/C03 and CRS-0026/C08 (src/cascade/index.ts
 * getCascadedStyle rawCustomProps and src/cascade/variable-resolver.ts
 * substituteVariables). css-variables-1 #defining custom properties cascade
 * normally, so an !important --a beats a later normal --a. WPT
 * css/css-variables/variable-reference-13.html and -14.html assert color:
 * var(--a) is green in exactly this fixture. getCascadedStyle fills
 * rawCustomProps from the LAST grouped declaration in encounter order and
 * substituteVariables resolves var(--a) through that unsorted map, so a
 * custom property that references --a sees 'crimson' while a standard
 * property sees the correctly cascaded 'green'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function styleOf(css: string): { get(p: string): string } {
  const rules = parseStyleSheet(css);
  const doc = parseHTML('<html><body><div class="a b" id="t"></div></body></html>').document;
  const el = doc.getElementById('t');
  const s = getCascadedStyle(el, rules);
  return { get: (p: string) => s.getPropertyValue(p) };
}

test('CRS-0026/C08: var() inside a custom property sees the cascaded winner', () => {
  const s = styleOf('.a { --a: green !important; } .a { --a: crimson; } .b { --x: var(--a); }');
  assert.equal(s.get('--x'), 'green', 'WPT variable-reference-13.html: the important declaration wins');
});

test('CRS-0026/C03: rawCustomProps stores the cascaded winner', () => {
  const s = styleOf('.a { --a: green !important; } .a { --a: crimson; } .b { color: var(--x); --x: var(--a); }');
  assert.equal(s.get('--x'), 'green');
});

test('control: standard property substitution already uses the winner', () => {
  const s = styleOf('.a { --a: green !important; } .a { --a: crimson; } .b { color: var(--a); }');
  assert.equal(s.get('color'), 'rgb(0, 128, 0)');
});
