/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Unit tests for the reference-free fuzz oracles (fuzz/oracles/lib/invariants.ts,
 * fuzz/oracles/minimize.ts) and the corpus extractor (fuzz/oracles/roundtrip-sweep.ts).
 *
 * Pure in-memory, fully deterministic (no randomness anywhere on these paths;
 * deltaDebug's fixed granularity ladder makes its result reproducible run to
 * run), no child processes.
 *
 * Spec anchors:
 * - css-syntax-3 § 3.3 #input-preprocessing (CRLF/CR/FF → LF, NUL/surrogates → U+FFFD)
 * - css-syntax-3 § 4 #tokenization (token stream partitions the input exactly)
 * - cssom-1 serialization rules (serialize∘parse idempotence)
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkFixpoint,
  checkTokenConservation,
  checkTokenRefixation,
  contentTokens,
  detectContiguityProblems,
  preprocessInput,
  rebuiltTextMatches,
} from '../fuzz/oracles/lib/invariants.ts';
import { deltaDebug } from '../fuzz/oracles/minimize.ts';
import { extractExternalInputs } from '../fuzz/oracles/roundtrip-sweep.ts';
import type { Token } from '../src/types.ts';

// ---------------------------------------------------------------------------
// preprocessInput — css-syntax-3 § 3.3 #input-preprocessing
// ---------------------------------------------------------------------------

test('preprocessInput normalizes CRLF to LF', () => {
  assert.equal(preprocessInput('a\r\nb\rc'), 'a\nb\nc');
});

test('preprocessInput maps NUL to U+FFFD', () => {
  assert.equal(preprocessInput('a\0b'), 'a\uFFFDb');
});

test('preprocessInput replaces lone surrogates with U+FFFD', () => {
  // Lone high surrogate followed by ordinary text.
  assert.equal(preprocessInput('\uD800x'), '\uFFFDx');
  // Lone low surrogate with no high before it.
  assert.equal(preprocessInput('y\uDE00'), 'y\uFFFD');
});

test('preprocessInput preserves valid surrogate pairs', () => {
  const emoji = '\uD83D\uDE00'; // 😀
  assert.equal(preprocessInput(`x${emoji}y`), `x${emoji}y`);
});

// ---------------------------------------------------------------------------
// detectContiguityProblems — synthetic token arrays (css-syntax-3 § 4: tokens
// must partition the preprocessed stream with no gaps/overlaps)
// ---------------------------------------------------------------------------

/** Structurally valid minimal Token literal; only the fields the oracle reads. */
function fakeToken(
  type: 'ident' | 'whitespace' | 'delim' | 'EOF',
  startIndex: number,
  endIndex: number,
  originalText = '',
): Token {
  return { type, value: '', startIndex, endIndex, originalText };
}

test('detectContiguityProblems exposes an offset gap between tokens', () => {
  const findings = detectContiguityProblems([fakeToken('ident', 0, 1), fakeToken('whitespace', 3, 4)]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.kind, 'token-gap');
  assert.equal(findings[0]?.offset, 1);
  assert.equal(findings[0]?.expected, '1');
  assert.equal(findings[0]?.actual, '3');
});

test('detectContiguityProblems exposes an offset overlap between tokens', () => {
  const findings = detectContiguityProblems([fakeToken('ident', 0, 2), fakeToken('delim', 1, 3)]);
  assert.equal(findings.length, 1);
  assert.equal(findings[0]?.kind, 'token-overlap');
  assert.equal(findings[0]?.offset, 1);
  assert.equal(findings[0]?.expected, '2');
  assert.equal(findings[0]?.actual, '1');
});

test('detectContiguityProblems accepts a perfectly contiguous slice', () => {
  assert.deepEqual(detectContiguityProblems([fakeToken('ident', 0, 1), fakeToken('whitespace', 1, 2)]), []);
});

// ---------------------------------------------------------------------------
// Oracle sanity — zero findings on tricky-but-valid inputs. These double as a
// regression tripwire: if conservation starts flagging valid input, either the
// tokenizer broke or the oracle drifted from src/tokenizer.ts.
// ---------------------------------------------------------------------------

test('checkTokenConservation is clean on comments, escapes, url() and custom properties', () => {
  // Comments placed inside blocks stay in the token stream; a dangling
  // top-level comment is folded into the <EOF-token>'s originalText
  // (css-syntax-3 § 4.3.1 #consume-token step 1 + § 4.3.2 #consume-comment),
  // which the conservation rebuild includes — see the EOF-sentinel tests below.
  const tricky =
    'a{/* kept */content:"a\\22 b";--custom:calc(1px + 2px);background:url("x.png") no-repeat}:root{--x:1px}b{c:var(--x)} /* dangling */';
  const findings = checkTokenConservation(tricky);
  assert.deepEqual(
    findings.map((f) => f.kind),
    [],
    `expected clean conservation, got ${JSON.stringify(findings)}`,
  );
});

