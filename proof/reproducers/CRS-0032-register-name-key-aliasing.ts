/**
 * Reproducer for CRS-0032/C20 (PropertyRegistry.register keys the Map by
 * the raw name value).
 *
 * WebIDL types PropertyDefinition.name as DOMString: the value is
 * stringified before register-a-custom-property runs, so a String object
 * or coercible object naming "--x" IS the name "--x". The implementation
 * validates nameStr = definition.name.toString() but stores and looks up
 * registry entries by definition.name itself. Registering an object-named
 * --x then registering the string '--x' again therefore misses the
 * existing entry: no InvalidModificationError, two live entries for one
 * property name.
 *
 * Asserts the SAFE contract: the second '--x' registration hits the
 * existing registration and throws InvalidModificationError.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PD6M / WebIDL DOMString conversion in registerProperty
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0032/C20: object-valued names stringify to the same registry key', () => {
  PropertyRegistry.clear();
  const objectName: unknown = {
    toString() { return '--crs0032c20'; },
    startsWith() { return true; },
  };
  PropertyRegistry.register({ name: objectName as string, inherits: false, syntax: '<length>', initialValue: '1px' });
  assert.ok(PropertyRegistry.get('--crs0032c20'), 'validation used the stringified name, so the entry is reachable');

  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0032c20', inherits: false, syntax: '<color>', initialValue: 'red' }),
    (e: unknown) => (e as DOMException).name === 'InvalidModificationError',
    'the string form names the same property and must hit the existing registration'
  );
});
