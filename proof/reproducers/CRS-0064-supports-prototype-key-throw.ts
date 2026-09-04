/**
 * Reproducer for CRS-0064/C03 and CRS-0064/C04 (src/parser-api.ts
 * evaluateSupportsDeclaration). SHORTHANDS and STANDARD_PROPERTIES_SYNTAX are
 * plain objects with Object.prototype, so the bracket lookups in
 * evaluateSupportsDeclaration resolve inherited members for property names
 * like "constructor" and "__proto__". `SHORTHANDS[prop] !== undefined` then
 * reports the property as supported, and the shorthand arm calls
 * `shorthand.expand(...)` on the inherited Object value, which has no expand
 * method. CSS.supports therefore throws a raw TypeError instead of returning
 * false. css-conditional-3 #dom-css-conditions-supports and SYS-REQ-260821-SMW6
 * require supports to return a boolean and never throw.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { supports } from '../../src/parser-api.ts';

test('CRS-0064/C03: supports("constructor", "foo") returns false instead of throwing', () => {
  assert.equal(supports('constructor', 'foo'), false);
});

test('CRS-0064/C03: supports("__proto__", "x") returns false instead of throwing', () => {
  assert.equal(supports('__proto__', 'x'), false);
});

test('CRS-0064/C04: supports never leaks an evaluation exception to the caller', () => {
  let leaked: unknown = null;
  try {
    supports('constructor', 'red');
  } catch (e) {
    leaked = e;
  }
  assert.equal(leaked, null, 'SYS-REQ-260821-SMW6: supports must return a boolean and must not throw');
});

test('control: a real shorthand still evaluates and a real longhand still parses', () => {
  assert.equal(supports('color', 'red'), true);
  assert.equal(supports('border', '1px solid red'), true);
  assert.equal(supports('color', 'not-a-color-with-a-name-this-long'), false);
});
