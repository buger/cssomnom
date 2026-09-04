/**
 * Reproducer for CRS-0046/C01+C05 (src/matcher.ts getElementSiblings).
 * The parentElement branch returns parentElement.children without checking
 * that the element is a member. The exported DOMElement type marks children
 * optional, and the parentNode branch falls back to [element]. A parent
 * object without children (or with an empty list) therefore yields
 * elIndex1Based 0, and the child-index guard returns false before the
 * :disabled/:enabled arms run. html#selector-disabled: an input with the
 * disabled attribute specified is actually disabled and must match.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

test('CRS-0046/C01: disabled input under a children-less parent matches :disabled', () => {
  const parent = { localName: 'form' };
  const input = { localName: 'input', parentElement: parent, hasAttribute: (n: string) => n === 'disabled' };
  assert.equal(matches(input, ':disabled'), true);
});

test('CRS-0046/C01: disabled input under an empty children list matches :disabled', () => {
  const parent = { localName: 'form', children: [] as unknown[] };
  const input = { localName: 'input', parentElement: parent, hasAttribute: (n: string) => n === 'disabled' };
  assert.equal(matches(input, ':disabled'), true);
});

test('CRS-0046/C05: enabled input under a children-less parent matches :enabled', () => {
  const parent = { localName: 'form' };
  const input = { localName: 'input', parentElement: parent, hasAttribute: () => false };
  assert.equal(matches(input, ':enabled'), true);
});

test('control: parent children containing the element keep :disabled working', () => {
  const input = { localName: 'input', hasAttribute: (n: string) => n === 'disabled' };
  const parent = { localName: 'form', children: [input] };
  (input as { parentElement?: unknown }).parentElement = parent;
  assert.equal(matches(input, ':disabled'), true);
});

test('control: detached disabled input still matches :disabled', () => {
  const input = { localName: 'input', hasAttribute: (n: string) => n === 'disabled' };
  assert.equal(matches(input, ':disabled'), true);
});
