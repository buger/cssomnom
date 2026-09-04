/**
 * Reproducer for CRS-0055/C30 (src/PropertyRegistry.ts get/register).
 * get() returns the live Map value, including the internal `origin` tag,
 * without copying or freezing. Mutating the returned record flips origin
 * to 'css', and a second JavaScript registration of the same name then
 * skips the JS-then-JS duplicate check. #register-a-custom-property step 2
 * requires InvalidModificationError for any repeated name in
 * [[registeredPropertySet]], which must not be reachable from script.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0055/C30: mutating the get() record cannot bypass the duplicate check', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0055c30', inherits: false, syntax: '<length>', initialValue: '1px' }, 'js');
  const record = PropertyRegistry.get('--crs0055c30') as { origin?: string } | undefined;
  assert.ok(record, 'control: the registration is visible');
  record!.origin = 'css';
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0055c30', inherits: false, syntax: '<color>', initialValue: 'red' }, 'js'),
    (e: unknown) => (e as DOMException).name === 'InvalidModificationError',
    'a js-then-js duplicate must throw whatever the stored record says',
  );
  PropertyRegistry.clear();
});

test('CRS-0055/C30: get() must not expose the internal origin tag', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0055c30b', inherits: false, syntax: '<length>', initialValue: '1px' }, 'js');
  const record = PropertyRegistry.get('--crs0055c30b') as Record<string, unknown> | undefined;
  assert.equal(record && 'origin' in record, false, 'the public PropertyDefinition shape has no origin member');
  PropertyRegistry.clear();
});
