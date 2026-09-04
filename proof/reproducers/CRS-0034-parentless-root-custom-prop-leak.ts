/**
 * Reproducer for CRS-0034/C10 (src/cascade/index.ts getCascadedStyle).
 *
 * css-variables-1 #defining-the-default custom properties inherit from the
 * parent element like any inherited property; an element with no parent
 * receives the guaranteed-invalid initial value, never a value from
 * ownerDocument.documentElement. getCascadedStyle falls back to copying the
 * documentElement custom properties into rawCustomProps whenever
 * parentCascaded is null and rootNode !== element, so a parentless element
 * resolves var(--x) references inside custom properties against the root's
 * --x instead of guaranteed-invalid. Asserts the spec outcome so this
 * command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parse } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade/index.ts';

const doc = parseHTML('<html style="--x: fromroot"><body><div id="host"></div></body></html>').document;
const rules = parse('div { --w: var(--x); color: var(--w, none); }').cssRules as never;

function parentlessConnectedElement(): Record<string, unknown> {
  return {
    nodeType: 1,
    tagName: 'DIV',
    isConnected: true,
    ownerDocument: doc,
    getAttribute: () => null,
    parentElement: null,
    parentNode: null,
    style: '',
  };
}

test('CRS-0034/C10: parentless element does not see documentElement custom properties', () => {
  const style = getCascadedStyle(parentlessConnectedElement() as never, rules);
  assert.equal(style.getPropertyValue('--w'), '',
    'var(--x) is guaranteed-invalid without a parent, so --w is empty');
  assert.equal(style.getPropertyValue('color'), 'none',
    'color falls back to the var() default');
});

test('control: the documentElement itself still exposes --x', () => {
  const rootStyle = getCascadedStyle(doc.documentElement, rules);
  assert.equal(rootStyle.getPropertyValue('--x'), 'fromroot');
});
