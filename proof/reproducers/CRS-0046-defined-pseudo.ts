/**
 * Reproducer for CRS-0046/C13 (src/matcher.ts matchPseudoClassSelector).
 * html#selector-defined: :defined must match any element that is defined —
 * built-in elements and successfully-upgraded custom elements. An
 * autonomous custom element that was never defined (no registry entry, no
 * upgrade) is not defined and must not match. The matcher returns true
 * unconditionally for every element. 'my-el' is a valid custom element
 * name with no definition here, so :defined must be false.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

test('CRS-0046/C13: an undefined custom element does not match :defined', () => {
  const uncustomized = { localName: 'my-el', nodeType: 1 };
  assert.equal(matches(uncustomized, ':defined'), false);
});

test('control: built-in elements match :defined', () => {
  assert.equal(matches({ localName: 'div', nodeType: 1 }, ':defined'), true);
});
