/**
 * Reproducer for CRS-0036/C01 and CRS-0036/C21 (src/PropertyRegistry.ts
 * PropertyRegistry.register). css-properties-values-api-1 #register-a-custom-
 * property step 2 throws InvalidModificationError for a name already in
 * [[registeredPropertySet]] and exits BEFORE step 3 consumes a syntax
 * definition and BEFORE step 4 parses initialValue. register() calls
 * validate() first (line 354) and only consults the registry at line 355, so
 * a duplicate JS registration with an invalid syntax string or a missing
 * initialValue throws SyntaxError instead of InvalidModificationError.
 *
 * Asserts the SAFE contract: the duplicate JS registration reports
 * InvalidModificationError regardless of the second definition's validity.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-V5GA
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

function outcome(fn: () => void): string {
  try {
    fn();
    return 'no-throw';
  } catch (e) {
    return (e as DOMException)?.name ?? String(e);
  }
}

test('CRS-0036/C01: duplicate JS register with a bad syntax string throws InvalidModificationError', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0036c01', inherits: false, syntax: '*' });
  const name = outcome(() =>
    PropertyRegistry.register({ name: '--crs0036c01', inherits: false, syntax: '<not-a-type>', initialValue: '1px' }),
  );
  assert.equal(name, 'InvalidModificationError', `second register must not report SyntaxError, got ${name}`);
});

test('CRS-0036/C21: duplicate JS register with a missing initialValue throws InvalidModificationError', () => {
  PropertyRegistry.clear();
  PropertyRegistry.register({ name: '--crs0036c21', inherits: false, syntax: '*' });
  const name = outcome(() =>
    PropertyRegistry.register({ name: '--crs0036c21', inherits: false, syntax: '<length>' }),
  );
  assert.equal(name, 'InvalidModificationError', `second register must not report SyntaxError, got ${name}`);
});

test('control: a first registration with the same bad definitions still reports SyntaxError', () => {
  PropertyRegistry.clear();
  assert.equal(
    outcome(() => PropertyRegistry.register({ name: '--crs0036ctl1', inherits: false, syntax: '<not-a-type>' })),
    'SyntaxError',
  );
  assert.equal(
    outcome(() => PropertyRegistry.register({ name: '--crs0036ctl2', inherits: false, syntax: '<length>' })),
    'SyntaxError',
  );
});
