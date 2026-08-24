/**
 * Round-trip / conservation sweep over a CSS corpus (dry-run triage tool).
 *
 * Feeds every corpus input through the reference-free oracles in
 * lib/invariants.ts and emits a clustered findings report. This is the
 * *candidate stream* of the bug pipeline — NOT a KI ledger. Per repo policy,
 * raw finding counts do not count as bugs: minimize, cluster, validate each
 * root against the spec, then file via proof/ with twice-red reproducers.
 *
 * Usage:
 *   node fuzz/oracles/roundtrip-sweep.ts [--corpus-dir DIR]... [--external]
 *        [--out REPORT.json] [--budget-ms N] [--max-files N] [--ci]
 *
 * Never mutates repo state. Exit code is 0 for triage use; with --ci it is 1
 * when any finding exists (for gating curated corpora only — expect findings
 * on wild corpora).
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { checkInput, ORACLE_VERSION, type Finding } from './lib/invariants.ts';
import { corpusEntries } from '../css-fuzz/src/index.ts';
import { decodeUtf8Lossy } from '../css-fuzz/src/rng.ts';

interface SourceInput {
  sourceId: string;
  text: string;
}

interface Cluster {
  key: string;
  count: number;
  exampleSourceId: string;
  exampleFinding: Finding;
}

const EXTERNAL_DIR = 'tests/fixtures/external';
const EXTERNAL_CAP = 3000;

// ---------------------------------------------------------------------------
// Curated edge cases (small, deterministic, high edge-density)
// ---------------------------------------------------------------------------

const EDGE_CASES: readonly string[] = [
  '',
  ' ',
  '\n\t\r\f',
  '/* comment only */',
  '/**/ /**/ /*/',
  '/* unterminated',
  'a{color:red}',
  'A{COLOR:RED}',
  'a{color:red!important}',
  'a{color:red ! important}',
  'a{color:red!important;color:blue}',
  'a{;;;}',
  '{}',
  '{{}}',
  '}}}',
  'a{}b{}',
  '@media all{a{color:red}}',
  '@media (max-width:100px){a{color:red}}',
  '@media (max-width:{a{color:red}}',
  '@supports (display:grid){@media screen{a{display:grid}}}',
  '@supports {a{color:red}}',
  '@keyframes k{from{opacity:0}to{opacity:1}}',
  '@keyframes k{0%{top:0}100%{top:10px}}',
  '@keyframes{k{a:b}}',
  '@font-face{font-family:x;src:url(a.woff)}',
  '@charset "utf-8";a{color:red}',
  '@import url(x.css);a{color:red}',
  '@unknown-at-rule arg{a{nested:true}}',
  'a{background:url(x.png)}',
  'a{background:url("x.png") no-repeat}',
  'a{background:url(}',
  'a{background:url("unclosed)}',
  'a{content:"unterminated',
  "a{content:'mixed\"}",
  'a{content:"a\\22 b"}',
  'a{color:#abc}',
  'a{color:#abcd}',
  'a{color:#abcde}',
  'a{width:10px;width:.5em;width:+3px;width:-2%',
  'a{width:1e3px;width:10E-2px}',
  'a{margin:0 auto}',
  'a{transform:translate(1px,2px) rotate(.5turn)}',
  'a{width:calc(100% - (2*3px))}',
  'a{--custom: ;b:var(--custom)}',
  'a{b:env(safe-area-inset-top)}',
  'a:not([hidden]){color:red}',
  'a[href^="http"]::before{content:"> "}',
  '|a{}',
  '*|a{}',
  '@namespace svg url(http://www.w3.org/2000/svg);svg|a{}',
  '@font-face{src:local("Font Name"),url(f.woff2)format("woff2");unicode-range:U+0-7F}',
  '<!--a{}-->',
  'a{filter:progid:DXImageTransform(foo)}',
  'a{color:red}\\n@media print{b{x:y}}'.replace('\\n', '\n'),
  '\uFEFFa{color:red}',
  'a{color:red}\0b{c:d}',
  '\uD800lone{lone surrogate}',
  'pair{\uD83D\uDE00 emoji}',
  'a{background:"str"ident}',
  'a{color:red;;;};;;',
  // Comment-conservation family (v2 oracle false-positive target): a trailing
  // comment after a declaration and adjacent comments between empty rules
  // must serialize identically on both passes.
  'a{color:red} /* x */',
  'a{}/*a*//*b*/',
];

// ---------------------------------------------------------------------------
// Corpus assembly
// ---------------------------------------------------------------------------

function looksLikeCss(text: string): boolean {
  return text.includes('{') && (text.includes(';') || text.includes(':'));
}

