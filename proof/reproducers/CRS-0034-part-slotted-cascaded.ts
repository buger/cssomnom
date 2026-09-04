/**
 * Reproducer for CRS-0034/C01 (src/cascade/index.ts getCascadedStyle).
 *
 * cssom-1 #dom-window-getcomputedstyle step 3.2: "If type is failure, or is
 * a ::slotted() or ::part() pseudo-element, let obj be null." obj null plus
 * step 5's connectedness gate leaves decls empty, so the computed style of
 * ::part()/::slotted() is empty. normalizePseudoElement lists 'part' and
 * 'slotted' in KNOWN_FUNCTIONAL_PSEUDO_ELEMENTS, the isKnown guard passes,
 * and collectMatchedDeclarations cascades rules addressed to ::part()/::
 * slotted() into the returned style. Asserts the spec outcome so this
 * command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const doc = parseHTML('<html><body><div id="host"></div></body></html>').document;
const host = doc.getElementById('host')!;

test('CRS-0034/C01: ::part(foo) computed style stays empty', () => {
  const rules = parse('div::part(foo) { color: red; padding-top: 1px; margin-left: 2px; }').cssRules as never;
  const style = getCascadedStyle(host, rules, '::part(foo)');
  assert.equal(style.length, 0, '::part() must resolve to obj null, so no declarations are collected');
  assert.notEqual(style.getPropertyValue('color'), 'rgb(255, 0, 0)');
});

test('CRS-0034/C01: ::slotted(span) computed style stays empty', () => {
  const rules = parse('div::slotted(span) { color: red; }').cssRules as never;
  const style = getCascadedStyle(host, rules, '::slotted(span)');
  assert.equal(style.length, 0, '::slotted() must resolve to obj null, so no declarations are collected');
  assert.notEqual(style.getPropertyValue('color'), 'rgb(255, 0, 0)');
});

test('control: an unknown pseudo-element is already empty', () => {
  const rules = parse('div::part(foo) { color: red; }').cssRules as never;
  const style = getCascadedStyle(host, rules, '::notapseudo');
  assert.equal(style.length, 0);
  assert.notEqual(style.getPropertyValue('color'), 'rgb(255, 0, 0)');
});
