/**
 * Reproducer for CRS-0036/C15 (src/PropertyRegistry.ts matchesSyntax
 * <color> arm). The named-color membership test is `val in NAMED_COLORS`
 * (line 230) on a prototype-bearing object literal. CSS identifiers whose
 * lowercased form collides with an Object.prototype key - 'constructor',
 * '__proto__' - pass the membership test, so matchesSyntax treats them as
 * <color> and registerProperty accepts them as initial values.
 * css-properties-values-api #register-a-custom-property step 4 must parse
 * initialValue against the syntax definition and throw SyntaxError.
 *
 * Asserts the SAFE contract: prototype keys are not colors, so the
 * registration throws SyntaxError.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-V5GA
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry, matchesSyntax } from '../../src/PropertyRegistry.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';

function componentValues(css: string) {
  const tokens = tokenize(css).filter((t) => t.type !== 'EOF' && t.type !== 'whitespace');
  return new Parser(tokens).parseComponentValues();
}

test('CRS-0036/C15: matchesSyntax does not accept the ident "constructor" as <color>', () => {
  assert.equal(matchesSyntax(componentValues('constructor'), '<color>'), false);
});

test('CRS-0036/C15: matchesSyntax does not accept the ident "__proto__" as <color>', () => {
  assert.equal(matchesSyntax(componentValues('__proto__'), '<color>'), false);
});

test('CRS-0036/C15: registerProperty rejects initialValue "constructor" for syntax "<color>"', () => {
  PropertyRegistry.clear();
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0036c15a', inherits: false, syntax: '<color>', initialValue: 'constructor' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
  );
});

test('control: real named colors still match and register', () => {
  assert.equal(matchesSyntax(componentValues('red'), '<color>'), true);
  PropertyRegistry.clear();
  assert.doesNotThrow(() =>
    PropertyRegistry.register({ name: '--crs0036c15ctl', inherits: false, syntax: '<color>', initialValue: 'red' }),
  );
});
