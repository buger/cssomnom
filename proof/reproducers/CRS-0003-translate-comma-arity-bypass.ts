/**
 * Reproducer for CRS-0003/C06 (src/typed-om/values/style-value-parser.ts).
 * The individual transform properties translate/rotate/scale are
 * space-separated grammars (css-transforms-2: translate: none | <length-
 * percentage>{1,2}...), so a comma makes the value invalid. Filtering
 * commas out of the token list before the arity check lets
 * translate: 10px, 20px parse as a valid CSSTranslate instead of
 * throwing TypeError per css-typed-om-1 #parse-a-cssstylevalue step 3.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleValue } from '../../src/index.ts';

test('CRS-0003/C06: translate rejects a comma-separated pair', () => {
  assert.throws(() => CSSStyleValue.parse('translate', '10px, 20px'), TypeError);
});

test('CRS-0003/C06: translate rejects double commas', () => {
  assert.throws(() => CSSStyleValue.parse('translate', '10px,,20px'), TypeError);
});

test('CRS-0003/C06: scale rejects comma-separated args', () => {
  assert.throws(() => CSSStyleValue.parse('scale', '2, 3'), TypeError);
});

test('control: space-separated transforms still parse', () => {
  assert.ok(CSSStyleValue.parse('translate', '10px 20px'));
  assert.ok(CSSStyleValue.parse('scale', '2 3'));
  assert.ok(CSSStyleValue.parse('rotate', '45deg'));
});
