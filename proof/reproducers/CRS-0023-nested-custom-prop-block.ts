/**
 * Reproducer for CRS-0023/C01 (requirement SW-REQ-260821-9KNX,
 * src/parser.ts consumeQualifiedRule). css-syntax-3 #consume-a-qualified-rule
 * '{'-token arm: when the first two non-whitespace prelude values are an ident
 * starting with "--" followed by a colon and |nested| is true, the parser
 * consumes the remnants of a bad declaration (nested) and returns nothing, so
 * the entire malformed custom-property construct is swallowed through its
 * ending semicolon. The implementation always runs the |nested| false arm
 * (consume a block and return nothing), so only the {}-block is consumed and
 * the tail '.bar { color: blue; }' survives in the stream as a fresh
 * (valid) rule candidate.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../src/parser.ts';
import { Parser } from '../../src/parser.ts';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0023/C01: nested custom-property remnants consume the whole construct', () => {
  const parser = new Parser(tokenize('--foo: { a: b } .bar { color: blue; }'));
  const rule = parser.consumeRule(true);
  assert.equal(rule, null, 'the malformed custom-property rule returns nothing');
  const rest: string[] = [];
  while (parser.nextToken.type !== 'EOF') {
    rest.push(parser.consumeToken().type);
  }
  assert.deepEqual(rest, [], `remnants must consume through EOF, leftover: ${JSON.stringify(rest)}`);
});

test('control: nested false keeps the spec consume-a-block arm', () => {
  const parser = new Parser(tokenize('--foo: { a: b } .bar { color: blue; }'));
  const rule = parser.consumeRule(false);
  assert.equal(rule, null);
  // The block is consumed, the .bar rule remains for a rule-list caller.
  const next = parser.consumeComponentValue();
  assert.notEqual(next.type, 'EOF');
});
