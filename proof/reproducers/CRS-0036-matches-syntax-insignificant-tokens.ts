/**
 * Reproducer for CRS-0036/C22 (src/PropertyRegistry.ts matchesSyntax).
 * matchesSyntax counts every component value it receives, including
 * whitespace and comment tokens, and its checkItem arms require exactly one
 * token. parser-api.ts evaluateSupportsDeclaration passes the unfiltered
 * component-value list (src/parser-api.ts:677), so an insignificant trailing
 * comment makes a grammatically valid value fail. css-syntax-3 #serialization
 * and css-conditional-3 #the-css-namespace... make comments insignificant in
 * declaration values, so CSS.supports('z-index', '1 /*c*/') must return true.
 *
 * Asserts the SAFE contract: insignificant tokens do not change the match.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-V5GA
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSS } from '../../src/parser-api.ts';
import { matchesSyntax } from '../../src/PropertyRegistry.ts';
import { tokenize } from '../../src/tokenizer.ts';
import { Parser } from '../../src/parser.ts';

function componentValues(css: string) {
  return new Parser(tokenize(css)).parseComponentValues();
}

test('CRS-0036/C22: matchesSyntax ignores an insignificant trailing comment', () => {
  assert.equal(matchesSyntax(componentValues('1 /*c*/'), '<integer>'), true);
  assert.equal(matchesSyntax(componentValues('red /*c*/'), '<color>'), true);
});

test("CRS-0036/C22: CSS.supports('z-index', '1 /*c*/') is true", () => {
  assert.equal(CSS.supports('z-index', '1 /*c*/'), true);
});

test("CRS-0036/C22: CSS.supports('color', 'red /*c*/') is true", () => {
  assert.equal(CSS.supports('color', 'red /*c*/'), true);
});

test('control: comment-free values keep evaluating true', () => {
  assert.equal(CSS.supports('z-index', '1'), true);
  assert.equal(CSS.supports('color', 'red'), true);
});
