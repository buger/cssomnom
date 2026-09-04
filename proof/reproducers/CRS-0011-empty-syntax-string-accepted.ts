/**
 * Reproducer for CRS-0011/C02 (src/PropertyRegistry.ts validate/register).
 * CSS.registerProperty({ syntax: '' }) must throw a SyntaxError:
 * css-properties-values-api #consume-a-syntax-definition step 2 returns
 * failure when the string is empty after stripping whitespace, and
 * #register-a-custom-property step 3 turns that failure into a SyntaxError.
 * The WebIDL default "*" applies only when the member is absent, not when it
 * is the empty string. PropertyRegistry.validate coerces with
 * `definition.syntax || '*'`, so '' is treated as the universal syntax and
 * the registration succeeds with syntax "".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

const isSyntaxError = (e: unknown) => (e as DOMException)?.name === 'SyntaxError';

test('CRS-0011/C02: registerProperty rejects syntax: "" with SyntaxError', () => {
  PropertyRegistry.clear();
  assert.throws(
    () => CSS.registerProperty({ name: '--c02-empty', inherits: false, syntax: '' }),
    isSyntaxError,
    'consume-a-syntax-definition step 2 fails on the empty string',
  );
});

test('control: omitted syntax still defaults to the universal syntax', () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() => CSS.registerProperty({ name: '--c02-omit', inherits: false }));
  assert.notEqual(PropertyRegistry.get('--c02-omit'), undefined);
});

test('control: an invalid non-empty syntax still throws', () => {
  PropertyRegistry.clear();
  assert.throws(
    () => CSS.registerProperty({ name: '--c02-junk', inherits: false, syntax: '<>' }),
    isSyntaxError,
  );
});

PropertyRegistry.clear();
