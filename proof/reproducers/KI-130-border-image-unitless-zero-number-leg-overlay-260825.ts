/**
 * Overlay reproducer for KI-130. This file intentionally stays red until
 * border-image-outset / border-image-width preserve the <number> unit for
 * unitless zero instead of reifying it as px.
 *
 * Reproduces: KI-130
 * Verifies: SYS-REQ-260825-26NJ
 *
 * Spec anchors:
 * - css-typed-om-1 #reify-a-numeric-value steps 2-3 (~line 5450 area):
 *   step 2 maps a unitless 0 to px ONLY when the value "is a <<dimension>>";
 *   step 3 sets the unit slot to "number" when the value is a <<number>>.
 *   A bare zero in border-image-outset is a number-token match of the
 *   <number> leg, never a dimension.
 * - css-backgrounds-3 #border-image-outset: `<length> | <number>{1,4}` style
 *   grammar (length or number legs); same dual-leg shape for
 *   border-image-width. Typed inputs carry their leg explicitly, so a typed
 *   CSSUnitValue(0, 'number') round-trips with unit 'number' through
 *   #create-an-internal-representation plus reification.
 * - Local WPT properties/border-image-outset.html pins the '<number>' case
 *   with specified: assert_is_equal_with_range_handling (round-trip equality
 *   includes the unit); border-image-width.html pins the same shape.
 * - css-values-4 (#lengths) makes a bare 0 a valid <length>, which explains
 *   why pure-length properties (outline-width) legitimately reify 0 as px.
 *
 * Root-dedup notes:
 * - vs KI-122 (out-of-range values wrap in a fresh CSSMathSum): different
 *   algorithm clause and observable. KI-122 concerns range wrapping of
 *   negative magnitudes; this KI concerns the UNIT of an in-range zero on a
 *   dual length-or-number grammar. No wrap is expected here.
 * - vs KI-114 / KI-116 (border-image declaration loss / serialization
 *   fixpoint): both pin declaration-block text outcomes; this KI pins only
 *   the reified CSSUnitValue unit on typed set/get round-trips.
 *
 * Observed defect at HEAD via public API:
 *   set('border-image-outset', CSSUnitValue(0,'number')); get().unit === 'px'
 * Spec requires 'number'; non-zero numbers already round-trip correctly.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSStyleValue, CSSUnitValue } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Reproduces: KI-130
// Verifies: SYS-REQ-260825-26NJ (positive controls)
describe('KI-130 controls', () => {
  test('non-zero numbers keep unit number on outset', () => {
    const v = CSSStyleValue.parseAll('border-image-outset', '3')[0] as CSSUnitValue;
    assert.equal(v.unit, 'number', `got ${v.unit}`);
  });

  test('non-zero numbers keep unit number on width sibling', () => {
    const v = CSSStyleValue.parseAll('border-image-width', '3')[0] as CSSUnitValue;
    assert.equal(v.unit, 'number', `got ${v.unit}`);
  });

  test('typed non-zero outset round-trips as number', () => {
    const m = mapFor('');
    m.set('border-image-outset', new CSSUnitValue(3, 'number'));
    assert.equal((m.get('border-image-outset') as CSSUnitValue).unit, 'number');
  });

  test('bare zero on a pure length property legitimately reifies as px', () => {
    const v = CSSStyleValue.parseAll('outline-width', '0')[0] as CSSUnitValue;
    assert.equal(v.unit, 'px', 'css-values-4 makes bare 0 a valid <length>');
  });
});

// Reproduces: KI-130
// Verifies: SYS-REQ-260825-26NJ (zero-coercion defect legs)
describe('KI-130: unitless zero must preserve the number leg on dual grammars', () => {
  test('typed zero on border-image-outset round-trips with unit number', () => {
    const m = mapFor('');
    m.set('border-image-outset', new CSSUnitValue(0, 'number'));
    const v = m.get('border-image-outset') as CSSUnitValue;
    assert.equal(v.unit, 'number', `reify-a-numeric-value step 2 applies to dimensions only; got '${v?.unit}'`);
  });

  test('typed zero on border-image-width round-trips with unit number', () => {
    const m = mapFor('');
    m.set('border-image-width', new CSSUnitValue(0, 'number'));
    const v = m.get('border-image-width') as CSSUnitValue;
    assert.equal(v.unit, 'number', `got '${v?.unit}'`);
  });

  test('string-parsed zero keeps unit number on outset', () => {
    const v = CSSStyleValue.parseAll('border-image-outset', '0')[0] as CSSUnitValue;
    assert.equal(v.unit, 'number', `got '${v?.unit}'`);
  });
});
