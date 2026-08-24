/**
 * Overlay reproducer for KI-111.  CSS.registerProperty() must parse an
 * initial value against the registered syntax instead of accepting arbitrary
 * functions through a shallow matcher.
 *
 * Reproduces: KI-111
 * Verifies: SYS-REQ-260822-V111
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';

let serial = 0;
function definition(syntax: string, initialValue: string): { name: string; syntax: string; inherits: false; initialValue: string } {
  serial += 1;
  return {
    name: `--ki111-${serial}`,
    syntax,
    inherits: false,
    initialValue,
  };
}

// properties-values-api #the-registerproperty-function and #supported-names:
// valid initial values are positive controls for each syntax matcher.
// Verifies: SYS-REQ-260822-V111
// MCDC SYS-REQ-260822-V111: registered_value_invalid=F, registration_rejected=F => TRUE [no-action: valid initial values do not enter rejection handling]
// MCDC SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=F => FALSE [known-issue] [ki: KI-111]
// MCDC SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=T => TRUE [known-issue] [ki: KI-111]
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
test('KI-111 positive controls: valid length and image values register', () => {
  assert.doesNotThrow(() => CSS.registerProperty(definition('<length>', '10px')));
  assert.doesNotThrow(() => CSS.registerProperty(definition('<image>', 'url(ki111.png)')));
});

// properties-values-api #the-registerproperty-function: parse the initial
// value with the syntax definition and throw SyntaxError on parse failure.
// Verifies: SYS-REQ-260822-V111
//mcdc:ignore:capability-gap SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=F => FALSE -- the matcher currently accepts invalid typed initial values; the failing public-API tripwire is KI-111 [reviewed: REVIEW-47] [ki: KI-111] [category: capability-gap]
// MCDC SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=F => FALSE [known-issue] [ki: KI-111]
test('KI-111: registerProperty rejects an invalid <length> function', () => {
  assert.throws(
    () => CSS.registerProperty(definition('<length>', 'calc(foo)')),
    (error: unknown) => error !== null && typeof error === 'object' && (error as { name?: string }).name === 'SyntaxError',
  );
});

// properties-values-api #the-registerproperty-function and #supported-names:
// <image> accepts image values, not every function token.
// Verifies: SYS-REQ-260822-V111
//mcdc:ignore:known-issue SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=T => TRUE -- the satisfied invalid-value row becomes reachable after the KI-111 syntax matcher fix [reviewed: REVIEW-47] [ki: KI-111]
// MCDC SYS-REQ-260822-V111: registered_value_invalid=T, registration_rejected=T => TRUE [known-issue] [ki: KI-111]
test('KI-111: registerProperty rejects an arbitrary <image> function', () => {
  assert.throws(
    () => CSS.registerProperty(definition('<image>', 'not-an-image(1)')),
    (error: unknown) => error !== null && typeof error === 'object' && (error as { name?: string }).name === 'SyntaxError',
  );
});
