/**
 * Reproducer for CRS-0019/C18 (src/CSSOM.ts CSSStyleRule._getNamespaceContext).
 * cssom-1 #dom-cssstylerule-selectortext must return the serialized selector
 * and defines no SecurityError for it. _getNamespaceContext walks
 * sheet.cssRules, the public getter that throws SecurityError on a
 * non-origin-clean sheet, so reading selectorText on a rule of a tainted sheet
 * built via CSSStyleSheet.createInternal(rules, parse, false) throws instead
 * of serializing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

test('CRS-0019/C18: selectorText serializes on a non-origin-clean sheet', () => {
  const clean = parse('div { color: red }') as unknown as {
    cssRules: { selectorText: string; type: number }[];
  };
  const rule = clean.cssRules[0];
  const tainted = CSSStyleSheet.createInternal(
    [rule],
    () => null as unknown as ReturnType<typeof parse>['cssRules'][number],
    false
  );
  assert.ok(tainted, 'tainted sheet constructed');
  assert.equal(
    rule.selectorText,
    'div',
    'cssom-1: selectorText has no SecurityError; only sheet.cssRules is origin-clean gated'
  );
});

test('control: the tainted sheet cssRules getter still throws SecurityError', () => {
  const clean = parse('div { color: red }') as unknown as { cssRules: unknown[] };
  const rule = clean.cssRules[0];
  const tainted = CSSStyleSheet.createInternal([rule], () => null as unknown, false);
  assert.throws(() => (tainted as unknown as { cssRules: unknown[] }).cssRules.length, /SecurityError|origin-clean/);
});

test('control: origin-clean sheet selectorText works', () => {
  const sheet = parse('div { color: red }') as unknown as { cssRules: { selectorText: string }[] };
  assert.equal(sheet.cssRules[0].selectorText, 'div');
});
