/**
 * Reproducer for CRS-0054/C09 (src/PropertyRegistry.ts matchesSyntax
 * reached through src/parser.ts handlePropertyRule). css-properties-values-api
 * #supported-names types the <image> component as "Any valid <<image>> value"
 * and #register-a-custom-property step 4 parses the initial value according
 * to the syntax definition. calc(1) is a math function, not an <image>, so
 * the initial-value descriptor is invalid and the @property rule must be
 * dropped at ingest. The matcher's image branch returns true for every
 * function token, so the rule survives in cssRules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0054/C09: @property <image> with a calc() initial value is dropped', () => {
  const sheet = parse('@property --crs0054c09 { syntax: "<image>"; inherits: false; initial-value: calc(1); }') as unknown as {
    cssRules: unknown[];
  };
  assert.equal(sheet.cssRules.length, 0, 'calc(1) is not an <image>, so the rule must not survive ingest');
});

test('CRS-0054/C09: @property <image> with a non-image function initial value is dropped', () => {
  const sheet = parse('@property --crs0054c09b { syntax: "<image>"; inherits: false; initial-value: rgb(0, 0, 0); }') as unknown as {
    cssRules: unknown[];
  };
  assert.equal(sheet.cssRules.length, 0, 'rgb() is a <color>, not an <image>');
});

test('control: a url() initial value keeps the <image> rule', () => {
  const sheet = parse('@property --crs0054ctl { syntax: "<image>"; inherits: false; initial-value: url(a.png); }') as unknown as {
    cssRules: unknown[];
  };
  assert.equal(sheet.cssRules.length, 1);
});
