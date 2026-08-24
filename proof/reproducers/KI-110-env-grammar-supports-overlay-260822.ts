/**
 * Overlay reproducer for KI-110.  This KI intentionally keeps the two
 * independently failing paths under one env() grammar root: CSS.supports()
 * handling and computed-value invalidation for a malformed index.
 *
 * Reproduces: KI-110
 * Verifies: SYS-REQ-260822-V110, SYS-REQ-260822-V11A
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { Parser } from '../../src/parser.ts';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

// css-env-1 #env-function: a syntactically valid env() makes the containing
// property grammar valid at parse time; an empty env() is not valid.
// Verifies: SYS-REQ-260822-V110
// MCDC SYS-REQ-260822-V110: supports_env_true=F, syntactically_valid_env=F => TRUE [no-action: ordinary-value control does not enter env() support handling]
// MCDC SYS-REQ-260822-V110: supports_env_true=F, syntactically_valid_env=T => FALSE [known-issue] [ki: KI-110]
// MCDC SYS-REQ-260822-V110: supports_env_true=T, syntactically_valid_env=T => TRUE [known-issue] [ki: KI-110]
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-110 positive controls: ordinary values and valid indexed env() parse', () => {
  assert.equal(CSS.supports('width', '10px'), true);
  assert.equal(CSS.supports('width', 'env()'), false);
});

// Verifies: SYS-REQ-260822-V11A
// MCDC SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=F, invalid_env_index=F => TRUE [no-action: non-negative index control does not enter invalid-index handling]
// MCDC SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=F, invalid_env_index=T => FALSE [known-issue] [ki: KI-110]
// MCDC SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=T, invalid_env_index=T => TRUE [known-issue] [ki: KI-110]
test('KI-110 positive control: a non-negative env() index resolves', () => {
  const style = new CSSStyleDeclaration();
  style.setProperty('width', 'env(ki110-name 0)');
  assert.equal(Parser.resolveVariables(style, 'width', { 'ki110-name 0': '8px' }), '8px');
});

// css-conditional-3 #the-css-interface and css-env-1 #env-function.
// Verifies: SYS-REQ-260822-V110
//mcdc:ignore:known-issue SYS-REQ-260822-V110: supports_env_true=T, syntactically_valid_env=T => TRUE -- the satisfied valid-env row becomes reachable after the KI-110 supports() fix [reviewed: REVIEW-45] [ki: KI-110]
// MCDC SYS-REQ-260822-V110: supports_env_true=T, syntactically_valid_env=T => TRUE [known-issue] [ki: KI-110]
test('KI-110: CSS.supports accepts a valid env() with no fallback', () => {
  assert.equal(CSS.supports('width', 'env(ki110-name)'), true);
});

// css-env-1 #env-function: env(name,) is the valid empty-fallback form.
// Verifies: SYS-REQ-260822-V110
//mcdc:ignore:capability-gap SYS-REQ-260822-V110: supports_env_true=F, syntactically_valid_env=T => FALSE -- CSS.supports currently rejects valid env() syntax; the failing public-API tripwire is KI-110 [reviewed: REVIEW-45] [ki: KI-110] [category: capability-gap]
// MCDC SYS-REQ-260822-V110: supports_env_true=F, syntactically_valid_env=T => FALSE [known-issue] [ki: KI-110]
test('KI-110: CSS.supports accepts a valid env() with an empty fallback', () => {
  assert.equal(CSS.supports('width', 'env(ki110-name,)'), true);
});

// css-env-1 #env-function and indexed-env WPT: indices are non-negative
// integers; an invalid function makes the declaration invalid rather than
// selecting the unindexed environment variable.
// Verifies: SYS-REQ-260822-V11A
//mcdc:ignore:capability-gap SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=F, invalid_env_index=T => FALSE -- negative env() indices currently reach the wrong fallback path; the failing public-API tripwire is KI-110 [reviewed: REVIEW-46] [ki: KI-110] [category: capability-gap]
// MCDC SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=F, invalid_env_index=T => FALSE [known-issue] [ki: KI-110]
//mcdc:ignore:known-issue SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=T, invalid_env_index=T => TRUE -- the satisfied invalid-index row becomes reachable after the KI-110 env() grammar fix [reviewed: REVIEW-46] [ki: KI-110]
// MCDC SYS-REQ-260822-V11A: env_invalid_at_computed_value_time=T, invalid_env_index=T => TRUE [known-issue] [ki: KI-110]
test('KI-110: a negative env() index is invalid at computed-value time', () => {
  const style = new CSSStyleDeclaration();
  style.setProperty('width', 'env(ki110-name -1, 5px)');
  assert.equal(Parser.resolveVariables(style, 'width', { 'ki110-name': '9px' }), '');
});
