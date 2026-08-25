/**
 * Overlay reproducer for KI-129. This file intentionally stays red until
 * StylePropertyMap.append() throws the pending-substitution TypeError when the
 * target longhand carries a var() reference inherited from a shorthand.
 *
 * Reproduces: KI-129
 * Verifies: SYS-REQ-260825-2FMA
 *
 * Spec anchors:
 * - css-typed-om-1 #append-to-a-stylepropertymap step 7 (~line 642):
 *   "If |props|[|property|] contains a var() reference, throw a TypeError."
 *   The step runs before any mutation, so a throwing append must leave the
 *   stored list untouched.
 * - css-variables-1 (#substitute-a-var) defines var() as an arbitrary
 *   substitution function; a shorthand value containing it stays unexpanded
 *   until computed-value time, so every longhand derived from
 *   'transition: var(--a)' still "contains a var() reference".
 * - Local WPT declared/append.tentative.html pins both directions:
 *     createDeclaredStyleMap(t, 'transition-duration: var(--a)') + append
 *       -> throws ("Appending to a list containing a variable reference");
 *     createDeclaredStyleMap(t, 'transition: var(--a)') + append
 *       -> throws ("Appending to a longhand list containing a variable
 *          reference should throw").
 *
 * Root-dedup notes:
 * - vs KI-107/KI-108/KI-109 (var() feature-query grammar and substitution
 *   order): different surface. Those cover CSS.supports() parsing and cascade
 *   substitution; this KI covers the Typed OM append guard only.
 * - Scope note: set() has no equivalent clause in #dom-stylepropertymap-set;
 *   replacing the entry is spec-consistent there. This filing asserts the
 *   append path only.
 *
 * Observed defect at HEAD via public API:
 *   declared 'transition: var(--a)'; append('transition-duration', CSS.s(1))
 *   does not throw and silently stores 1s.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, StylePropertyMap, CSSStyleValue } from '../../src/index.ts';

function mapFor(cssText: string): StylePropertyMap {
  const sheet = parse(`div{${cssText}}`);
  return new StylePropertyMap(sheet.cssRules[0].style);
}

// Reproduces: KI-129
// Verifies: SYS-REQ-260825-2FMA (positive controls)
describe('KI-129 controls', () => {
  test('append against a longhand var() reference throws TypeError', () => {
    assert.throws(
      () => mapFor('transition-duration: var(--a)').append('transition-duration', CSSStyleValue.parse('transition-duration', '1s')),
      TypeError,
      'the own-text pending-substitution guard exists and fires',
    );
  });

  test('append without any var() reference keeps appending', () => {
    const m = mapFor('transition-duration: 5s');
    m.append('transition-duration', '1s');
    assert.deepEqual(
      m.getAll('transition-duration').map((v) => v.toString()),
      ['5s', '1s'],
    );
  });
});

// Reproduces: KI-129
// Verifies: SYS-REQ-260825-2FMA (shorthand-hidden var() legs)
describe('KI-129: append must reject longhands carrying shorthand-inherited var() references', () => {
  test("append behind 'transition: var(--a)' throws TypeError", () => {
    assert.throws(
      () => mapFor('transition: var(--a)').append('transition-duration', CSSStyleValue.parse('transition-duration', '1s')),
      TypeError,
      'css-typed-om-1 #append-to-a-stylepropertymap step 7 requires the throw',
    );
  });

  test('the rejected append leaves the longhand storage untouched', () => {
    const m = mapFor('transition: var(--a)');
    try {
      m.append('transition-duration', '1s');
    } catch {
      // Step 7 throws before step 9 mutates; reaching here is not the defect.
    }
    assert.equal(
      m.get('transition-duration'),
      null,
      `step 7 precedes mutation, but get() returned ${String(m.get('transition-duration'))}`,
    );
  });
});
