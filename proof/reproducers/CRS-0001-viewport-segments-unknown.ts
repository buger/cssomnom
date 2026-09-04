/**
 * Reproducer for CRS-0001/C04 and CRS-0001/C22 (requirement SW-REQ-260822-QKE9,
 * src/MediaParser.ts). The generated media-features table lists
 * horizontal-viewport-segments and vertical-viewport-segments as known integer
 * features, but evaluateMediaFeature maps neither name to an environment value
 * (getActualNumeric) and parseValueForFeature falls through to parseIdent, so
 * the features always evaluate unknown and never match. mediaqueries-5
 * #viewport-segments defines both as range features of the viewport.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C04+C22: viewport-segments features evaluate against the environment', () => {
  // The default environment models a single-segment 800x600 viewport, so
  // (horizontal-viewport-segments: 1) must match and : 2 must not match.
  assert.equal(
    MediaParser.evaluate('(horizontal-viewport-segments: 1)'),
    true,
    'single-segment viewport must match horizontal-viewport-segments: 1',
  );
  assert.equal(
    MediaParser.evaluate('(min-vertical-viewport-segments: 1)'),
    true,
    'single-segment viewport must match min-vertical-viewport-segments: 1',
  );
  assert.equal(
    MediaParser.evaluate('(horizontal-viewport-segments: 2)'),
    false,
    'single-segment viewport must not match horizontal-viewport-segments: 2',
  );
});
