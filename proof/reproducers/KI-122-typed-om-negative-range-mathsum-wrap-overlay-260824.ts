/**
 * Overlay reproducer for KI-122.  This file intentionally stays red until
 * StylePropertyMap.set() wraps out-of-range negative CSSUnitValues in a fresh
 * CSSMathSum instead of storing them as bare unit values.
 *
 * Reproduces: KI-122
 * Verifies: SYS-REQ-260824-QGJE
 *
 * Spec anchors:
 * - css-typed-om-1 #create-an-internal-representation (~line 680),
 *   CSSStyleValue-subclass branch: "If any component of |property|'s CSS
 *   grammar has a limited numeric range, and the corresponding part of |value|
 *   is a {{CSSUnitValue}} that is outside of that range, replace that value
 *   with the result of wrapping it in a fresh {{CSSMathSum}} whose
 *   {{CSSMathSum/values}} internal slot contains only that part of |value|."
 * - css-typed-om-1 #reify-stylevalue "Property-specific Rules" (#reify-property,
 *   ~line 3619): "The following list defines the reification behavior for every
 *   single property in CSS" — reification reflects the stored internal
 *   representation, so a wrapped Sum comes back through get()/getAll().
 * - Limited ranges of the probed grammars:
 *     flex-grow            <number [0,∞]>          (css-flexbox-1 § flex-grow)
 *     border-top-left-radius <length-percentage [0,∞]>{1,2}  (css-backgrounds-3 § corner-radius)
 * - Local WPT fixture css/css-typed-om/the-stylepropertymap/properties/
 *   testsuite.js assert_is_equal_with_range_handling (~line 18): "Invalid
 *   (out-of-range) numeric values must be wrapped in a CSSMathSum" — applied by
 *   42 property fixtures; the wpt-sandbox known-failure baseline carries 150
 *   such rows ("expected CSSMathSum but got CSSUnitValue").
 *
 * Root-dedup notes:
 * - vs KI-39 (degenerate single-child Sum serialization structure drift): this
 *   KI pins ONLY the presence of the range wrap on the get() shape after a
 *   typed set(); it never asserts calc() serialization text.
 * - vs KI-111 (registered-syntax matcher initial values): different surface
 *   (CSS.registerProperty initial validation vs StylePropertyMap.set storage).
 *
 * Observed defect at HEAD via public API:
 *   map.set('flex-grow', new CSSUnitValue(-3.14, 'number'))
 *   map.get('flex-grow').constructor.name === 'CSSUnitValue'   // bare, unwrapped
 * Spec requires a fresh CSSMathSum wrapping exactly that unit value.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSUnitValue, CSSMathSum } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Verifies: SYS-REQ-260824-QGJE (KI-122 reproducer helper: StylePropertyMap probe)
// Positive control (green today): in-range values are stored as-is and come
// back as the same kind of value, per css-typed-om-1 #create-an-internal-
// representation (no limited-range violation => no wrapping).
// Verifies: SYS-REQ-260824-QGJE (in-range no-wrap controls)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-122 control', () => {
  test('in-range flex-grow stays a bare CSSUnitValue', () => {
    const map = mapFor('');
    map.set('flex-grow', new CSSUnitValue(3, 'number'));
    const v = map.get('flex-grow');
    assert.ok(v instanceof CSSUnitValue, `expected bare CSSUnitValue, got ${v?.constructor?.name}`);
    assert.equal((v as CSSUnitValue).value, 3);
  });

  test('in-range border-top-left-radius stays a bare CSSUnitValue', () => {
    const map = mapFor('');
    map.set('border-top-left-radius', new CSSUnitValue(0, 'px'));
    const v = map.get('border-top-left-radius');
    assert.ok(v instanceof CSSUnitValue, `expected bare CSSUnitValue, got ${v?.constructor?.name}`);
  });
});

// Reproduces: KI-122
// Verifies: SYS-REQ-260824-QGJE (out-of-range CSSMathSum wrap legs)
describe('KI-122: out-of-range negative unit values must be wrapped in a fresh CSSMathSum', () => {
  // css-flexbox-1 flex-grow: <number [0,∞]> — -3.14 is outside the range.
  // Verifies: SYS-REQ-260824-QGJE (flex-grow <number [0,∞]> leg).
  test('set(flex-grow, -3.14 number) reifies as CSSMathSum wrapping the input', () => {
    const map = mapFor('');
    const input = new CSSUnitValue(-3.14, 'number');
    map.set('flex-grow', input);
    const v = map.get('flex-grow');
    assert.ok(v instanceof CSSMathSum, `out-of-range value must reify as CSSMathSum per css-typed-om-1 #create-an-internal-representation; got ${v?.constructor?.name}`);
    assert.equal(v!.length, 1, 'fresh CSSMathSum wraps exactly one value');
    assert.deepEqual([...(v as unknown as { values: CSSUnitValue[] }).values].map(u => [u.value, u.unit]), [[-3.14, 'number']]);
  });

  // css-backgrounds-3 corner radii are non-negative lengths/percentages.
  test('set(border-top-left-radius, -3.14em) reifies as CSSMathSum wrapping the input', () => {
    const map = mapFor('');
    const input = new CSSUnitValue(-3.14, 'em');
    map.set('border-top-left-radius', input);
    const v = map.get('border-top-left-radius');
    assert.ok(v instanceof CSSMathSum, `out-of-range radius must reify as CSSMathSum per css-typed-om-1 #create-an-internal-representation; got ${v?.constructor?.name}`);
    assert.equal(v!.length, 1);
    assert.deepEqual([...(v as unknown as { values: CSSUnitValue[] }).values].map(u => [u.value, u.unit]), [[-3.14, 'em']]);
  });

  // getAll() exposes the same internal representation (multi-map view).
  test('getAll(flex-grow) carries the wrapped representation too', () => {
    const map = mapFor('');
    map.set('flex-grow', new CSSUnitValue(-1, 'number'));
    const all = map.getAll('flex-grow');
    assert.equal(all.length, 1);
    assert.ok(all[0] instanceof CSSMathSum, `expected CSSMathSum in getAll, got ${all[0]?.constructor?.name}`);
  });
});
