/**
 * Reproducer for CRS-0036/C11 (src/PropertyRegistry.ts matchesSyntax
 * ident-literal arm). consumeSyntaxComponent records the '+' / '#' multiplier
 * for ident-literal syntax components (lines 142-144), but matchesSyntax's
 * ident branch requires tokens.length === 1 and never reads comp.multiplier
 * (line 264). css-properties-values-api #multipliers defines '<ident>+' as a
 * space-separated list of that ident and '<ident>#' as a comma-separated
 * list, so registerProperty({syntax:'foo+', initialValue:'foo foo'}) must
 * register; it currently throws "does not match syntax".
 *
 * Asserts the SAFE contract: list-shaped initial values match the literal
 * syntax component carrying the corresponding multiplier.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-V5GA
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PropertyRegistry, matchesSyntax } from '../../src/PropertyRegistry.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';

function componentValues(css: string) {
  const tokens = tokenize(css).filter((t) => t.type !== 'EOF' && t.type !== 'whitespace');
  return new Parser(tokens).parseComponentValues();
}

test("CRS-0036/C11: 'foo+' matches the space-separated list 'foo foo'", () => {
  assert.equal(matchesSyntax(componentValues('foo foo'), 'foo+'), true);
});

test("CRS-0036/C11: 'foo#' matches the comma-separated list 'foo,foo'", () => {
  assert.equal(matchesSyntax(componentValues('foo,foo'), 'foo#'), true);
});

test("CRS-0036/C11: registerProperty accepts initialValue 'foo foo' for syntax 'foo+'", () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() =>
    PropertyRegistry.register({ name: '--crs0036c11a', inherits: false, syntax: 'foo+', initialValue: 'foo foo' }),
  );
});

test("CRS-0036/C11: registerProperty accepts initialValue 'foo,foo' for syntax 'foo#'", () => {
  PropertyRegistry.clear();
  assert.doesNotThrow(() =>
    PropertyRegistry.register({ name: '--crs0036c11b', inherits: false, syntax: 'foo#', initialValue: 'foo,foo' }),
  );
});

test('control: single literal and <length>+ list values keep matching', () => {
  assert.equal(matchesSyntax(componentValues('foo'), 'foo'), true);
  assert.equal(matchesSyntax(componentValues('1px 2px'), '<length>+'), true);
});
