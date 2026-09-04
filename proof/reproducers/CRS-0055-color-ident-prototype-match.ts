/**
 * Reproducer for CRS-0055/C10 (src/PropertyRegistry.ts matchesSyntax color
 * branch). The named-color membership test `val in NAMED_COLORS` runs on a
 * prototype-bearing Record, so inherited Object.prototype keys match. The
 * identifier `constructor` is not a color, and #register-a-custom-property
 * step 4 requires the initial value to parse according to the <color>
 * syntax component, so registerProperty must throw SyntaxError and the
 * @property rule must be dropped at ingest. The prototype hit lets both
 * registrations succeed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSS } from '../../src/parser-api.ts';
import { PropertyRegistry } from '../../src/PropertyRegistry.ts';

test('CRS-0055/C10: registerProperty rejects the color ident "constructor"', () => {
  PropertyRegistry.clear();
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0055c10', inherits: false, syntax: '<color>', initialValue: 'constructor' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'an Object.prototype key is not a named color',
  );
});

test('CRS-0055/C10: @property <color> with initial-value constructor is dropped', () => {
  const sheet = parse('@property --crs0055c10b { syntax: "<color>"; inherits: false; initial-value: constructor; }') as unknown as {
    cssRules: unknown[];
  };
  assert.equal(sheet.cssRules.length, 0, 'the prototype hit must not satisfy <color>');
});

test('control: real named colors still register and unknown idents still throw', () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() => CSS.registerProperty({ name: '--crs0055ctl', inherits: false, syntax: '<color>', initialValue: 'red' }));
  assert.throws(
    () => CSS.registerProperty({ name: '--crs0055ctl2', inherits: false, syntax: '<color>', initialValue: 'notacolor' }),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
  );
  PropertyRegistry.clear();
});
