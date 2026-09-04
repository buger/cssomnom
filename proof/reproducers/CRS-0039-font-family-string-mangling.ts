/**
 * Reproducer for CRS-0039/C11+C27 (src/serializer.ts serializeFontFamily /
 * serializeFontFamilyItem). C11: string font families are wrapped in raw
 * `"`+value+`"` without serializeString, so a family containing a quote
 * character serializes to a broken CSS string ("foo"bar") that re-tokenizes
 * as three tokens. C27: comma groups that are empty (trailing comma, or a
 * double comma) are dropped, so `Arial,` serializes as `Arial` and
 * `Arial,,serif` as `Arial, serif`, changing the token count on re-parse.
 * css-syntax-3 #serialization requires round-trip fidelity.
 * Asserts the round-trip contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { ParseHooks } from '../../src/parse-hooks.ts';
import '../../src/parser.ts';
import { serializeFontFamily } from '../../src/serializer.ts';

function values(css: string) {
  return ParseHooks.parseComponentValues(tokenize(css));
}

test('CRS-0039/C11: a quoted family containing a quote round-trips as one string', () => {
  const out = serializeFontFamily(values('"foo\\"bar"'));
  const toks = tokenize(out).filter(t => t.type !== 'EOF');
  const strings = toks.filter(t => t.type === 'string');
  assert.equal(toks.length, 1, `expected a single string token, got ${JSON.stringify(out)}`);
  assert.equal(strings.length, 1, `output must be one valid string: ${JSON.stringify(out)}`);
  assert.equal((strings[0] as { value: string }).value, 'foo"bar');
});

test('CRS-0039/C27: a trailing comma group is not silently dropped', () => {
  const input = values('Arial,');
  const out = serializeFontFamily(input);
  const commasIn = input.filter(t => t.type === 'comma').length;
  const commasOut = tokenize(out).filter(t => t.type === 'comma').length;
  assert.equal(commasOut, commasIn,
    `comma groups must survive serialization: ${JSON.stringify(out)}`);
});

test('CRS-0039/C27: an empty mid-list group is not silently dropped', () => {
  const input = values('Arial,,serif');
  const out = serializeFontFamily(input);
  const commasIn = input.filter(t => t.type === 'comma').length;
  const commasOut = tokenize(out).filter(t => t.type === 'comma').length;
  assert.equal(commasOut, commasIn,
    `comma groups must survive serialization: ${JSON.stringify(out)}`);
});

test('control: plain quoted and unquoted families serialize validly', () => {
  assert.equal(serializeFontFamily(values('"Times New Roman", serif')), 'Times New Roman, serif');
  assert.equal(serializeFontFamily(values('Arial')), 'Arial');
});
