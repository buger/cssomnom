/**
 * Reproducer for CRS-0003/C39 (src/parser.ts handleFontFeatureValuesRule).
 * css-fonts-4 #font-feature-values-syntax defines the feature value blocks
 * as at-rules named by <font-feature-value-type> = @stylistic |
 * @historical-forms | @styleset | @character-variant (plus @annotation,
 * @ornaments, @swash per the descriptor list) - all hyphenated. The
 * handler accepts the unhyphenated aliases 'charactervariant' and
 * 'historicalforms' and fills the characterVariant / historicalForms maps
 * with declarations the spec says belong to an unrecognized block.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

type FFV = { characterVariant: Map<string, number[]>; historicalForms: Map<string, number[]> };

test('CRS-0003/C39: @charactervariant is not a feature value block', () => {
  const sheet = parse('@font-feature-values F { @charactervariant { cv1: 2; } }') as unknown as {
    cssRules: FFV[];
  };
  assert.equal(sheet.cssRules[0].characterVariant.size, 0,
    'the unhyphenated block must be ignored, leaving characterVariant empty');
});

test('CRS-0003/C39: @historicalforms is not a feature value block', () => {
  const sheet = parse('@font-feature-values F { @historicalforms { hist: 3; } }') as unknown as {
    cssRules: FFV[];
  };
  assert.equal(sheet.cssRules[0].historicalForms.size, 0,
    'the unhyphenated block must be ignored, leaving historicalForms empty');
});

test('control: hyphenated feature value blocks still populate their maps', () => {
  const sheet = parse('@font-feature-values F { @character-variant { cv1: 2; } @historical-forms { hist: 3; } }') as unknown as {
    cssRules: FFV[];
  };
  assert.equal(sheet.cssRules[0].characterVariant.size, 1);
  assert.equal(sheet.cssRules[0].historicalForms.size, 1);
});
