/**
 * Reproducer for CRS-0026/C24 (src/cascade/index.ts getCascadedStyle).
 * getCascadedStyle recurses into parentNode/parentElement with no visited
 * set. A duck-typed element whose parentElement is itself drives unbounded
 * recursion and the API surfaces a raw RangeError (stack overflow) instead
 * of terminating.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const rules = parseStyleSheet('#t { color: red; }');

test('CRS-0026/C24: a self-parented element does not overflow the stack', () => {
  const el: Record<string, unknown> = {
    nodeType: 1,
    tagName: 'DIV',
    isConnected: true,
    getAttribute: () => null,
  };
  el.parentElement = el;
  let out = '';
  assert.doesNotThrow(() => { out = getCascadedStyle(el, rules).getPropertyValue('color'); },
    'the ancestor walk must terminate on a cycle');
  assert.equal(out, 'rgb(255, 0, 0)', 'the element itself still cascades');
});

test('control: a two-element chain still resolves', () => {
  const parent: Record<string, unknown> = { nodeType: 1, tagName: 'DIV', isConnected: true, getAttribute: () => null };
  const child: Record<string, unknown> = { nodeType: 1, tagName: 'DIV', isConnected: true, getAttribute: () => null, parentElement: parent };
  assert.doesNotThrow(() => { getCascadedStyle(child, rules); });
});
