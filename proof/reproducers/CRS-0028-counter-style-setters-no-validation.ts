/**
 * Reproducer for CRS-0028/C14 and CRS-0028/C15 (src/CSSOM.ts
 * CSSCounterStyleRule descriptor and name setters).
 * css-counter-styles-3 #cssom requires the name setter to do nothing for
 * 'none' (step 1) and every descriptor setter to parse the value and do
 * nothing when it fails the descriptor grammar. The setters assign the raw
 * string, so rule.system = 'not-a-system-keyword' and rule.name = 'none'
 * stick and re-serialize into invalid @counter-style text.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

type CounterRule = { system: string; name: string; cssText: string };

function rule(): CounterRule {
  return (parse('@counter-style cs { system: cyclic; symbols: a; }') as CSSStyleSheet).cssRules[0] as unknown as CounterRule;
}

test('control: the parsed rule reports its descriptors', () => {
  const r = rule();
  assert.equal(r.system, 'cyclic');
  assert.equal(r.name, 'cs');
});

test('CRS-0028/C14: a grammar-invalid system value is ignored', () => {
  const r = rule();
  r.system = 'not-a-system-keyword';
  assert.equal(r.system, 'cyclic', 'css-counter-styles-3 #cssom: invalid descriptor values do nothing');
  assert.equal(r.cssText.includes('not-a-system-keyword'), false);
});

test('CRS-0028/C14: a numeric system value is ignored', () => {
  const r = rule();
  r.system = '123';
  assert.equal(r.system, 'cyclic');
});

test('CRS-0028/C15: the reserved name "none" is ignored', () => {
  const r = rule();
  r.name = 'none';
  assert.equal(r.name, 'cs', 'css-counter-styles-3 #cssom name setter step 1 does nothing for none');
});

test('CRS-0028/C15: an empty name is ignored', () => {
  const r = rule();
  r.name = '';
  assert.equal(r.name, 'cs');
});
