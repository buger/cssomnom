/**
 * Reproducer for CRS-0026/C29 (src/cascade/value-processor.ts
 * processStandardDeclarations revert-rule handling).
 * css-cascade-5 #revert-rule-keyword: "the cascaded value is rolled back
 * such that the specified value is calculated as if the current style rule
 * had not been present at all." processStandardDeclarations implements
 * revert-rule as a plain `continue', so the walk lands on any lower-sorted
 * declaration, including longhands the SAME style rule contributed through a
 * shorthand. margin-block: 10px + margin-top: revert-rule in one rule must
 * yield the initial margin-top (the whole rule is absent), not the same
 * rule's expanded 10px.
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

test('CRS-0026/C29: revert-rule ignores the same rule shorthand expansion', () => {
  const s = styleOf('.t { margin-block: 10px; margin-top: revert-rule; }');
  assert.ok(s.get('margin-top') === '' || s.get('margin-top') === '0px',
    `the whole rule is absent, so margin-top unsets; got ${JSON.stringify(s.get('margin-top'))}`);
});

test('control: revert-rule keeps earlier rules', () => {
  const s = styleOf('.t { margin-top: 10px; } .u { margin-top: revert-rule; }',
    '<html><body><div class="t u" id="t"></div></body></html>');
  assert.equal(s.get('margin-top'), '10px');
});
