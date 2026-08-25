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
 * Unit tests for the invalid-superset oracle
 * (fuzz/oracles/lib/mutate.ts + fuzz/oracles/invalid-superset.ts).
 *
 * Pure in-memory, fully deterministic (fixed seeds everywhere, no child
 * processes).
 *
 * End-to-end expectations are anchored to behaviors HAND-PROBED against the
 * current tree (`node probe` snippets cited inline):
 *
 *   .o{width:red}                          → rules=1 value="red"    (retained)
 *   .o{color:10px}                         → rules=1 value="10px"   (retained)
 *   .o{animation-timing-function:bogus()}  → rules=1 value="bogus()"(retained)
 *   .o{color:url(x                         → rules=1 value="url(\"x\")" (bad-url repaired + retained)
 *   .o{color:re;;d}                        → rules=1 value="re"     (retained)
 *   .o{color:red{};}                       → rules=1 value=""       (dropped)
 *   .o{color:red;;}                        → rules=1 value="red"    (correctly retained: ';' ends decl)
 *
 * The current recovery parser retains every grammar-invalid declaration above,
 * so those are genuine accept-invalid detections, not planted mocks.
 */

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MUTATION_OPS,
  mutateDeclaration,
  mutateValid,
  tokenizeLoosely,
  type DeclarationMutation,
  type MutationOp,
} from '../fuzz/oracles/lib/mutate.ts';
import {
  POLICY_SKIPPED_OPS,
  checkMutantSnippet,
  mutantIsAmbiguouslyValid,
  runOracle,
  syntaxListsBothCases,
} from '../fuzz/oracles/invalid-superset.ts';
import { rngFromSeed } from '../fuzz/css-fuzz/src/rng.ts';

// ---------------------------------------------------------------------------
// tokenizeLoosely — safety boundaries for the mutators
// ---------------------------------------------------------------------------

test('tokenizeLoosely keeps strings, urls and function blocks atomic', () => {
  const tokens = tokenizeLoosely(`url(a b) "s;t" var(--x) 10px`);
  assert.deepEqual(
    tokens.map((t) => [t.kind, t.text]),
    [
      ['url', 'url(a b)'],
      ['ws', ' '],
      ['string', '"s;t"'],
      ['ws', ' '],
      ['block', 'var(--x)'],
      ['ws', ' '],
      ['dimension', '10px'],
    ],
  );
});

test('tokenizeLoosely never exposes custom-property idents as keyword sites', () => {
  const tokens = tokenizeLoosely('--custom-color');
  assert.deepEqual(tokens.map((t) => [t.kind, t.text]), [['ident', '--custom-color']]);
});

test('tokenizeLoosely treats unterminated url/string as one opaque token to EOF', () => {
  assert.deepEqual(tokenizeLoosely('url(x y').map((t) => [t.kind, t.text]), [['url', 'url(x y']]);
  assert.deepEqual(tokenizeLoosely('"abc def').map((t) => [t.kind, t.text]), [['string', '"abc def']]);
});

// ---------------------------------------------------------------------------
// mutateValid / mutateDeclaration — deterministic grammar-invalid mutants
// ---------------------------------------------------------------------------

function declarationSequence(seed: number): Array<DeclarationMutation | null> {
  const rng = rngFromSeed(seed);
  return ['red', '10px', '0 auto', 'rgb(1,2,3)', 'url(a.png) red'].map((value) =>
    mutateDeclaration('color', value, rng),
  );
}

test('mutation is fully deterministic under a seed', () => {
  const a = declarationSequence(20260824);
  const b = declarationSequence(20260824);
  assert.deepEqual(a, b);
  // And different from a different seed's stream (not vacuously constant).
  const c = declarationSequence(1);
  assert.notDeepEqual(a, c);
});

test('every generated mutant differs from its original and carries a known op', () => {
  for (const mutation of declarationSequence(7)) {
    assert.notEqual(mutation, null);
    assert.ok(MUTATION_OPS.includes(mutation!.op));
    assert.notEqual(mutation!.value, '');
    assert.match(mutation!.snippet, /^\.o\{color:[^{}]+;\}$/);
  }
});

test('known-invalid mutants are produced: unterminated url wrap and truncation', () => {
  // wrap-in-unterminated-url is applicable to ANY nonempty value and always
  // yields a bad-url (css-syntax-3 § 4.3.6 EOF-in-url):
  const wrapped = mutateValid('red', rngFromSeed(11));
  // Bounded deterministic search for specific ops keeps this test robust to
  // RNG stream details while still being fully reproducible.
  const findOp = (op: MutationOp, value: string, tries = 400): string | null => {
    for (let seed = 1; seed <= tries; seed++) {
      const mutation = mutateValid(value, rngFromSeed(seed));
      if (mutation?.op === op) return mutation.value;
    }
    return null;
  };
  assert.ok(wrapped !== null);
  assert.equal(findOp('unterminated-url', 'red'), 'url(red');
  // truncate-mid-token on an ident leaves a broken keyword head:
  const truncated = findOp('truncate-token', 'red');
  assert.ok(truncated === 'r' || truncated === 're');
  // px↔deg swap applies to dimensions:
  assert.equal(findOp('unit-swap', '10px'), '10deg');
  assert.equal(findOp('unit-swap', '10deg'), '10px');
});

test('case-corrupt never targets urls, strings or custom properties', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const mutation = mutateValid('var(--custom-color)', rngFromSeed(seed));
    if (mutation?.op === 'case-corrupt') {
      // Only corruptible plain ident here would be… none: `var(--x)` folds
      // into ONE atomic block token, so case-corrupt must fail to apply and
      // fall through to another op.
      assert.fail('case-corrupt applied inside a var() block');
    }
  }
  const quoted = tokenizeLoosely('"Red"');
  assert.deepEqual(quoted.map((t) => t.kind), ['string']); // no inner ident site
});

