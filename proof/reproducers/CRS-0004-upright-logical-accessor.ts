/**
 * Reproducer for CRS-0004/C16 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts getCascadedStyle vs src/cascade/computed-style.ts).
 *
 * CSS Writing Modes 3/4 make text-orientation:upright force the *used* value of
 * direction to ltr while the computed value stays rtl (so rtl inherits into
 * descendants). getCascadedStyle honors that split: it maps logical properties
 * with the forced ltr (margin-inline-start -> margin-top) but emits the
 * computed direction: rtl. CSSComputedStyleDeclaration.getPropertyValue then
 * re-resolves logical property names with the computed direction, so the same
 * declaration is looked up as margin-bottom and the accessor returns the empty
 * string even though margin-inline-start was declared. Asserts the intended
 * contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const document = parseHTML('<html><body></body></html>').document;

test('CRS-0004/C16: logical accessor agrees with the emitted physical mapping under upright', () => {
  const el = document.createElement('span');
  el.setAttribute('style', 'writing-mode:vertical-rl;text-orientation:upright;direction:rtl;margin-inline-start:1px');
  document.body.appendChild(el);

  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('margin-top'), '1px',
    'upright forces used direction ltr, so inline-start is the top');
  assert.equal(style.getPropertyValue('margin-inline-start'), '1px',
    'the declared logical property must report its computed value');
  assert.equal(style.getPropertyValue('direction'), 'rtl',
    'computed direction stays rtl so it inherits into descendants');
});
