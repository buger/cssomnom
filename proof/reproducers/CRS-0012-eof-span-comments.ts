/**
 * Reproducer for CRS-0012/C01-C04 (requirement INT-REQ-260826-GTCS,
 * src/tokenizer.ts Tokenizer.tokenize).
 *
 * INT-REQ-260826-GTCS: "Batch tokenize() shall return the full token list for
 * the supplied CSS text, terminated by exactly one EOF token whose span is
 * empty at end of input". css-syntax-3 4.3.1 #consume-token consumes comments
 * first and then, at end of input, returns an <EOF-token> with no associated
 * data. Tokenizer.tokenize (src/tokenizer.ts L59-63) captures the position
 * BEFORE consumeToken() and paints the discarded comment bytes onto the EOF
 * token's originalText/startIndex/endIndex instead.
 *
 * Witness test tests/obligation-witness-int-children.test.ts only feeds
 * '.a { color: red }' (no trailing comments), so the hole is invisible there.
 *
 * Asserts the intended contract, so this command FAILS while the hole exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';

// CRS-0012/C01: a trailing comment becomes the EOF token's span.
test('CRS-0012/C01: EOF token after a trailing comment has an empty span', () => {
  const tokens = tokenize('ident/*c*/');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF', 'exactly one EOF terminates the list');
  assert.equal(last.originalText, '', 'css-syntax-3 4.3.1: <EOF-token> has no associated data');
  assert.equal(last.startIndex, last.endIndex, 'INT-REQ-260826-GTCS: EOF span is empty at end of input');
  assert.equal(last.startIndex, 5, 'EOF sits at the end of the preprocessed stream');
});

// CRS-0012/C02: the public batch tokenize() wrapper returns that same list.
test('CRS-0012/C02: public tokenize() returns an empty-span EOF for "/*c*/"', () => {
  const tokens = tokenize('/*c*/');
  assert.equal(tokens.length, 1);
  assert.equal(tokens[0].type, 'EOF');
  assert.equal(tokens[0].originalText, '');
  assert.equal(tokens[0].startIndex, tokens[0].endIndex);
});

// CRS-0012/C03: comment-only input stuffs the whole stylesheet into EOF.
test('CRS-0012/C03: comment-only input yields one EOF with an empty span', () => {
  for (const css of ['/*c*/', '/**/', '/*c*//*d*/']) {
    const tokens = tokenize(css);
    assert.equal(tokens.length, 1, `${css} must be a single EOF token`);
    assert.equal(tokens[0].type, 'EOF');
    assert.equal(tokens[0].originalText, '', `${css} folded into EOF.originalText`);
    assert.equal(tokens[0].startIndex, tokens[0].endIndex);
  }
  // control: empty input already satisfies the contract
  const empty = tokenize('');
  assert.equal(empty.length, 1);
  assert.equal(empty[0].originalText, '');
});

// CRS-0012/C04: an unclosed trailing comment is folded in the same way.
test('CRS-0012/C04: unclosed trailing comment does not widen the EOF span', () => {
  const tokens = tokenize('/* unclosed');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF');
  assert.equal(last.originalText, '');
  assert.equal(last.startIndex, last.endIndex);
});

// control: the witnessed happy path keeps working.
test('control: ".a { color: red }" still ends in an empty-span EOF', () => {
  const tokens = tokenize('.a { color: red }');
  const last = tokens[tokens.length - 1];
  assert.equal(last.type, 'EOF');
  assert.equal(last.originalText, '');
  assert.equal(last.startIndex, last.endIndex);
});