/**
 * Generic recursive extractor for external-suite JSON fixtures (shape-independent).
 *
 * `depth` guards against stack overflow (RangeError) on pathologically nested
 * fixture JSON — V8's `JSON.parse` survives nesting depths that this recursive
 * walk cannot. Real fixtures are shallow; 64 levels is generous. Sub-cap
 * traversal simply yields nothing beyond level 64; if extraction still throws
 * for any reason, the loader skips and counts the file (see
 * {@link getSkippedExternalFileCount}).
 */
export function extractExternalInputs(node: unknown, out: string[], seen: Set<string>, depth = 0): void {
  if (depth > 64) return;
  if (out.length >= EXTERNAL_CAP) return;
  if (typeof node === 'string') {
    const trimmed = node.trim();
    if (trimmed.length >= 4 && trimmed.length <= 8192 && looksLikeCss(trimmed) && !seen.has(trimmed)) {
      seen.add(trimmed);
      out.push(trimmed);
    }
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      extractExternalInputs(item, out, seen, depth + 1);
      if (out.length >= EXTERNAL_CAP) return;
    }
    return;
  }
  if (node !== null && typeof node === 'object') {
    const record = node as Record<string, unknown>;
    if ('input' in record) extractExternalInputs(record['input'], out, seen, depth + 1);
    for (const key of Object.keys(record)) {
      if (key === 'input') continue;
      extractExternalInputs(record[key], out, seen, depth + 1);
      if (out.length >= EXTERNAL_CAP) return;
    }
  }
}

// Module-local count of external fixture files whose extraction was aborted
// mid-walk (e.g. RangeError from pathological nesting). Best-effort loading:
// a bad file must never take down the sweep.
let skippedExternalFiles = 0;

/** Number of external fixture files skipped because extraction threw. */
export function getSkippedExternalFileCount(): number {
  return skippedExternalFiles;
}

function loadExternalInputsCollect(): SourceInput[] {
  const texts: string[] = [];
  const seen = new Set<string>();
  let files: string[];
  try {
    files = readdirSync(EXTERNAL_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(EXTERNAL_DIR, file), 'utf8')) as unknown;
    } catch {
      continue;
    }
    try {
      extractExternalInputs(parsed, texts, seen);
    } catch {
      // Extraction threw (e.g. stack-deep nesting); drop this file but keep
      // the sweep alive. Counted so the summary can surface the loss.
      skippedExternalFiles++;
    }
  }
  return texts.map((text, i) => ({ sourceId: `external#${i}`, text }));
}

function walkCssFiles(dir: string, acc: string[], maxFiles: number): void {
  if (acc.length >= maxFiles) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries) {
    if (acc.length >= maxFiles) return;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkCssFiles(full, acc, maxFiles);
    else if (entry.endsWith('.css') && st.size <= 262_144) acc.push(full);
  }
}

/**
 * Anti-greenwashing self-check: for every explicitly-requested --corpus-dir
 * that contributed 0 inputs, emit a warning line. A silent zero (typo'd path,
 * wrong extension, all files oversized/unreadable) previously looked identical
 * to a successful load — wave-1 lost 3 of 4 WPT dirs without any signal.
 */
export function zeroInputCorpusDirWarnings(
  requestedDirs: readonly string[],
  inputsPerDir: readonly number[],
): string[] {
  return requestedDirs.flatMap((dir, i) =>
    (inputsPerDir[i] ?? 0) === 0 ? [`warning: corpus-dir '${dir}' yielded 0 inputs`] : [],
  );
}

export interface CorpusBuild {
  inputs: SourceInput[];
  /** One warning line per explicitly-requested --corpus-dir that yielded 0 inputs. */
  warnings: string[];
}

export function buildCorpus(args: Map<string, string[]>): CorpusBuild {
  const corpus: SourceInput[] = [];
  EDGE_CASES.forEach((text, i) => corpus.push({ sourceId: `edge#${i}`, text }));

  try {
    for (const entry of corpusEntries()) {
      // CorpusEntry stores raw bytes (`data`); decode lossily so invalid-UTF-8
      // seeds still reach the string-based oracles.
      corpus.push({ sourceId: `fuzz:${entry.id}`, text: decodeUtf8Lossy(entry.data) });
    }
  } catch {
    // css-fuzz barrel unavailable — continue with embedded corpus only.
  }

  if (args.has('external')) {
    corpus.push(...loadExternalInputsCollect());
  }

  const requestedDirs = args.get('corpus-dir') ?? [];
  const inputsPerDir: number[] = [];
  for (const dir of requestedDirs) {
    const files: string[] = [];
    walkCssFiles(dir, files, args.has('external') ? 1500 : 4000);
    let loaded = 0;
    files.forEach((path) => {
      try {
        const text = readFileSync(path, 'utf8');
        if (text.length <= 262_144) {
          corpus.push({ sourceId: `file:${path}`, text });
          loaded++;
        }
      } catch {
        // unreadable file: skip silently, corpus is best-effort
      }
    });
    inputsPerDir.push(loaded);
  }

  return { inputs: corpus, warnings: zeroInputCorpusDirWarnings(requestedDirs, inputsPerDir) };
}

