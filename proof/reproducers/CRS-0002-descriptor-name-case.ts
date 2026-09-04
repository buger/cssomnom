/**
 * Reproducer for CRS-0002/C16 and CRS-0002/C17 (src/CSSOM.ts
 * CSSCounterStyleRule / CSSViewTransitionRule constructors).
 * Descriptor (declaration) names are CSS identifiers matched ASCII case-
 * insensitively (css-counter-styles-3 #counter-style takes a
 * <declaration-list>; handlePropertyRule in the same parser already
 * lowercases descriptor names). Both constructors compare d.name ===
 * verbatim, so SYSTEM: cyclic and Navigation: auto leave the getters on
 * their defaults while cssText still shows the declarations.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';

test('CRS-0002/C16: @counter-style SYSTEM descriptor applies case-insensitively', () => {
  const sheet = parse('@counter-style foo { SYSTEM: cyclic; }') as unknown as {
    cssRules: { system: string }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @counter-style rule must parse');
  assert.equal(sheet.cssRules[0].system, 'cyclic', 'SYSTEM: must set system like system:');
});

test('CRS-0002/C17: @view-transition Navigation descriptor applies case-insensitively', () => {
  const sheet = parse('@view-transition { Navigation: auto; }') as unknown as {
    cssRules: { navigation: string }[];
  };
  assert.ok(sheet.cssRules.length > 0, 'the @view-transition rule must parse');
  assert.equal(sheet.cssRules[0].navigation, 'auto', 'Navigation: must set navigation like navigation:');
});

test('control: lowercase descriptors keep working', () => {
  const sheet = parse('@counter-style bar { system: cyclic; } @view-transition { navigation: auto; }') as unknown as {
    cssRules: { system?: string; navigation?: string }[];
  };
  assert.equal(sheet.cssRules[0].system, 'cyclic');
  assert.equal(sheet.cssRules[1].navigation, 'auto');
});
