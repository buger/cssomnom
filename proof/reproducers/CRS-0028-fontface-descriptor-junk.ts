/**
 * Reproducer for CRS-0028/C30 (src/CSSOM.ts CSSFontFaceDescriptors /
 * CSSStyleDeclaration.setProperty).
 * css-fonts-4 #font-face-src gives the src descriptor a strict grammar
 * (a comma list of url()/local()/tech()/format() terms). The font-face
 * descriptor surface admits src into _isPropertySupported and then runs the
 * generic property validator, which has no descriptor grammar, so
 * fontFaceRule.style.setProperty('src', 'not-a-src') stores junk and
 * re-serializes an invalid @font-face rule instead of being a no-op.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet, CSSFontFaceRule } from '../../src/CSSOM.ts';

type Face = { style: { setProperty(p: string, v: string): void; getPropertyValue(p: string): string }; cssText: string };

function face(): Face {
  return (parse('@font-face { font-family: x; src: url(a.woff); }') as CSSStyleSheet).cssRules[0] as unknown as Face;
}

test('control: the parsed descriptor round-trips', () => {
  const r = face();
  assert.ok(r.style.getPropertyValue('src').includes('a.woff'));
});

test('CRS-0028/C30: a grammar-invalid src value is ignored', () => {
  const r = face();
  r.style.setProperty('src', 'not-a-src');
  assert.equal(r.style.getPropertyValue('src').includes('not-a-src'), false, 'src must match the css-fonts-4 #font-face-src grammar');
  assert.equal(r.cssText.includes('not-a-src'), false);
});

test('CRS-0028/C30: a grammar-invalid unicode-range value is ignored', () => {
  const r = face();
  r.style.setProperty('unicode-range', 'zzz');
  assert.equal(r.style.getPropertyValue('unicode-range').includes('zzz'), false, 'unicode-range must be a <<urange>>');
});
