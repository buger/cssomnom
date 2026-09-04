/**
 * Reproducer for CRS-0069/C30: Parser.resolveVariables overflows the JS
 * stack on deeply nested values that parse() itself accepts.
 *
 * #resolveVariablesInString first serializes the stored declaration value
 * (style.getPropertyValue) and then re-parses it; serializer.ts serializeNode
 * and the resolver walkers recurse once per nesting level with no depth
 * budget (src/parser.ts:1727-1740). A 4000-deep calc() parses cleanly but
 * resolveVariables dies with a raw RangeError. css-values-4 #calc-syntax
 * admits arbitrarily nested calc(); a consumer must fail closed with a
 * structured error instead of exhausting the engine stack.
 *
 * Reproduces: CRS-0069 resolveVariables deep-value recursion
 * Verifies: SYS-REQ-260821-7521
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

type Style = { getPropertyValue(p: string): string };

function deepCalcStyle(depth: number): Style {
  const css = 'a{ x:' + 'calc('.repeat(depth) + '1' + ')'.repeat(depth) + '; }';
  const sheet = parse(css) as CSSStyleSheet; // parse itself must succeed here
  return (sheet.cssRules[0] as unknown as { style: Style }).style;
}

test('control: shallow calc value resolves through resolveVariables', () => {
  const style = deepCalcStyle(5);
  const out = Parser.resolveVariables(style, 'x');
  assert.ok(typeof out === 'string' && out.length > 0);
});

test('CRS-0069/C30: parse-accepted 4000-deep calc resolves without a raw RangeError', () => {
  const style = deepCalcStyle(4000);
  let out: string | undefined;
  let err: unknown;
  try {
    out = Parser.resolveVariables(style, 'x');
  } catch (e) {
    err = e;
  }
  assert.ok(
    err === undefined,
    `resolveVariables threw ${(err as Error)?.name}: ${(err as Error)?.message} — a value parse() accepts must resolve without exhausting the engine stack (SYS-REQ-260821-7521 recursion_depth_bounded)`,
  );
  assert.ok(typeof out === 'string');
});
