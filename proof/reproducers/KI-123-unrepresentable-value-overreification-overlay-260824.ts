/**
 * Overlay reproducer for KI-123.  This file intentionally stays red until
 * StylePropertyMap.get() reifies values of base-only properties (whose
 * css-typed-om-1 normalization row ends in "reify as a CSSStyleValue") as a
 * DIRECT CSSStyleValue instead of a subclass instance.
 *
 * Reproduces: KI-123
 * Verifies: SYS-REQ-260824-XE59
 *
 * Spec anchors:
 * - css-typed-om-1 #reify-stylevalue "Property-specific Rules" (#reify-property,
 *   ~line 3619): "The following list defines the [=reification=] behavior for
 *   every single property in CSS, for both specified and computed values."
 * - #reify-property 'color' row (~line 4105): "For both specified and computed
 *   values: 1. If the value is <css>currentcolor</css>, reify an identifier...
 *   2. Otherwise, reify as a {{CSSStyleValue}} and return the result."
 *   The 'border-top-color' row (~line 4013) is identical apart from
 *   currentcolor. ('<color>'s are not supported in Level 1' — color.html
 *   comment; same for border-top-color.)
 * - #reify-failure "Unrepresentable Values" (~line 5290) +
 *   #reify-as-a-cssstylevalue (~line 5307): such values are "reified as a
 *   CSSStyleValue" — "a new CSSStyleValue object ... whose [[associatedProperty]]
 *   internal slot is set to |property|".
 * - Local WPT fixture css/css-typed-om/the-stylepropertymap/properties/
 *   color.html runUnsupportedPropertyTests('color', ['red', '#bbff00',
 *   'rgb(255, 255, 128)', 'hsl(50, 33%, 25%)', 'transparent']) via
 *   testUnsupportedValue: "Unsupported value must be a CSSStyleValue and not
 *   one of its subclasses". The wpt-sandbox baseline carries 204 such rows
 *   across the typed-om property fixtures.
 *
 * Root-dedup notes:
 * - vs KI-117 (grammar-invalid relative colors dropped by declaration-block
 *   parsing): KI-117 pins block-parse DROP semantics; here every probed value
 *   is grammar-VALID — the defect is the reified TYPE on get().
 * - vs KI-122 (limited-range CSSMathSum wrap on set): different algorithm
 *   (#create-an-internal-representation range clause) and different observable
 *   (wrap shape vs base-class identity).
 *
 * Observed defect at HEAD via public API:
 *   map.get('color') after 'color: red' -> CSSKeywordValue instance
 *   map.get('color') after 'color: #bbff00' -> CSSRGB instance
 * Spec requires a direct CSSStyleValue with [[associatedProperty]] = 'color'.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSKeywordValue } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Verifies: SYS-REQ-260824-XE59 (KI-123 reproducer helper: StylePropertyMap probe)
// Positive control (green today): the currentcolor keyword reifies as an
// identifier per the 'color' row step 1 (CSSKeywordValue is correct here).
// Verifies: SYS-REQ-260824-XE59 (currentcolor identifier-reification control)
describe('KI-123 control', () => {
  test('currentcolor reifies as an identifier (CSSKeywordValue)', () => {
    const v = mapFor('color: currentcolor').get('color');
    assert.ok(v instanceof CSSKeywordValue, `currentcolor must stay identifier-reified; got ${v?.constructor?.name}`);
    assert.equal(v!.value, 'currentcolor');
  });
});

// Reproduces: KI-123
// Verifies: SYS-REQ-260824-XE59 (base-only reification defect legs)
describe('KI-123: unrepresentable <color> values must reify as a direct CSSStyleValue', () => {
  // WPT color.html runUnsupportedPropertyTests rows.
  // Verifies: SYS-REQ-260824-XE59 (WPT color.html unsupported-value rows).
  const UNSUPPORTED_COLORS = [
    ['red', 'keyword color'],
    ['#bbff00', 'hex color'],
    ['rgb(255, 255, 128)', 'rgb() color'],
    ['transparent', 'transparent keyword'],
  ] as const;

  for (const [value, kind] of UNSUPPORTED_COLORS) {
    test(`get('color') after 'color: ${value}' is a direct CSSStyleValue (${kind})`, () => {
      const v = mapFor(`color: ${value}`).get('color');
      assert.ok(v !== undefined, 'value must be present');
      assert.equal(v!.constructor.name, 'CSSStyleValue',
        `css-typed-om-1 #reify-property 'color' row step 2 requires direct CSSStyleValue; got ${v!.constructor.name}`);
      assert.equal(v!.toString(), /red/.test(value) ? 'red' : value);
    });
  }

  // Same normalization rule family for border-top-color.
  test("get('border-top-color') after 'border-top-color: red' is a direct CSSStyleValue", () => {
    const v = mapFor('border-top-color: red').get('border-top-color');
    assert.equal(v!.constructor.name, 'CSSStyleValue',
      `css-typed-om-1 #reify-property 'border-top-color' row step 2 requires direct CSSStyleValue; got ${v!.constructor.name}`);
  });

  // The [[associatedProperty]] slot must name the property it came from
  // (#reify-as-a-cssstylevalue step 1).
  // INVARIANT PIN (green today): already satisfied via the value factory;
  // must REMAIN true once reification switches to direct CSSStyleValue, so
  // the fix cannot drop the slot.
  test('the reified base value keeps [[associatedProperty]] = color', () => {
    const v = mapFor('color: red').get('color');
    assert.equal((v as unknown as { _associatedProperty?: string })._associatedProperty, 'color');
  });
});
