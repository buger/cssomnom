/**
 * Reproducer for CRS-0021/C09 (requirement SW-REQ-260821-7AKJ,
 * src/typed-om/color/color-reify.ts reifyColor). css-color-4 #hex-notation
 * defines #RGB/#RGBA/#RRGGBB/#RRGGBBAA with hexadecimal digits only. The hash
 * reifier checks only the token length, so #ggg, #xyz, and #zzzzzz pass the
 * length gate and parseInt non-hex digits produce NaN channels. The typed-om
 * parse entry CSSColorValue.parse therefore returns rgb(nan, nan, nan) instead
 * of throwing SyntaxError or TypeError per css-typed-om-1
 * #parse-a-cssstylevalue step 3.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSColorValue } from '../../src/typed-om/color/CSSColorValue.ts';

function assertThrowsSyntax(fn: () => unknown, css: string): void {
  try {
    fn();
  } catch (e) {
    assert.ok(
      e instanceof SyntaxError || e instanceof TypeError ||
        (e instanceof DOMException && e.name === 'SyntaxError'),
      `${css} must raise SyntaxError or TypeError, got ${(e as object).constructor.name}`,
    );
    return;
  }
  assert.fail(`CSSColorValue.parse(${JSON.stringify(css)}) must throw for non-hex digits`);
}

test('CRS-0021/C09: #ggg is not a hex color and must throw', () => {
  assertThrowsSyntax(() => CSSColorValue.parse('#ggg'), '#ggg');
});

test('CRS-0021/C09: #xyz is not a hex color and must throw', () => {
  assertThrowsSyntax(() => CSSColorValue.parse('#xyz'), '#xyz');
});

test('CRS-0021/C09: #zzzzzz is not a hex color and must throw', () => {
  assertThrowsSyntax(() => CSSColorValue.parse('#zzzzzz'), '#zzzzzz');
});

test('control: real hex colors parse with finite channels', () => {
  const c = CSSColorValue.parse('#abc') as { r: { value: number }; g: { value: number }; b: { value: number } };
  assert.ok(Number.isFinite(c.r.value) && Number.isFinite(c.g.value) && Number.isFinite(c.b.value));
});
