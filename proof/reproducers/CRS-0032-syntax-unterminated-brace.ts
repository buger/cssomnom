/**
 * Reproducer for CRS-0032/C06 (unterminated '{' multiplier in syntax
 * strings).
 *
 * Brace repetition is not part of the css-properties-values-api
 * #syntax-strings grammar at all (multipliers are only '+' and '#',
 * immediately after the name — #multipliers). Even under the
 * implementation's own brace branch, an unterminated '<length>{2' must not
 * succeed: the EOF closer silently breaks the loop and assigns
 * multiplier='+', registering the dictionary. The '<' data-type loop in
 * the same function throws on EOF, so the asymmetry is internal too.
 *
 * Asserts the SAFE contract: an unterminated brace multiplier throws
 * SyntaxError from CSS.registerProperty.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PD6M / css-properties-values-api #syntax-strings
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0032/C06: unterminated "{N" multiplier fails the syntax definition', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c06', inherits: false, syntax: '<length>{2', initialValue: '1px' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'an unclosed brace cannot produce a valid syntax component'
  );
});
