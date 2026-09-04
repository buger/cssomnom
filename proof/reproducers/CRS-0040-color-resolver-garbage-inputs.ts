/**
 * Reproducer for the CRS-0040 color-resolver claims (C03-C11, C14-C16, C20;
 * src/cascade/color-resolver.ts parseRgbComponents / parseHslComponents /
 * normalizeComputedColor). css-color-4 #funcdef-rgb / #funcdef-hsl type the
 * components: hue <number>|<angle>|none, s/l <percentage>|none, alpha requires
 * a `/` separator in the modern syntax; the legacy comma syntax cannot carry
 * a slash alpha; a missing (`none`) component computes as 0. The resolvers
 * instead parseFloat-prefix everything, coerce NaN alpha to 1, and accept
 * four space-separated components, so garbage input silently becomes a
 * canonical rgb()/rgba() (including rgb(NaN, NaN, NaN)) and `none` alpha
 * becomes fully opaque, instead of leaving the invalid text untouched.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeComputedColor } from '../../src/cascade/color-resolver.ts';

test('CRS-0040/C03+C04: invalid hsl saturation/lightness are not rewritten to rgb(NaN)', () => {
  assert.equal(normalizeComputedColor('hsl(0, foo, 50%)'), 'hsl(0, foo, 50%)');
  assert.equal(normalizeComputedColor('hsl(0, none, 50%)'), 'hsl(0, none, 50%)');
});

test('CRS-0040/C16: a bare unit keyword hue is not rewritten to rgb(255, 0, NaN)', () => {
  assert.equal(normalizeComputedColor('hsl(deg, 100%, 50%)'), 'hsl(deg, 100%, 50%)');
});

test('CRS-0040/C05+C15: a garbage hue is not rewritten to red', () => {
  assert.equal(normalizeComputedColor('hsl(nope, 100%, 50%)'), 'hsl(nope, 100%, 50%)');
  assert.equal(normalizeComputedColor('rgba(10, 20, 30, notanumber)'), 'rgba(10, 20, 30, notanumber)');
});

test('CRS-0040/C06+C08: alpha none computes as 0, not opaque', () => {
  assert.equal(normalizeComputedColor('hsl(0, 50%, 50%, none)'), 'rgba(128, 64, 64, 0)');
  assert.equal(normalizeComputedColor('rgb(10, 20, 30, none)'), 'rgba(10, 20, 30, 0)');
});

test('CRS-0040/C07: unitless hsl saturation/lightness are invalid, not 0-1 fractions', () => {
  assert.equal(normalizeComputedColor('hsl(0, 1, 1)'), 'hsl(0, 1, 1)');
});

test('CRS-0040/C09: rgb none components compute as 0; trailing junk is rejected', () => {
  assert.equal(normalizeComputedColor('rgb(none 0 0)'), 'rgb(0, 0, 0)');
  assert.equal(normalizeComputedColor('rgb(255foo, 0, 0)'), 'rgb(255foo, 0, 0)');
});

test('CRS-0040/C10+C20: comma syntax cannot carry a slash alpha', () => {
  assert.equal(normalizeComputedColor('rgb(255, 0, 0 / 0.5)'), 'rgb(255, 0, 0 / 0.5)');
  assert.equal(normalizeComputedColor('hsl(0, 100%, 50% / 0.5)'), 'hsl(0, 100%, 50% / 0.5)');
});

test('CRS-0040/C11+C14: modern 4-component form requires the slash', () => {
  assert.equal(normalizeComputedColor('rgb(255 0 0 0.5)'), 'rgb(255 0 0 0.5)');
  assert.equal(normalizeComputedColor('hsl(0 50% 50% 0.5)'), 'hsl(0 50% 50% 0.5)');
});

test('control: valid colors keep normalizing', () => {
  assert.equal(normalizeComputedColor('hsl(0, 100%, 50%)'), 'rgb(255, 0, 0)');
  assert.equal(normalizeComputedColor('rgb(255 0 0 / 0.5)'), 'rgba(255, 0, 0, 0.5)');
  assert.equal(normalizeComputedColor('#fff'), 'rgb(255, 255, 255)');
});
