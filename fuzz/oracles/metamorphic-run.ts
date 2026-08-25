/**
 * Metamorphic-relation runner (dry-run triage CLI).
 *
 * Applies the meaning-preserving wrappers from lib/metamorphic.ts (M1 case-flip,
 * M2 escape-encoding, M3 separator injection, M5 top-level rule duplication)
 * to every corpus item, plus the chunk-boundary permutation equivalence check
 * (M4), and reports BASELINE-COMPARED delta findings:
 *
 *   violations(transformed) - violations(original) > 0   ⇒ suspicious pair
 *
 * A meaning-preserving transform cannot add invariant violations: any positive
 * delta implies pre-existing debt on BOTH shapes (cancelled by subtraction),
 * a wrapper bug, or a real parser bug only the transformed shape exposes.
 * Negative deltas are impossible too and are surfaced separately as a
 * nondeterminism hint. Deltas are grouped by (relation × invariant-kind);
 * raw counts are triage candidates, never bugs (fuzz/oracles/README.md).
 *
 * Usage:
 *   node fuzz/oracles/metamorphic-run.ts [--selftest] [--corpus-dir DIR]...
 *        [--budget-ms N] [--seed N] [--out REPORT.json]
 *
 * Exit code 0 always for sweeps (triage tool); 1 only when --selftest fails.
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkInput, type Finding } from './lib/invariants.ts';
import {
  METAMORPHIC_VERSION,
  checkChunkBoundaryPermutations,
  metamorphicTransforms,
} from './lib/metamorphic.ts';

/** Inputs larger than this never enter transform evaluation (budget guard). */
const MAX_INPUT_CHARS = 65_536;

/** Max .css files walked per --corpus-dir. */
const MAX_FILES_PER_DIR = 2000;

// ---------------------------------------------------------------------------
// Embedded corpus (small, deterministic, high edge-density; curated for the
// metamorphic relations: case-sensitive-looking names, escapable idents, many
// token boundaries, duplicable top-level rules)
// ---------------------------------------------------------------------------

const EMBEDDED_CORPUS: readonly string[] = [
  '',
  ' ',
  '/* comment only */',
  '/* unterminated',
  'a{color:red}',
  'A{COLOR:RED}',
  '.foo{margin:0 auto}',
  'a{color:red!important}',
  'a{color:red ! important;color:blue}',
  'a{margin:0 auto;margin-top:1px}',
  'a{--custom:{} ;b:var(--custom)}',
  'a{b:c}a{b:c}',
  '@media screen{a{color:red}}',
  '@media (max-width:100px){a{color:red}}',
  '@supports (display:grid){@media screen{a{display:grid}}}',
  '@keyframes k{from{opacity:0}to{opacity:1}}',
  '@font-face{font-family:X;src:url(a.woff)}',
  '@charset "utf-8";a{color:red}',
  '@import url(x.css);a{color:red}',
  '@unknown-at-rule arg{a{nested:true}}',
  'a:not([hidden])::before{content:"> "}',
  'a[href^="http"]{background:url("x.png") no-repeat}',
  '<!--a{}-->',
  'a{width:1e3px;width:10E-2px;width:calc(100% - (2*3px))}',
  'a{content:"unterminated}',
  'a{background:url("unclosed)}',
  '\uFEFFa{color:red}',
  'a{color:red}\0b{c:d}',
  'pair{\uD83D\uDE00 emoji}',
  'a{color:red} /* x */',
  'a{}/*a*//*b*/',
];

// ---------------------------------------------------------------------------
// In-band self-tests (hand-pinned; run via --selftest, exit 1 on failure)
// ---------------------------------------------------------------------------

interface SelftestCase {
  name: string;
  input: string;
  /** Only variants whose relation equals this are asserted. */
  relation: string;
  /** The transformed text must contain this marker (wrapper sanity). */
  mustContain: string;
}

const SELFTEST_CASES: readonly SelftestCase[] = [
  {
    name: 'case-flip of A{color:RED} yields zero delta',
    input: 'A{color:RED}',
    relation: 'M1:case-flip',
    mustContain: 'COLOR',
  },
  {
    name: 'escape-encoding of .foo{margin:0 auto} yields zero delta',
    input: '.foo{margin:0 auto}',
    relation: 'M2:escape-idents',
    mustContain: '\\66 ',
  },
  {
    name: 'comment injection into @media screen{a{color:red}} yields zero delta',
    input: '@media screen{a{color:red}}',
    relation: 'M3:comment-injection',
    mustContain: '/*m3*/',
  },
];

