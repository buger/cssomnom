/**
 * Reproducer for CRS-0021/C18 (requirement SW-REQ-260821-7AKJ,
 * src/typed-om/color/color-rectify.ts rectifyColorAngle).
 * css-typed-om-1 #rectify-a-csscolorangle step 4 accepts only the keyword
 * "none"; every other CSSKeywordValue falls through to the step 5 TypeError.
 * The rectifier also returns the keyword "undefined" (and the JS undefined
 * branch produces it), so the typed-om parse entry CSSColorValue.parse accepts
 * hue components that css-color-4 (<hue> = <number> | <angle> | none) rejects.
 * oklch(50% 0.1 undefined) therefore parses instead of throwing, violating the
 * parse_throws guarantee for invalid input.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSColorValue } from '../../src/typed-om/color/CSSColorValue.ts';
import { CSSStyleValue } from '../../src/typed-om/values/CSSStyleValue.ts';

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
  assert.fail(`CSSColorValue.parse(${JSON.stringify(css)}) must throw: 'undefined' is not a color component keyword`);
}

test('CRS-0021/C18: oklch hue keyword "undefined" is not <hue> and must throw', () => {
  assertThrowsSyntax(() => CSSColorValue.parse('oklch(50% 0.1 undefined)'), 'oklch(50% 0.1 undefined)');
});

test('CRS-0021/C18: oklch hue keyword "undefined" fails through CSSStyleValue.parse too', () => {
  assertThrowsSyntax(
    () => CSSStyleValue.parse('color', 'oklch(50% 0.1 undefined)'),
    'oklch(50% 0.1 undefined)',
  );
});

test('CRS-0021/C18: a hue channel with keyword "undefined" in lch also throws', () => {
  assertThrowsSyntax(() => CSSColorValue.parse('lch(50% 0.1 undefined)'), 'lch(50% 0.1 undefined)');
});

test('control: hue "none" and real angles still parse', () => {
  assert.ok(CSSColorValue.parse('oklch(50% 0.1 none)'));
  assert.ok(CSSColorValue.parse('oklch(50% 0.1 30deg)'));
});
