/**
 * Reproducer for CRS-0003/C17 (src/parser.ts validateVarFunction /
 * consumeDeclarationFromStream). css-variables-1 #guaranteed-invalid says
 * the only way to create the guaranteed-invalid value is an invalid
 * arbitrary substitution function, and a property whose value contains it
 * becomes invalid at computed-value time - i.e. the declaration parses and
 * survives until substitution. validateDeclarationValue drops the whole
 * declaration at parse time instead (cssText loses color: var()).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0003/C17: color: var() stays in the rule and defers to computed value', () => {
  const sheet = parse('p { color: var() }') as unknown as { cssRules: { cssText: string }[] };
  assert.ok(sheet.cssRules.length > 0, 'the style rule must survive');
  assert.match(
    sheet.cssRules[0].cssText,
    /var\(\)/,
    'the malformed var() declaration must be kept and become invalid at computed-value time',
  );
});

test('CRS-0003/C17: color: var(--x {) block-mixed name also survives parse', () => {
  const sheet = parse('p { color: var({x}) }') as unknown as { cssRules: { cssText: string }[] };
  assert.ok(sheet.cssRules.length > 0);
  assert.match(sheet.cssRules[0].cssText, /var\(/);
});

test('control: var(foo) and empty-fallback forms already survive parse', () => {
  const sheet = parse('p { color: var(foo); background: var(--x,) }') as unknown as {
    cssRules: { cssText: string }[];
  };
  assert.match(sheet.cssRules[0].cssText, /var\(foo\)/);
  assert.match(sheet.cssRules[0].cssText, /var\(--x,\)/);
});
