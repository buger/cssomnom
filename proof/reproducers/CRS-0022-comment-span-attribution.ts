/**
 * Reproducer for CRS-0022/C13 (requirement SW-REQ-260821-7M07,
 * src/tokenizer.ts tokenize). startIndex/endIndex/originalText are captured
 * before consumeToken skips leading comments, so a comment preceding a token is
 * folded into that token's span and originalText. For '/*c*&#47;foo' the ident
 * token reports originalText '/*c*&#47;foo' and startIndex 0, so the span does
 * not describe the token's own source segment and disagree with token.value.
 * Asserts the intended contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';

const COMMENT = '/*c*/';

test('CRS-0022/C13: a leading comment stays out of the following token span', () => {
  const [ident] = tokenize(`${COMMENT}foo`);
  assert.equal(ident.type, 'ident');
  assert.equal(ident.originalText, 'foo', `expected originalText 'foo', got ${JSON.stringify(ident.originalText)}`);
  assert.equal(ident.startIndex, COMMENT.length);
  assert.equal(ident.endIndex, COMMENT.length + 3);
});

test('CRS-0022/C13: an interior comment is not attributed to the next token', () => {
  const toks = tokenize(`a ${COMMENT} b`);
  const identB = toks.find(t => t.type === 'ident' && t.value === 'b');
  assert.ok(identB, 'the ident b is tokenized');
  assert.equal(identB.originalText, 'b', `expected originalText 'b', got ${JSON.stringify(identB.originalText)}`);
});

test('control: spans stay exact without comments', () => {
  const [ident] = tokenize('foo');
  assert.equal(ident.originalText, 'foo');
  assert.equal(ident.startIndex, 0);
});
