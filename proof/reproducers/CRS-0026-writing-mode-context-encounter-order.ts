/**
 * Reproducer for CRS-0026/C02 (src/cascade/index.ts getCascadedStyle logical
 * mapping context). CSS Logical 1 maps logical properties against the
 * computed writing-mode. groupDeclarationsByProperty only appends in
 * encounter order, and getCascadedStyle reads declarationsByProperty
 * .get('writing-mode')?.at(-1) before any cascade sort, so an earlier
 * !important writing-mode loses to a later normal declaration and logical
 * longhands map through the wrong writing mode. margin-block-start: 10px
 * under writing-mode: vertical-rl !important must map to margin-right, not
 * margin-top.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function styleOf(css: string): { get(p: string): string } {
  const rules = parseStyleSheet(css);
  const doc = parseHTML('<html><body><div id="t"></div></body></html>').document;
  const el = doc.getElementById('t');
  const s = getCascadedStyle(el, rules);
  return { get: (p: string) => s.getPropertyValue(p) };
}

test('CRS-0026/C02: mapping context uses the cascaded writing-mode winner', () => {
  const s = styleOf('#t { writing-mode: vertical-rl !important; margin-block-start: 10px; } #t { writing-mode: horizontal-tb; }');
  assert.equal(s.get('margin-right'), '10px', 'vertical-rl maps block-start to the right side');
  assert.equal(s.get('margin-top'), '', 'the losing horizontal-tb must not drive the mapping');
});

test('control: uncontested vertical-rl maps block-start to margin-right', () => {
  const s = styleOf('#t { writing-mode: vertical-rl; margin-block-start: 10px; }');
  assert.equal(s.get('margin-right'), '10px');
});
