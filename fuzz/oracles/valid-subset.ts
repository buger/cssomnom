/**
 * Valid-subset oracle (triage CLI): grammar-valid declarations must never be
 * dropped by the recovery parser.
 *
 * css-values-4 § "Value definition syntax" defines the grammar our sampler
 * walks; a value generated *from* a property's own standard syntax is valid by
 * construction, and CSSOM requires a conforming parser to keep every valid
 * declaration it can express (cssom-1 #the-cssstyledeclaration-interface,
 * getPropertyValue round-trip). Dropping one is an output-correctness bug —
 * crash-signals cannot see it.
 *
 * Anti-false-positive rule: survival is asserted ONLY for properties listed in
 * SUPPORTED_PROPERTIES (src/data/gen/property-list.ts). Sampled properties
 * outside that set are counted in `unsupportedSampled` and never produce
 * findings — this library intentionally does not implement every syntaxed
 * property.
 *
 * Usage:
 *   node fuzz/oracles/valid-subset.ts [--per-property N] [--seed N]
 *        [--filter REGEX] [--budget-ms N] [--max-findings N] [--out FILE]
 *
 * Exit code is always 0: this is a dry-run triage tool, not a gate. Findings
 * feed minimize → cluster → spec-validation downstream; raw counts never count
 * as bugs (see fuzz/oracles/README.md).
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { STANDARD_PROPERTIES_SYNTAX } from '../../src/data/gen/standard-syntax.ts';
import { SUPPORTED_PROPERTIES } from '../../src/data/gen/property-list.ts';
import { SyntaxGenerator } from './lib/grammar-gen.ts';
import {
  checkFixpoint,
  ORACLE_VERSION,
  parseDeclarationValue,
  type Finding,
} from './lib/invariants.ts';
import { encodeUtf8, rngFromData, type Rng } from '../css-fuzz/src/rng.ts';

interface ContextualizedFinding extends Finding {
  property: string;
  sampledValue: string;
}

interface SubsetReport {
  oracleVersion: string;
  tool: 'valid-subset';
  generatedAt: string;
  seed: number;
  perProperty: number;
  filter: string;
  elapsedMs: number;
  truncatedByBudget: boolean;
  findingsCapped: boolean;
  propertiesMatched: number;
  valuesGenerated: number;
  unsupportedSampled: number;
  emptySamplesSkipped: number;
  droppedCount: number;
  fixpointFindingsCount: number;
  /** Stored finding details (capped at --max-findings). */
  findings: ContextualizedFinding[];
}

/** Deterministic per-property RNG stream, independent of processing order. */
function rngForProperty(globalSeed: number, property: string): Rng {
  return rngFromData(encodeUtf8(`${globalSeed}:${property}`));
}

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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const int = (name: string, fallback: number): number => {
    const parsed = Number.parseInt(args.get(name)?.[0] ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };
  const perProperty = Math.max(1, int('per-property', 3));
  const seed = int('seed', 20260823);
  const budgetMs = int('budget-ms', 60_000);
  const maxFindings = Math.max(1, int('max-findings', 200));
  const filterRaw = args.get('filter')?.[0];
  let filterRe: RegExp;
  try {
    filterRe = filterRaw === undefined ? /./ : new RegExp(filterRaw);
  } catch (err: unknown) {
    process.stderr.write(`valid-subset: bad --filter: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const report: SubsetReport = {
    oracleVersion: ORACLE_VERSION,
    tool: 'valid-subset',
    generatedAt: new Date().toISOString(),
    seed,
    perProperty,
    filter: filterRaw ?? '(none)',
    elapsedMs: 0,
    truncatedByBudget: false,
    findingsCapped: false,
    propertiesMatched: 0,
    valuesGenerated: 0,
    unsupportedSampled: 0,
    emptySamplesSkipped: 0,
    droppedCount: 0,
    fixpointFindingsCount: 0,
    findings: [],
  };

  const outOfBudget = (): boolean => Date.now() - startedAt > budgetMs;
  const store = (finding: ContextualizedFinding): void => {
    if (report.findings.length < maxFindings) report.findings.push(finding);
    else report.findingsCapped = true;
  };
  const forward = (property: string, value: string, findings: readonly Finding[]): void => {
    for (const f of findings) {
      if (f.kind === 'valid-value-dropped') continue; // survival oracle owns that kind here
      report.fixpointFindingsCount += 1;
      store({ ...f, property, sampledValue: value });
    }
  };

  const matched = Object.keys(STANDARD_PROPERTIES_SYNTAX)
    .filter((name) => filterRe.test(name))
    .sort();

  for (const property of matched) {
    if (outOfBudget()) {
      report.truncatedByBudget = true;
      break;
    }
    report.propertiesMatched += 1;

    const supported = SUPPORTED_PROPERTIES.has(property);
    const syntax = STANDARD_PROPERTIES_SYNTAX[property]!;
    // `<'other-prop'>` references resolve against the same standard table
    // (css-values-4 #typedef-property).
    const generator = new SyntaxGenerator(rngForProperty(seed, property), (name) =>
      STANDARD_PROPERTIES_SYNTAX[name],
    );

    let accepted = 0;
    let tries = 0;
    while (accepted < perProperty && tries < perProperty * 4) {
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
        // '' matches syntaxes with optional terms; the survival oracle cannot
        // distinguish an empty match from a dropped declaration, so empty
        // samples are skipped rather than misreported (anti-false-positive).
        if (value === '') report.emptySamplesSkipped += 1;
        continue;
      }
      accepted += 1;
      report.valuesGenerated += 1;

      const snippet = `.o{${property}:${value};}`;
      if (!supported) {
        report.unsupportedSampled += 1;
      } else if (parseDeclarationValue(snippet, property) === '') {
        // A grammar-valid declaration vanished in recovery — output bug.
        report.droppedCount += 1;
        store({
          kind: 'valid-value-dropped',
          detail: `grammar-valid declaration for supported property '${property}' was dropped`,
          expected: value,
          actual: '',
          property,
          sampledValue: value,
        });
      }

      // Fixpoint findings are forwarded verbatim regardless of support status:
      // parse∘serialize instability on any input is a bug on its own
      // (cssom-1 serialization rules).
      forward(property, value, checkFixpoint(snippet));
    }
  }

  report.elapsedMs = Date.now() - startedAt;

  const outFile = args.get('out')?.[0];
  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2));

  process.stdout.write(
    [
      ``,
      `=== valid-subset (${ORACLE_VERSION}) ===`,
      `seed=${report.seed} per-property=${perProperty} filter=${report.filter}`,
      `properties matched: ${report.propertiesMatched}`,
      `values generated: ${report.valuesGenerated} (unsupported sampled: ${report.unsupportedSampled}, empty skipped: ${report.emptySamplesSkipped})`,
      `dropped (valid-value-dropped): ${report.droppedCount}`,
      `fixpoint findings: ${report.fixpointFindingsCount}${report.findingsCapped ? ` [details capped at ${maxFindings}]` : ''}`,
      `elapsed: ${report.elapsedMs}ms${report.truncatedByBudget ? ' [BUDGET-TRUNCATED]' : ''}`,
      outFile ? `report: ${outFile}` : `(no --out given; stdout summary only)`,
      ``,
    ].join('\n'),
  );
  // Triage tool: exit 0 even when findings exist. Gating happens downstream
  // after minimization + spec validation, never on raw counts.
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
