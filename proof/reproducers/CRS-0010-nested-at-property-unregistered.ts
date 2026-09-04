/**
 * Reproducer for CRS-0010/C18 (requirement INT-REQ-260821-ZMZR,
 * src/CSSOM.ts CSSStyleSheet.createInternal / _registerRuleProperties).
 *
 * The parser accepts @property inside group rules (isSupportedAtRule has no
 * top-level restriction for 'property'), so parse('@media all { @property
 * --x { ... } }') yields a CSSPropertyRule in the media rule's cssRules.
 * createInternal registers @property only while iterating top-level rules,
 * so the nested rule is constructed but never registered, and
 * replaceSync/deleteRule bookkeeping never tracks it either.
 * css-properties-values-api-1 #at-property-rule: "Valid @property rules
 * result in a registered custom property, as if registerProperty() had been
 * called." css-conditional group rules accept any at-rule legal at the top
 * level, so the nested rule must register exactly like a top-level one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';
import { CSSPropertyRule } from '../../src/CSSOM.ts';

// Reproduces: pending KI (CRS-0010/C18)
test('CRS-0010/C18: @property inside a group rule registers like a top-level @property', () => {
  const sheet = parse('@media all { @property --nested-qx { syntax: "*"; inherits: false; } }');
  const media = sheet.cssRules[0] as unknown as { cssRules: unknown[] };
  assert.ok(media.cssRules[0] instanceof CSSPropertyRule,
    'control: the parser constructs the nested CSSPropertyRule');
  const registered = PropertyRegistry.get('--nested-qx');
  assert.ok(registered !== null && registered !== undefined,
    'a valid @property rule the parser accepted must register (css-properties-values-api-1 #at-property-rule)');
});

// Reproduces: pending KI (CRS-0010/C18) — control: top-level registers
test('CRS-0010/C18 control: top-level @property registers', () => {
  parse('@property --toplevel-qx { syntax: "*"; inherits: false; }');
  const registered = PropertyRegistry.get('--toplevel-qx');
  assert.ok(registered !== null && registered !== undefined);
});
