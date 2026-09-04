/**
 * Reproducer for CRS-0001/C13 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * isValidRatioOperand accepts a zero denominator as a ratio operand, but
 * parseRatio returns null for a zero denominator, so (aspect-ratio: 16/0)
 * evaluates unknown. css-values-4 #ratios permits zero components (degenerate
 * ratios) and compares ratios by division; WPT css/mediaqueries/
 * aspect-ratio-002/004.html require 0/0 to behave as the infinite ratio 1/0.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C13: zero-denominator ratios evaluate as degenerate infinite ratios', () => {
  // WPT aspect-ratio-004: max-aspect-ratio: 0/0 is infinite, so it matches.
  assert.equal(
    MediaParser.evaluate('(max-aspect-ratio: 0/0)'),
    true,
    'max-aspect-ratio: 0/0 is infinite and must match (WPT aspect-ratio-004)',
  );
  // WPT aspect-ratio-002: min-aspect-ratio: 0/0 is infinite, so it never matches.
  assert.equal(
    MediaParser.evaluate('(min-aspect-ratio: 0/0)'),
    false,
    'min-aspect-ratio: 0/0 is infinite and must not match (WPT aspect-ratio-002)',
  );
  // 16/0 is infinite, not equal to 4/3, so the negation matches.
  assert.equal(
    MediaParser.evaluate('not (aspect-ratio: 16/0)'),
    true,
    '16/0 must compare as infinite, so its negation matches',
  );
});
