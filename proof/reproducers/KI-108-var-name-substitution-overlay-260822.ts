/**
 * Overlay reproducer for KI-108.  The CSS Variables algorithm resolves
 * substitution functions in var()'s first argument before using it as a
 * custom-property name; the product currently does not.
 *
 * Reproduces: KI-108
 * Verifies: SYS-REQ-260822-V108
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import '../../src/parser.ts';
import { parseStyleSheet } from '../../src/parser.ts';
import { getCascadedStyle } from '../../src/cascade.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function cascade(css: string): CSSStyleDeclaration {
  const { document } = parseHTML('<div class="ki108"></div>');
  const element = document.querySelector('.ki108');
  assert.ok(element, 'missing .ki108');
  const style = getCascadedStyle(element, parseStyleSheet(css));
  assert.ok(style instanceof CSSStyleDeclaration);
  return style;
}

// css-variables-1 #using-variables: a direct custom-property reference is a
// positive control for the substitution path.
// Verifies: SYS-REQ-260822-V108
// MCDC SYS-REQ-260822-V108: nested_name_substituted=F, nested_var_name=F => TRUE [no-action: direct var() control does not enter nested-name substitution]
// MCDC SYS-REQ-260822-V108: nested_name_substituted=F, nested_var_name=T => FALSE [known-issue] [ki: KI-108]
// MCDC SYS-REQ-260822-V108: nested_name_substituted=T, nested_var_name=T => TRUE [known-issue] [ki: KI-108]
test('KI-108 positive control: direct custom-property reference resolves', () => {
  const style = cascade('.ki108 { --ki108-other: 10px; width: var(--ki108-other); }');
  assert.equal(style.getPropertyValue('width'), '10px');
});

// css-variables-1 #using-variables gives --myvar: --other and
// --result: var(var(--myvar)) as the nested-name example.
// Verifies: SYS-REQ-260822-V108
//mcdc:ignore:capability-gap SYS-REQ-260822-V108: nested_name_substituted=F, nested_var_name=T => FALSE -- nested var() names currently fail to resolve; the failing public-API tripwire is KI-108 [reviewed: REVIEW-43] [ki: KI-108] [category: capability-gap]
// MCDC SYS-REQ-260822-V108: nested_name_substituted=F, nested_var_name=T => FALSE [known-issue] [ki: KI-108]
test('KI-108: nested var() produces the custom-property name', () => {
  const style = cascade(
    '.ki108 { --ki108-other: 10px; --ki108-myvar: --ki108-other; width: var(var(--ki108-myvar)); }',
  );
  assert.equal(style.getPropertyValue('width'), '10px');
});

// css-variables-1 #replace-a-var: substitute the first argument before
// parsing it as a custom-property name, then continue replacement.
// Verifies: SYS-REQ-260822-V108
//mcdc:ignore:known-issue SYS-REQ-260822-V108: nested_name_substituted=T, nested_var_name=T => TRUE -- the satisfied nested-name row becomes reachable after the KI-108 substitution fix [reviewed: REVIEW-43] [ki: KI-108]
// MCDC SYS-REQ-260822-V108: nested_name_substituted=T, nested_var_name=T => TRUE [known-issue] [ki: KI-108]
test('KI-108: nested var() is resolved through a custom-property chain', () => {
  const style = cascade(
    '.ki108 { --ki108-other: 10px; --ki108-myvar: --ki108-other; --ki108-result: var(var(--ki108-myvar)); width: var(--ki108-result); }',
  );
  assert.equal(style.getPropertyValue('width'), '10px');
});
