/**
 * Overlay reproducer for KI-128. This file intentionally stays red until
 * declared StylePropertyMap iteration follows inline declaration order with
 * custom properties interleaved at their source positions.
 *
 * Reproduces: KI-128
 * Verifies: SYS-REQ-260825-V4ZS
 *
 * Spec anchors (two competing rules; the override governs declared maps):
 * - css-typed-om-1 default ordering rule (div before #stylevalue-subclasses,
 *   ~line 424): "Unless otherwise stated, the initial ordering of the
 *   [[declarations]] internal slot is based on the key of each entry"
 *   with standardized, vendor-prefixed, then custom properties, each group
 *   "sorted in increasing code-point order".
 * - css-typed-om-1 #declared-stylepropertymap (~line 824) states otherwise and
 *   therefore overrides it: "When constructed, the [[declarations]] internal
 *   slot for declared StylePropertyMap objects is initialized to contain an
 *   entry for each property with a valid value inside the CSSStyleRule or
 *   inline style that the object represents, in the same order as the
 *   CSSStyleRule or inline style."
 * - Local WPT declared/iterable.tentative.html pins the exact expectation:
 *   keys for '--A: A; width: 10px; --C: C; transition-duration: 1s, 2s;
 *   color: red; --B: B;' are ['--A','width','--C','transition-duration',
 *   'color','--B'].
 *
 * Root-dedup notes:
 * - vs KI-119 (repeated declarations collapse; declaration_retention): KI-119
 *   pins how many entries survive; this KI pins the traversal ORDER of the
 *   surviving entries. Different observable, different algorithm clause.
 * - An earlier audit hypothesis claimed sorted iteration is spec-mandated;
 *   that reading stops at the "Unless otherwise stated" default clause and
 *   misses the #declared-stylepropertymap override quoted above.
 *
 * Observed defect at HEAD via public API:
 *   [...map.keys()] === ['color','transition-duration','width','--A','--B','--C']
 * Spec and WPT require ['--A','width','--C','transition-duration','color','--B'].
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSUnparsedValue, CSSUnitValue } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Reproduces: KI-128
// Verifies: SYS-REQ-260825-V4ZS (positive controls)
describe('KI-128 controls', () => {
  test('empty declared map iterates nothing', () => {
    assert.deepEqual([...mapFor('').keys()], []);
  });

  test('iteration yields correctly reified values (list-valued leg)', () => {
    const m = mapFor('transition-duration: 1s, 2s');
    const values = [...m.values()].flat();
    assert.deepEqual(values.map((v) => (v as CSSUnitValue).toString()), ['1s', '2s']);
  });

  test('iteration yields custom properties reified as CSSUnparsedValue', () => {
    const m = mapFor('--A: A');
    for (const [, value] of m.entries()) {
      assert.ok(value[0] instanceof CSSUnparsedValue, `expected CSSUnparsedValue, got ${value[0]?.constructor?.name}`);
    }
  });
});

// Reproduces: KI-128
// Verifies: SYS-REQ-260825-V4ZS (declaration-order legs)
describe('KI-128: declared maps iterate in inline declaration order', () => {
  test('keys follow declaration order with custom properties interleaved', () => {
    const m = mapFor('--A: A; width: 10px; --C: C; transition-duration: 1s, 2s; color: red; --B: B;');
    assert.deepEqual(
      [...m.keys()],
      ['--A', 'width', '--C', 'transition-duration', 'color', '--B'],
      'css-typed-om-1 #declared-stylepropertymap pins source order over the sorted default',
    );
  });

  test('entries traversal starts at the first declared property, not the lowest key', () => {
    const m = mapFor('--A: A; width: 10px; --C: C; color: red;');
    const first = m.entries().next().value;
    assert.equal(first?.[0], '--A', `first entry key was ${first?.[0]}`);
  });
});
