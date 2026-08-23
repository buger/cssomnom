/**
 * Overlay reproducer for KI-35: registerProperty accepts invalid {N}/{N,M}
 * syntax multipliers.
 *
 * css-properties-values-api § 2.2 "The '+' and '#' Multipliers" (#multipliers,
 * submodules/css-houdini-drafts/css-properties-values-api/Overview.bs:976-991)
 * closes the multiplier set: "Any syntax component name ... may be immediately
 * followed by a multiplier: U+002B PLUS SIGN (+) indicates a space-separated
 * list. U+0023 NUMBER SIGN (#) indicates a comma-separated list." No brace
 * repetition forms ({N} or {N,M}) exist anywhere in the syntax-string grammar
 * (#syntax-strings, :1020-1031), so '<length>{2}' is not a valid syntax string
 * and CSS.registerProperty must throw a SyntaxError (register-a-custom-property
 * step: "If name does not start with '--' or parsing syntax fails, throw a
 * SyntaxError", #the-registerproperty-function).
 *
 * Distinctness from KI-111: KI-111 covers initial-value matcher validation
 * (values not matching the registered syntax); this issue is the syntax-string
 * GRAMMAR itself admitting an out-of-set multiplier.
 *
 * Asserts the SAFE contract: brace-multiplier syntax strings are rejected with
 * SyntaxError; the legal +/# multipliers remain accepted.
 *
 * Reproduces: KI-35
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '/workspace/src/parser-api.ts';

// Reproducer constants mirrored in specs/system/variables/property-registry-syntax-budget.vars.yaml:
const ILLEGAL_BRACE_MULTIPLIERS = 2; // '<length>{2}', '<length>{2,4}'
const LEGAL_MULTIPLIERS = 2; // '+', '#'

let seq = 0;
function tryRegister(syntax: string, initialValue: string): unknown {
  seq++;
  return CSS.registerProperty({
    name: `--ki35-probe-${seq}`,
    syntax,
    initialValue,
    inherits: false,
  });
}

describe('KI-35 registerProperty rejects brace multipliers in syntax strings', () => {
  test('positive control: legal space-separated + multiplier accepted', () => {
    assert.doesNotThrow(() => tryRegister('<length>+', '1px 2px'));
  });

  test('positive control: legal comma-separated # multiplier accepted', () => {
    assert.doesNotThrow(() => tryRegister('<length>#', '1px, 2px'));
  });

  // Reproduces: KI-35
  test(`all ${ILLEGAL_BRACE_MULTIPLIERS} brace-multiplier syntaxes throw SyntaxError`, () => {
    const illegal: Array<[string, string]> = [
      ['<length>{2}', '1px 2px'],
      ['<length>{2,4}', '1px 2px'],
    ];
    let accepted = 0;
    for (const [syntax, init] of illegal) {
      try {
        tryRegister(syntax, init);
        accepted++;
      } catch (e) {
        assert.equal(
          (e as Error).name,
          'SyntaxError',
          `KI-35: rejection of "${syntax}" must be a SyntaxError, got ${(e as Error).name}`,
        );
      }
    }
    assert.equal(
      accepted,
      0,
      `KI-35: ${accepted}/${ILLEGAL_BRACE_MULTIPLIERS} brace-multiplier syntax strings were ACCEPTED by registerProperty; the multiplier set is closed to '+' and '#' (css-properties-values-api #multipliers)`,
    );
  });

  // Reproduces: KI-35
  test('single illegal form <length>{2} throws SyntaxError directly', () => {
    assert.throws(() => tryRegister('<length>{2}', '1px 2px'), SyntaxError);
  });

  assert.equal(ILLEGAL_BRACE_MULTIPLIERS, 2);
  assert.equal(LEGAL_MULTIPLIERS, 2);
});
