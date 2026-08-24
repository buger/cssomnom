/**
 * Overlay reproducer for KI-109.  Function dispatch in custom-property
 * substitution must be ASCII case-insensitive, including intermediate
 * custom-property values.
 *
 * Reproduces: KI-109
 * Verifies: SYS-REQ-260822-V109
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../../src/parser.ts';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function cascade(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<div class="ki109"></div>');
  const element = document.querySelector('.ki109');
  assert.ok(element, 'missing .ki109');
  const style = getCascadedStyle(element, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

// css-variables-1 #using-variables and css-env-1 #env-function: lowercase
// function spelling remains a positive control for both substitution paths.
// Verifies: SYS-REQ-260822-V109
// MCDC SYS-REQ-260822-V109: function_dispatch_case_insensitive=F, mixed_case_var_or_env=F => TRUE [no-action: lowercase controls do not enter the mixed-case dispatch path]
// MCDC SYS-REQ-260822-V109: function_dispatch_case_insensitive=F, mixed_case_var_or_env=T => FALSE [known-issue] [ki: KI-109]
// MCDC SYS-REQ-260822-V109: function_dispatch_case_insensitive=T, mixed_case_var_or_env=T => TRUE [known-issue] [ki: KI-109]
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-109 positive controls: lowercase var() and env() resolve', () => {
  const varStyle = cascade('.ki109 { --ki109-x: lime; --ki109-y: var(--ki109-x); color: var(--ki109-y, red); }');
  assert.equal(varStyle.getPropertyValue('color'), 'rgb(0, 255, 0)');

  const envStyle = cascade('.ki109 { --ki109-safe: env(safe-area-inset-top); padding-top: var(--ki109-safe, 9px); }');
  assert.equal(envStyle.getPropertyValue('padding-top'), '0px');
});

// css-variables-1 #using-variables: function names are ASCII
// case-insensitive even though custom-property values otherwise preserve
// author casing.
// Verifies: SYS-REQ-260822-V109
//mcdc:ignore:capability-gap SYS-REQ-260822-V109: function_dispatch_case_insensitive=F, mixed_case_var_or_env=T => FALSE -- mixed-case intermediate functions currently remain unresolved; the failing public-API tripwire is KI-109 [reviewed: REVIEW-44] [ki: KI-109] [category: capability-gap]
// MCDC SYS-REQ-260822-V109: function_dispatch_case_insensitive=F, mixed_case_var_or_env=T => FALSE [known-issue] [ki: KI-109]
test('KI-109: uppercase VAR() in a custom property dispatches as var()', () => {
  const style = cascade('.ki109 { --ki109-x: lime; --ki109-y: VAR(--ki109-x); color: var(--ki109-y, red); }');
  assert.equal(style.getPropertyValue('color'), 'rgb(0, 255, 0)');
});

// css-env-1 #env-function: env() is the environment-variable function;
// its spelling is ASCII case-insensitive.
// Verifies: SYS-REQ-260822-V109
//mcdc:ignore:known-issue SYS-REQ-260822-V109: function_dispatch_case_insensitive=T, mixed_case_var_or_env=T => TRUE -- the satisfied mixed-case row becomes reachable after the KI-109 dispatch fix [reviewed: REVIEW-44] [ki: KI-109]
// MCDC SYS-REQ-260822-V109: function_dispatch_case_insensitive=T, mixed_case_var_or_env=T => TRUE [known-issue] [ki: KI-109]
test('KI-109: uppercase ENV() in a custom property dispatches as env()', () => {
  const style = cascade('.ki109 { --ki109-safe: ENV(safe-area-inset-top); padding-top: var(--ki109-safe, 9px); }');
  assert.equal(style.getPropertyValue('padding-top'), '0px');
});
