/**
 * Reproducer for CRS-0001/C07 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * matchesType admits number-typed math functions for integer features, but
 * parseInteger only accepts number tokens, so (color: calc(8)) evaluates
 * unknown instead of comparing against the environment. WPT
 * css/mediaqueries/mq-calc-sign-function-003/004.html feed (grid: calc(...))
 * and require evaluation.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C07: integer features evaluate math-function values', () => {
  assert.equal(
    MediaParser.evaluate('(color: calc(8))', { color: 8 }),
    true,
    'calc(8) must compare equal with env.color 8',
  );
  assert.equal(
    MediaParser.evaluate('(color: calc(8))', { color: 4 }),
    false,
    'calc(8) must not compare equal with env.color 4',
  );
  assert.equal(
    MediaParser.evaluate('(min-color: calc(4))', { color: 8 }),
    true,
    'min-color: calc(4) must match env.color 8',
  );
});
