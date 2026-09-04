/**
 * Reproducer for CRS-0008/C05, CRS-0008/C06, CRS-0008/C07 (requirement
 * INT-REQ-260821-WQX9, src/typed-om/style-map/StylePropertyMap.ts).
 *
 * StylePropertyMap detects var() with substring tests on serialized text
 * instead of token-level detection. css-typed-om-1 #dom-stylepropertymap-append
 * step 5 throws TypeError only when a value in the argument list IS a
 * CSSUnparsedValue or CSSVariableReferenceValue object; a string argument
 * goes through #create-an-internal-representation ("Parse a CSSStyleValue")
 * which parses against the property grammar. Step 7 throws only when the
 * stored entry contains an actual var() reference. The set() algorithm has
 * no pending-substitution throw at all in css-typed-om-1.
 *
 * A quoted string such as "var(foo)" is a valid font-family value whose
 * characters spell v-a-r-( inside a <string> token; it is not a var()
 * reference. The substring tests reject it with a spec-absent TypeError:
 *   - append() rejects the incoming string value (src line 155),
 *   - append() rejects the stored value (line 175),
 *   - set()/append()/delete() reject a longhand when the serialized
 *     shorthand merely contains the characters (line 59, _checkPendingSubstitution).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import type { CSSStyleRule } from '../../src/CSSOM.ts';

// Reproduces: pending KI (CRS-0008/C05)
test('CRS-0008/C05: append accepts a string value containing "var(" inside quotes', () => {
  const sheet = parse('div { font-family: serif; }');
  const rule = sheet.cssRules[0] as CSSStyleRule;
  // css-typed-om-1 append step 5: only CSSUnparsedValue/CSSVariableReferenceValue
  // OBJECTS throw. "var(foo)" is a quoted <string>, a valid font-family item.
  rule.styleMap.append('font-family', '"var(foo)"');
  const joined = rule.style.getPropertyValue('font-family');
  assert.ok(joined.includes('var(foo)'), `family must contain the quoted item, got ${JSON.stringify(joined)}`);
});

// Reproduces: pending KI (CRS-0008/C06)
test('CRS-0008/C06: append works when the stored value contains "var(" inside a string token', () => {
  const sheet = parse('div { font-family: "var(bar)"; }');
  const rule = sheet.cssRules[0] as CSSStyleRule;
  // css-typed-om-1 append step 7: throw only if the stored value CONTAINS a
  // var() reference. A <string> token is not a var() reference.
  rule.styleMap.append('font-family', 'serif');
  const joined = rule.style.getPropertyValue('font-family');
  assert.ok(joined.includes('serif'), `family must gain the appended item, got ${JSON.stringify(joined)}`);
});

// Reproduces: pending KI (CRS-0008/C07)
test('CRS-0008/C07: set() on a longhand does not throw when the shorthand value is a quoted string', () => {
  const sheet = parse('div { margin: 1px; }');
  const rule = sheet.cssRules[0] as CSSStyleRule;
  // "var(x)" as the margin value is a <string> token (kept by the declared
  // declaration). set('margin-top') has no pending-substitution throw step in
  // css-typed-om-1 #dom-stylepropertymap-set; the substring guard fires anyway.
  rule.style.setProperty('margin', '"var(x)"');
  rule.styleMap.set('margin-top', '2px');
  assert.equal(rule.style.getPropertyValue('margin-top'), '2px', 'the longhand set must apply');
});
