/**
 * Reproducer for CRS-0014/C13 (requirement SW-REQ-260821-2Z0N session packet
 * src/parser-api.ts evaluateSupportsDeclaration).
 *
 * evaluateSupportsDeclaration ends in an unconditional `return true`
 * (src/parser-api.ts ~681). The arm is reached for a property listed in the
 * generated SUPPORTED_PROPERTIES table but absent from
 * STANDARD_PROPERTIES_SYNTAX and from SHORTHANDS. Five -webkit-box-* legacy
 * properties sit in that gap ('-webkit-box-align', '-webkit-box-flex',
 * '-webkit-box-ordinal-group', '-webkit-box-orient', '-webkit-box-pack'), so
 * CSS.supports(prop, value) accepts any garbage for them.
 *
 * css-conditional-3 3 #supports-feature: a declaration is supported only when
 * its property is known AND its value matches the property's grammar.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';

const BOGUS = 'definitely-not-a-valid-value';

test('CRS-0014/C13: syntax-less properties do not accept arbitrary values', () => {
  for (const prop of [
    '-webkit-box-align',
    '-webkit-box-flex',
    '-webkit-box-ordinal-group',
    '-webkit-box-orient',
    '-webkit-box-pack',
  ]) {
    assert.equal(CSS.supports(prop, BOGUS), false, `${prop} has no grammar row, so ${BOGUS} must be rejected`);
  }
});

// controls: properties that do carry a syntax row are still rejected/accepted.
test('control: grammar-backed properties keep their verdicts', () => {
  assert.equal(CSS.supports('-webkit-box-shadow', 'none'), true);
  assert.equal(CSS.supports('-webkit-box-shadow', BOGUS), false);
  assert.equal(CSS.supports('color', 'red'), true);
  assert.equal(CSS.supports('color', BOGUS), false);
});
