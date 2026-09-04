/**
 * Reproducer for CRS-0031/C16 (deleteRule unregisters @property unconditionally).
 *
 * css-properties-values-api #determining-registration: when several valid
 * @property rules register the same name, "the last one in stylesheet
 * order wins". Deleting one of those rules must leave the registration
 * that the surviving rules define. CSSStyleSheet.deleteRule instead calls
 * PropertyRegistry.unregister(rule.name, 'css') for every deleted
 * CSSPropertyRule, so deleting the winning rule drops the registration
 * while an earlier valid @property rule for the same name remains in
 * cssRules.
 *
 * Asserts the SAFE contract: after deleting the last duplicate, the
 * surviving @property rule still owns the registration.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: css-properties-values-api #determining-registration
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0031/C16: deleting the winning @property keeps the earlier registration', () => {
  PropertyRegistry.clear();
  const sheet = parse(
    '@property --x { syntax: "<length>"; inherits: false; initial-value: 1px; } ' +
    '@property --x { syntax: "<color>"; inherits: true; initial-value: red; }'
  );
  assert.equal(sheet.cssRules.length, 2);
  assert.equal(PropertyRegistry.get('--x')?.syntax, '<color>', 'last valid @property wins initially');

  sheet.deleteRule(1);
  assert.equal(sheet.cssRules.length, 1, 'the earlier @property rule survives');
  const reg = PropertyRegistry.get('--x');
  assert.ok(reg, 'the surviving valid @property rule must keep the name registered');
  assert.equal(reg.syntax, '<length>', 'registration falls back to the surviving rule');
});
