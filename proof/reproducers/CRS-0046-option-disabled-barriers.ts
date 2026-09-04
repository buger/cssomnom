/**
 * Reproducer for CRS-0046/C03+C04+C18 (src/matcher.ts isOptionDisabled /
 * nearestAncestorSelectIsDisabled / isElementDisabled).
 * html#concept-option-disabled: walk ancestors in reverse tree order; return
 * false at a select, hr, datalist, or option ancestor; decide solely on the
 * nearest optgroup. html nearest-ancestor-select: return null at datalist,
 * hr, option, or a second optgroup. The matcher instead scans the whole
 * ancestor chain for any disabled optgroup or any select, so options the
 * spec leaves enabled match :disabled and lose :enabled.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

function tree(...names: string[]): Record<string, unknown> {
  let child: Record<string, unknown> | undefined;
  let el: Record<string, unknown> | undefined;
  for (const name of names) {
    el = { localName: name, children: [] as unknown[] };
    if (child) {
      (child as { parentElement?: unknown }).parentElement = el;
      el.children = [child];
    }
    child = el;
  }
  return child as Record<string, unknown>;
}

function disabled(name: string): Record<string, unknown> {
  return { localName: name, hasAttribute: (n: string) => n === 'disabled', children: [] as unknown[] };
}

function chain(...nodes: Record<string, unknown>[]): Record<string, unknown> {
  for (let i = 0; i + 1 < nodes.length; i++) {
    (nodes[i] as { parentElement?: unknown }).parentElement = nodes[i + 1];
    nodes[i + 1].children = [nodes[i]];
  }
  return nodes[0];
}

test('CRS-0046/C03: option under a non-disabled optgroup stays enabled', () => {
  // optgroup[disabled] > optgroup > option: nearest optgroup lacks disabled.
  const opt = tree('option');
  const inner = tree('optgroup');
  (opt as { parentElement?: unknown }).parentElement = inner;
  inner.children = [opt];
  const outer = disabled('optgroup');
  (inner as { parentElement?: unknown }).parentElement = outer;
  outer.children = [inner];
  assert.equal(matches(opt, ':disabled'), false);
  assert.equal(matches(opt, ':enabled'), true);
});

test('CRS-0046/C04: option under select > datalist stays enabled despite a disabled select above', () => {
  // html nearest-ancestor-select returns null at a datalist barrier.
  const opt = tree('option');
  const dl = chain(opt, tree('datalist'));
  const sel = disabled('select');
  (dl as { parentElement?: unknown }).parentElement = sel;
  sel.children = [dl];
  assert.equal(matches(opt, ':disabled'), false);
  assert.equal(matches(opt, ':enabled'), true);
});

test('CRS-0046/C04: option under two nested optgroups stays enabled despite a disabled select above', () => {
  // html nearest-ancestor-select returns null at the second optgroup.
  const opt = tree('option');
  const og1 = chain(opt, tree('optgroup'));
  const og2 = tree('optgroup');
  (og1 as { parentElement?: unknown }).parentElement = og2;
  og2.children = [og1];
  const sel = disabled('select');
  (og2 as { parentElement?: unknown }).parentElement = sel;
  sel.children = [og2];
  assert.equal(matches(opt, ':disabled'), false);
  assert.equal(matches(opt, ':enabled'), true);
});

test('control: option directly under a disabled select is disabled', () => {
  const opt = tree('option');
  const sel = disabled('select');
  (opt as { parentElement?: unknown }).parentElement = sel;
  sel.children = [opt];
  assert.equal(matches(opt, ':disabled'), true);
});

test('control: option under a directly disabled optgroup is disabled', () => {
  const opt = tree('option');
  const og = disabled('optgroup');
  (opt as { parentElement?: unknown }).parentElement = og;
  og.children = [opt];
  assert.equal(matches(opt, ':disabled'), true);
});

test('control: plain option is enabled', () => {
  assert.equal(matches(tree('option'), ':enabled'), true);
});
