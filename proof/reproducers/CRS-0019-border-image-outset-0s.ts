/**
 * Reproducer for CRS-0019/C17 (src/shorthands.ts isInitialBorderImage /
 * contractBorderImage). css-backgrounds-3 #border-image-outset accepts only
 * <length> and <number> values, so "0s" (a <time>) is invalid and the
 * declaration must be dropped. The code stores outset "0s" AND lists "0s" as
 * an initial-outset spelling, so a stored "0s" is contracted away as if it
 * were the initial 0.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts'; // side-effect: injects ParseHooks used by setProperty
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0019/C17: border-image-outset rejects the time value 0s', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('border-image-outset', '0s');
  assert.equal(
    decl.getPropertyValue('border-image-outset'),
    '',
    '0s is not a <length>|<number> outset, so cssom must drop the declaration'
  );
});

test('CRS-0019/C17: a stored 0s outset is not treated as the initial 0', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('border-image-source', 'url(x.png)');
  decl.setProperty('border-image-outset', '0s');
  assert.notEqual(
    decl.getPropertyValue('border-image'),
    'none',
    '0s must not pass the initial-outset comparison in isInitialBorderImage'
  );
});

test('control: numeric outset 0 stays initial', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('border-image-source', 'url(x.png)');
  decl.setProperty('border-image-outset', '0');
  assert.equal(decl.getPropertyValue('border-image'), 'url("x.png")');
});
