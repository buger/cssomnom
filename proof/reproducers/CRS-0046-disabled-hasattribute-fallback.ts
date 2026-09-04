/**
 * Reproducer for CRS-0046/C06+C07+C08 (src/matcher.ts isFormControlDisabled /
 * isDisabledFieldset / isDisabledByAncestorFieldset).
 * The disabled-attribute checks read element.hasAttribute?.('disabled') only.
 * The exported DOMElement type marks hasAttribute optional, and
 * matchAttributeSelector already falls back to getAttribute for presence.
 * A duck-typed element that exposes getAttribute but not hasAttribute is
 * therefore never detected as disabled, so :disabled misses it and :enabled
 * wrongly matches. html#concept-fe-disabled: a specified disabled attribute
 * makes the control actually disabled.
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matches } from '../../src/matcher.ts';

test('CRS-0046/C06: input exposing only getAttribute matches :disabled', () => {
  const input = { localName: 'input', getAttribute: (n: string) => (n === 'disabled' ? '' : null) };
  assert.equal(matches(input, ':disabled'), true);
  assert.equal(matches(input, ':enabled'), false);
});

test('CRS-0046/C07: fieldset exposing only getAttribute matches :disabled', () => {
  const fieldset = { localName: 'fieldset', getAttribute: (n: string) => (n === 'disabled' ? '' : null), children: [] as unknown[] };
  assert.equal(matches(fieldset, ':disabled'), true);
});

test('CRS-0046/C08: input under an ancestor fieldset exposing only getAttribute matches :disabled', () => {
  const input = { localName: 'input', getAttribute: () => null };
  const fieldset = { localName: 'fieldset', getAttribute: (n: string) => (n === 'disabled' ? '' : null), children: [input] };
  (input as { parentElement?: unknown }).parentElement = fieldset;
  assert.equal(matches(input, ':disabled'), true);
});

test('control: hasAttribute-bearing mocks keep working', () => {
  const input = { localName: 'input', hasAttribute: (n: string) => n === 'disabled' };
  assert.equal(matches(input, ':disabled'), true);
});
