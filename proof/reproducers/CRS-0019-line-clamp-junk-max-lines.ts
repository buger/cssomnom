/**
 * Reproducer for CRS-0019/C22 (src/shorthands.ts expandLineClamp).
 * css-overflow-4 #line-clamp: "line-clamp: none | [<integer [1,infinity]> ||
 * <'block-ellipsis'>]". "3 foo" matches neither branch, so the declaration is
 * invalid and must be dropped. expandLineClamp dumps the leftover token list
 * into max-lines unvalidated, storing "3 foo" (comment tokens included).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';
import { parse } from '../../src/parser.ts';

test('CRS-0019/C22: line-clamp 3 foo is dropped as grammar-invalid', () => {
  const decl = new CSSStyleDeclaration();
  decl.setProperty('line-clamp', '3 foo');
  assert.equal(
    decl.getPropertyValue('max-lines'),
    '',
    'css-overflow-4: junk after the integer invalidates the shorthand'
  );
});

test('CRS-0019/C22: stylesheet path drops line-clamp junk too', () => {
  const sheet = parse('.a{line-clamp: 3 foo}') as unknown as {
    cssRules: { style: { getPropertyValue(n: string): string; cssText: string } }[];
  };
  const style = sheet.cssRules[0].style;
  assert.equal(style.getPropertyValue('max-lines'), '', 'parse path must reject the same input');
  assert.ok(!style.cssText.includes('foo'), 'cssText must not retain the junk tokens');
});

test('control: line-clamp none and a plain integer parse', () => {
  const a = new CSSStyleDeclaration();
  a.setProperty('line-clamp', 'none');
  assert.equal(a.getPropertyValue('max-lines'), 'none');
  const b = new CSSStyleDeclaration();
  b.setProperty('line-clamp', '3');
  assert.equal(b.getPropertyValue('max-lines'), '3');
});
