/**
 * Reproducer for CRS-0039/C12 (src/serializer.ts serializeUrlToken).
 * serializeUrlToken escapes every code point <= 0x20 as `\` + char. In an
 * unquoted url() that backslash+newline is NOT a valid escape, so a url value
 * carrying a real newline (from an `\a ` source escape) re-tokenizes as
 * <bad-url-token>. The originalText fast path is bypassed as soon as the value
 * contains U+FFFD (from a `\0` escape), so `url(a\0 b\a c)` serialized with
 * preserveCase=true (the custom-property path) loses the URL entirely.
 * css-syntax-3 #serialization requires round-trip fidelity.
 * Asserts the round-trip contract so this command FAILS while the bug exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tokenize } from '../../src/tokenizer.ts';
import { ParseHooks } from '../../src/parse-hooks.ts';
import '../../src/parser.ts';
import { serialize } from '../../src/serializer.ts';

test('CRS-0039/C12: control characters in a url value survive serialization', () => {
  const css = 'url(a\\0 b\\a c)';
  const vals = ParseHooks.parseComponentValues(tokenize(css));
  const out = serialize(vals, true);
  const reTok = tokenize(out).filter(t => t.type !== 'EOF')[0];
  assert.equal(reTok.type, 'url', `re-parse must yield a url token, got ${JSON.stringify(out)}`);
  assert.equal((reTok as { value: string }).value, 'a\uFFFD b\nc',
    `the url value must round-trip verbatim; got ${JSON.stringify(out)}`);
});

test('control: escaped url values with no control characters round-trip', () => {
  const out = serialize(ParseHooks.parseComponentValues(tokenize('url(a\\9 b)')), true);
  const reTok = tokenize(out).filter(t => t.type !== 'EOF')[0] as { type: string; value: string };
  assert.equal(reTok.type, 'url');
  assert.equal(reTok.value, 'a\tb');
});
