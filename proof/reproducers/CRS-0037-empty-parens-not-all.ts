/**
 * Reproducer for CRS-0037/C10 (src/MediaParser.ts
 * MediaQueryValidator.validateMediaInParens). mediaqueries-4 #mq-syntax
 * defines <general-enclosed> = [ <<function-token>> <<any-value>>? ) ] |
 * [ ( <<any-value>? ) ] - the any-value is optional. '()' therefore parses
 * as general-enclosed, evaluates unknown, and stays a valid media query.
 * validateMediaInParens returns null for an empty token list
 * (src/MediaParser.ts:492), so MediaParser.parse('()') marks the query
 * invalid and serializeMediaQuery emits 'not all'. The same file accepts
 * 'func()' as general-enclosed, so the two forms disagree.
 *
 * Asserts the SAFE contract: empty parentheses stay a valid query and
 * serialize as themselves.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-W8S1
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaParser, serializeMediaQuery } from '../../src/MediaParser.ts';

function serialized(text: string): string {
  const queries = MediaParser.parse(text);
  return queries.map((q) => serializeMediaQuery(q)).join(', ');
}

test("CRS-0037/C10: '()' stays a valid query instead of becoming not all", () => {
  const queries = MediaParser.parse('()');
  assert.equal(queries.length, 1);
  assert.notEqual(queries[0].invalid, true, '() is <general-enclosed> with an optional any-value');
  assert.equal(serialized('()'), '()');
});

test("CRS-0037/C10: 'screen and ()' stays valid and serializes as itself", () => {
  assert.equal(serialized('screen and ()'), 'screen and ()');
});

test("control: 'func()' already serializes as general-enclosed", () => {
  assert.equal(serialized('func()'), 'func()');
});

test("control: a genuinely malformed query still becomes not all", () => {
  assert.equal(serialized('screen and (('), 'not all');
});
