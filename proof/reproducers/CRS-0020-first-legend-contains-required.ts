/**
 * Reproducer for CRS-0020/C28 (src/matcher.ts isInsideFirstLegend).
 * html #concept-fe-disabled: a control inside the first legend child of a
 * disabled fieldset is not disabled. isInsideFirstLegend computes containment
 * only through legend.contains?.(); the exported DOMElement type marks
 * contains optional, and focus-within already falls back to a parent-chain
 * walk, so a host DOM without contains marks those controls disabled.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

const el = (props: Record<string, unknown>) => ({ nodeType: 1, children: [], ...props });

function disabledFieldsetWithLegend(legendContains?: (n: unknown) => boolean) {
  const input = el({ localName: 'input' });
  const legend = el({ localName: 'legend', children: [input], ...(legendContains ? { contains: legendContains } : {}) });
  const fieldset = el({
    localName: 'fieldset',
    hasAttribute: (n: string) => n === 'disabled',
    getAttribute: () => '',
    children: [legend],
  });
  input.parentElement = legend;
  legend.parentElement = fieldset;
  return { input, fieldset };
}

test('CRS-0020/C28: first-legend input without legend.contains stays enabled', () => {
  const { input } = disabledFieldsetWithLegend();
  assert.equal(
    matches(input, ':disabled'),
    false,
    'html #concept-fe-disabled: descendants of the first legend of a disabled fieldset are not disabled'
  );
});

test('control: legend.contains DOM keeps the input enabled', () => {
  const { input } = disabledFieldsetWithLegend(() => true);
  assert.equal(matches(input, ':disabled'), false);
});

test('control: an input outside the first legend stays disabled', () => {
  const input = el({ localName: 'input' });
  const fieldset = el({
    localName: 'fieldset',
    hasAttribute: (n: string) => n === 'disabled',
    getAttribute: () => '',
    children: [el({ localName: 'legend', contains: () => false }), input],
    contains: () => true,
  });
  input.parentElement = fieldset;
  assert.equal(matches(input, ':disabled'), true);
});
