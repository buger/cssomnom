/**
 * Overlay reproducer for KI-38: the cascade computed-value path ignores
 * PropertyRegistry - initial-value substitution, the inherits flag and syntax
 * validation of registered custom properties are all dead inside
 * getCascadedStyle().
 *
 * css-properties-values-api § 2.5 "Computed Value-Time Behavior"
 * (#calculation-of-computed-values,
 * submodules/css-houdini-drafts/css-properties-values-api/Overview.bs:202-216)
 * is load-bearing:
 *
 *   The computed value of a registered custom property is determined by the
 *   syntax of its registration. ... Otherwise, attempt to CSS/parse the
 *   property's value according to its registered syntax. If this fails, the
 *   declaration is invalid at computed-value time and the computed value is
 *   determined accordingly.
 *
 * § 2.4.1 "#inherits-descriptor" (Overview.bs:617, 627-629) specifies that
 * the inherits descriptor controls "whether or not the property inherits by
 * default", and § 2.4.2 "#initial-value-descriptor" (Overview.bs:632,
 * controlling sentence :642-644) that initial-value "controls the property's
 * initial value". css-variables-1 #guaranteed-invalid additionally makes a
 * var() referencing an invalid registered value without fallback
 * invalid-at-computed-value-time.
 *
 * Root cause: substituteVariables/resolveCustomProperties
 * (src/cascade/variable-resolver.ts:50+, :220+) consult only the cascaded
 * custom-property maps and never PropertyRegistry, while Parser's own
 * #resolveVarFunction (src/parser.ts:1726-1823) DOES apply the registry -
 * two resolvers in the same engine disagree about the same registration:
 *
 *   Leg 1: width: var(--len) with NO --len anywhere must substitute the
 *          registered initial value '10px'; getCascadedStyle returns ''.
 *   Leg 2: a TRUE descendant (#c carries ONLY class c - it does not match
 *          '.p' itself) inside <div class=p> reads parent .p{--len:40px}
 *          through its width:var(--len) ('40px') despite the inherits:false
 *          registration; per #inherits-descriptor :627-629 the property must
 *          not inherit by default. The inherits:true control over the SAME
 *          descendant shape DOES propagate.
 *   Leg 3: .p{--len:red} fails <length> validation; 'red' leaks through as
 *          width:'red' instead of invalid-at-computed-value-time.
 *
 * Fixture note: an earlier draft of leg 2 put BOTH classes on the child
 * (<div class="p c">), so '.p{--len:40px}' applied to the child DIRECTLY -
 * direct application is correct even under inherits:false (the descriptor
 * only blocks inheritance), so that markup could not evidence a leak. The
 * child now carries only the consuming class; any '40px' on it can only
 * arrive via inheritance.
 *
 * Distinctness: KI-108/109/110 cover substitution dispatch bugs (var-name
 * lookup, case-insensitivity, env grammar); KI-111/KI-35 cover registration-
 * time validation. Withdrawn KI-4 covered JS-vs-@property REGISTRATION
 * precedence (InvalidModificationError angle), not cascade precedence - no
 * cascade-precedence KI exists. This issue covers registry enforcement
 * (initial substitution / inheritance / syntax validation) being entirely
 * absent from the cascade resolver path.
 *
 * Asserts the SAFE contract: getCascadedStyle honors registered custom
 * property descriptors exactly like Parser.#resolveVarFunction does.
 *
 * Reproduces: KI-38
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import * as CSSOM from '../../src/index.ts';

// Reproducer constants mirrored in specs/system/variables/cascade-registry-budget.vars.yaml:
const REGISTERED_INITIAL_VALUE = '10px'; // initialValue of the <length> probe registration
const INHERITS_LEAK_BUDGET = 0; // zero inheritance leaks allowed through an inherits:false registration
const INVALID_AT_CV_TIME_LEAKS = 0; // zero raw invalid values may leak through var()

function cascadedWidth(css: string, html: string, selector: string): string {
  const sheet = CSSOM.parse(css);
  const { document } = parseHTML(html);
  const el = selector === 'first' ? document.querySelector('div')! : document.querySelector(selector)!;
  return CSSOM.getCascadedStyle(el, sheet.cssRules).getPropertyValue('width');
}

describe('KI-38 cascade path ignores PropertyRegistry', () => {
  test('positive control: plain literal width resolves through getCascadedStyle', () => {
    const w = cascadedWidth('.c { width: 42px; }', '<html><body><div class=c></div></body></html>', 'div');
    assert.equal(w, '42px');
  });

  // Reproduces: KI-38
  test(`unset registered var() substitutes its initial value (${REGISTERED_INITIAL_VALUE})`, () => {
    const w = cascadedWidth('.c { width: var(--len); }', '<html><body><div class=c></div></body></html>', 'div');
    assert.equal(
      w,
      REGISTERED_INITIAL_VALUE,
      `KI-38: width read ${JSON.stringify(w)}; css-properties-values-api #initial-value-descriptor requires the registered initial value when --len is unset`,
    );
  });

  // Reproduces: KI-38
  test(`inherits:false registration isolates true descendants (${INHERITS_LEAK_BUDGET} leak budget)`, () => {
    // #c carries ONLY class c, so '.p' never matches it directly; a '40px'
    // width could only reach it through INHERITANCE, which the inherits:false
    // registration forbids (css-properties-values-api #inherits-descriptor
    // :627-629).
    const leaked = cascadedWidth(
      '.p { --len: 40px; } .c { width: var(--len); }',
      '<html><body><div class=p><div class=c id=c></div></div></body></html>',
      '#c',
    );
    assert.notEqual(
      leaked,
      '40px',
      `KI-38: descendant width inherited the parent value (${JSON.stringify(leaked)}) despite inherits:false; css-properties-values-api #inherits-descriptor (:627-629) forbids inheritance here`,
    );
  });

  test('positive control: inherits:true registration does propagate to true descendants', () => {
    CSSOM.CSS.registerProperty({ name: '--inh-probe', syntax: '<length>', inherits: true, initialValue: '7px' });
    const leaked = cascadedWidth(
      '.p2 { --inh-probe: 40px; } .c2 { width: var(--inh-probe); }',
      '<html><body><div class=p2><div class=c2 id=c></div></div></body></html>',
      '#c',
    );
    assert.equal(leaked, '40px');
  });

  // Reproduces: KI-38
  test(`invalid <length> value never leaks through var() (${INVALID_AT_CV_TIME_LEAKS} leaks allowed)`, () => {
    let leaks = 0;
    const w = cascadedWidth(
      '.p3 { --len: red; } .c3 { width: var(--len); }',
      '<html><body><div class=p3 id=p></div><div class="p3 c3" id=c></div></body></html>',
      '#c',
    );
    if (w === 'red') leaks++;
    assert.equal(
      leaks,
      INVALID_AT_CV_TIME_LEAKS,
      `KI-38: 'red' failed <length> syntax yet leaked through as width:${JSON.stringify(w)}; css-properties-values-api #calculation-of-computed-values requires invalid at computed-value time instead`,
    );
  });
});
