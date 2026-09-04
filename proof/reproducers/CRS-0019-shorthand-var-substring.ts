/**
 * Reproducer for CRS-0019/C19 (src/CSSStyleDeclaration.ts setProperty).
 * css-variables-1 #using-variables: var() is a functional notation; the
 * characters "var(" inside a quoted <string> token are not a reference.
 * setProperty detects substitution with value.includes('var('), so
 * background: url("var(x)") takes the pending-substitution path, wipes the
 * longhands, and never stores background-image: url("var(x)").
 * Distinct from KI-185, which pins the same substring heuristic in
 * StylePropertyMap (typed-om).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts'; // side-effect: injects ParseHooks used by setProperty
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0019/C19: a quoted "var(" is not a substitution and expands the shorthand', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('background', 'url("var(x)")');
  assert.equal(
    decl.getPropertyValue('background-image'),
    'url("var(x)")',
    'css-variables-1: a string token containing var( is inert, so the shorthand expands normally'
  );
});

test('CRS-0019/C19: content longhand with quoted var( keeps its value', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('font', '16px "var(oops"');
  assert.ok(
    decl.getPropertyValue('font-size').length > 0,
    'the shorthand must expand; only a real var() reference may stay pending'
  );
});

test('control: a real var() reference stays pending', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('background', 'var(--x)');
  assert.equal(decl.getPropertyValue('background'), 'var(--x)');
});
