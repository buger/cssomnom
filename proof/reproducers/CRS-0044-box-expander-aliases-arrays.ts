/**
 * Reproducer for CRS-0044/C01 and CRS-0044/C20 (requirement
 * SW-REQ-260822-YBF2, src/shorthands.ts expandBox / normalizePositionTokens).
 *
 * expandBox assigns the same ComponentValue[] object to every side that
 * repeats a value: a 1-value padding sets right = bottom = left = top, and a
 * 2-value form aliases bottom to top. normalizePositionTokens returns
 * [t0, t0] for a lone 'center', aliasing one token object into both axes.
 * Each longhand must own an independent value list, so mutating one side's
 * list cannot rewrite another side. Asserts the intended contract so this
 * command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHORTHANDS } from '../../src/shorthands.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';
import type { ComponentValue } from '../../src/types.ts';

function expand(shorthand: string, text: string): Record<string, ComponentValue[]> | null {
  const values = new Parser(tokenize(text)).parseComponentValues();
  return SHORTHANDS[shorthand].expand(values);
}

test('CRS-0044/C01: 1-value padding assigns four independent arrays', () => {
  const result = expand('padding', '1px');
  assert.ok(result);
  assert.notEqual(result['padding-top'], result['padding-right']);
  assert.notEqual(result['padding-top'], result['padding-bottom']);
  assert.notEqual(result['padding-top'], result['padding-left']);
});

test('CRS-0044/C01: mutating one side list does not rewrite the aliased sides', () => {
  const result = expand('padding', '1px');
  assert.ok(result);
  result['padding-top'].push({ type: 'ident', value: 'junk' } as ComponentValue);
  assert.equal(result['padding-right'].length, 1, 'right keeps its own 1px list');
});

test('CRS-0044/C01: 2-value margin aliases bottom to top and left to right', () => {
  const result = expand('margin', '1px 2px');
  assert.ok(result);
  assert.notEqual(result['margin-top'], result['margin-bottom']);
  assert.notEqual(result['margin-right'], result['margin-left']);
});

test('CRS-0044/C01: 1-value logical margin aliases all four logical longhands', () => {
  const result = expand('margin', '1px');
  assert.ok(result);
  const logical = ['margin-block-start', 'margin-inline-start', 'margin-block-end', 'margin-inline-end'];
  for (let i = 1; i < logical.length; i++) {
    assert.notEqual(result[logical[0]], result[logical[i]]);
  }
});

test('CRS-0044/C20: background center does not alias one token into both axes', () => {
  const result = expand('background', 'center');
  assert.ok(result);
  const pos = result['background-position'];
  assert.equal(pos.length, 2);
  assert.notEqual(pos[0], pos[1], 'the center token object must not be shared by both axes');
});
