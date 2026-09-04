/**
 * Reproducer for CRS-0003/C33 (src/parser.ts #resolveEnvFunction).
 * css-env-1 #env-function: when the environment variable does not exist
 * and no fallback is provided, the property containing env() is invalid
 * at computed-value time. The var() twin of this code path substitutes
 * the guaranteed-invalid ident so the property collapses to '', but
 * #resolveEnvFunction returns an empty component list, so a nested env()
 * silently deletes itself and leaves a mangled value like
 * 'calc(1px + )' on the property.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSStyleDeclaration } from '../../src/CSSStyleDeclaration.ts';
import { Parser } from '../../src/parser.ts';

function resolvedWidth(value: string, envMap: Record<string, string>): string {
  const style = new CSSStyleDeclaration();
  style.setProperty('width', value);
  return Parser.resolveVariables(style, 'width', envMap);
}

test('CRS-0003/C33: unknown env() without fallback invalidates the property', () => {
  assert.equal(resolvedWidth('calc(1px + env(unknown-thing))', {}), '',
    'the whole value must be invalid at computed-value time, not spliced empty');
});

test('CRS-0003/C33: unknown top-level env() already collapses to empty', () => {
  assert.equal(resolvedWidth('env(unknown-thing)', {}), '');
});

test('control: known env values substitute', () => {
  assert.equal(resolvedWidth('calc(1px + env(known-x))', { 'known-x': '2px' }).replace(/\s+/g, ' ').trim(), 'calc(1px + 2px)');
});

test('control: env() fallback still applies', () => {
  assert.equal(resolvedWidth('env(missing, 3px)', {}).trim(), '3px');
});
