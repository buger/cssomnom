/**
 * WPT inline-CSS seed harvester (dry-run triage feeder).
 *
 * Walks the web-platform-tests submodule for HTML files under the requested
 * spec subdirectories and extracts inline CSS seeds:
 *
 *   - `<style> … </style>` blocks
 *   - `style="…"` / `style='…'` attribute values (wrapped in a dummy rule so
 *     each seed is a complete stylesheet for the parser)
 *
 * Extraction is deliberately CRUDE (regex-based, patterned after
 * scripts/external_suites/extract_wpt.ts, which this tool does not modify):
 * FALSE-POSITIVE RISKS include JS string literals containing `<style>`
 * markup inside test harness scripts, undecoded HTML entities (`&amp;` stays
 * literal), and template scaffolding. For recovery-parser *seeds* that noise
 * is tolerable — malformed CSS is a first-class input class here — but these
 * MUST NOT be treated as semantic fixtures.
 *
 * Output: one CSS document per file, `NNNN-seed.css`, plus `manifest.json`
 * (source path per seed). Byte-deterministic (no timestamps, sorted walks).
 * Writes ONLY inside --out-dir (default /tmp/opencode/wpt-seeds/).
 *
 * Usage:
 *   node fuzz/oracles/wpt-seeds.ts [--spec-subdir css/css-syntax]...
 *        [--max-files N] [--limit-per-file N] [--out-dir DIR]
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const WPT_SEEDS_VERSION = 'fuzz/oracles/wpt-seeds v1';

const DEFAULT_OUT_DIR = '/tmp/opencode/wpt-seeds';
const DEFAULT_SPEC_SUBDIRS = ['css/css-syntax'];
const MAX_SEED_CHARS = 16_384; // size-cap per seed (chars, not bytes)
const DEFAULT_MAX_FILES = Number.MAX_SAFE_INTEGER;
const DEFAULT_LIMIT_PER_FILE = 8;

interface SeedRecord {
  file: string;
  source: string;
  kind: 'style-block' | 'style-attr';
  bytes: number;
  text: string;
}

/** Manifest shape: SeedRecord minus the bulky text payload. */
type ManifestEntry = Omit<SeedRecord, 'text'>;

interface HarvestStats {
  htmlFilesWalked: number;
  htmlFilesRead: number;
  styleBlocksFound: number;
  styleAttrsFound: number;
  extractionsConsidered: number;
  dedupeDropped: number;
  oversizeSkipped: number;
  emptySkipped: number;
  perFileLimitDropped: number;
  emitted: number;
}

// ---------------------------------------------------------------------------
// Extraction (crude, documented false-positive risk)
// ---------------------------------------------------------------------------

const STYLE_BLOCK_RE = /<style\b([^>]*)>([\s\S]*?)<\/style>/gi;
const STYLE_ATTR_RE = /\bstyle\s*=\s*(["'])([\s\S]*?)\1/gi;
/** `<style type="text/plain">` and friends are not CSS seeds. */
const TYPE_ATTR_RE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)')/i;

function styleBlockTypeAllowsCss(attrs: string): boolean {
  const match = TYPE_ATTR_RE.exec(attrs);
  if (!match) return true; // absent type defaults to text/css
  const type = match[1] ?? match[2] ?? '';
  return type.toLowerCase().includes('css');
}

export function extractStyleBlocks(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(STYLE_BLOCK_RE)) {
    if (!styleBlockTypeAllowsCss(match[1] ?? '')) continue;
    out.push((match[2] ?? '').trim());
  }
  return out;
}

/**
 * Inline `style="…"` values wrapped into a dummy rule. Crude filters: needs a
 * `:` (declaration-shaped) and no raw braces (attribute soup protection).
 */
export function extractStyleAttrs(html: string): string[] {
  const out: string[] = [];
  for (const match of html.matchAll(STYLE_ATTR_RE)) {
    const value = (match[2] ?? '').trim();
    if (!value.includes(':')) continue;
    if (/[{}<>]/.test(value)) continue;
    out.push(`#wpt-inline-harvest{${value}}`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Walker
// ---------------------------------------------------------------------------

function walkHtmlFiles(dir: string, acc: string[], maxFiles: number): void {
  if (acc.length >= maxFiles) return;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const entry of entries.sort()) {
    if (acc.length >= maxFiles) return;
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) walkHtmlFiles(full, acc, maxFiles);
    else if (entry.endsWith('.html')) acc.push(full);
  }
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
      // Repeated flags ACCUMULATE (repeatable --spec-subdir).
      if (!map.has(current)) map.set(current, []);
    } else if (current !== null) {
      map.get(current)?.push(arg);
    }
  }
  return map;
}

