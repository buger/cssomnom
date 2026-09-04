/**
 * Reproducer for CRS-0037/C04 and CRS-0037/C05 (src/MediaParser.ts
 * evaluateMediaFeature). The generated media-features table lists
 * -webkit-device-pixel-ratio in KNOWN_FEATURES and RANGE_FEATURES,
 * -webkit-transform-3d with an integer value type, and ua-color-scheme /
 * shape with allowed idents. None of those names has a case in
 * getActualNumeric, parseValueForFeature or the discrete-ident switch, so
 * every query on them parses as a known media feature and then evaluates
 * unknown and never matches. MediaEnvironment carries uaColorScheme and
 * resolution, so those environments can answer the queries.
 *
 * The viewport-segments legs of the same mechanism are owned by KI-136.
 *
 * Asserts the SAFE contract: declared-known features evaluate against the
 * environment instead of always failing.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-W8S1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, DEFAULT_MEDIA_ENV, evaluateMediaFeature } from '../../src/MediaParser.ts';
import { KNOWN_FEATURES, RANGE_FEATURES } from '../../src/data/gen/media-features.ts';

test('CRS-0037/C04: the generated table declares the -webkit features known', () => {
  assert.ok(KNOWN_FEATURES.has('-webkit-device-pixel-ratio'));
  assert.ok(RANGE_FEATURES.has('-webkit-device-pixel-ratio'));
  assert.ok(KNOWN_FEATURES.has('-webkit-transform-3d'));
});

test('CRS-0037/C04: (-webkit-device-pixel-ratio: 2) matches a 2dppx environment', () => {
  // resolution is stored in dpi; 2 dppx = 192 dpi.
  assert.equal(MediaParser.evaluate('(-webkit-device-pixel-ratio: 2)', { ...DEFAULT_MEDIA_ENV, resolution: 192 }), true);
});

test('CRS-0037/C04: (-webkit-transform-3d: 1) compares instead of staying unknown', () => {
  const queries = MediaParser.parse('(-webkit-transform-3d: 1)');
  const feature = queries[0]?.condition as unknown as { type: string; name?: string };
  assert.equal(feature?.type, 'media-feature', 'the parser already declares the feature known');
  const evaluated = evaluateMediaFeature(feature as never, DEFAULT_MEDIA_ENV);
  assert.notEqual(evaluated, 'unknown', 'a declared-known feature must not evaluate unknown');
});

test('CRS-0037/C05: (ua-color-scheme: light) matches an environment whose uaColorScheme is light', () => {
  assert.equal(MediaParser.evaluate('(ua-color-scheme: light)', DEFAULT_MEDIA_ENV), true);
  assert.equal(MediaParser.evaluate('(ua-color-scheme: dark)', DEFAULT_MEDIA_ENV), false);
});

test('control: a feature with a mapping still evaluates', () => {
  assert.equal(MediaParser.evaluate('(color: 8)', DEFAULT_MEDIA_ENV), true);
});