// ---------------------------------------------------------------------------
// Anti-false-positive policy skips
// ---------------------------------------------------------------------------

test('policy-skipped ops are exactly the still-grammar-valid classes', () => {
  assert.deepEqual([...POLICY_SKIPPED_OPS].sort(), ['case-corrupt', 'punct-;;']);
});

test('keyword case-corrupt is classified still-valid when syntax lists both cases', () => {
  // css-values-4 § "Value definition syntax": keywords match ASCII
  // case-insensitively, so any case variant stays grammar-valid — doubly so
  // when the syntax literally lists both spellings.
  assert.equal(syntaxListsBothCases('small-caps | SMALL-CAPS', 'Small-Caps'), true);
  assert.equal(syntaxListsBothCases('red | RED', 'red'), true);
  assert.equal(syntaxListsBothCases('red | green | blue', 'RED'), false);
});

test('campaign findings never come from policy-skipped ops', () => {
  const report = runOracle({ perProperty: 1, mutations: 8, seed: 20260824, budgetMs: 30_000, filter: /^color$/ });
  for (const finding of report.findings) {
    assert.ok(!POLICY_SKIPPED_OPS.has(finding.op), `unexpected policy-op finding: ${finding.op}`);
  }
});

test('grammar-dependent duplicate/delete mutants on repetition-capable syntax are skipped', () => {
  // Audited false-positive class: `<length-percentage>{1,2}` accepts the
  // doubled form; `margin: 0 auto` survives deletion down to `auto`.
  assert.equal(mutantIsAmbiguouslyValid('token-duplicate', '<length-percentage>{1,2}', '100%'), true);
  assert.equal(mutantIsAmbiguouslyValid('token-delete', 'auto | <length-percentage>', '0 auto'), true);
  // Repetition metachars force a skip even for single-token originals:
  assert.equal(mutantIsAmbiguouslyValid('token-duplicate', '<filter-value-list>+', 'url(a)'), true);
  assert.equal(mutantIsAmbiguouslyValid('token-delete', '[a && b] | c', 'red'), true);
  // Non-repetition grammar + single token: reliably invalid ⇒ checked.
  assert.equal(mutantIsAmbiguouslyValid('token-duplicate', 'normal | auto | none', 'red'), false);
  // Other ops are never ambiguous by this guard.
  assert.equal(mutantIsAmbiguouslyValid('truncate-token', '<length-percentage>{1,2}', '100%'), false);
});

test('campaign duplicate/delete findings only ever come from single-token originals', () => {
  // The ≥2-content-token ambiguity rule must be enforced end-to-end: any
  // surviving delete/duplicate finding had a single-token original (judged
  // against THIS repo's declared syntax — see module docs).
  const report = runOracle({
    perProperty: 2,
    mutations: 6,
    seed: 20260824,
    budgetMs: 30_000,
    filter: /^-webkit-border-top-right-radius$/,
  });
  for (const finding of report.findings) {
    if (finding.op === 'token-duplicate' || finding.op === 'token-delete') {
      const contentTokens = tokenizeLoosely(finding.original).filter((t) => t.kind !== 'ws').length;
      assert.equal(contentTokens, 1, `ambiguous multi-token original reported: ${finding.snippet}`);
    }
  }
});

// ---------------------------------------------------------------------------
// ORACLE core: verified-current-behavior accept-invalid detection
// ---------------------------------------------------------------------------

