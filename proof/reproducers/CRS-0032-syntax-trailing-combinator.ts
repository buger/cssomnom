/**
 * Reproducer for CRS-0032/C02 + CRS-0032/C28 (trailing '|' combinator in
 * syntax strings).
 *
 * css-properties-values-api #consume-a-syntax-definition loops
 * "component ('|' component)*": after consuming '|', the algorithm must
 * consume another syntax component; EOF there hits the "anything else"
 * branch and the whole definition fails. register-a-custom-property must
 * then throw SyntaxError. parseSyntax's loop instead `continue`s after the
 * '|' and exits cleanly at EOF, so '<length> |' and '<length> | ' register.
 *
 * Asserts the SAFE contract: a syntax string ending in '|' throws
 * SyntaxError from CSS.registerProperty.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PD6M / css-properties-values-api #consume-a-syntax-definition
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0032/C02: trailing "|" combinator fails the syntax definition', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c02', inherits: false, syntax: '<length> |', initialValue: '1px' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'consume-a-syntax-definition requires a component after every "|"'
  );
});

test('CRS-0032/C28: trailing "|" with trailing spaces also fails', () => {
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c28', inherits: false, syntax: '<length> | ', initialValue: '1px' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'whitespace after the trailing combinator does not add a component'
  );
});
