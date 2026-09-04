/**
 * Reproducer for CRS-0050/C16 (src/parser.ts Parser.handleViewTransitionRule).
 * css-view-transitions-2 #view-transition-rule types the rule as
 * `@view-transition { <declaration-list> }` with an empty prelude; any
 * prelude token makes the at-rule syntactically invalid and it must be
 * dropped. handleViewTransitionRule never inspects rule.prelude, so
 * '@view-transition foo { navigation: auto }' survives and silently drops
 * the prelude from its serialized form.
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

test('CRS-0050/C16: @view-transition with a prelude is dropped', () => {
  const rules = parseStyleSheet('@view-transition foo { navigation: auto }');
  assert.equal(rules.length, 0, 'the @view-transition grammar has an empty prelude; junk must drop the rule');
});

test('control: the prelude-free @view-transition keeps parsing', () => {
  const rules: unknown[] = parseStyleSheet('@view-transition { navigation: auto; }');
  assert.equal(rules.length, 1);
  assert.ok(String((rules[0] as { cssText: string }).cssText).includes('navigation'));
});
