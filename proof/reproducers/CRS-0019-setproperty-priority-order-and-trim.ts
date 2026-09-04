/**
 * Reproducer for CRS-0019/C01 and CRS-0019/C02 (src/CSSStyleDeclaration.ts
 * setProperty). cssom-1 #dom-cssstyledeclaration-setproperty runs the
 * empty-value removal (step "If value is the empty string, invoke
 * removeProperty() ... and return") BEFORE the priority gate ("If priority is
 * not the empty string and is not an ASCII case-insensitive match for
 * important, then return"). The implementation checks priority first, so a
 * bogus priority blocks the removal. The implementation also trims the
 * priority string; the spec compares the raw string, so " important " must
 * fail the ASCII case-insensitive match and leave the property unprioritized.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts'; // side-effect: injects ParseHooks used by setProperty
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0019/C01: empty value removes the property even with an invalid priority', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('color', 'red', 'important');
  assert.equal(decl.getPropertyValue('color'), 'red');
  decl.setProperty('color', '', 'bogus');
  assert.equal(
    decl.getPropertyValue('color'),
    '',
    'cssom-1 setProperty: the empty-value removal runs before the priority gate'
  );
});

test('CRS-0019/C02: padded priority " important " is not an ASCII case-insensitive match', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('color', 'blue', ' important ');
  assert.equal(
    decl.getPropertyPriority('color'),
    '',
    'cssom-1 compares the raw priority string: " important " must not register as important'
  );
  assert.ok(
    !decl.cssText.includes('!important'),
    'cssText must not synthesize !important from a padded priority'
  );
});

test('control: exact "important" priority still applies', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('color', 'blue', 'IMPORTANT');
  assert.equal(decl.getPropertyPriority('color'), 'important');
});
