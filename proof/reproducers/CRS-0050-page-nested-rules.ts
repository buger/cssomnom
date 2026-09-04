/**
 * Reproducer for CRS-0050/C32 (src/parser.ts Parser.handlePageRule).
 * css-page-3 #at-page-rule constrains the @page body: "The @page rule can
 * only contain page properties and margin at-rules." A nested style rule or
 * a grouping at-rule inside @page is therefore invalid and must be dropped.
 * handlePageRule parses the block with consumeBlockContents(..., true),
 * which admits nested qualified rules and NESTED_GROUP_AT_RULES, and pushes
 * every non-first item into nestedRules unconditionally.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

const children = (r: unknown): unknown[] => Array.from((r as { cssRules?: Iterable<unknown> }).cssRules ?? []);

test('CRS-0050/C32: a nested style rule inside @page is dropped', () => {
  const rules = parseStyleSheet('@page { div { color: red } }');
  assert.equal(rules.length, 1);
  assert.equal(children(rules[0]).length, 0, '@page admits only declarations and margin at-rules');
});

test('CRS-0050/C32: a grouping at-rule inside @page is dropped', () => {
  const rules = parseStyleSheet('@page { @media all { } }');
  assert.equal(rules.length, 1);
  assert.equal(children(rules[0]).length, 0, '@page admits only declarations and margin at-rules');
});

test('control: declarations and margin at-rules stay in @page', () => {
  const rules = parseStyleSheet('@page { margin: 1cm; @top-left { color: red } }');
  assert.equal(rules.length, 1);
  assert.equal(children(rules[0]).length, 1);
});
