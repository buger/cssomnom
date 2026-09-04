/**
 * Reproducer for CRS-0038/C18 (src/parser.ts Parser.parseRule instance
 * method). css-syntax-3 #parse-rule step 3 returns a syntax error when
 * consume-a-qualified-rule yields nothing, and cssom-1 #insert-a-css-rule /
 * #parse-a-css-rule surface that syntax error as a thrown SyntaxError. The
 * instance method returns null for that case while the static
 * Parser.parseRuleText throws, so the two public parse-a-rule surfaces of
 * the same class disagree. CRS-0038 pins the instance method; KI-203 pins
 * the parser-api parseRuleSync twin.
 *
 * Asserts the SAFE contract: the instance method reports invalid input as a
 * SyntaxError instead of null.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-YG9J
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Parser } from '../../src/parser.ts';

test("CRS-0038/C18: parseRule('color: red') throws SyntaxError instead of returning null", () => {
  assert.throws(
    () => new Parser([]).parseRule('color: red'),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
    'a declaration is not a rule: parse-a-rule must return a syntax error',
  );
});

test("CRS-0038/C18: parseRule('1foo {}') throws SyntaxError instead of returning null", () => {
  assert.throws(
    () => new Parser([]).parseRule('1foo {}'),
    (e: unknown) => (e as DOMException).name === 'SyntaxError',
  );
});

test('CRS-0038/C18: the static twin already throws for the same input', () => {
  assert.throws(() => Parser.parseRuleText('color: red'), (e: unknown) => (e as DOMException).name === 'SyntaxError');
});

test('control: a valid rule still parses', () => {
  const rule = new Parser([]).parseRule('div { color: red; }  ');
  assert.ok(rule, 'a valid rule must be returned');
});

test('control: trailing garbage still throws SyntaxError', () => {
  assert.throws(() => new Parser([]).parseRule('div { color: red; } leftover'), (e: unknown) => (e as DOMException).name === 'SyntaxError');
});
