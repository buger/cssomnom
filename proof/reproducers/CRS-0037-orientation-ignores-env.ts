/**
 * Reproducer for CRS-0037/C03 (src/MediaParser.ts evaluateMediaFeature
 * orientation arm). MediaEnvironment carries an `orientation` field and
 * DEFAULT_MEDIA_ENV sets it, but the discrete-ident switch derives the actual
 * value from env.width > env.height (src/MediaParser.ts:1293-1294). A caller
 * supplying orientation: 'portrait' with a landscape 800x600 viewport still
 * fails (orientation: portrait). mediaqueries-4 #orientation defines the
 * feature from the page's orientation, which this API exposes through
 * MediaEnvironment, so a caller-provided orientation must win.
 *
 * Asserts the SAFE contract: the environment's orientation field drives the
 * feature.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-W8S1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, DEFAULT_MEDIA_ENV } from '../../src/MediaParser.ts';

test('CRS-0037/C03: (orientation: portrait) honours env.orientation on a landscape viewport', () => {
  const env = { ...DEFAULT_MEDIA_ENV, width: 800, height: 600, orientation: 'portrait' as const };
  assert.equal(MediaParser.evaluate('(orientation: portrait)', env), true);
  assert.equal(MediaParser.evaluate('(orientation: landscape)', env), false);
});

test('CRS-0037/C03: (orientation) boolean context honours env.orientation', () => {
  const env = { ...DEFAULT_MEDIA_ENV, width: 800, height: 600, orientation: 'portrait' as const };
  assert.equal(MediaParser.evaluate('not (orientation: portrait)', env), false);
});

test('control: the derived value still matches when the field agrees with the geometry', () => {
  assert.equal(MediaParser.evaluate('(orientation: landscape)', DEFAULT_MEDIA_ENV), true);
});
