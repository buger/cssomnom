/**
 * Reproducer for CRS-0032/C16 + C17 + C29 (matchesSyntax accepts function
 * tokens by name without argument or result-type validation).
 *
 * css-properties-values-api #the-registerproperty-function requires the
 * initial value to parse according to the registered syntax definition.
 * checkItem short-circuits:
 *   - every MATH_FUNCTIONS name satisfies <integer>/<length>/…, so
 *     calc(1.5) and sin(1) count as <integer> although neither represents
 *     an integer;
 *   - <color> accepts any COLOR_FUNCTIONS name without components, so
 *     rgb() (zero arguments) counts as a <color>;
 *   - <transform-list>/<transform-function> accept any
 *     VALID_TRANSFORM_FUNCTIONS name, so rotate() (missing argument)
 *     counts as a transform function.
 * All three bad dictionaries register without SyntaxError.
 *
 * Asserts the SAFE contract: each registration throws SyntaxError.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PD6M / css-properties-values-api #the-registerproperty-function
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0032/C16: calc(1.5) and sin(1) are not <integer> values', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c16a', inherits: false, syntax: '<integer>', initialValue: 'calc(1.5)' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'calc(1.5) does not represent an integer'
  );
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c16b', inherits: false, syntax: '<integer>', initialValue: 'sin(1)' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'sin(1) is not an <integer> value for the registry matcher'
  );
});

test('CRS-0032/C17: rgb() with no components is not a <color>', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c17', inherits: false, syntax: '<color>', initialValue: 'rgb()' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'a color function needs its component arguments'
  );
});

test('CRS-0032/C29: rotate() with no argument is not a <transform-function>', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c29', inherits: false, syntax: '<transform-list>', initialValue: 'rotate()' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'a transform function needs its argument'
  );
});