function truncate(text: string, max = 120): string {
  return text.length <= max ? text : `${text.slice(0, max)}…(+${text.length - max})`;
}

/**
 * The recovery parser hard-wires `console.warn` for its ParseError telemetry
 * (src/AbstractTokenizer.ts) with no injectable sink, which would drown the
 * CLI report on malformed corpus items (expected input for a recovery parser).
 * Oracle *findings* are unaffected — this only mutes the log sink while
 * counting the suppressed messages for the report.
 */
function withSilencedParserWarnings<T>(fn: () => T): { value: T; suppressed: number } {
  const original = console.warn;
  let suppressed = 0;
  console.warn = (...args: unknown[]) => {
    void args;
    suppressed++;
  };
  try {
    return { value: fn(), suppressed };
  } finally {
    console.warn = original;
  }
}

function runSelftests(seed: number): boolean {
  let allPass = true;
  for (const testCase of SELFTEST_CASES) {
    const { value: baseCounts } = withSilencedParserWarnings(() =>
      kindCounts(checkInput(testCase.input).findings),
    );
    const variants = metamorphicTransforms(testCase.input, { seed }).filter((t) =>
      t.relation === testCase.relation,
    );
    const problems: string[] = [];
    if (variants.length === 0) {
      problems.push(`no ${testCase.relation} variant produced`);
    }
    for (const variant of variants) {
      if (!variant.transformed.includes(testCase.mustContain)) {
        problems.push(`marker ${JSON.stringify(testCase.mustContain)} missing in ${JSON.stringify(truncate(variant.transformed))}`);
      }
      const { value: delta, suppressed } = withSilencedParserWarnings(() =>
        totalDelta(baseCounts, kindCounts(checkInput(variant.transformed).findings)),
      );
      void suppressed; // selftest inputs are well-formed; noise not expected
      if (delta !== 0) {
        problems.push(`${variant.relation}: expected delta 0, got ${delta}`);
      }
    }
    if (problems.length === 0) {
      const shown = variants[0] === undefined ? '' : variants[0]!.transformed;
      process.stdout.write(
        `[selftest] PASS ${testCase.name} | relation=${testCase.relation} delta=0 transformed=${JSON.stringify(truncate(shown, 80))}\n`,
      );
    } else {
      allPass = false;
      for (const problem of problems) {
        process.stdout.write(`[selftest] FAIL ${testCase.name} | ${problem}\n`);
      }
    }
  }
  return allPass;
}

// ---------------------------------------------------------------------------
// Delta accounting
// ---------------------------------------------------------------------------

function kindCounts(findings: readonly Finding[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const finding of findings) {
    counts.set(finding.kind, (counts.get(finding.kind) ?? 0) + 1);
  }
  return counts;
}

/** Σ over kinds of max(0, transformed - original): the suspicious direction. */
function totalDelta(base: Map<string, number>, transformed: Map<string, number>): number {
  let delta = 0;
  for (const [kind, tCount] of transformed) {
    const excess = tCount - (base.get(kind) ?? 0);
    if (excess > 0) delta += excess;
  }
  return delta;
}

interface DeltaExample {
  sourceId: string;
  detail: string;
  transformedPreview: string;
}

interface DeltaGroup {
  relation: string;
  kind: string;
  count: number;
  examples: DeltaExample[];
}

interface RunReport {
  tool: 'metamorphic-run';
  version: string;
  seed: number;
  budgetMs: number;
  elapsedMs: number;
  truncatedByBudget: boolean;
  corpusEmbedded: number;
  corpusFilesByDir: Record<string, number>;
  corpusTotal: number;
  inputsSkippedTooLarge: number;
  transformsEvaluated: number;
  m4ChecksRun: number;
  suspiciousDeltaFindings: number;
  negativeDeltaUnits: number;
  suppressedParserWarnings: number;
  groups: DeltaGroup[];
}

// ---------------------------------------------------------------------------
// Corpus assembly
// ---------------------------------------------------------------------------

