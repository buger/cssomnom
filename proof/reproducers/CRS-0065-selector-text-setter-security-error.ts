/**
 * Reproducer for CRS-0065/C11 (src/CSSOM.ts CSSStyleRule selectorText setter).
 * The setter iterates `sheet.cssRules`, the public getter that throws
 * SecurityError when the sheet is not origin-clean, so assigning selectorText on
 * a rule of a sheet built with CSSStyleSheet.createInternal(rules, parse, false)
 * aborts before the selector parses. cssom-1 #dom-cssstylerule-selectortext
 * defines the setter as a selector re-parse with no SecurityError step; the
 * origin-clean gate belongs to CSSStyleSheet.cssRules only. The getter half of
 * the same leak is KI-222.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

function taintedRule() {
  const clean = parse('div { color: red }') as unknown as {
    cssRules: { selectorText: string }[];
  };
  const rule = clean.cssRules[0];
  const tainted = CSSStyleSheet.createInternal(
    [rule],
    () => null as unknown as ReturnType<typeof parse>['cssRules'][number],
    false
  );
  assert.ok(tainted, 'tainted sheet constructed');
  return rule;
}

test('CRS-0065/C11: assigning selectorText on a non-origin-clean sheet does not throw', () => {
  const rule = taintedRule();
  assert.doesNotThrow(() => {
    rule.selectorText = 'span';
  }, 'cssom-1 selectorText setter has no SecurityError step');
});

test('control: the tainted sheet cssRules getter still throws SecurityError', () => {
  const clean = parse('div { color: red }') as unknown as { cssRules: unknown[] };
  const tainted = CSSStyleSheet.createInternal([clean.cssRules[0]], () => null as unknown, false);
  assert.throws(() => (tainted as unknown as { cssRules: unknown[] }).cssRules.length, /SecurityError|origin-clean/);
});

test('control: the setter re-parses on an origin-clean sheet', () => {
  const sheet = parse('div { color: red }') as unknown as {
    cssRules: { selectorText: string }[];
  };
  const rule = sheet.cssRules[0];
  rule.selectorText = 'span';
  assert.equal(rule.selectorText, 'span');
});
