/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Verifies: SYS-REQ-260821-5283, SW-REQ-260821-W8S1, INT-REQ-260821-MZW3
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MediaParser,
  evaluateMediaFeature,
  evaluateMediaQueries,
  serializeMediaQuery,
  DEFAULT_MEDIA_ENV,
} from '../src/MediaParser.ts';
import type { MediaEnvironment, MediaFeature } from '../src/types.ts';

const env = (over: Partial<MediaEnvironment> = {}): MediaEnvironment => ({
  ...DEFAULT_MEDIA_ENV,
  ...over,
});

describe('MC/DC branch: MediaParser parse / serialize', () => {
  test('empty, trailing comma, and all-and prefix', () => {
    assert.deepEqual(MediaParser.parse(''), []);
    assert.deepEqual(MediaParser.parse('   '), []);
    const trailing = MediaParser.parse('screen,');
    assert.ok(trailing.length >= 1);
    const allAnd = MediaParser.parse('all and (color)');
    assert.equal(serializeMediaQuery(allAnd[0]).includes('color'), true);
  });

  test('range context inverts when the ident is on the right', () => {
    assert.equal(MediaParser.evaluate('screen and (400px < width <= 800px)'), true);
    assert.equal(MediaParser.evaluate('screen and (100px < width <= 200px)'), false);
    assert.equal(MediaParser.evaluate('screen and (1000px > width > 100px)'), true);
    assert.equal(MediaParser.evaluate('screen and (width >= 800px)'), true);
    assert.equal(MediaParser.evaluate('screen and (width <= 800px)'), true);
    assert.equal(MediaParser.evaluate('screen and (800px <= width)'), true);
    assert.equal(MediaParser.evaluate('screen and (800px >= width)'), true);
  });

  test('aspect-ratio single-number range is treated as n/1', () => {
    assert.equal(MediaParser.evaluate('(aspect-ratio > 1)'), true);
    assert.equal(MediaParser.evaluate('(1 < aspect-ratio < 2)'), true);
    assert.equal(MediaParser.evaluate('(device-aspect-ratio = 800/600)'), true);
  });

  test('calc() resolution units canonicalize through dppx / x / dpi / dpcm', () => {
    const dpi = MediaParser.parse('(resolution: calc(96dpi))');
    assert.ok(serializeMediaQuery(dpi[0]).toLowerCase().includes('calc'));
    const x = MediaParser.parse('(resolution: calc(1x))');
    assert.ok(serializeMediaQuery(x[0]).length > 0);
    const dpcm = MediaParser.parse('(resolution: calc(37.8dpcm))');
    assert.ok(serializeMediaQuery(dpcm[0]).length > 0);
    const dppx = MediaParser.parse('(resolution: calc(1dppx))');
    assert.ok(serializeMediaQuery(dppx[0]).length > 0);
  });

  test('evaluate accepts string, MediaQuery, and MediaQuery[]', () => {
    const parsed = MediaParser.parse('screen and (color)');
    assert.equal(MediaParser.evaluate('screen and (color)'), true);
    assert.equal(MediaParser.evaluate(parsed[0]), true);
    assert.equal(MediaParser.evaluate(parsed), true);
    assert.equal(MediaParser.evaluate('not all'), false);
  });
});

