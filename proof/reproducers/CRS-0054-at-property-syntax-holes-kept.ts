/**
 * Reproducer for CRS-0054/C01, C02, C03, C04, C05, C17 (src/PropertyRegistry.ts
 * parseSyntax/consumeSyntaxComponent reached through src/parser.ts
 * handlePropertyRule). css-properties-values-api #consume-a-syntax-definition
 * fails a syntax string whose grammar is out of set, so #at-property-rule
 * treats the syntax descriptor as invalid and the whole @property rule is
 * dropped from the stylesheet (WPT at-property.html expects no CSSPropertyRule
 * for invalid descriptor values). consumeSyntaxComponent accepts the '?'
 * and '*' multipliers, any '{...}' run rewritten to '+', a multiplier after
 * whitespace, a trailing '|' combinator, and the unsupported <flex> name,
 * so PropertyRegistry.validate passes and the bad rules stay in cssRules.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

const ruleCount = (css: string): number => {
  const sheet = parse(css) as unknown as { cssRules: unknown[] };
  return sheet.cssRules.length;
};

test('CRS-0054/C01: @property with the "?" multiplier is dropped', () => {
  assert.equal(
    ruleCount('@property --crs0054c01 { syntax: "<length>?"; inherits: false; initial-value: 0px; }'),
    0,
    "'?' is not in the {+,#} multiplier grammar, so the rule must not survive ingest",
  );
});

test('CRS-0054/C02: @property with the "{2}" brace multiplier is dropped', () => {
  assert.equal(
    ruleCount('@property --crs0054c02 { syntax: "<length>{2}"; inherits: false; initial-value: 0px 1px; }'),
    0,
    'brace repetition is absent from the syntax-string grammar',
  );
});

test('CRS-0054/C03: @property with a whitespace-separated multiplier is dropped', () => {
  assert.equal(
    ruleCount('@property --crs0054c03 { syntax: "<length> +"; inherits: false; initial-value: 0px; }'),
    0,
    'the multiplier must follow the component name immediately',
  );
});

test('CRS-0054/C04: @property with a trailing "|" combinator is dropped', () => {
  assert.equal(
    ruleCount('@property --crs0054c04 { syntax: "<length> |"; inherits: false; initial-value: 0px; }'),
    0,
    'consume-a-syntax-definition requires a component after every "|"',
  );
});

test('CRS-0054/C05: @property with the unsupported <flex> syntax is dropped', () => {
  assert.equal(
    ruleCount('@property --crs0054c05 { syntax: "<flex>"; inherits: false; initial-value: calc(0); }'),
    0,
    '<flex> is not in the #supported-names list',
  );
});

test('CRS-0054/C17: a later valid inherits descriptor does not rescue a bad syntax string', () => {
  assert.equal(
    ruleCount('@property --crs0054c17 { syntax: "<length>?"; inherits: nope; inherits: false; initial-value: 0px; }'),
    0,
    'last-valid-wins on inherits cannot keep a rule whose syntax descriptor is invalid',
  );
});

test('control: in-grammar syntax strings keep the rule', () => {
  assert.equal(ruleCount('@property --crs0054ctl { syntax: "<length>+"; inherits: false; initial-value: 0px; }'), 1);
  assert.equal(ruleCount('@property --crs0054ctl2 { syntax: "<length>#"; inherits: false; initial-value: 0px, 1px; }'), 1);
});