// ---------------------------------------------------------------------------
// rebuiltTextMatches — pure rebuild comparison over ALL tokens INCLUDING the
// possibly non-empty-text <EOF-token> (css-syntax-3 § 4.3.2 #consume-comment:
// comments produce no token; § 5.3 #parser-definitions: EOF is a conceptual
// sentinel; § 8 #serialization: preserving comments is allowed).
// Synthetic negative controls prove genuine byte loss still fires.
// ---------------------------------------------------------------------------

test('rebuiltTextMatches accepts a full reconstruction including non-empty EOF text', () => {
  const tokens = [
    fakeToken('ident', 0, 1, 'a'),
    fakeToken('whitespace', 1, 2, ' '),
    fakeToken('EOF', 2, 9, '/* x */'),
  ];
  assert.deepEqual(rebuiltTextMatches(tokens, 'a /* x */'), { ok: true, offset: -1 });
});

test('rebuiltTextMatches flags missing trailing bytes (EOF text dropped)', () => {
  // Simulates the pre-fix oracle bug: content tokens only, trailing comment lost.
  const tokens = [fakeToken('ident', 0, 1, 'a'), fakeToken('whitespace', 1, 2, ' ')];
  assert.deepEqual(rebuiltTextMatches(tokens, 'a /* x */'), { ok: false, offset: 2 });
});

test('rebuiltTextMatches flags bytes missing mid-stream', () => {
  const tokens = [
    fakeToken('ident', 0, 1, 'a'),
    fakeToken('ident', 4, 6, 'cd'), // offsets contiguous but text skips "bc"
  ];
  assert.deepEqual(rebuiltTextMatches(tokens, 'abcd'), { ok: false, offset: 1 });
});

test('rebuiltTextMatches reports min-length offset when one side prefixes the other', () => {
  const tokens = [fakeToken('ident', 0, 3, 'abc')];
  assert.equal(rebuiltTextMatches(tokens, 'abcdef').ok, false);
  assert.equal(rebuiltTextMatches(tokens, 'abcdef').offset, 3);
  assert.equal(rebuiltTextMatches(tokens, 'ab').offset, 2);
});

// css-syntax-3 § 4.3.1 #consume-token step 1 consumes comments *before* token
// recursion and § 4.3.2 #consume-comment "returns nothing": comments produce no
// token of their own. This tokenizer therefore folds consumed comment bytes into
// the span/originalText of the NEXT token — or, at end of input, into the
// <EOF-token> (§ 5.2 #input-stream / § 5.3 #parser-definitions). The EOF token's
// originalText may thus be non-empty, and concat(originalText) over ALL tokens
// INCLUDING EOF must still reproduce the preprocessed input exactly.
test('checkTokenConservation keeps trailing comments folded into the EOF sentinel', async (t) => {
  await t.test('trailing whitespace-separated comment: a{color:red} /* x */', () => {
    assert.deepEqual(
      checkTokenConservation('a{color:red} /* x */').map((f) => f.kind),
      [],
    );
  });
  await t.test('comment-only input is absorbed entirely by EOF', () => {
    assert.deepEqual(
      checkTokenConservation('/* x */').map((f) => f.kind),
      [],
    );
  });
  await t.test('comment immediately after close brace: a{color:red}/*x*/', () => {
    assert.deepEqual(
      checkTokenConservation('a{color:red}/*x*/').map((f) => f.kind),
      [],
    );
  });
  await t.test('consecutive trailing comments: a{} /*a*//*b*/', () => {
    assert.deepEqual(
      checkTokenConservation('a{} /*a*//*b*/').map((f) => f.kind),
      [],
    );
  });
});

// Behavioral lock for oracle 3 on the same family: refixation must stay quiet
// on trailing-comment inputs both before and after the conservation fix (its
// rebuilt string must include the EOF text so retokenization covers them).
test('checkTokenRefixation stays clean when EOF absorbs trailing comments', () => {
  const sheets = ['a{color:red} /* x */', '/* x */', 'a{color:red}/*x*/', 'a{} /*a*//*b*/'];
  for (const sheet of sheets) {
    const findings = checkTokenRefixation(sheet);
    assert.deepEqual(
      findings.map((f) => f.kind),
      [],
      `expected clean refixation for ${JSON.stringify(sheet)}, got ${JSON.stringify(findings)}`,
    );
  }
});

