/**
 * Overlay reproducer for KI-102.
 *
 * Reproduces: KI-102
 * Verifies: SYS-REQ-260822-XEPS
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSCounterStyleRule } from '../../src/CSSOM.ts';

// Reproduces: KI-102
test('KI-102: a valid CSSCounterStyleRule descriptor setter updates cssText', () => {
  // css-counter-styles-3 § 8.1 #the-csscounterstylerule-interface and
  // #counter-style-prefix: a valid setter replaces the associated descriptor.
  // cssom-1 § 6.3 #serialize-a-css-rule and #dom-cssrule-csstext: CSSRule.cssText
  // serializes the current associated rule state.
  const sheet = parse('@counter-style tally { system: cyclic; symbols: "*" "†"; }');
  const rule = sheet.cssRules[0] as CSSCounterStyleRule;
  rule.prefix = '"("';
  assert.equal(rule.prefix, '"("', 'valid prefix setter must update the descriptor getter');
  assert.equal(rule.cssText.includes('prefix: "(";'), true,
    'serialization must include the valid descriptor set through the CSSOM');
});
