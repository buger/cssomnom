/**
 * Reproducer for CRS-0001/C09 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * canonicalSerialize guards parseMathFunction with try/catch, but the
 * validation and evaluation path (matchesType via isFeatureUnknown,
 * parseLengthToPx, parseResolutionToDpi) calls parseMathFunction unguarded.
 * A media feature value whose math function mixes incompatible units makes
 * parseMathFunction throw, and the raw TypeError escapes MediaParser.evaluate.
 * mediaqueries-4 #error-handling requires the query to fold to not all, so
 * evaluate must return false instead of throwing.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C09: evaluate never throws for incompatible-unit calc in feature values', () => {
  assert.equal(
    MediaParser.evaluate('(width: calc(1px + 1deg))'),
    false,
    'calc(1px + 1deg) is a type error, so the query must fold to not all and evaluate false',
  );
  assert.equal(
    MediaParser.evaluate('(width: min(1px, 1deg))'),
    false,
    'min(1px, 1deg) is a type error, so the query must fold to not all and evaluate false',
  );
});
