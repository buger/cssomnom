/**
 * Reproducer for CRS-0031/C13 (setProperty null value handling).
 *
 * cssom-1 types CSSStyleDeclaration.setProperty's value as CSSOMString.
 * WebIDL DOMString conversion turns null into the string "null" before the
 * algorithm runs, so cssom-1 #dom-cssstyledeclaration-setproperty step 3
 * ("if value is the empty string, remove") never fires for null: the value
 * "null" is parsed as a normal value. The implementation compares
 * value === null and removes the declaration instead.
 *
 * Asserts the SAFE contract: setProperty('font-family', null) sets the
 * value "null" (a valid custom family ident); it must not delete the
 * existing declaration.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: WebIDL DOMString conversion + cssom-1 #dom-cssstyledeclaration-setproperty
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts'; // injects ParseHooks before CSSStyleDeclaration runs
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0031/C13: setProperty null value converts to the string "null"', () => {
  const decl = new CSSStyleDeclaration([{ type: 'declaration', name: 'color', value: [{ type: 'ident', value: 'red' }], important: false }]);
  decl.setProperty('font-family', 'serif');
  assert.equal(decl.getPropertyValue('font-family'), 'serif');

  decl.setProperty('font-family', null as unknown as string);
  // WebIDL: null -> "null"; "null" is a valid <custom-ident> family name.
  assert.equal(decl.getPropertyValue('font-family'), 'null', 'null CSSOMString-converts to "null", not to removal');
  assert.ok(decl.cssText.includes('font-family'), 'the declaration must not be silently deleted');
});
