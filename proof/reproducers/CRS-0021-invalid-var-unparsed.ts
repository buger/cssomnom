/**
 * Reproducer for CRS-0021/C05 and CRS-0021/C07 (requirement
 * SW-REQ-260821-7AKJ, src/typed-om/values/style-value-parser.ts _parseAll and
 * src/typed-om/values/CSSUnparsedValue.ts tokensToUnparsedSegments).
 * css-typed-om-1 #parse-a-cssstylevalue step 3 parses the value against the
 * property grammar and throws TypeError on failure. css-variables-1 #funcdef-var
 * requires var( <custom-property-name> , <declaration-value>? ), so var(foo),
 * var(--), and var() are syntax errors, not valid values. _parseAll returns a
 * CSSUnparsedValue for any function named var before the grammar gate runs, and
 * tokensToUnparsedSegments serializes the invalid call as a plain string
 * segment, so the parse succeeds.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { CSSStyleValue } from '../../src/typed-om/values/CSSStyleValue.ts';

test('CRS-0021/C05: var(foo) is not a dashed ident and must throw', () => {
  assert.throws(
    () => CSSStyleValue.parse('width', 'var(foo)'),
    TypeError,
    'css-variables-1 requires a <custom-property-name> first argument',
  );
});

test('CRS-0021/C05: var(--) is a bare double-dash and must throw', () => {
  assert.throws(() => CSSStyleValue.parse('color', 'var(--)'), TypeError);
});

test('CRS-0021/C05: var() with no arguments must throw', () => {
  assert.throws(() => CSSStyleValue.parse('width', 'var()'), TypeError);
});

test('CRS-0021/C05: a nested invalid var still fails the parse', () => {
  assert.throws(
    () => CSSStyleValue.parse('margin', '10px var(bad)'),
    TypeError,
    'an invalid var() inside a shorthand value is a syntax error',
  );
});

test('control: a well-formed var() still parses as CSSUnparsedValue', () => {
  const v = CSSStyleValue.parse('width', 'var(--foo)');
  assert.ok(v, 'valid substitution references stay parseable');
});