test('contentTokens drops only the trailing EOF sentinel', () => {
  const tokens: Token[] = [
    fakeToken('ident', 0, 1),
    { type: 'EOF', value: '', startIndex: 1, endIndex: 1, originalText: '' },
  ];
  assert.equal(contentTokens(tokens).length, 1);
});

const SANE_STYLESHEETS: readonly string[] = [
  'a{color:red}',
  'a{color:red}b{c:d}',
  '@media screen{a{color:red}}',
  'a{/* inner */color:red}',
  'a{content:"a\\22 b"}',
  'a{background:url("x.png") no-repeat}',
  ':root{--custom:calc(1px + 2px)}a{b:var(--custom)}',
  'a{margin:0 auto!important}',
  '@keyframes k{from{opacity:0}to{opacity:1}}',
  'a[href^="http"]::before{content:"> "}',
  'a{width:calc(100% - (2*3px))}',
  '@supports (display:grid){@media screen{a{display:grid}}}',
];

test('checkFixpoint finds nothing on sane stylesheets', async (t) => {
  await t.test('mini embedded corpus is fixpoint-stable', () => {
    for (const sheet of SANE_STYLESHEETS) {
      const findings = checkFixpoint(sheet);
      assert.deepEqual(
        findings.map((f) => f.kind),
        [],
        `expected clean fixpoint for ${JSON.stringify(sheet)}, got ${JSON.stringify(findings)}`,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// deltaDebug — generic greedy hierarchical shrink
// ---------------------------------------------------------------------------

const MARKER = 'KEEP{a:b}';
const keepPredicate = (s: string): boolean => s.includes(MARKER);

function junkFrame(): string {
  const lines: string[] = [];
  for (let i = 0; i < 40; i++) lines.push(`junk line ${i} {}`);
  return lines.join('\n');
}

test('deltaDebug shrinks junk down to the property-bearing marker', () => {
  const input = `${junkFrame()}\n${MARKER}\n${junkFrame()}`;
  const first = deltaDebug(input, keepPredicate);
  const second = deltaDebug(input, keepPredicate);

  assert.equal(first.ok, true, 'predicate holds initially and on the final minimized form');
  assert.ok(first.minimized.includes(MARKER), 'minimized retains the marker');
  assert.ok(
    first.minimized.length < input.length,
    `minimized (${first.minimized.length}) must be smaller than input (${input.length})`,
  );
  assert.ok(first.evals > 0 && first.evals < 4000, 'evals recorded within budget');

  // Determinism: identical inputs produce byte-identical results.
  assert.deepEqual(second, first);
});

test('deltaDebug reports ok=false when the predicate rejects the initial input', () => {
  const result = deltaDebug('nothing interesting here', (s) => s.includes(MARKER));
  assert.equal(result.ok, false);
  assert.equal(result.minimized, 'nothing interesting here');
});

test('deltaDebug respects maxEvals budget', () => {
  const input = `${junkFrame()}\n${MARKER}\n${junkFrame()}`;
  const result = deltaDebug(input, keepPredicate, { maxEvals: 25 });
  assert.ok(result.evals <= 26, `evals ${result.evals} should honor the 25-eval budget (+final check)`);
  assert.equal(result.ok, true, 'budget exhaustion must never lose the property');
});

// ---------------------------------------------------------------------------
// extractExternalInputs — generic recursive fixture harvesting
// ---------------------------------------------------------------------------

function collect(node: unknown): { out: string[]; seen: Set<string> } {
  const out: string[] = [];
  const seen = new Set<string>();
  extractExternalInputs(node, out, seen);
  return { out, seen };
}

test('extractExternalInputs pulls CSS strings from nested structures exactly once', () => {
  const { out } = collect([
    { suite: 'wpt', cases: [{ input: 'a{b:c}' }, { name: 'skip-me', other: 'd{e:f};' }] },
    { input: { deep: 'g{h:i}' } },
    'plain.css text without braces stays out',
  ]);
  assert.deepEqual(out.sort(), ['a{b:c}', 'd{e:f};', 'g{h:i}']);
});

test('extractExternalInputs dedups repeated fixtures via the seen-set', () => {
  const { out } = collect([{ input: 'a{b:c}' }, ['a{b:c}', { x: { input: 'a{b:c}' } }]]);
  assert.deepEqual(out, ['a{b:c}']);
});
