/**
 * Overlay reproducer for KI-107.  This file intentionally stays red until
 * malformed var() functions stop making CSS.supports() return true.
 *
 * Reproduces: KI-107
 * Verifies: SYS-REQ-260822-V107
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';

// css-conditional-3 #the-css-interface: supports(property, value) returns
// true only when the value parses according to the property's grammar.
// css-variables-1 #using-variables: var() has one dashed-ident name and an
// optional fallback after a comma; var(--x,) is the valid empty-fallback case.
// Verifies: SYS-REQ-260822-V107
// MCDC SYS-REQ-260822-V107: malformed_var_function=F, supports_false=F => TRUE [no-action: valid var() controls do not enter malformed-input handling]
// MCDC SYS-REQ-260822-V107: malformed_var_function=T, supports_false=F => FALSE [known-issue] [ki: KI-107]
// MCDC SYS-REQ-260822-V107: malformed_var_function=T, supports_false=T => TRUE [known-issue] [ki: KI-107]
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-107 positive controls: valid var() forms are supported', () => {
  assert.equal(CSS.supports('color', 'var(--ki107-name)'), true);
  assert.equal(CSS.supports('color', 'var(--ki107-name,)'), true);
  assert.equal(CSS.supports('color', 'var(--ki107-name, red)'), true);
});

// Verifies: SYS-REQ-260822-V107
//mcdc:ignore:capability-gap SYS-REQ-260822-V107: malformed_var_function=T, supports_false=F => FALSE -- malformed var() currently reports true; the failing public-API tripwire is KI-107 [reviewed: REVIEW-42] [ki: KI-107] [category: capability-gap]
// MCDC SYS-REQ-260822-V107: malformed_var_function=T, supports_false=F => FALSE [known-issue] [ki: KI-107]
test('KI-107: CSS.supports rejects an empty var() argument list', () => {
  assert.equal(CSS.supports('color', 'var()'), false);
});

// Verifies: SYS-REQ-260822-V107
//mcdc:ignore:known-issue SYS-REQ-260822-V107: malformed_var_function=T, supports_false=T => TRUE -- the satisfied malformed-input row is reachable only after the KI-107 parser fix [reviewed: REVIEW-42] [ki: KI-107]
// MCDC SYS-REQ-260822-V107: malformed_var_function=T, supports_false=T => TRUE [known-issue] [ki: KI-107]
test('KI-107: CSS.supports rejects a var() name with a second token', () => {
  assert.equal(CSS.supports('color', 'var(--ki107-name red)'), false);
});

// Verifies: SYS-REQ-260822-V107
test('KI-107: CSS.supports rejects an unclosed var() function', () => {
  assert.equal(CSS.supports('color', 'var(--ki107-name'), false);
});

// Verifies: SYS-REQ-260822-V107
test('KI-107: CSS.supports rejects an unclosed var() fallback', () => {
  assert.equal(CSS.supports('color', 'var(--ki107-name,'), false);
});