// ---------------------------------------------------------------------------
// Clustering + reporting
// ---------------------------------------------------------------------------

function clusterKey(kind: string, finding: Finding): string {
  // Empty-string `actual` carries no information; treat it as missing so it
  // doesn't collapse distinct findings that differ only in `detail`.
  const basis = finding.actual !== undefined && finding.actual.length > 0 ? finding.actual : finding.detail;
  const normalized = basis.replace(/\d+/g, 'N').replace(/\s+/g, ' ').trim();
  return `${kind}:${normalized.slice(0, 60)}`;
}

interface Report {
  oracleVersion: string;
  generatedAt: string;
  elapsedMs: number;
  truncatedByBudget: boolean;
  inputsTotal: number;
  inputsClean: number;
  bySource: Record<string, number>;
  findingsTotal: number;
  findingsByKind: Record<string, number>;
  clusters: Cluster[];
  findingsCapped: Array<{ sourceId: string } & Finding>;
}

function runSweep(corpus: SourceInput[], budgetMs: number): Report {
  const startedAt = Date.now();
  const bySource: Record<string, number> = {};
  const byKind: Record<string, number> = {};
  const clusters = new Map<string, Cluster>();
  const cappedFindings: Array<{ sourceId: string } & Finding> = [];
  let truncated = false;
  let clean = 0;

  for (const input of corpus) {
    if (Date.now() - startedAt > budgetMs) {
      truncated = true;
      break;
    }
    const prefix = input.sourceId.split(':')[0] ?? 'unknown';
    bySource[prefix] = (bySource[prefix] ?? 0) + 1;

    const result = checkInput(input.text);
    if (result.findings.length === 0) {
      clean++;
      continue;
    }
    for (const finding of result.findings) {
      byKind[finding.kind] = (byKind[finding.kind] ?? 0) + 1;
      const key = clusterKey(finding.kind, finding);
      const existing = clusters.get(key);
      if (existing) existing.count++;
      else clusters.set(key, { key, count: 1, exampleSourceId: input.sourceId, exampleFinding: finding });
      if (cappedFindings.length < 500) cappedFindings.push({ sourceId: input.sourceId, ...finding });
    }
  }

  return {
    oracleVersion: ORACLE_VERSION,
    generatedAt: new Date().toISOString(),
    elapsedMs: Date.now() - startedAt,
    truncatedByBudget: truncated,
    inputsTotal: corpus.length,
    inputsClean: clean,
    bySource,
    findingsTotal: Object.values(byKind).reduce((sum, n) => sum + n, 0),
    findingsByKind: byKind,
    clusters: [...clusters.values()].sort((a, b) => b.count - a.count),
    findingsCapped: cappedFindings,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function parseArgs(argv: readonly string[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  let current: string | null = null;
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      current = arg.slice(2);
      // Repeated occurrences of the same flag ACCUMULATE (e.g. multiple
      // --corpus-dir dirs); only create the bucket on first sight so a
      // later occurrence never clobbers earlier values.
      if (!map.has(current)) map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const budgetMs = Number.parseInt(args.get('budget-ms')?.[0] ?? '90000', 10) || 90_000;

  process.stdout.write(`building corpus…\n`);
  const { inputs: corpus, warnings } = buildCorpus(args);
  process.stdout.write(`corpus: ${corpus.length} inputs\n`);
  for (const line of warnings) process.stdout.write(`${line}\n`);

  const report = runSweep(corpus, budgetMs);

  const outFile = args.get('out')?.[0];
  if (outFile) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(outFile, JSON.stringify(report, null, 2));
  }

  const skippedExternal = getSkippedExternalFileCount();
  process.stdout.write(
    [
      ``,
      `=== roundtrip-sweep (${ORACLE_VERSION}) ===`,
      `inputs: ${report.inputsTotal} (clean ${report.inputsClean})${skippedExternal > 0 ? ` (skipped ${skippedExternal} malformed external files)` : ''}${report.truncatedByBudget ? ' [BUDGET-TRUNCATED]' : ''}`,
      `findings: ${report.findingsTotal}`,
      ...Object.entries(report.findingsByKind)
        .sort((a, b) => b[1] - a[1])
        .map(([kind, count]) => `  ${kind}: ${count}`),
      `clusters: ${report.clusters.length}`,
      ...report.clusters.slice(0, 12).map((c) => `  [${c.count}] ${c.key}`),
      outFile ? `report: ${outFile}` : `(no --out given; stdout summary only)`,
      ``,
    ].join('\n'),
  );

  if (args.has('ci') && report.findingsTotal > 0) {
    process.exitCode = 1;
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  main().catch((err: unknown) => {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  });
}
