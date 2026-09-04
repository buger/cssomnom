/**
 * Reproducer for CRS-0026/C04, CRS-0026/C07 and CRS-0026/C19
 * (src/cascade/value-processor.ts processStandardDeclarations/
 * expandShorthandWithVariables and src/cascade/variable-resolver.ts
 * resolveCustomProperties). css-variables-1 #guaranteed-invalid makes a
 * substitution failure poison the declaration at computed-value time:
 * non-custom properties compute as unset (css-cascade-5 #initial) and custom
 * properties become guaranteed-invalid. WPT
 * css/css-variables/variables-substitute-guaranteed-invalid.html asserts a
 * custom property referencing a non-existent variable computes to ''. The
 * implementation treats the failure like a cascade rollback: `continue'
 * walks to the previous declaration and returns it instead.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const document = parseHTML('<html><body></body></html>').document;

function styleOf(css: string, html: string): { get(p: string): string } {
  const rules = parseStyleSheet(css);
  const doc = parseHTML(html).document;
  const el = doc.getElementById('t');
  const s = getCascadedStyle(el, rules);
  return { get: (p: string) => s.getPropertyValue(p) };
}

test('CRS-0026/C04: missing var() computes as unset, not the loser declaration', () => {
  const s = styleOf(
    '.t { color: red; } .t { color: var(--missing); }',
    '<html><body style="color: blue"><div class="t" id="t"></div></body></html>',
  );
  assert.equal(s.get('color'), 'rgb(0, 0, 255)', 'IACVT makes color unset, i.e. inherited blue');
});

test('CRS-0026/C07: custom property stays guaranteed-invalid', () => {
  const s = styleOf(
    '.a { --x: 1px; } .b { --x: var(--missing); }',
    '<html><body><div class="a b" id="t"></div></body></html>',
  );
  assert.equal(s.get('--x'), '', 'WPT variables-substitute-guaranteed-invalid.html expects the empty string');
});

test('CRS-0026/C19: shorthand IACVT unsets its longhands', () => {
  const s = styleOf(
    '.t { margin-top: 10px; } .t { margin: var(--missing); }',
    '<html><body><div class="t" id="t"></div></body></html>',
  );
  assert.ok(s.get('margin-top') === '' || s.get('margin-top') === '0px',
    `margin-top must unset, got ${JSON.stringify(s.get('margin-top'))}`);
});

test('control: var() fallback still works', () => {
  const s = styleOf(
    '.t { color: var(--missing, green); }',
    '<html><body><div class="t" id="t"></div></body></html>',
  );
  assert.equal(s.get('color'), 'rgb(0, 128, 0)');
});
