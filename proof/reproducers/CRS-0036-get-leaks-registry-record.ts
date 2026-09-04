/**
 * Reproducer for CRS-0036/C03 (src/PropertyRegistry.ts PropertyRegistry.get).
 * get() returns the live Map record by reference. The stored record carries
 * the internal `origin` field, and register() gates the JS-then-JS
 * InvalidModificationError throw on existing.origin === 'js'. A caller that
 * mutates the object returned by get() therefore flips the gate and makes the
 * duplicate JS registration overwrite silently. SW-REQ-260821-V5GA requires
 * the InvalidModificationError guarantee to hold for every duplicate JS
 * registration.
 *
 * Asserts the SAFE contract: mutating the object handed out by get() cannot
 * defeat the duplicate-JS InvalidModificationError gate.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-V5GA
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0036/C03: mutating the get() record cannot defeat the duplicate-JS gate', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0036c03', inherits: false, syntax: '*' });

  const leaked = PropertyRegistry.get('--crs0036c03') as unknown as Record<string, unknown>;
  assert.ok(leaked, 'get() must expose the registration');
  leaked.origin = 'css';

  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0036c03', inherits: false, syntax: '*' }),
    (e: unknown) => (e as DOMException).name === 'InvalidModificationError',
    'a second JS registration must still throw InvalidModificationError',
  );
});

test('control: the unmutated record keeps throwing InvalidModificationError', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0036c03ctl', inherits: false, syntax: '*' });
  assert.throws(
    () => PropertyRegistry.register({ name: '--crs0036c03ctl', inherits: false, syntax: '*' }),
    (e: unknown) => (e as DOMException).name === 'InvalidModificationError',
  );
});
