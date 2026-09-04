/**
 * Reproducer for CRS-0050/C08 (src/parser.ts Parser.isSupportedAtRule +
 * handleMarginRule). css-page-3 #at-page-rule only allows margin at-rules
 * inside @page ("The @page rule can only contain page properties and margin
 * at-rules" / margin at-rule placement note). Outside @page, '@top-left' is
 * an unknown at-rule and must survive as a generic at-rule, never as a
 * CSSMarginRule. isSupportedAtRule returns true for MARGIN_RULE_NAMES before
 * any parent-context check, so a top-level '@top-left {}' fabricates a
 * CSSMarginRule and a nested one attaches to a style rule.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

const ctor = (r: unknown) => (r as { constructor: { name: string } }).constructor.name;
const children = (r: unknown): unknown[] => Array.from((r as { cssRules?: Iterable<unknown> }).cssRules ?? []);

test('CRS-0050/C08: a top-level @top-left is not a CSSMarginRule', () => {
  const rules = parseStyleSheet('@top-left { color: red }');
  assert.equal(rules.length, 1, 'the at-rule survives');
  assert.notEqual(ctor(rules[0]), 'CSSMarginRule', 'margin at-rules exist only inside @page');
});

test('CRS-0050/C08: a @top-left nested in a style rule is not a CSSMarginRule', () => {
  const rules = parseStyleSheet('div { @top-left { color: red } }');
  const nested = children(rules[0]);
  assert.ok(nested.every(r => ctor(r) !== 'CSSMarginRule'), 'margin at-rules exist only inside @page');
});

test('control: @top-left inside @page stays a CSSMarginRule', () => {
  const rules = parseStyleSheet('@page { @top-left { color: red } }');
  const nested = children(rules[0]);
  assert.equal(nested.length, 1);
  assert.equal(ctor(nested[0]), 'CSSMarginRule');
});
