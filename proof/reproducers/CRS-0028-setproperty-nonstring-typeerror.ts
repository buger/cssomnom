/**
 * Reproducer for CRS-0028/C06 (src/CSSStyleDeclaration.ts setProperty).
 * The CSSOM IDL types CSSStyleDeclaration.setProperty's value argument as
 * CSSOMString, so the WebIDL conversion runs before the algorithm: a number
 * or a string-coercible object becomes a string and the call then validates
 * and ignores it. The shorthand branch calls value.includes() directly, so
 * setProperty('margin', 123) and the style.margin proxy assignment throw a
 * raw TypeError instead of converting and ignoring.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

test('CRS-0028/C06: a number value is converted, not thrown on', () => {
  const s = new CSSStyleDeclaration();
  s.setProperty('color', 'red');
  let err: unknown;
  try {
    (s as unknown as { setProperty(p: string, v: unknown): void }).setProperty('margin', 123);
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `setProperty('margin', 123) threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
});

test('CRS-0028/C06: a string-coercible object value is converted, not thrown on', () => {
  const s = new CSSStyleDeclaration();
  let err: unknown;
  try {
    (s as unknown as { setProperty(p: string, v: unknown): void }).setProperty('color', { toString() { return 'blue'; } });
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `setProperty('color', object) threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
});

test('CRS-0028/C06: style.margin = 123 converts instead of throwing', () => {
  const s = new CSSStyleDeclaration();
  let err: unknown;
  try {
    (s as unknown as Record<string, unknown>)['margin'] = 123;
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `style.margin = 123 threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
});