function walkCssFiles(dir: string, acc: string[]): void {
  if (acc.length >= MAX_FILES_PER_DIR) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  // Sorted for deterministic traversal order.
  for (const entry of entries.sort()) {
    if (acc.length >= MAX_FILES_PER_DIR) return;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkCssFiles(full, acc);
    else if (entry.endsWith('.css') && st.size <= MAX_INPUT_CHARS) acc.push(full);
  }
}

interface CorpusItem {
  sourceId: string;
  text: string;
}

interface LoadedCorpus {
  files: CorpusItem[];
  filesByDir: Record<string, number>;
  warnings: string[];
}

function loadCorpus(dirs: readonly string[]): LoadedCorpus {
  const filesByDir: Record<string, number> = {};
  const warnings: string[] = [];
  const files: CorpusItem[] = [];
  for (const dir of dirs) {
    const paths: string[] = [];
    walkCssFiles(dir, paths);
    let loaded = 0;
    for (const path of paths) {
      try {
        const text = readFileSync(path, 'utf8');
        if (text.length <= MAX_INPUT_CHARS) {
          files.push({ sourceId: `file:${path}`, text });
          loaded++;
        }
      } catch {
        // unreadable file: skip silently, corpus loading is best-effort
      }
    }
    filesByDir[dir] = loaded;
    if (loaded === 0) warnings.push(`warning: corpus-dir '${dir}' yielded 0 inputs`);
  }
  return { files, filesByDir, warnings };
}

// ---------------------------------------------------------------------------
// Sweep
// ---------------------------------------------------------------------------

function evaluateItem(
  sourceId: string,
  text: string,
  seed: number,
  state: {
    groups: Map<string, DeltaGroup>;
    transformsEvaluated: number;
    m4ChecksRun: number;
    suspicious: number;
    negativeUnits: number;
    suppressedWarnings: number;
  },
): void {
  const base = withSilencedParserWarnings(() => checkInput(text));
  state.suppressedWarnings += base.suppressed;
  const baseCounts = kindCounts(base.value.findings);

  // M4: direct equivalence violations (not deltas — fresh checks).
  const m4 = withSilencedParserWarnings(() => checkChunkBoundaryPermutations(text));
  state.suppressedWarnings += m4.suppressed;
  state.m4ChecksRun += 1;
  for (const finding of m4.value) {
    addToGroup(state.groups, 'M4:chunk-boundary-permutation', finding.kind, {
      sourceId,
      detail: finding.detail,
      transformedPreview: '(same input, boundary-aligned chunk schedule)',
    });
    state.suspicious += 1;
  }

  const variantsWrap = withSilencedParserWarnings(() => metamorphicTransforms(text, { seed }));
  state.suppressedWarnings += variantsWrap.suppressed;
  const variants = variantsWrap.value;
  for (const variant of variants) {
    if (variant.transformed.length > MAX_INPUT_CHARS * 4) continue; // runaway growth guard
    state.transformsEvaluated += 1;
    const result = withSilencedParserWarnings(() => checkInput(variant.transformed));
    state.suppressedWarnings += result.suppressed;
    const counts = kindCounts(result.value.findings);
    for (const [kind, tCount] of counts) {
      const bCount = baseCounts.get(kind) ?? 0;
      if (tCount > bCount) {
        addToGroup(state.groups, variant.relation, kind, {
          sourceId,
          detail: result.value.findings.find((f) => f.kind === kind)?.detail ?? '',
          transformedPreview: truncate(variant.transformed),
        });
        state.suspicious += tCount - bCount;
      } else if (tCount < bCount) {
        // Transforms preserve meaning: fewer findings is nondeterminism.
        state.negativeUnits += bCount - tCount;
      }
    }
  }
}

