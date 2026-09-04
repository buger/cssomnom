/**
 * Reproducer for CRS-0060/C20 (requirement SYS-REQ-260821-KV30, src/types.ts + src/CSSOM.ts).
 *
 * css-view-transitions-2 #cssom defines the CSSViewTransitionRule IDL:
 *
 *     [Exposed=Window]
 *     interface CSSViewTransitionRule : CSSRule {
 *         readonly attribute CSSOMString navigation;
 *         [SameObject] readonly attribute FrozenArray<CSSOMString> types;
 *     };
 *
 * and the {{CSSViewTransitionRule/types}} getter steps return the value of the
 * corresponding ''@view-transition/types'' descriptor if one exists, otherwise
 * an empty list. The runtime class (src/CSSOM.ts CSSViewTransitionRule) exposes
 * only `navigation`, and the interface in src/types.ts mirrors that gap, so a
 * parsed ''types'' descriptor is unreachable and dropped from cssText.
 *
 * Asserts the intended contract so this command FAILS while the bug is present.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/parser.ts';
import { CSSViewTransitionRule } from '../../src/CSSOM.ts';

test('CRS-0060/C20: @view-transition types descriptor is exposed on the rule', () => {
  const sheet = parse('@view-transition { navigation: auto; types: root; }');
  const rule = sheet.cssRules[0];
  assert.ok(rule instanceof CSSViewTransitionRule, 'the rule must be a CSSViewTransitionRule');
  assert.equal(rule.navigation, 'auto', 'navigation descriptor round-trips');

  // css-view-transitions-2 #cssom: the types getter returns the descriptor value.
  assert.ok(rule.types !== undefined, 'CSSViewTransitionRule.types must exist per css-view-transitions-2 #cssom');
  assert.deepEqual(Array.from(rule.types as Iterable<string>), ['root'],
    'types: root must expose the single type "root"');

  // The serializer must not silently drop the descriptor either.
  assert.ok(rule.cssText.includes('root'), 'cssText must retain the types descriptor value');
});

test('CRS-0060/C20: missing types descriptor yields an empty list, not undefined', () => {
  const sheet = parse('@view-transition { navigation: auto; }');
  const rule = sheet.cssRules[0] as unknown as { types?: Iterable<string> };
  // css-view-transitions-2: otherwise an empty list.
  assert.ok(rule.types !== undefined, 'types must always exist (empty list when no descriptor)');
  assert.deepEqual(Array.from(rule.types as Iterable<string>), []);
});
