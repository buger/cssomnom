/**
 * Reproducer for CRS-0069/C29: Parser.resolveVariables does not dispatch
 * mixed-case VAR()/ENV() stored in custom properties.
 *
 * #resolveOneVariable compares function names with === 'var' / === 'env'
 * (src/parser.ts:1721-1724) while validateVarFunction lowercases the name
 * (1888). css-values-4 § 4.1 #keywords makes CSS function names ASCII
 * case-insensitive. A custom property keeps its raw author text, so 'VAR'
 * survives to substitution and the reference stays literal.
 *
 * Distinct from KI-109 (cascade gate) and KI-150 (cascade substring test):
 * this pins the parser-level resolver gate itself.
 *
 * Reproduces: CRS-0069 resolveVariables mixed-case dispatch
 * Verifies: SYS-REQ-260821-7521
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, Parser } from '../../src/parser.ts';
import { CSSStyleSheet } from '../../src/CSSOM.ts';

type Style = { getPropertyValue(p: string): string };

function styleOf(css: string): Style {
  const sheet = parse(css) as CSSStyleSheet;
  return (sheet.cssRules[0] as unknown as { style: Style }).style;
}

test('control: lowercase var() through a custom-property chain resolves', () => {
  const style = styleOf('a { --x: red; --y: var(--x); color: var(--y); }');
  assert.equal(Parser.resolveVariables(style, 'color'), 'red');
});

test('CRS-0069/C29: uppercase VAR() in a custom property resolves like var()', () => {
  const style = styleOf('a { --x: red; --y: VAR(--x); color: var(--y); }');
  assert.equal(
    Parser.resolveVariables(style, 'color'),
    'red',
    'VAR() is ASCII case-insensitive (css-values-4 #keywords); the reference must substitute',
  );
});

test('CRS-0069/C29: uppercase ENV() in a custom property resolves like env()', () => {
  const style = styleOf('a { --safe: ENV(safe-area-inset-top); color: var(--safe); }');
  assert.equal(
    Parser.resolveVariables(style, 'color', { 'safe-area-inset-top': '1px' }),
    '1px',
    'ENV() is ASCII case-insensitive; the envMap entry must substitute',
  );
});
