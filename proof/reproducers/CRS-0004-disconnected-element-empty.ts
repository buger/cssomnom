/**
 * Reproducer for CRS-0004/C07 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts getCascadedStyle -> collectStyleSheetsAndRules).
 *
 * collectStyleSheetsAndRules returns null for any element whose isConnected is
 * false, and getCascadedStyle then returns a bare empty CSSStyleDeclaration:
 * explicitly passed rules, the element's own inline style, and parent
 * inheritance are all dropped, and matcher/MediaParser/supports are never
 * consulted. The connected equivalents of the same fixtures resolve fine, so
 * the disconnect guard is the sole cause. Asserts the intended contract so this
 * command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const document = parseHTML('<html><body><div class="t"></div></body></html>').document;

test('CRS-0004/C07: detached element still applies explicitly passed rules', () => {
  const el = document.createElement('div');
  el.className = 't';
  const sheet = parse('.t { color: red }');
  const style = getCascadedStyle(el, sheet.cssRules);
  assert.equal(style.getPropertyValue('color'), 'rgb(255, 0, 0)',
    'explicit rules must be walked even when isConnected is false');

  // Control: the identical fixture attached to the document resolves.
  const attached = document.createElement('div');
  attached.className = 't';
  document.body.appendChild(attached);
  assert.equal(getCascadedStyle(attached, sheet.cssRules).getPropertyValue('color'), 'rgb(255, 0, 0)');
});

test('CRS-0004/C07: detached element keeps its inline style', () => {
  const el = document.createElement('div');
  el.setAttribute('style', 'color: green');
  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('color'), 'rgb(0, 128, 0)',
    'the style attribute applies regardless of connectedness');
});

test('CRS-0004/C07: detached subtree still inherits', () => {
  const parent = document.createElement('div');
  parent.setAttribute('style', 'color: green');
  const el = document.createElement('div');
  parent.appendChild(el);
  const style = getCascadedStyle(el, []);
  assert.equal(style.getPropertyValue('color'), 'rgb(0, 128, 0)',
    'color inherits from the detached parent');
});
