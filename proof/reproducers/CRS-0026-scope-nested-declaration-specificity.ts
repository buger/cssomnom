/**
 * Reproducer for CRS-0026/C20 (src/cascade/rule-filter.ts
 * collectMatchedDeclarations walkRules CSSNestedDeclarations arm).
 * css-cascade-5 #cascade-sort sorts declarations by the specificity of their
 * originating selector. walkRules threads scopeNode from any ancestor @scope
 * into every descendant and zeros CSSNestedDeclarations specificity whenever
 * scopeNode is truthy, so declarations nested after an at-rule inside a
 * scoped style rule lose as if wrapped in :where(). The same nested
 * declaration without @scope keeps its .foo specificity and wins.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

function colorOf(css: string): string {
  const rules = parseStyleSheet(css);
  const doc = parseHTML('<html><body><div id="t" class="foo"><p>x</p></div></body></html>').document;
  const el = doc.getElementById('t');
  return getCascadedStyle(el, rules).getPropertyValue('color');
}

test('CRS-0026/C20: nested declarations inside @scope keep selector specificity', () => {
  const out = colorOf('@scope (div) { .foo { @media screen { } color: red; } } div { color: blue; }');
  assert.equal(out, 'rgb(255, 0, 0)', '.foo (0,1,0) must beat div (0,0,1) inside @scope');
});

test('control: the same nesting without @scope wins', () => {
  const out = colorOf('.foo { @media screen { } color: red; } div { color: blue; }');
  assert.equal(out, 'rgb(255, 0, 0)');
});

test('control: a scoped style rule without nesting still maps specificity', () => {
  const out = colorOf('@scope (div) { .foo { color: red; } } div { color: blue; }');
  assert.equal(out, 'rgb(255, 0, 0)');
});