describe('MC/DC branch: evaluateMediaFeature custom media and discrete features', () => {
  test('custom media from Map, object, boolean, string, and mediaText', () => {
    const feature = (name: string): MediaFeature => ({ type: 'media-feature', name, tokens: [] });

    assert.equal(evaluateMediaFeature(feature('--missing'), env()), 'unknown');
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: new Map([['--x', true]]) })), true);
    assert.equal(evaluateMediaFeature(feature('--x'), env({ customMedia: new Map([['--x', false]]) })), false);
    assert.equal(evaluateMediaFeature(feature('--y'), env({ customMedia: { '--y': true } })), true);
    assert.equal(evaluateMediaFeature(feature('--z'), env({ customMedia: { '--z': 'screen' } })), true);
    assert.equal(
      evaluateMediaFeature(feature('--m'), env({ customMedia: { '--m': { mediaText: 'not all' } } })),
      false,
    );
    assert.equal(evaluateMediaFeature(feature('--none'), env({ customMedia: { '--other': true } })), 'unknown');
    assert.equal(evaluateMediaFeature(feature('--obj'), env({ customMedia: { '--obj': { nope: true } } })), 'unknown');
  });

  test('boolean context for range features, hover/pointer, and resizable', () => {
    assert.equal(MediaParser.evaluate('(width)', env({ width: 0 })), false);
    assert.equal(MediaParser.evaluate('(width)', env({ width: 800 })), true);
    assert.equal(MediaParser.evaluate('(hover)', env({ hover: 'none' })), false);
    assert.equal(MediaParser.evaluate('(hover)', env({ hover: 'hover' })), true);
    assert.equal(MediaParser.evaluate('(pointer)', env({ pointer: 'none' })), false);
    assert.equal(MediaParser.evaluate('(grid)', env({ grid: 1 })), true);
    assert.equal(MediaParser.evaluate('(resizable)', env({ resizable: true })), true);
    assert.equal(MediaParser.evaluate('(resizable)', env({ resizable: false })), false);
    assert.equal(MediaParser.evaluate('(min-width)'), false);
  });

  test('color-gamut and video-color-gamut srgb/p3/rec2020', () => {
    assert.equal(MediaParser.evaluate('(color-gamut: srgb)', env({ colorGamut: 'srgb' })), true);
    assert.equal(MediaParser.evaluate('(color-gamut: p3)', env({ colorGamut: 'srgb' })), false);
    assert.equal(MediaParser.evaluate('(color-gamut: p3)', env({ colorGamut: 'p3' })), true);
    assert.equal(MediaParser.evaluate('(color-gamut: p3)', env({ colorGamut: 'rec2020' })), true);
    assert.equal(MediaParser.evaluate('(color-gamut: rec2020)', env({ colorGamut: 'p3' })), false);
    assert.equal(MediaParser.evaluate('(color-gamut: rec2020)', env({ colorGamut: 'rec2020' })), true);

    assert.equal(MediaParser.evaluate('(video-color-gamut: srgb)', env({ videoColorGamut: 'srgb' })), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut: p3)', env({ videoColorGamut: 'srgb' })), false);
    assert.equal(MediaParser.evaluate('(video-color-gamut: p3)', env({ videoColorGamut: 'p3' })), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut: rec2020)', env({ videoColorGamut: 'rec2020' })), true);
  });

  test('orientation flips with width vs height; ident inequality is unknown', () => {
    assert.equal(MediaParser.evaluate('(orientation: landscape)', env({ width: 800, height: 600 })), true);
    assert.equal(MediaParser.evaluate('(orientation: portrait)', env({ width: 400, height: 800 })), true);
    assert.equal(MediaParser.evaluate('(orientation: portrait)', env({ width: 800, height: 600 })), false);
    assert.equal(MediaParser.evaluate('(orientation > landscape)'), false);
  });

  test('prefers-*, display-mode, scan, update, overflow, scripting, nav-controls', () => {
    assert.equal(MediaParser.evaluate('(prefers-color-scheme: light)'), true);
    assert.equal(MediaParser.evaluate('(prefers-contrast: more)', env({ prefersContrast: 'more' })), true);
    assert.equal(MediaParser.evaluate('(prefers-reduced-motion: reduce)', env({ prefersReducedMotion: 'reduce' })), true);
    assert.equal(MediaParser.evaluate('(display-mode: browser)'), true);
    assert.equal(MediaParser.evaluate('(display-state: normal)'), true);
    assert.equal(MediaParser.evaluate('(scan: progressive)'), true);
    assert.equal(MediaParser.evaluate('(update: fast)'), true);
    assert.equal(MediaParser.evaluate('(overflow-block: scroll)'), true);
    assert.equal(MediaParser.evaluate('(overflow-inline: none)', env({ overflowInline: 'none' })), true);
    assert.equal(MediaParser.evaluate('(scripting: enabled)'), true);
    assert.equal(MediaParser.evaluate('(environment-blending: opaque)'), true);
    assert.equal(MediaParser.evaluate('(nav-controls: none)'), true);
    assert.equal(MediaParser.evaluate('(resizable: true)'), true);
    assert.equal(MediaParser.evaluate('(resizable: false)', env({ resizable: false })), true);
    assert.equal(MediaParser.evaluate('(forced-colors: active)', env({ forcedColors: 'active' })), true);
    assert.equal(MediaParser.evaluate('(inverted-colors: inverted)', env({ invertedColors: 'inverted' })), true);
    assert.equal(MediaParser.evaluate('(dynamic-range: high)', env({ dynamicRange: 'high' })), true);
    assert.equal(MediaParser.evaluate('(video-dynamic-range: high)', env({ videoDynamicRange: 'high' })), true);
    assert.equal(MediaParser.evaluate('(any-hover: hover)'), true);
    assert.equal(MediaParser.evaluate('(any-pointer: fine)'), true);
  });

  test('resolution infinite ident and numeric min/max prefixes', () => {
    assert.equal(MediaParser.evaluate('(min-width: 800px)'), true);
    assert.equal(MediaParser.evaluate('(max-width: 800px)'), true);
    assert.equal(MediaParser.evaluate('(min-resolution: 96dpi)'), true);
    const infinite = MediaParser.parse('(resolution: infinite)');
    assert.ok(infinite.length >= 1);
  });

  test('not / and / or 3-valued evaluation and unknown features', () => {
    assert.equal(MediaParser.evaluate('not (width)'), false);
    assert.equal(MediaParser.evaluate('(color) and (width)'), true);
    assert.equal(MediaParser.evaluate('(unknown-feature) or (color)'), true);
    assert.equal(MediaParser.evaluate('(unknown-feature) and (color)'), false);
    assert.equal(evaluateMediaQueries([], env()), true);
  });

  test('boolean color-gamut / video-color-gamut / orientation always true in boolean context', () => {
    assert.equal(MediaParser.evaluate('(color-gamut)'), true);
    assert.equal(MediaParser.evaluate('(video-color-gamut)'), true);
    assert.equal(MediaParser.evaluate('(orientation)'), true);
    assert.equal(MediaParser.evaluate('(display-mode)'), true);
    assert.equal(MediaParser.evaluate('(aspect-ratio)'), true);
  });
});
