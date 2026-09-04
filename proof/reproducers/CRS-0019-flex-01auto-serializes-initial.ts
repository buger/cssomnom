/**
 * Reproducer for CRS-0019/C16 (src/shorthands.ts contractFlex). The flex
 * longhands grow=0, shrink=1, basis=auto are the initial VALUES of the
 * longhands, not css-wide keywords. cssom-1 #serialize-a-css-value may emit a
 * css-wide keyword only when the longhand values ARE that keyword, so
 * getPropertyValue('flex') must not serialize "0 1 auto" as "initial".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts'; // side-effect: injects ParseHooks used by shorthand expansion
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0019/C16: flex 0 1 auto serializes without the css-wide keyword "initial"', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('flex', '0 1 auto');
  const out = decl.getPropertyValue('flex');
  assert.notEqual(
    out,
    'initial',
    'browsers serialize the specified longhands ("0 auto"); the css-wide keyword was never specified'
  );
  assert.ok(
    !/^(initial|inherit|unset|revert|revert-layer)$/i.test(out),
    'no css-wide keyword may be synthesized from non-keyword longhand values'
  );
  assert.ok(out.startsWith('0'), 'the serialized shorthand starts with flex-grow 0');
});

test('CRS-0019/C16: cssText round-trips without a fabricated keyword', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('flex', '0 auto');
  assert.ok(
    !decl.cssText.toLowerCase().includes('initial'),
    'cssText must not claim a keyword the author never wrote'
  );
});

test('control: an explicitly specified css-wide keyword serializes', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('flex', 'inherit');
  assert.equal(decl.cssText, 'flex: inherit;');
});