function addToGroup(
  groups: Map<string, DeltaGroup>,
  relation: string,
  kind: string,
  example: DeltaExample,
): void {
  const key = `${relation}\u0000${kind}`;
  let group = groups.get(key);
  if (!group) {
    group = { relation, kind, count: 0, examples: [] };
    groups.set(key, group);
  }
  group.count += 1;
  if (group.examples.length < 3) group.examples.push(example);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseCli(argv: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      // Repeated flags ACCUMULATE (e.g. multiple --corpus-dir).
      if (!map.has(current)) map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

async function main(): Promise<void> {
  const args = parseCli(process.argv.slice(2));
  const int = (name: string, fallback: number): number => {
    const parsed = Number.parseInt(args.get(name)?.[0] ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };
  const seed = int('seed', 20260825);
  const budgetMs = int('budget-ms', 120_000);

  if (args.has('selftest')) {
    const pass = runSelftests(seed);
    if (!pass) process.exitCode = 1;
    return;
  }

  const startedAt = Date.now();
  const dirs = args.get('corpus-dir') ?? [];
  const loaded = loadCorpus(dirs);

  // Deterministic order: embedded edge cases first, then --corpus-dir files in
  // sorted traversal order.
  const allItems: CorpusItem[] = EMBEDDED_CORPUS.map((text, i) => ({
    sourceId: `embedded#${i}`,
    text,
  }));
  allItems.push(...loaded.files);

  const state = {
    groups: new Map<string, DeltaGroup>(),
    transformsEvaluated: 0,
    m4ChecksRun: 0,
    suspicious: 0,
    negativeUnits: 0,
    suppressedWarnings: 0,
  };
  let skippedTooLarge = 0;
  let truncated = false;
  for (const item of allItems) {
    if (Date.now() - startedAt > budgetMs) {
      truncated = true;
      break;
    }
    if (item.text.length > MAX_INPUT_CHARS) {
      skippedTooLarge++;
      continue;
    }
    evaluateItem(item.sourceId, item.text, seed, state);
  }

  const groups = [...state.groups.values()].sort(
    (a, b) => b.count - a.count || a.relation.localeCompare(b.relation) || a.kind.localeCompare(b.kind),
  );
  const report: RunReport = {
    tool: 'metamorphic-run',
    version: METAMORPHIC_VERSION,
    seed,
    budgetMs,
    elapsedMs: Date.now() - startedAt,
    truncatedByBudget: truncated,
    corpusEmbedded: EMBEDDED_CORPUS.length,
    corpusFilesByDir: loaded.filesByDir,
    corpusTotal: allItems.length,
    inputsSkippedTooLarge: skippedTooLarge,
    transformsEvaluated: state.transformsEvaluated,
    m4ChecksRun: state.m4ChecksRun,
    suspiciousDeltaFindings: state.suspicious,
    negativeDeltaUnits: state.negativeUnits,
    suppressedParserWarnings: state.suppressedWarnings,
    groups,
  };

  const outFile = args.get('out')?.[0];
  if (outFile) writeFileSync(outFile, JSON.stringify(report, null, 2));

  const lines: string[] = [
    ``,
    `=== metamorphic-run (${METAMORPHIC_VERSION}) seed=${seed} ===`,
    `corpus: ${report.corpusTotal} inputs (embedded ${report.corpusEmbedded}${Object.entries(report.corpusFilesByDir)
      .map(([dir, n]) => `, ${dir}: ${n}`)
      .join('')})${skippedTooLarge > 0 ? ` [skipped ${skippedTooLarge} oversized]` : ''}${truncated ? ' [BUDGET-TRUNCATED]' : ''}`,
    ...loaded.warnings,
    `pairs compared: ${state.transformsEvaluated} transformed + ${state.m4ChecksRun} M4 boundary-permutation checks`,
    `suspicious delta findings: ${state.suspicious}`,
    `negative delta units (nondeterminism hint): ${state.negativeUnits}`,
    `parser console warnings suppressed: ${state.suppressedWarnings} (recovery-parser telemetry, not findings)`,
    `groups (relation × kind): ${groups.length}`,
  ];
  for (const group of groups.slice(0, 12)) {
    lines.push(`  [${group.count}] ${group.relation} :: ${group.kind}`);
    for (const example of group.examples.slice(0, 1)) {
      lines.push(`      e.g. ${example.sourceId}: ${truncate(example.detail, 140)}`);
      lines.push(`           transformed: ${truncate(example.transformedPreview, 110)}`);
    }
  }
  if (groups.length === 0) lines.push('  (none — all relations held)');
  lines.push(outFile ? `report: ${outFile}` : `(no --out given; stdout summary only)`);
  lines.push(`elapsed: ${report.elapsedMs}ms`);
  lines.push('');
  process.stdout.write(lines.join('\n'));
  // Triage tool: exit 0 regardless of deltas; gating happens downstream after
  // minimization + spec validation (fuzz/oracles/README.md pipeline policy).
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