function main(): void {
  const args = parseCli(process.argv.slice(2));
  const repoRoot = resolve(import.meta.dirname, '../..');
  const wptRoot = join(repoRoot, 'submodules', 'web-platform-tests');

  const intArg = (name: string, fallback: number): number => {
    const parsed = Number.parseInt(args.get(name)?.[0] ?? '', 10);
    return Number.isNaN(parsed) ? fallback : parsed;
  };
  const maxFiles = intArg('max-files', DEFAULT_MAX_FILES);
  const limitPerFile = Math.max(1, intArg('limit-per-file', DEFAULT_LIMIT_PER_FILE));
  const outDir = args.get('out-dir')?.[0] ?? DEFAULT_OUT_DIR;
  const subdirs = args.get('spec-subdir')?.length ? args.get('spec-subdir')! : DEFAULT_SPEC_SUBDIRS;

  const stats: HarvestStats = {
    htmlFilesWalked: 0,
    htmlFilesRead: 0,
    styleBlocksFound: 0,
    styleAttrsFound: 0,
    extractionsConsidered: 0,
    dedupeDropped: 0,
    oversizeSkipped: 0,
    emptySkipped: 0,
    perFileLimitDropped: 0,
    emitted: 0,
  };

  const seen = new Set<string>();
  const seeds: SeedRecord[] = [];

  for (const subdir of subdirs) {
    // Path-traversal guard: resolved dir must stay inside the WPT checkout.
    const absDir = resolve(wptRoot, subdir);
    if (absDir !== wptRoot && !absDir.startsWith(wptRoot + '/')) {
      process.stdout.write(`warning: spec-subdir '${subdir}' escapes the WPT checkout; skipped\n`);
      continue;
    }
    const found: string[] = [];
    walkHtmlFiles(absDir, found, maxFiles - stats.htmlFilesWalked);
    if (found.length === 0 && !subdirs.some((s) => s !== subdir && s.startsWith(subdir))) {
      process.stdout.write(`warning: spec-subdir '${subdir}' yielded 0 html files\n`);
    }
    for (const htmlPath of found) {
      stats.htmlFilesWalked++;
      let html: string;
      try {
        html = readFileSync(htmlPath, 'utf8');
      } catch {
        continue;
      }
      stats.htmlFilesRead++;
      const source = relative(wptRoot, htmlPath).split('\\').join('/');
      const blocks = extractStyleBlocks(html);
      const attrs = extractStyleAttrs(html);
      const candidates: Array<{ text: string; kind: SeedRecord['kind'] }> = [];
      for (const block of blocks) candidates.push({ text: block, kind: 'style-block' });
      for (const attr of attrs) candidates.push({ text: attr, kind: 'style-attr' });
      stats.styleBlocksFound += blocks.length;
      stats.styleAttrsFound += attrs.length;

      let takenFromFile = 0;
      for (const candidate of candidates) {
        stats.extractionsConsidered++;
        if (takenFromFile >= limitPerFile) {
          stats.perFileLimitDropped++;
          continue;
        }
        const text = candidate.text;
        if (text.length === 0) {
          stats.emptySkipped++;
          continue;
        }
        if (text.length > MAX_SEED_CHARS) {
          stats.oversizeSkipped++;
          continue;
        }
        if (seen.has(text)) {
          stats.dedupeDropped++;
          continue;
        }
        seen.add(text);
        takenFromFile++;
        seeds.push({
          file: `${String(seeds.length).padStart(4, '0')}-seed.css`,
          source,
          kind: candidate.kind,
          bytes: Buffer.byteLength(text, 'utf8'),
          text,
        });
      }
    }
  }

  // Emit ONLY inside outDir (default /tmp/opencode/wpt-seeds).
  mkdirSync(outDir, { recursive: true });
  for (const seed of seeds) {
    writeFileSync(join(outDir, seed.file), seed.text);
  }
  stats.emitted = seeds.length;

  const manifestEntries: ManifestEntry[] = seeds.map(({ text: _text, ...entry }) => entry);
  const manifest = {
    tool: 'wpt-seeds',
    version: WPT_SEEDS_VERSION,
    wptSubdirs: subdirs,
    maxSeedChars: MAX_SEED_CHARS,
    stats,
    seeds: manifestEntries,
  };
  writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

  process.stdout.write(
    [
      ``,
      `=== wpt-seeds (${WPT_SEEDS_VERSION}) ===`,
      `subdirs: ${subdirs.join(', ')}`,
      `html files walked/read: ${stats.htmlFilesWalked}/${stats.htmlFilesRead}`,
      `extractions: ${stats.styleBlocksFound} style blocks + ${stats.styleAttrsFound} style attrs`,
      `emitted: ${stats.emitted} seeds (dedupe dropped ${stats.dedupeDropped}, oversize ${stats.oversizeSkipped}, empty ${stats.emptySkipped}, per-file-limit ${stats.perFileLimitDropped})`,
      `out-dir: ${outDir}`,
      ``,
    ].join('\n'),
  );
}

const invokedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  try {
    main();
  } catch (err: unknown) {
    process.stderr.write(`${String(err)}\n`);
    process.exitCode = 1;
  }
}
