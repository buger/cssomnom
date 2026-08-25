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
 * Invalid-superset oracle (triage CLI): grammar-INVALID mutants of valid
 * declarations must be DROPPED by a conforming recovery parser; any retained
 * mutant is an accept-invalid finding.
 *
 * Mirror image of valid-subset.ts: values are sampled from each property's own
 * standard syntax (css-values-4 § "Value definition syntax") via
 * SyntaxGenerator, then deterministically mutated into grammar-invalid
 * variants by fuzz/oracles/lib/mutate.ts. cssom-1 #parse-a-declaration makes a
 * value that does not match the property's grammar a parse error whose
 * declaration is ignored — so for `.o{prop:mutant}` a conforming parser must
 * yield getPropertyValue(prop) === '' AND fabricate no extra rules. Anything
 * else is an output-correctness bug crash-signals cannot see.
 *
 * Anti-false-positive policy:
 * - Survival/retention findings are only collected for properties listed in
 *   SUPPORTED_PROPERTIES (src/data/gen/property-list.ts); other sampled
 *   properties count under `unsupportedSampled` and never produce findings,
 *   mirroring valid-subset.ts.
 * - Op-based validity skip list ({@link POLICY_SKIPPED_OPS}): mutants whose
 *   op cannot reliably produce grammar-invalid output are counted in
 *   `skippedValid` and never checked:
 *     - `case-corrupt`: CSS grammar keywords and function names match ASCII
 *       case-insensitively (css-values-4 § "Value definition syntax" —
 *       "keywords … are ASCII case-insensitive"; css-syntax-3 ident tokens),
 *       so flipping keyword case alone can never invalidate a declaration.
 *       {@link syntaxListsBothCases} documents the rarer explicit case where
 *       the standard syntax literally lists both spellings.
 *     - `punct-;;`: `;` terminates a declaration (css-syntax-3 § 5.4.1
 *       #consume-declarations), so an injected `;;` legally truncates the
 *       declaration to a possibly-valid prefix which MUST be retained — e.g.
 *       `.o{color:red;;}` retains `red` correctly. Flagging retention there
 *       would be a guaranteed false positive.
 * - Grammar-dependent ambiguity guard ({@link mutantIsAmbiguouslyValid}):
 *   `token-duplicate`/`token-delete` are skipped whenever the original had
 *   ≥2 content tokens, because doubling/reduction then routinely stays
 *   grammar-valid in real CSS (css-backgrounds `border-*-radius` accepts
 *   `{1,2}`, css-filters takes `<filter-value-list>+`, `margin: 0 auto`
 *   survives deletion down to `auto`). Note: STANDARD_PROPERTIES_SYNTAX is
 *   currently a flattened term pool without quantifiers, so its
 *   single-term samples dodge most of this class; the repetition-metachar
 *   clause keeps the guard correct if richer syntax strings land later.
 *   Residual risk (assessed in reports): duplicates of single tokens remain
 *   checked and are judged against THIS repo's declared syntax, which lists
 *   e.g. `-webkit-border-top-right-radius` as plain `<length-percentage>`.
 *
 * The component-value surface (`parseComponentValueSync`, cssom-1
 * #parse-component-value) has a DIFFERENT contract (rejects multi-value input
 * with SyntaxError, returns null on empty) and is probed but recorded
 * separately — its acceptance/rejection counts are never findings.
 *
 * Usage:
 *   node fuzz/oracles/invalid-superset.ts [--per-property N] [--mutations N]
 *        [--seed N] [--budget-ms N] [--filter REGEX] [--out FILE]
 *
 * Exit code is always 0: this is a dry-run triage tool, not a gate. Raw
 * finding counts never count as bugs (see fuzz/oracles/README.md).
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { STANDARD_PROPERTIES_SYNTAX } from '../../src/data/gen/standard-syntax.ts';
import { SUPPORTED_PROPERTIES } from '../../src/data/gen/property-list.ts';
import { SyntaxGenerator } from './lib/grammar-gen.ts';
import { ORACLE_VERSION } from './lib/invariants.ts';
import { mutateDeclaration, tokenizeLoosely, type MutationOp } from './lib/mutate.ts';
import { encodeUtf8, rngFromData, type Rng } from '../css-fuzz/src/rng.ts';
import { parse, parseComponentValueSync } from '../../src/index.ts';

/** Hard cap on embedded strings so reports stay small and heap-safe. */
const CAP = 300;

function cap(text: string, max = CAP): string {
  return text.length <= max ? text : `${text.slice(0, max)}…(+${text.length - max})`;
}

// ---------------------------------------------------------------------------
// Findings & report shapes
// ---------------------------------------------------------------------------

export type InvalidSupersetFindingKind = 'invalid-retained' | 'rule-fabricated' | 'parse-threw';

export interface InvalidSupersetFinding {
  kind: InvalidSupersetFindingKind;
  property: string;
  op: MutationOp;
  /** Original grammar-valid sampled value (capped). */
  original: string;
  /** Grammar-invalid mutant (capped). */
  mutant: string;
  /** Minimal repro stylesheet (capped). */
  snippet: string;
  detail: string;
  /** What the parser produced instead of '' (capped), when meaningful. */
  actual?: string;
}

export interface InvalidSupersetCluster {
  property: string;
  op: MutationOp;
  /** Count among STORED findings (storage cap applies — see maxFindings). */
  count: number;
  /** One minimal repro (capped). */
  example: string;
}

export interface InvalidSupersetCounts {
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

export interface ComponentValueProbe {
  accepted: number;
  rejected: number;
  threw: number;
}

export interface InvalidSupersetReport {
  oracleVersion: string;
  tool: 'invalid-superset';
  generatedAt: string;
  seed: number;
  perProperty: number;
  mutations: number;
  filter: string;
  elapsedMs: number;
  truncatedByBudget: boolean;
  findingsCapped: boolean;
  counts: InvalidSupersetCounts;
  componentValueProbe: ComponentValueProbe;
  clusters: InvalidSupersetCluster[];
  findings: InvalidSupersetFinding[];
}

// ---------------------------------------------------------------------------
// Anti-false-positive policy (see module docs)
// ---------------------------------------------------------------------------

/**
 * Ops whose mutants are unconditionally classified still-grammar-valid and
 * therefore never oracle-checked (counted under `skippedValid`).
 */
export const POLICY_SKIPPED_OPS: ReadonlySet<MutationOp> = new Set<MutationOp>(['case-corrupt', 'punct-;;']);

/**
 * Does `syntax` literally list both case spellings of `word` as standalone
 * grammar words? Conservative word-split over identifiers/hyphens; used to
 * document (and unit-test) when a case-corrupt target is doubly ambiguous.
 */
export function syntaxListsBothCases(syntax: string, word: string): boolean {
  const words = new Set(syntax.split(/[^A-Za-z0-9-]+/).filter((w) => w.length > 0));
  return words.has(word.toLowerCase()) && words.has(word.toUpperCase());
}

/**
 * Conservative "mutant may still be grammar-valid" classifier for the
 * structural ops whose invalidity depends on the property grammar:
 *
 * - `token-duplicate` / `token-delete` are only reliably invalid when the
 *   grammar forbids term repetition AND the original had a single content
 *   token. Doubling/deleting under repetition-capable grammars routinely
 *   yields VALID values (audited against this repo's own table):
 *   `-webkit-border-top-right-radius: <length-percentage>{1,2}` accepts the
 *   duplicate `100% 100%`; `-webkit-filter: <filter-value-list>+` accepts
 *   duplicated urls; `margin: 0 auto` survives deletion down to `auto`.
 *   Flagging those would be guaranteed false positives.
 *
 * Returns true (= skip, counted under `skippedValid`) when either:
 *   (a) the original value already had ≥2 content tokens (any juxtaposition,
 *       `&&`, `||`, or list grammar may accept the reduced/doubled form), or
 *   (b) the property's standard syntax carries any repetition metacharacter
 *       (`*`, `+`, `#`, `{a,b}`, `&&`, `||`) — css-values-4 § "Value
 *       definition syntax" #combinator-multiplier. (The current flattened
 *       STANDARD_PROPERTIES_SYNTAX term pool contains none; this clause is
 *       future-proofing for richer syntax strings.)
 */
const REPETITION_METACHARS = /[+*#{]|&&|\|\|/;
const MULTI_TOKEN_DELETE_DUPLICATE: ReadonlySet<MutationOp> = new Set<MutationOp>(['token-delete', 'token-duplicate']);

export function mutantIsAmbiguouslyValid(
  op: MutationOp,
  syntax: string,
  originalValue: string,
): boolean {
  if (!MULTI_TOKEN_DELETE_DUPLICATE.has(op)) return false;
  const contentTokens = tokenizeLoosely(originalValue).filter((t) => t.kind !== 'ws').length;
  if (contentTokens >= 2) return true;
  return REPETITION_METACHARS.test(syntax);
}

// ---------------------------------------------------------------------------
// Core oracle step (pure; exported for unit tests)
// ---------------------------------------------------------------------------

interface StyleRuleHost {
  style?: { getPropertyValue(property: string): string };
  selectorText?: string;
}

interface SheetLike {
  cssRules: { length: number; item(index: number): unknown };
}

function firstStyleRule(sheet: SheetLike): StyleRuleHost | null {
  for (let i = 0; i < sheet.cssRules.length; i++) {
    const rule = sheet.cssRules.item(i) as StyleRuleHost | null;
    if (rule && typeof rule === 'object' && rule.style) return rule;
  }
  return null;
}

/**
 * ORACLE: parse `.o{prop:mutant;}` and assert the grammar-INVALID mutant was
 * dropped: getPropertyValue(prop) === '' AND no fabricated rules.
 *
 * Callers MUST pass a genuine mutant (see POLICY_SKIPPED_OPS + mutate.ts docs):
 * this function cannot distinguish a valid declaration retained correctly from
 * an invalid one retained incorrectly — passing `color:red` here would be a
 * false positive by construction.
 *
 * Verified current behaviors this detects (hand-probed against today's tree):
 * `.o{width:red}` → retained 'red'; `.o{color:10px}` → retained '10px';
 * `.o{animation-timing-function:bogus()}` → retained 'bogus()'.
 */
export function checkMutantSnippet(
  snippet: string,
  property: string,
  op: MutationOp,
  original: string,
  mutant: string,
): InvalidSupersetFinding[] {
  const findings: InvalidSupersetFinding[] = [];
  let sheet: SheetLike;
  try {
    sheet = parse(snippet) as unknown as SheetLike;
  } catch (err: unknown) {
    // A recovery parser must never throw (crash-signals complement, not
    // duplicate: here we KNOW the input shape).
    findings.push({
      kind: 'parse-threw',
      property,
      op,
      original: cap(original),
      mutant: cap(mutant),
      snippet: cap(snippet),
      detail: `parse threw ${err instanceof Error ? err.name : typeof err}: ${cap(err instanceof Error ? err.message : String(err))}`,
    });
    return findings;
  }

  if (sheet.cssRules.length > 1) {
    findings.push({
      kind: 'rule-fabricated',
      property,
      op,
      original: cap(original),
      mutant: cap(mutant),
      snippet: cap(snippet),
      detail: `single-declaration snippet fabricated ${sheet.cssRules.length} rules`,
      actual: String(sheet.cssRules.length),
    });
  }

  const rule = firstStyleRule(sheet);
  const value = rule?.style?.getPropertyValue(property) ?? '';
  if (value !== '') {
    findings.push({
      kind: 'invalid-retained',
      property,
      op,
      original: cap(original),
      mutant: cap(mutant),
      snippet: cap(snippet),
      detail: `grammar-invalid mutant for supported property '${property}' survived recovery`,
      actual: cap(value),
    });
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Campaign runner (pure; main() only adds argv parsing + file IO)
// ---------------------------------------------------------------------------

export interface OracleOptions {
  perProperty: number;
  mutations: number;
  seed: number;
  budgetMs: number;
  filter?: RegExp;
  maxFindings?: number;
}

/** Deterministic per-(property, sample, mutation) RNG stream. */
function rngForMutant(seed: number, property: string, sampleIndex: number, mutationIndex: number): Rng {
  return rngFromData(encodeUtf8(`invalid-superset:${seed}:${property}:${sampleIndex}:${mutationIndex}`));
}

function rngForProperty(seed: number, property: string): Rng {
  return rngFromData(encodeUtf8(`${seed}:${property}`));
}

export function runOracle(options: OracleOptions): InvalidSupersetReport {
  const { perProperty, mutations, seed, budgetMs } = options;
  const filterRe = options.filter ?? /./;
  const maxFindings = options.maxFindings ?? 300;

  const startedAt = Date.now();
  const report: InvalidSupersetReport = {
    oracleVersion: ORACLE_VERSION,
    tool: 'invalid-superset',
    generatedAt: new Date().toISOString(),
    seed,
    perProperty,
    mutations,
    filter: filterRe.source === '.' ? '(none)' : filterRe.source,
    elapsedMs: 0,
    truncatedByBudget: false,
    findingsCapped: false,
    counts: {
      properties: 0,
      valuesSampled: 0,
      mutantsGenerated: 0,
      skippedValid: 0,
      findings: 0,
      unsupportedSampled: 0,
      emptySamplesSkipped: 0,
      noopMutantsSkipped: 0,
      oracleChecked: 0,
    },
    componentValueProbe: { accepted: 0, rejected: 0, threw: 0 },
    clusters: [],
    findings: [],
  };

  const clusterMap = new Map<string, InvalidSupersetCluster>();
  const store = (finding: InvalidSupersetFinding): void => {
    report.counts.findings += 1;
    if (report.findings.length < maxFindings) {
      report.findings.push(finding);
      const key = `${finding.property}\u0000${finding.op}`;
      const existing = clusterMap.get(key);
      if (existing) existing.count += 1;
      else clusterMap.set(key, { property: finding.property, op: finding.op, count: 1, example: finding.snippet });
    } else {
      report.findingsCapped = true;
    }
  };

  const outOfBudget = (): boolean => Date.now() - startedAt > budgetMs;

  const matched = Object.keys(STANDARD_PROPERTIES_SYNTAX)
    .filter((name) => filterRe.test(name))
    .sort();

  for (const property of matched) {
    if (outOfBudget()) {
      report.truncatedByBudget = true;
      break;
    }
    report.counts.properties += 1;

    const supported = SUPPORTED_PROPERTIES.has(property);
    const syntax = STANDARD_PROPERTIES_SYNTAX[property]!;
    // `<'other-prop'>` references resolve against the same standard table
    // (css-values-4 #typedef-property) — mirrors valid-subset.ts.
    const generator = new SyntaxGenerator(rngForProperty(seed, property), (name) =>
      STANDARD_PROPERTIES_SYNTAX[name],
    );

    let acceptedValues = 0;
    let tries = 0;
    while (acceptedValues < perProperty && tries < perProperty * 4) {
      if (outOfBudget()) {
        report.truncatedByBudget = true;
        break;
      }
      tries += 1;
      let value: string | null;
      try {
        value = generator.sample(syntax);
      } catch {
        value = null; // generator documents "never throws"; belt-and-braces
      }
      if (value === null || value === '') {
        if (value === '') report.counts.emptySamplesSkipped += 1;
        continue;
      }
      acceptedValues += 1;
      report.counts.valuesSampled += 1;
      if (!supported) report.counts.unsupportedSampled += 1;

      for (let mutationIndex = 0; mutationIndex < mutations; mutationIndex++) {
        if (outOfBudget()) {
          report.truncatedByBudget = true;
          break;
        }
        const rng = rngForMutant(seed, property, acceptedValues - 1, mutationIndex);
        const mutation = mutateDeclaration(property, value, rng);
        if (mutation === null) continue; // no op applied; nothing generated
        report.counts.mutantsGenerated += 1;

        // No-op guard: a mutant equal to the original (or empty) measures
        // nothing; classify as skipped rather than checked.
        if (mutation.value === value || mutation.value === '') {
          report.counts.noopMutantsSkipped += 1;
          continue;
        }

        // Component-value surface probe — recorded separately because its
        // contract differs (cssom-1 #parse-component-value throws on multiple
        // top-level values; this library returns null for empty input).
        try {
          const parsed = parseComponentValueSync(mutation.value);
          if (parsed === null) report.componentValueProbe.rejected += 1;
          else report.componentValueProbe.accepted += 1;
        } catch {
          report.componentValueProbe.threw += 1;
        }

        if (!supported) {
          // Unsupported properties never produce findings (anti-FP, mirrors
          // valid-subset.ts).
          report.counts.skippedValid += 1;
        } else if (POLICY_SKIPPED_OPS.has(mutation.op)) {
          // Policy ops are still-grammar-valid by design (see module docs).
          report.counts.skippedValid += 1;
        } else if (mutantIsAmbiguouslyValid(mutation.op, syntax, value)) {
          // Grammar-dependent structural ops whose mutant may remain valid —
          // conservative skip (see {@link mutantIsAmbiguouslyValid}).
          report.counts.skippedValid += 1;
        } else {
          report.counts.oracleChecked += 1;
          for (const finding of checkMutantSnippet(mutation.snippet, property, mutation.op, value, mutation.value)) {
            store(finding);
          }
        }
      }
    }
  }

  report.elapsedMs = Date.now() - startedAt;
  report.clusters = [...clusterMap.values()].sort(
    (a, b) => b.count - a.count || a.property.localeCompare(b.property) || a.op.localeCompare(b.op),
  );
  return report;
}

// ---------------------------------------------------------------------------
// CLI plumbing
// ---------------------------------------------------------------------------

function parseArgs(argv: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

function formatSummary(report: InvalidSupersetReport): string {
  const lines = [
    ``,
    `=== invalid-superset (${report.oracleVersion}) ===`,
    `seed=${report.seed} per-property=${report.perProperty} mutations=${report.mutations} filter=${report.filter}`,
    `properties matched: ${report.counts.properties}`,
    `values sampled: ${report.counts.valuesSampled} (unsupported: ${report.counts.unsupportedSampled}, empty skipped: ${report.counts.emptySamplesSkipped})`,
    `mutants generated: ${report.counts.mutantsGenerated} (skippedValid: ${report.counts.skippedValid}, noop: ${report.counts.noopMutantsSkipped}, checked: ${report.counts.oracleChecked})`,
    `findings (invalid-retained / rule-fabricated / parse-threw): ${report.counts.findings}${report.findingsCapped ? ' [details capped]' : ''}`,
    `component-value probe: accepted=${report.componentValueProbe.accepted} rejected=${report.componentValueProbe.rejected} threw=${report.componentValueProbe.threw}`,
  ];
  lines.push(`clusters (property × op × stored-count):`);
  for (const c of report.clusters.slice(0, 15)) {
    lines.push(`  ${c.property} × ${c.op} × ${c.count}  e.g. ${c.example}`);
  }
  if (report.clusters.length > 15) lines.push(`  … ${report.clusters.length - 15} more clusters`);
  lines.push(`elapsed: ${report.elapsedMs}ms${report.truncatedByBudget ? ' [BUDGET-TRUNCATED]' : ''}`);
  return lines.join('\n');
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const int = (name: string, fallback: number): number => {
    const parsed = Number.parseInt(args.get(name)?.[0] ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };

  const filterRaw = args.get('filter')?.[0];
  let filter: RegExp;
  try {
    filter = filterRaw === undefined ? /./ : new RegExp(filterRaw);
  } catch (err: unknown) {
    process.stderr.write(`invalid-superset: bad --filter: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  const report = runOracle({
    perProperty: Math.max(1, int('per-property', 3)),
    mutations: Math.max(1, int('mutations', 4)),
    seed: int('seed', 20260824),
    budgetMs: int('budget-ms', 60_000),
    filter,
  });

  const outFile = args.get('out')?.[0];
  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2));

  process.stdout.write(formatSummary(report));
  if (outFile) process.stdout.write(`\nreport: ${outFile}\n`);
  process.stdout.write('\n');
  // Triage tool: exit 0 even with findings; gating happens downstream after
  // minimization + spec validation (fuzz/oracles/README.md).
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
