/**
 * Reproducer for CRS-0001/C10 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * validateMediaInParens turns a boolean min-/max- feature such as (min-width)
 * into general-enclosed, so the query stays valid and evaluates unknown.
 * mediaqueries-4 #mq-min-max states: "Attempting to evaluate a min/max
 * prefixed media feature in a boolean context is invalid and a syntax error."
 * The query must therefore be invalid and serialize as not all, and an or
 * context containing it must not match.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser, serializeMediaQuery } from '../../src/MediaParser.ts';

test('CRS-0001/C10: boolean min-/max- is a syntax error (mediaqueries-4 #mq-min-max)', () => {
  assert.equal(
    MediaParser.parse('(min-width)')[0].invalid,
    true,
    '(min-width) in boolean context is a syntax error and must mark the query invalid',
  );
  assert.equal(
    serializeMediaQuery(MediaParser.parse('(min-width)')[0]),
    'not all',
    'the invalid query must serialize as not all',
  );
  assert.equal(
    MediaParser.evaluate('(color) or (min-width)'),
    false,
    'a query containing the syntax error must not match, even in an or context',
  );
});
