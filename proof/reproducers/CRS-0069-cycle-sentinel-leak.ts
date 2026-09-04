/**
 * Reproducer for CRS-0069/C31: cycle / guaranteed-invalid sentinels leak
 * into the serialized resolved value when the failing var() sits inside a
 * function or block.
 *
 * #resolveVariablesInString scans only the TOP-LEVEL component values for
 * the '\0guaranteed-invalid' / '\0cycle:' markers (src/parser.ts:1706).
 * #resolveOneVariable nests markers produced inside function and block
 * values (1727-1740), so the scan misses them and serialize() emits the
 * sentinel into the computed value. css-variables-1 #guaranteed-invalid
 * makes the whole property resolve to the empty invalid signal instead.
 *
 * Reproduces: CRS-0069 nested sentinel leak
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

test('control: top-level missing var() resolves to the empty invalid signal', () => {
  const style = styleOf('a { width: var(--undef); }');
  assert.equal(Parser.resolveVariables(style, 'width'), '');
});

test('CRS-0069/C31: missing var() nested in calc() resolves to empty, not a sentinel leak', () => {
  const style = styleOf('a { width: calc(1px + var(--undef)); }');
  const out = Parser.resolveVariables(style, 'width');
  assert.equal(
    out,
    '',
    `expected '' (css-variables-1 #guaranteed-invalid poisons the containing value), got ${JSON.stringify(out)}`,
  );
});

test('CRS-0069/C31: cycle marker nested in a function never reaches the output', () => {
  const style = styleOf('a { --a: calc(1px + var(--b)); --b: calc(1px + var(--a)); width: var(--a); }');
  const out = Parser.resolveVariables(style, 'width');
  assert.equal(out, '', `expected '' for a substitution cycle, got ${JSON.stringify(out)}`);
});
