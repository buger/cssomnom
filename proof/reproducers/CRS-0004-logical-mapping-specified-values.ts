/**
 * Reproducer for CRS-0004/C08 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts getCascadedStyle).
 *
 * The logical-property mapping context is taken from the unresolved specified
 * winner of writing-mode/direction/text-orientation (L234-241), so CSS-wide
 * keywords and var() references map logical properties with the wrong writing
 * mode and direction. CSS Logical 1 and CSS Writing Modes 4 define logical
 * mapping against the computed writing-mode and direction. The identical
 * fixtures with the resolved keyword map correctly, isolating the raw-value
 * read as the cause. Asserts the intended contract so this command FAILS while
 * the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const document = parseHTML('<html><body></body></html>').document;

test('CRS-0004/C08: writing-mode:inherit maps logical properties with the computed mode', () => {
  const el = document.createElement('span');
  el.setAttribute('style', 'writing-mode:inherit;margin-inline-start:1px');
  const parent = document.createElement('div');
  parent.setAttribute('style', 'writing-mode:vertical-rl');
  parent.appendChild(el);
  document.body.appendChild(parent);

  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('writing-mode'), 'vertical-rl', 'computed writing-mode resolves');
  assert.equal(style.getPropertyValue('margin-top'), '1px',
    'vertical-rl + ltr maps margin-inline-start to margin-top');
  assert.equal(style.getPropertyValue('margin-left'), '', 'horizontal mapping must not be used');
});

test('CRS-0004/C08: writing-mode:var(--wm) maps logical properties with the substituted mode', () => {
  const el = document.createElement('span');
  el.setAttribute('style', 'writing-mode:var(--wm);margin-inline-start:1px');
  const parent = document.createElement('div');
  parent.setAttribute('style', 'writing-mode:vertical-rl;--wm:vertical-rl');
  parent.appendChild(el);
  document.body.appendChild(parent);

  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('margin-top'), '1px',
    'var() must be substituted before it is used as mapping context');
  assert.equal(style.getPropertyValue('margin-left'), '');
});

test('CRS-0004/C08: direction:inherit maps logical properties with the computed direction', () => {
  const el = document.createElement('span');
  el.setAttribute('style', 'direction:inherit;margin-inline-start:1px');
  const parent = document.createElement('div');
  parent.setAttribute('style', 'direction:rtl');
  parent.appendChild(el);
  document.body.appendChild(parent);

  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('margin-right'), '1px',
    'rtl maps margin-inline-start to margin-right');
  assert.equal(style.getPropertyValue('margin-left'), '');
});
