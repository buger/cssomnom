/**
 * Overlay reproducer for KI-42: parseComponentValueSync('url(a b)') returns a
 * truncated CSSParserToken('a') instead of throwing SyntaxError for the
 * <bad-url-token>.
 *
 * Reproduces: KI-42
 * Verifies: SYS-REQ-260823-BTC4 (bad-token component values are rejected)
 *
 * Spec anchors:
 * - css-syntax-3 § 4 "Tokenization" (#consume-token-output,
 *   submodules/csswg-drafts/css-syntax-3/Overview.bs ~2013-2016):
 *   "<bad-string-token>, and <bad-url-token> ... are always parse errors".
 *   'url(a b)' therefore tokenizes to a <bad-url-token>: a raw U+0020 SPACE is
 *   not allowed inside an unquoted url.
 * - css-syntax-3 § 5.3.5 #parse-a-component-value (Overview.bs ~2457-2484):
 *   consume a component value; if consumption fails, return a syntax error —
 *   the caller must never observe a bad token as a successful value.
 * - WICG CSS Parser API #parsing-api: parseComponentValue returns a single
 *   CSSToken; failure semantics come from css-syntax-3 (syntax error), which
 *   this library realizes as DOMException('Syntax error', 'SyntaxError').
 *
 * Observed defect (src/parser-api.ts ~590-605): parseComponentValueSync only
 * counts non-whitespace values; a lone <bad-url-token> passes the length
 * checks and toParserToken() serializes its truncated ident ('a'). The
 * library's OWN >1-value branch throws for 'a b', so rejecting 'url(a b)' is
 * consistent internal behavior, not new policy.
 *
 * Distinctness: KI-8/KI-114/KI-116 cover @import href extraction and
 * border-image url() expansion loss for VALID urls; here the input is an
 * always-parse-error bad-url that must be rejected outright.
 *
 * Reproducer constants mirrored in
 * specs/system/variables/parser-api-bad-token-budget.vars.yaml:
 * const BAD_URL_ACCEPT_BUDGET = 0;
 * const MULTI_VALUE_CONTROL_REJECTIONS_MIN = 1;
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { parseComponentValueSync } from '../../src/parser-api.ts';

// Reproducer constants mirrored in specs/system/variables/parser-api-bad-token-budget.vars.yaml:
const BAD_URL_ACCEPT_BUDGET = 0; // zero bad-token acceptances allowed
const MULTI_VALUE_CONTROL_REJECTIONS_MIN = 1; // existing >1-value branch must keep throwing

// Verifies: SYS-REQ-260823-BTC4 (KI-42 reproducer suite: bad-token rejection contract)
// reqproof:proptest:skip assertion-only known-issue overlay harness driving live parser/CSSOM object graphs; verdict exists only as pass/fail assertions with no comparable return value
describe('KI-42 parseComponentValue rejects <bad-url-token>', () => {
  // Control leg (green today): multi-value inputs throw via the >1 branch.
  // Verifies: SYS-REQ-260823-BTC4
  test(`control: trailing-garbage multi-value input still throws (${MULTI_VALUE_CONTROL_REJECTIONS_MIN} rejection)`, () => {
    assert.throws(() => parseComponentValueSync('a b'), (e: unknown) => (e as Error).name === 'SyntaxError');
  });

  // css-syntax-3 ~2013-2016 + #parse-a-component-value: url(a b) is a bad-url,
  // an always-parse-error, so SyntaxError is mandatory.
  // Verifies: SYS-REQ-260823-BTC4
  test(`parseComponentValueSync('url(a b)') throws instead of returning a truncated token (${BAD_URL_ACCEPT_BUDGET} acceptances allowed)`, () => {
    let returned: unknown;
    let threw = false;
    try {
      returned = parseComponentValueSync('url(a b)');
    } catch {
      threw = true;
    }
    assert.ok(
      threw,
      `KI-42: expected SyntaxError but got ${JSON.stringify(String(returned))} (${(returned as object)?.constructor?.name})`,
    );
  });

  // Same bad-url class with the offending whitespace after a newline escape.
  // Verifies: SYS-REQ-260823-BTC4
  test("parseComponentValueSync('url(a\\nb)') also rejects", () => {
    assert.throws(
      () => parseComponentValueSync('url(a\nb)'),
      (e: unknown) => (e as Error).name === 'SyntaxError',
      'KI-42: newline inside unquoted url() must produce <bad-url-token> → SyntaxError',
    );
  });
});
