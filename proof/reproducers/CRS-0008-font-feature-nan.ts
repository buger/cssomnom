/**
 * Reproducer for CRS-0008/C22 (requirement INT-REQ-260821-WQX9,
 * src/CSSOM.ts CSSFontFeatureValuesMap.set).
 *
 * CSSFontFeatureValuesMap.set coerces values with Number() and stores the
 * result without any integer/finite validation. WebIDL types the values
 * argument as (unsigned long or sequence<unsigned long>); ToUint32 maps NaN
 * to +0, so a conforming implementation never stores NaN. The map here
 * stores NaN, and CSSFontFeatureValuesRule.cssText then serializes it as
 * the bare token NaN, which is not valid CSS. css-fonts-4 #om-fontfeaturevalues
 * serializes feature values as <integer>.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSFontFeatureValuesRule } from '../../src/CSSOM.ts';

// Reproduces: pending KI (CRS-0008/C22)
test('CRS-0008/C22: font feature map rejects (does not store) non-numeric values', () => {
  const rule = new CSSFontFeatureValuesRule('X');
  // WebIDL unsigned long conversion maps NaN to +0; NaN must never be stored.
  rule.swash.set('swish', 'nope');
  const values = rule.swash.get('swish') ?? [];
  for (const v of values) {
    assert.ok(Number.isInteger(v) && Number.isFinite(v),
      `feature values must be integers, got ${JSON.stringify(values)}`);
  }
});

// Reproduces: pending KI (CRS-0008/C22)
test('CRS-0008/C22: cssText never emits the bare token NaN', () => {
  const rule = new CSSFontFeatureValuesRule('X');
  rule.swash.set('swish', 'nope');
  rule.swash.set('other', [1, undefined]);
  const text = rule.cssText;
  assert.ok(!/\bNaN\b/.test(text),
    `cssText must not serialize NaN, got ${JSON.stringify(text)}`);
});
