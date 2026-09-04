/**
 * Reproducer for CRS-0001/C02 (requirement SW-REQ-260822-QKE9, src/MediaParser.ts).
 * Viewport-percentage units in media feature values resolve against hardcoded
 * 800x600 constants (parseLengthToPx), not against the MediaEnvironment
 * viewport. css-values-4 #viewport-relative-lengths defines vw/vh/vi/vb/vmin/
 * vmax against the viewport; MediaParser.evaluate injects the environment
 * viewport, so (width: 100vw) must be an identity against env.width.
 * Asserts the intended contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { MediaParser } from '../../src/MediaParser.ts';

test('CRS-0001/C02: viewport units resolve against the MediaEnvironment viewport', () => {
  // 100vw of a 1920x1080 viewport is 1920px, so (width: 100vw) must match.
  assert.equal(
    MediaParser.evaluate('(width: 100vw)', { width: 1920, height: 1080 }),
    true,
    '100vw must equal env.width 1920',
  );
  assert.equal(
    MediaParser.evaluate('(height: 100vh)', { width: 1920, height: 1080 }),
    true,
    '100vh must equal env.height 1080',
  );
  assert.equal(
    MediaParser.evaluate('(width: 100vmax)', { width: 1920, height: 1080 }),
    true,
    '100vmax must equal the larger viewport edge 1920',
  );
});
