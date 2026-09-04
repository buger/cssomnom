/**
 * Reproducer for CRS-0037/C17 (src/MediaParser.ts evaluateMediaFeature
 * boolean-context switch). mediaqueries-4 #evaluating Media Features in a
 * Boolean Context makes a feature true whenever it would be true for any
 * value other than 0, a zero dimension, or the keyword none. dynamic-range
 * and video-dynamic-range have no 'none' value, so on a visual device with
 * dynamic-range: standard the boolean form must be true, exactly like the
 * neighbouring color-gamut / scan arms. The code returns
 * env.dynamicRange === 'high' (src/MediaParser.ts:1193), so a standard
 * display reports false.
 *
 * Asserts the SAFE contract: the boolean form is true unless the value is
 * none or zero.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-W8S1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, DEFAULT_MEDIA_ENV } from '../../src/MediaParser.ts';

test('CRS-0037/C17: (dynamic-range) is true on a standard display', () => {
  assert.equal(MediaParser.evaluate('(dynamic-range)', DEFAULT_MEDIA_ENV), true);
});

test('CRS-0037/C17: (video-dynamic-range) is true on a standard display', () => {
  assert.equal(MediaParser.evaluate('(video-dynamic-range)', DEFAULT_MEDIA_ENV), true);
});

test('CRS-0037/C17: (dynamic-range) is true on a high display', () => {
  assert.equal(MediaParser.evaluate('(dynamic-range)', { ...DEFAULT_MEDIA_ENV, dynamicRange: 'high' }), true);
});

test('control: the plain forms keep their discrete equality', () => {
  assert.equal(MediaParser.evaluate('(dynamic-range: standard)', DEFAULT_MEDIA_ENV), true);
  assert.equal(MediaParser.evaluate('(dynamic-range: high)', DEFAULT_MEDIA_ENV), false);
  // Neighbouring keyword features without a 'none' value already follow the rule.
  assert.equal(MediaParser.evaluate('(color-gamut)', DEFAULT_MEDIA_ENV), true);
});
