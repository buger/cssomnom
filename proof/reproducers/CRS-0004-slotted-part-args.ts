/**
 * Reproducer for CRS-0004/C01 + CRS-0004/C02 (requirement INT-REQ-260821-HJVC,
 * src/cascade/index.ts normalizePseudoElement).
 *
 * The known functional pseudo-element path accepts exactly one ident token, so
 * spec-valid arguments are rejected as invalid:
 *   - css-shadow-1 #slotted-pseudo: `::slotted( <<compound-selector>> )`, so
 *     `::slotted(*)` and `::slotted(div.foo)` are valid selectors.
 *   - css-shadow-1 #part-selector grammar: `::part() = ::part( <<ident>>+ )`,
 *     so `::part(tab active)` is a valid multi-part selector.
 * Both must parse as valid, known pseudo-elements. Asserts the intended
 * contract so this command FAILS while the hole is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizePseudoElement } from '../../src/cascade/index.ts';

test('CRS-0004/C01: ::slotted accepts a compound selector', () => {
  const star = normalizePseudoElement('::slotted(*)');
  assert.equal(star?.valid, true, '::slotted(*) is a valid <compound-selector>');
  assert.equal(star?.isKnown, true, '::slotted is in KNOWN_FUNCTIONAL_PSEUDO_ELEMENTS');

  const compound = normalizePseudoElement('::slotted(div.foo)');
  assert.equal(compound?.valid, true, '::slotted(div.foo) is a valid <compound-selector>');
  assert.equal(compound?.isKnown, true, 'compound ::slotted argument must stay known');
});

test('CRS-0004/C02: ::part accepts a space-separated ident list', () => {
  const single = normalizePseudoElement('::part(tab)');
  assert.equal(single?.valid, true);
  assert.equal(single?.isKnown, true);

  const list = normalizePseudoElement('::part(tab active)');
  assert.equal(list?.valid, true, 'css-shadow-1 defines ::part( <<ident>+ )');
  assert.equal(list?.isKnown, true, 'multi-ident ::part argument must stay known');
});
