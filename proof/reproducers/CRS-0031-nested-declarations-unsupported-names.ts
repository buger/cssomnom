/**
 * Reproducer for CRS-0031/C17 (nested-declarations insertRule retains
 * unsupported property names).
 *
 * cssom-1 #insert-a-css-rule parses the input as one CSS rule; CSS error
 * recovery (CSS 2.1 §4.2 "unknown properties: user agents must ignore a
 * declaration with an unknown property") drops declarations whose property
 * name is not supported. The codebase itself follows this in the cssText
 * setter (_isPropertySupported filter). CSSGroupingRule.insertRule filters
 * parsedRule.style.declarations only to decide whether to throw; when at
 * least one declaration is supported, unsupported names stay on the
 * inserted CSSNestedDeclarations and re-serialize into the sheet.
 *
 * Asserts the SAFE contract: an inserted nested-declarations rule carries
 * only supported property names.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: cssom-1 #insert-a-css-rule + CSS 2.1 §4.2 error recovery
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0031/C17: inserted CSSNestedDeclarations drop unsupported property names', () => {
  const sheet = parse('.x { color: red; .y { color: blue } }');
  const styleRule = sheet.cssRules[0];
  styleRule.insertRule('color: green; not-a-prop: 1', 1);

  const inserted = styleRule.cssRules[1] as unknown as { cssText: string };
  assert.ok(inserted, 'a nested-declarations rule is inserted');
  assert.equal(
    inserted.cssText,
    'color: green;',
    'unsupported property names must be ignored, leaving only color: green'
  );
});
