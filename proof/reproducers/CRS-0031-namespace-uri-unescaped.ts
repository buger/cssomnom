/**
 * Reproducer for CRS-0031/C07 (cssom-1 CSSNamespaceRule serialization).
 *
 * cssom-1 #serialize-a-css-rule (CSSNamespaceRule arm) requires the
 * namespaceURI to be emitted via "serialization as URL", which wraps a
 * string serialization (escaped, per cssom-1 #serialize-a-string).
 * CSSNamespaceRule.cssText interpolates the raw URI into url("..."),
 * so a URI containing a double quote terminates the string early and
 * emits structurally invalid CSS: @namespace url("foo"bar");
 *
 * Asserts the SAFE contract: cssText must be a string token that
 * re-tokenizes to one url() whose value equals the namespaceURI.
 *
 * Reproduces: this file (adjudicator run)
 * Verifies: SW-REQ-260821-PAKB family / cssom-1 #the-cssnamespacerule-interface
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSSNamespaceRule } from '../../src/CSSOM.ts';
import { tokenize } from '../../src/tokenizer.ts';

test('CRS-0031/C07: @namespace cssText escapes the URI string', () => {
  const rule = new CSSNamespaceRule('', 'foo"bar');
  const text = rule.cssText;
  // The url(...) payload must round-trip: a single url token, value intact.
  const toks = tokenize(text).filter((t) => t.type !== 'whitespace' && t.type !== 'EOF');
  assert.equal(toks.length, 4, `expected [@namespace, url, ;, EOF] tokens, got ${toks.map((t) => t.type).join(',')}`);
  const urlTok = toks[1] as unknown as { type: string; value: string };
  assert.equal(urlTok.type, 'url', 'URI must serialize as one url() component');
  assert.equal(urlTok.value, 'foo"bar', 'url() payload must equal the namespaceURI exactly');
});
