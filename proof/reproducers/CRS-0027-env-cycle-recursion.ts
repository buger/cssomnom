/**
 * Reproducer for CRS-0027/C10 (src/parser.ts Parser.#resolveEnvFunction).
 * css-variables-1 #using-variables treats env() like var(): a substitution
 * cycle makes the declaration invalid at computed-value time, never an
 * unbounded recursion. #resolveEnvFunction re-enters
 * #resolveVariablesInComponentValues on the raw envMap value with no envName
 * in the seen set, so an envMap entry naming itself overflows the JS stack
 * inside Parser.resolveVariables.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';
import type { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';

function styleOf(css: string): CSSStyleDeclaration {
  const sheet = parse(css) as CSSStyleSheet;
  return (sheet.cssRules[0] as unknown as { style: CSSStyleDeclaration }).style;
}

test('control: a non-cyclic envMap entry substitutes', () => {
  const style = styleOf('x { color: env(safe-area-inset-top); }');
  const out = Parser.resolveVariables(style, 'color', { 'safe-area-inset-top': '1px' });
  assert.equal(out.trim(), '1px');
});

test('CRS-0027/C10: a self-referential envMap entry does not overflow the stack', () => {
  const style = styleOf('x { color: env(safe-area-inset-top); }');
  let out: string | undefined;
  let err: unknown;
  try {
    out = Parser.resolveVariables(style, 'color', { 'safe-area-inset-top': 'env(safe-area-inset-top)' });
  } catch (e) {
    err = e;
  }
  assert.ok(err === undefined, `resolveVariables threw ${(err as Error)?.name}: ${(err as Error)?.message}`);
  assert.equal(out, '', 'an env() cycle resolves to the guaranteed-invalid (empty) value');
});
