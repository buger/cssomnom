/**
 * Reproducer for CRS-0032/C10 (<flex> is not a supported syntax component
 * name).
 *
 * css-properties-values-api #supported-names closes the supported syntax
 * component names to <length> <number> <percentage> <length-percentage>
 * <string> <color> <image> <url> <integer> <angle> <time> <resolution>
 * <transform-function> <custom-ident> <transform-list>. <flex> is absent,
 * and consume-a-syntax-component fails on a data type name that is not a
 * supported syntax component name. VALID_COMPONENTS contains 'flex', so
 * {syntax:'<flex>'} registers — with 'calc(0)' the whole bad dictionary
 * is accepted (checkItem treats every math function as a flex value and
 * calc(0) passes the independence check).
 *
 * Asserts the SAFE contract: '<flex>' throws SyntaxError.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PD6M / css-properties-values-api #supported-names
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0032/C10: <flex> is not a supported syntax component name', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c10', inherits: false, syntax: '<flex>', initialValue: 'calc(0)' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    '#supported-names has no <flex> entry, so consume-a-syntax-component fails'
  );
});
