/**
 * Reproducer for CRS-0026/C05 and CRS-0026/C06
 * (src/cascade/value-processor.ts processStandardDeclarations and
 * src/cascade/variable-resolver.ts resolveCustomProperties).
 * css-cascade-5 #revert-layer rolls the value back to the previous cascade
 * layer, i.e. the value the property would take with the declaring layer's
 * rules removed. For !important declarations the layer order is reversed, so
 * the next-weaker candidate lives in a layer with a HIGHER layerOrder. The
 * rollback loop skips while layerOrder >= the winner's layerOrder, which
 * under the reversed order discards every weaker !important layer and falls
 * off the array to the UA/parent value.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function styleOf(css: string, html = '<html><body><div class="t" id="t"></div></body></html>'): { get(p: string): string } {
  const rules = parseStyleSheet(css);
  const doc = parseHTML(html).document;
  const el = doc.getElementById('t');
  const s = getCascadedStyle(el, rules);
  return { get: (p: string) => s.getPropertyValue(p) };
}

test('CRS-0026/C05: important revert-layer rolls back to the next weaker layer', () => {
  const s = styleOf(
    '@layer a, b; @layer a { .t { color: revert-layer !important; } } @layer b { .t { color: red !important; } }',
  );
  assert.equal(s.get('color'), 'rgb(255, 0, 0)', 'removing layer a leaves layer b red as the winner');
});

test('CRS-0026/C06: custom property revert-layer !important rolls back too', () => {
  const s = styleOf(
    '@layer a, b; @layer a { .t { --x: revert-layer !important; } } @layer b { .t { --x: red !important; } }',
  );
  assert.equal(s.get('--x'), 'red');
});

test('control: normal revert-layer in the later layer works', () => {
  const s = styleOf(
    '@layer a, b; @layer a { .t { color: red; } } @layer b { .t { color: revert-layer; } }',
  );
  assert.equal(s.get('color'), 'rgb(255, 0, 0)');
});
