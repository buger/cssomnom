/**
 * Reproducer for CRS-0001/C06 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * matchesType admits a number-typed math function for the integer feature
 * color even when the resolved value is not an integer, so the query stays a
 * valid unknown query. mediaqueries-4 #error-handling requires a media query
 * whose value is unknown to be replaced by "not all", so cssText must report
 * not all. The same folding applies to the spec's own example
 * (color: 20example).
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser, serializeMediaQuery } from '../../src/MediaParser.ts';

test('CRS-0001/C06: unknown-valued queries fold to not all (mediaqueries-4 #error-handling)', () => {
  const nonIntegerCalc = MediaParser.parse('(color: calc(1.5))')[0];
  assert.equal(
    serializeMediaQuery(nonIntegerCalc),
    'not all',
    'non-integer calc(1.5) fails the color value syntax, so the query must serialize as not all',
  );
  const unknownValue = MediaParser.parse('(color: 20example)')[0];
  assert.equal(
    serializeMediaQuery(unknownValue),
    'not all',
    'the spec example (color: 20example) must serialize as not all',
  );
});