test('grammar-invalid mutants retained today are detected (hand-probed behaviors)', () => {
  const cases: Array<{ snippet: string; property: string; actual: string }> = [
    // probe: ".o{width:red}" rules=1 value="red"
    { snippet: '.o{width:red}', property: 'width', actual: 'red' },
    // probe: ".o{color:10px}" rules=1 value="10px"
    { snippet: '.o{color:10px}', property: 'color', actual: '10px' },
    // probe: ".o{animation-timing-function:bogus()}" rules=1 value="bogus()"
    { snippet: '.o{animation-timing-function:bogus()}', property: 'animation-timing-function', actual: 'bogus()' },
    // probe: ".o{color:url(x" rules=1 value="url(\"x\")" (bad-url repaired)
    { snippet: '.o{color:url(x', property: 'color', actual: 'url("x")' },
    // probe: ".o{color:re;;d}" rules=1 value="re"
    { snippet: '.o{color:re;;d}', property: 'color', actual: 're' },
  ];
  for (const { snippet, property, actual } of cases) {
    const findings = checkMutantSnippet(snippet, property, 'token-delete', '<original>', '<mutant>');
    assert.equal(findings.length, 1, `${snippet}: expected exactly one finding`);
    assert.equal(findings[0]!.kind, 'invalid-retained');
    assert.equal(findings[0]!.actual, actual);
    assert.ok(snippet.length <= 300);
  }
});

test('correctly dropped mutants yield no finding', () => {
  // probe: ".o{color:red{};}" rules=1 value="" (unclosed block swallowed)
  assert.deepEqual(checkMutantSnippet('.o{color:red{};}', 'color', 'punct-{{', 'red', 'red{{;}'), []);
});

test('single-declaration snippets never trigger rule-fabricated', () => {
  // probe: even odd mutants stay at rules=1 today; the fabricated-rule guard
  // must not fire spuriously.
  const findings = checkMutantSnippet('.o{color:zzz}', 'color', 'truncate-token', 'red', 'zzz');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.kind, 'invalid-retained'); // retained, NOT fabricated
});

// ---------------------------------------------------------------------------
// runOracle end-to-end (real generator + real parser, fixed seed)
// ---------------------------------------------------------------------------

interface SummaryCounts {
  properties: number;
  valuesSampled: number;
  mutantsGenerated: number;
  skippedValid: number;
  findings: number;
  unsupportedSampled: number;
  emptySamplesSkipped: number;
  noopMutantsSkipped: number;
  oracleChecked: number;
}

function stripVolatile(report: unknown): string {
  const clone = structuredClone(report) as { generatedAt: string; elapsedMs: number };
  clone.generatedAt = '';
  clone.elapsedMs = 0;
  return JSON.stringify(clone);
}

test('runOracle detects planted accept-invalid behavior end-to-end on width', () => {
  const report = runOracle({ perProperty: 1, mutations: 6, seed: 20260824, budgetMs: 60_000, filter: /^width$/ });
  const counts: SummaryCounts = report.counts;
  assert.equal(counts.properties, 1);
  assert.ok(counts.valuesSampled >= 1);
  assert.ok(counts.mutantsGenerated >= 1);

  // Bookkeeping invariant: generated = skipped(valid) + noop + checked.
  assert.equal(counts.mutantsGenerated, counts.skippedValid + counts.noopMutantsSkipped + counts.oracleChecked);

  // Component-value surface was probed for every non-noop mutant, recorded
  // separately from findings (its contract varies).
  assert.equal(
    report.componentValueProbe.accepted + report.componentValueProbe.rejected + report.componentValueProbe.threw,
    counts.mutantsGenerated - counts.noopMutantsSkipped,
  );

  // The recovery parser currently retains EVERY grammar-invalid declaration
  // (see module docs: hand-probed), so a supported property with ≥1 checked
  // mutant MUST produce accept-invalid findings.
  assert.ok(counts.oracleChecked >= 1);
  assert.ok(counts.findings >= 1);
  for (const finding of report.findings) {
    assert.equal(finding.kind, 'invalid-retained');
    assert.equal(finding.property, 'width');
    assert.match(finding.snippet, /^\.o\{width:[^{}]+;\}$/);
    assert.ok(finding.actual !== undefined && finding.actual.length > 0);
  }

  // Clusters are consistent with stored findings.
  const totalClustered = report.clusters.reduce((sum, c) => sum + c.count, 0);
  assert.equal(totalClustered, report.findings.length);
  for (const cluster of report.clusters) {
    assert.equal(cluster.property, 'width');
    assert.ok(cluster.example.startsWith('.o{'));
    assert.ok(cluster.example.length <= 301); // cap 300 + ellipsis
  }
});

test('runOracle is deterministic modulo timestamps', () => {
  const options = { perProperty: 1, mutations: 5, seed: 99, budgetMs: 60_000, filter: /^display$/ } as const;
  assert.equal(stripVolatile(runOracle(options)), stripVolatile(runOracle(options)));
});
