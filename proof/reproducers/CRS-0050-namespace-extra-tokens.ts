/**
 * Reproducer for CRS-0050/C38 (src/parser.ts Parser.handleNamespaceRule).
 * css-namespaces-3 #syntax types the rule as
 * `@namespace <namespace-prefix>? [ <string> | <url> ] ;` — one optional
 * prefix and exactly one URI — and requires a syntactically invalid
 * @namespace rule to be ignored. handleNamespaceRule reads at most
 * tokens[0]/tokens[1] and never inspects tokens[2+], so
 * '@namespace "a" "b";' survives with the second string silently dropped.
 * (KI-169 pins the missing-URI leg of the same handler; this pins the
 * trailing-tokens leg.)
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

test('CRS-0050/C38: trailing tokens after the @namespace URI drop the rule', () => {
  const rules = parseStyleSheet('@namespace "a" "b";');
  assert.equal(rules.length, 0, 'the @namespace grammar allows one prefix and one URI only');
});

test('control: the prefixed and default forms keep parsing', () => {
  const rules = parseStyleSheet('@namespace svg "http://www.w3.org/2000/svg"; @namespace "http://example.com/default";');
  assert.equal(rules.length, 2);
});
