/**
 * Overlay reproducer for KI-18: parser unbounded nesting depth.
 *
 * The css-syntax-3 consume algorithms (§ 5.5 "consume a qualified rule",
 * § 5.4.1 "consume a list of rules", § 5.5.x "consume an at-rule") recover
 * from malformed or pathological input by reporting parse errors and
 * dropping constructs; they never require unbounded recursion of the host.
 * A RangeError escaping parse() / replaceSync() violates both the
 * stylesheet_returned guarantee and the recursion_depth_bounded hazard on
 * SYS-REQ-260821-7521 ("Deeply nested @media/@supports/style rules recurse
 * without a depth cap and overflow the JS stack, crashing the host process").
 *
 * Asserts the SAFE contract: deeply nested style rules / @media blocks must
 * either parse to a CSSStyleSheet or fail with a structured parse error —
 * never a raw engine RangeError.
 *
 * Reproduces: KI-18
 * Verifies: SYS-REQ-260821-7521
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { parse } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

function nestStyle(depth: number): string {
  return 'a{'.repeat(depth) + 'x:1' + '}'.repeat(depth);
}

function nestMedia(depth: number): string {
  return '@media all{'.repeat(depth) + '}'.repeat(depth);
}

function assertNotRangeError(fn: () => unknown, label: string): void {
  let threw: unknown;
  try {
    fn();
  } catch (e) {
    threw = e;
  }
  if (threw === undefined) return;
  assert.ok(
    !(threw instanceof RangeError),
    `KI-18: ${label} escaped as ${(threw as Error).name}: ${(threw as Error).message} — parser recursion is not depth-bounded (SYS-REQ-260821-7521 recursion_depth_bounded)`,
  );
}

describe('KI-18 e2e parser nesting depth budget', () => {
  test('positive control: shallow nesting parses to a stylesheet', () => {
    const sheet = parse(nestStyle(200));
    assert.ok(sheet instanceof CSSStyleSheet);
    assert.equal(sheet.cssRules.length, 1);
  });

  // Reproduces: KI-18
  // Verifies: SYS-REQ-260821-7521
  test('deep nested style rules do not overflow the JS stack via parse()', () => {
    let sheet: unknown;
    try {
      sheet = parse(nestStyle(4000));
    } catch (e) {
      assertNotRangeError(() => {
        throw e;
      }, 'parse(nestStyle(4000))');
      return;
    }
    assert.ok(sheet instanceof CSSStyleSheet);
  });

  // Reproduces: KI-18
  // Verifies: SYS-REQ-260821-7521
  test('deep nested @media blocks do not overflow the JS stack via parse()', () => {
    let sheet: unknown;
    try {
      sheet = parse(nestMedia(2000));
    } catch (e) {
      assertNotRangeError(() => {
        throw e;
      }, 'parse(nestMedia(2000))');
      return;
    }
    assert.ok(sheet instanceof CSSStyleSheet);
  });

  // Reproduces: KI-18
  // Verifies: SYS-REQ-260821-7521
  test('deep nested style rules do not overflow the JS stack via CSSStyleSheet.replaceSync()', () => {
    const sheet = new CSSStyleSheet();
    try {
      sheet.replaceSync(nestStyle(4000));
    } catch (e) {
      assertNotRangeError(() => {
        throw e;
      }, 'replaceSync(nestStyle(4000))');
      return;
    }
    assert.ok(sheet instanceof CSSStyleSheet);
  });
});
