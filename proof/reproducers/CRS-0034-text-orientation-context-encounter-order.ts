/**
 * Reproducer for CRS-0034/C15 (src/cascade/index.ts getCascadedStyle).
 *
 * css-writing-modes-4 #text-orientation upright: "This value causes the
 * used value of 'direction' to be 'ltr'" in vertical writing modes, and
 * the mapping note pins the used direction to the computed writing-mode
 * and text-orientation. getCascadedStyle reads the text-orientation
 * mapping context from declarationsByProperty.get('text-orientation')
 * ?.at(-1) before any cascade sort (src/cascade/index.ts:240-245), so a
 * lower-priority text-orientation collected later hides the winning
 * upright declaration and the forced-LTR mapping is skipped. Identical
 * cascade winners then map margin-inline-start to opposite physical
 * sides depending only on collection order. Same one-line root as KI-259
 * (writing-mode leg); this pins the text-orientation leg. Asserts the
 * spec outcome so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function styleOf(css: string): { get(p: string): string } {
  const rules = parse(css).cssRules as never;
  const document = parseHTML('<html><body><div id="t"></div></body></html>').document;
  const s = getCascadedStyle(document.getElementById('t')!, rules);
  return { get: (p: string) => s.getPropertyValue(p) };
}

test('CRS-0034/C15: winning upright text-orientation drives the inline mapping', () => {
  // Winners: writing-mode vertical-rl, text-orientation upright (!important),
  // direction rtl. A lower-specificity text-orientation:mixed is collected last.
  const s = styleOf(
    '#t { writing-mode: vertical-rl; text-orientation: upright !important; direction: rtl; margin-inline-start: 10px; } ' +
    'div { text-orientation: mixed; }'
  );
  assert.equal(s.get('margin-top'), '10px',
    'upright forces the used direction to ltr, so inline-start is the top in vertical-rl');
  assert.equal(s.get('margin-bottom'), '',
    'the later-collected mixed must not drive the mapping');
});

test('control: uncontested upright maps inline-start to the top', () => {
  const s = styleOf(
    '#t { writing-mode: vertical-rl; text-orientation: upright !important; direction: rtl; margin-inline-start: 10px; }'
  );
  assert.equal(s.get('margin-top'), '10px');
  assert.equal(s.get('margin-bottom'), '');
});
