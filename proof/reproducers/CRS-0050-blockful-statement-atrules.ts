/**
 * Reproducer for CRS-0050/C05 + CRS-0050/C31 (src/parser.ts
 * AT_RULE_HANDLERS.namespace / .custom-media). css-namespaces-3 #syntax
 * types @namespace as a semicolon-terminated statement
 * (`@namespace <namespace-prefix>? [ <string> | <url> ] ;`) and requires a
 * syntactically invalid @namespace rule to be ignored. mediaqueries-5 2.3
 * #custom-mq types @custom-media as `@custom-media <extension-name>
 * [ <media-query-list> | true | false ] ;`. Neither rule has a block form,
 * so a blockful prelude is syntactically invalid and the rule must be
 * dropped. The handlers discard the block argument and still construct the
 * rule (the @import twin of this mechanism is KI-183).
 *
 * Asserts the correct behavior so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseStyleSheet } from '../../src/parser.ts';

test('CRS-0050/C05: a blockful @namespace is dropped, not fabricated', () => {
  const rules = parseStyleSheet('@namespace "http://example.com/ns" { }');
  assert.equal(rules.length, 0, 'an @namespace with a block is invalid CSS and must be ignored');
});

test('CRS-0050/C31: a blockful @custom-media is dropped, not fabricated', () => {
  const rules = parseStyleSheet('@custom-media --wide screen { }');
  assert.equal(rules.length, 0, 'an @custom-media with a block is invalid CSS and must be ignored');
});

test('control: the statement forms keep parsing', () => {
  const rules = parseStyleSheet('@namespace "http://example.com/ns"; @custom-media --wide screen;');
  assert.equal(rules.length, 2);
});
