/**
 * Reproducer for CRS-0024/C05 and CRS-0024/C06 (src/PropertyRegistry.ts
 * consumeSyntaxComponent). css-properties-values-api #multipliers closes the
 * multiplier set to '+' and '#', and the note requires the multiplier to
 * appear immediately after the syntax component name. #consume-a-syntax-
 * component only consumes U+002B or U+0023 right after the name; anything
 * else is leftover and #consume-a-syntax-definition step 5 returns failure
 * for it. consumeSyntaxComponent accepts '?', '*' and a whitespace-separated
 * multiplier, so '<length>?', '<length>*' and '<length> +' register instead
 * of throwing SyntaxError.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';

const isSyntaxError = (e: unknown) => (e as DOMException)?.name === 'SyntaxError';

test('CRS-0024/C05: registerProperty rejects the "?" multiplier', () => {
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0024c05a', syntax: '<length>?', inherits: false, initialValue: '10px' }),
    isSyntaxError,
    "'?' is not in the {+,#} multiplier grammar",
  );
});

test('CRS-0024/C05: registerProperty rejects the "*" multiplier', () => {
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0024c05b', syntax: '<length>*', inherits: false, initialValue: '10px' }),
    isSyntaxError,
    "'*' is not in the {+,#} multiplier grammar",
  );
});

test('CRS-0024/C06: registerProperty rejects a multiplier separated by whitespace', () => {
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0024c06a', syntax: '<length> +', inherits: false, initialValue: '10px 20px' }),
    isSyntaxError,
    'the multiplier must follow the component name immediately',
  );
});

test('control: "+" and "#" multipliers stay valid', () => {
  assert.doesNotThrow(() => CSS.registerProperty({ name: '--crs0024c05c', syntax: '<length>+', inherits: false, initialValue: '10px 20px' }));
  assert.doesNotThrow(() => CSS.registerProperty({ name: '--crs0024c05d', syntax: '<length>#', inherits: false, initialValue: '10px, 20px' }));
});
