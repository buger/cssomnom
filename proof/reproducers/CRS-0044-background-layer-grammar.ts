/**
 * Reproducer for CRS-0044/C11, C12, C13, C16, C26, C27, and C30
 * (requirement SW-REQ-260822-YBF2, src/shorthands.ts expandBackground,
 * normalizePositionTokens, parseRepeatTokens, extractSizeTokens).
 *
 * expandBackground classifies tokens by keyword tables and only length-caps
 * the position list (>4). css-backgrounds-3 #background gives one
 * <bg-position> [/ <bg-size>]? || <repeat-style> || <attachment> per layer;
 * <bg-position> admits at most two bare lengths (three- and four-value forms
 * need keywords), and 'cover'/'contain'/'auto' are not position keywords.
 * <repeat-style> is at most two keywords and 'repeat-x'/'repeat-y' cannot
 * combine. <attachment> appears once per layer. A third value after the
 * size slash must invalidate the layer. Invalid layers must reject the
 * whole declaration instead of expanding defaults. Asserts the intended
 * contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function probe(value: string, longhand: string): string {
  const style = new CSSStyleDeclaration();
  style.setProperty('background', value);
  return style.getPropertyValue(longhand);
}

test('CRS-0044/C11: background 10px 20px 30px is rejected (3 bare lengths)', () => {
  assert.equal(probe('10px 20px 30px', 'background-position'), '');
});

test('CRS-0044/C11: background 10px 20px 30px 40px is rejected (4 bare lengths)', () => {
  assert.equal(probe('10px 20px 30px 40px', 'background-position'), '');
});

test('CRS-0044/C12: bare cover is rejected (bg-size keyword outside the slash form)', () => {
  assert.equal(probe('cover', 'background-position'), '');
  assert.equal(probe('cover', 'background-color'), '');
});

test('CRS-0044/C12: bare auto is rejected as a position value', () => {
  assert.equal(probe('auto', 'background-position'), '');
});

test('CRS-0044/C13: left right is rejected (two horizontal keywords)', () => {
  assert.equal(probe('left right', 'background-position'), '');
});

test('CRS-0044/C13: top bottom is rejected (two vertical keywords)', () => {
  assert.equal(probe('top bottom', 'background-position'), '');
});

test('CRS-0044/C16: three repeat keywords are rejected, not defaulted to repeat', () => {
  assert.equal(probe('repeat space round', 'background-repeat'), '');
});

test('CRS-0044/C26: repeat-x cannot combine with a second repeat keyword', () => {
  assert.equal(probe('repeat-x no-repeat', 'background-repeat'), '');
});

test('CRS-0044/C27: two attachments are rejected, not joined', () => {
  assert.equal(probe('scroll fixed', 'background-attachment'), '');
});

test('CRS-0044/C30: a third value after the size slash is rejected', () => {
  assert.equal(probe('left / 10px 20px 30px', 'background-size'), '');
  assert.equal(probe('left / 10px 20px 30px', 'background-position'), '');
});

test('controls: valid backgrounds still expand', () => {
  assert.equal(probe('left 10px top 20px', 'background-position'), 'left 10px top 20px');
  assert.equal(probe('url(a.png) left / cover no-repeat fixed red', 'background-color'), 'red');
});
