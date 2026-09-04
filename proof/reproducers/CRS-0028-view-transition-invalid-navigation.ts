/**
 * Reproducer for CRS-0028/C33 (src/CSSOM.ts CSSViewTransitionRule).
 * css-view-transitions-2 #view-transition-navigation-descriptor types the
 * navigation descriptor as `auto | none` and requires descriptors whose
 * value does not match that grammar to be ignored in their entirety; the
 * navigation getter then returns the empty string because no descriptor
 * exists. handleViewTransitionRule assigns the serialized declaration value
 * unconditionally, so '@view-transition { navigation: bogus }' keeps and
 * re-serializes the invalid value.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet, CSSViewTransitionRule } from '../../src/CSSOM.ts';

type VT = { navigation: string; cssText: string };

test('control: a valid navigation descriptor parses', () => {
  const r = (parse('@view-transition { navigation: auto }') as CSSStyleSheet).cssRules[0] as unknown as VT;
  assert.ok(r instanceof CSSViewTransitionRule || typeof r.navigation === 'string');
  assert.equal(r.navigation, 'auto');
});

test('CRS-0028/C33: an invalid navigation value is ignored', () => {
  const r = (parse('@view-transition { navigation: bogus }') as CSSStyleSheet).cssRules[0] as unknown as VT;
  assert.equal(r.navigation, '', 'css-view-transitions-2: an off-grammar descriptor is ignored in its entirety');
  assert.equal(r.cssText.includes('bogus'), false);
});
