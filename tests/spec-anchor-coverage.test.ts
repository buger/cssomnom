/** @license Copyright 2026 Google LLC. SPDX-License-Identifier: Apache-2.0 */
// Spec-anchor coverage — the gap radar.
//
// PURPOSE: every Bikeshed anchor in our 8 audited specs (`{#id}` headings +
// `<dfn>` slugs, inventoried by scripts/codegen/generate_spec_anchors.ts into
// src/data/gen/spec-anchors.json) is a normative contract surface. Anchors with
// ZERO citations anywhere in the repo (requirements, source, tests, docs) are
// where unmodeled bugs emerge: retrospectively, the KI-112..126 escape cluster
// (docs/proof-escape-ki-112-113.md .. -124-126.md) fired almost exclusively on
// anchors that had zero or test-only coverage at filing time — font-shorthand
// serialization (KI-112..114), declaration-block serialization (KI-114/116),
// and media-query serialization (KI-115, which escaped through the serialize
// side while the parse side was modeled). This suite keeps that signal permanent.
//
// SCOPE (v1, deliberately narrow):
//   * CORE_SET (below) is ENFORCED: a core anchor with zero citations anywhere
//     fails this test unless a valid, unexpired row in proof/anchor-allowlist.yaml
//     exempts it. Every CORE_SET member is a serialization/parser-family anchor
//     empirically shown to predict real defects.
//   * All other anchors are counted and REPORTED (console.info) but not
//     asserted: raw uncovered counts are noisy (~89% of the 1261-anchor
//     inventory is uncited today; much of it is changelog/propdef/rendering
//     content outside cssomnom's scope). Tier widening happens via CORE_SET,
//     one reviewed entry at a time — never by loosening the check.
//   * Citation tokens are matched with a Levenshtein<=2 fuzzy join against the
//     inventory to absorb observed hyphenation drift (e.g. src cites
//     `#consume-token` for css-syntax-3's `#consume-a-token`; calibration
//     showed `#parse-component-value` vs `#parse-a-component-value`).
//
// ALLOWLIST: proof/anchor-allowlist.yaml, parsed here with a dependency-free
// rigid YAML subset (flat rows; keys exactly spec/anchor/reason/expires;
// single-line scalars; full-line comments only). Rows expire (expires date,
// inclusive) and resurface as violations afterwards, so the allowlist cannot
// become a silent dump.
//
// ANTI-VACUITY: the scanner accepts an injectable file list/contents, and the
// fault-injection subtests prove the enforcement actually FAILS when a core
// anchor's citations are erased from the real corpus (not just on toy input).
// This test file itself is EXCLUDED from the scanned corpus so its own anchor
// literals can never self-credit coverage.
//
// REGENERATE INVENTORY: pnpm run codegen (or
//   node scripts/codegen/generate_spec_anchors.ts) — byte-stable, no timestamp.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const INVENTORY_PATH = path.join(REPO_ROOT, 'src/data/gen/spec-anchors.json');
const ALLOWLIST_PATH = path.join(REPO_ROOT, 'proof/anchor-allowlist.yaml');
const SELF_FILE = path.resolve(import.meta.dirname, 'spec-anchor-coverage.test.ts');

interface AnchorEntry {
    readonly anchor: string;
    readonly title: string;
    readonly kind: 'heading' | 'dfn';
}
interface SpecInventory {
    readonly file: string;
    readonly anchors: readonly AnchorEntry[];
}
interface Inventory {
    readonly specs: Readonly<Record<string, SpecInventory>>;
}

/**
 * The enforced core set: serialization/parser-family anchors whose absence of
 * citations predicted real defects (KI-112..126 retrospective). Spec fields
 * reflect the CURRENT submodule checkout (upstream editorial renames moved
 * several of these into cssom-1; membership is asserted against the inventory
 * below so drift fails loudly instead of silently).
 */
const CORE_SET: readonly { spec: string; anchor: string; why: string }[] = [
    { spec: 'css-syntax-3', anchor: 'consume-comments', why: 'tokenizer loop backbone; comment/EOF mishandling escapes as KI-113-class bugs' },
    { spec: 'css-syntax-3', anchor: 'consume-a-token', why: '§4.3.1 dispatcher — every token-type defect routes through it' },
    { spec: 'css-syntax-3', anchor: 'consume-url-token', why: 'url-token state machine (KI-113 escape family)' },
    { spec: 'css-syntax-3', anchor: 'consume-name', why: 'ident/escape accumulation; escape-handling bugs cluster here' },
    { spec: 'css-syntax-3', anchor: 'parse-a-css-stylesheet', why: 'top-level tree-construction entry point' },
    { spec: 'cssom-1', anchor: 'parse-a-css-declaration-block', why: 'declaration-block parsing entry point cited by system requirements' },
    { spec: 'css-syntax-3', anchor: 'serialization', why: '§6 round-trip serialization contract topic anchor' },
    { spec: 'cssom-1', anchor: 'serialize-a-css-rule', why: 'rule serialization (KI-112 cluster)' },
    { spec: 'cssom-1', anchor: 'serialize-a-css-declaration-block', why: 'shorthand serialization; its own WPT fixture (border-shorthand-serialization.html) was never extracted pre-KI-114/116' },
    { spec: 'cssom-1', anchor: 'serializing-media-queries', why: 'MQ serialization — KI-115 escaped via the serialize side while the parse side was modeled' },
    { spec: 'cssom-1', anchor: 'parse-a-media-query-list', why: 'media-query-list parse-side entry point (asymmetric-coverage signal shape)' },
    { spec: 'css-values-4', anchor: 'css-wide-keywords', why: 'initial/inherit/unset/revert/revert-layer span every property surface' },
];

// ---------------------------------------------------------------------------
// Edit distance (full DP, row-min early exit; inputs are short anchor tokens).
// ---------------------------------------------------------------------------
export function editDistanceAtMost(a: string, b: string, k: number): boolean {
    if (a === b) return true;
    if (Math.abs(a.length - b.length) > k) return false;
    let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
    let cur: number[] = Array.from({ length: b.length + 1 }, () => 0);
    for (let j = 0; j <= b.length; j++) prev[j] = j;
    for (let i = 1; i <= a.length; i++) {
        cur[0] = i;
        let rowMin = i;
        const ca = a.charCodeAt(i - 1);
        for (let j = 1; j <= b.length; j++) {
            const cost = ca === b.charCodeAt(j - 1) ? 0 : 1;
            const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
            cur[j] = v;
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > k) return false;
        [prev, cur] = [cur, prev];
    }
    return prev[b.length] <= k;
}

// ---------------------------------------------------------------------------
// Citation extraction + inventory join.
// ---------------------------------------------------------------------------
const TOKEN_RE = /#[a-z0-9][a-z0-9-]{5,}/g;
/** Color-literal guard: #ffffff / #ffffffaa are CSS colors, not anchors. */
const HEXISH_RE = /^[0-9a-f]{6}([0-9a-f]{2})?$/;
const MAX_TOKEN_LEN = 64;

export function extractCitationTokens(text: string): string[] {
    const out: string[] = [];
    for (const m of text.matchAll(TOKEN_RE)) {
        const token = m[0].slice(1);
        if (!HEXISH_RE.test(token)) out.push(token);
    }
    return out;
}

class InventoryIndex {
    private readonly byAnchor = new Map<string, string[]>();
    private readonly byLength = new Map<number, string[]>();
    private readonly fuzzyCache = new Map<string, string[]>();

    constructor(inventory: Inventory) {
        for (const [spec, entry] of Object.entries(inventory.specs)) {
            for (const a of entry.anchors) {
                let owners = this.byAnchor.get(a.anchor);
                if (!owners) this.byAnchor.set(a.anchor, (owners = []));
                owners.push(spec);
                let bucket = this.byLength.get(a.anchor.length);
                if (!bucket) this.byLength.set(a.anchor.length, (bucket = []));
                bucket.push(a.anchor);
            }
        }
    }

    /** Resolve a citation token to covered `spec#anchor` keys. Exact hits and
        fuzzy joins are UNIONED (both tiers credit): citation drift routinely
        lands on the sibling anchor of the same algorithm — e.g. src cites the
        css-syntax-3 §4.3.1 heading id `#consume-token` while the export dfn
        slugs as `#consume-a-token` (distance 2). Crediting every inventory
        anchor within distance<=2 of the token keeps such drift from reading as
        a false gap; results cached per token, oversized tokens skipped. */
    resolve(token: string): string[] {
        if (token.length > MAX_TOKEN_LEN) return [];
        const cached = this.fuzzyCache.get(token);
        if (cached !== undefined) return cached;
        const resolved: string[] = [];
        for (let len = Math.max(6, token.length - 2); len <= token.length + 2; len++) {
            for (const cand of this.byLength.get(len) ?? []) {
                if (!editDistanceAtMost(token, cand, 2)) continue;
                for (const spec of this.byAnchor.get(cand) ?? []) {
                    const key = `${spec}#${cand}`;
                    if (!resolved.includes(key)) resolved.push(key);
                }
            }
        }
        this.fuzzyCache.set(token, resolved);
        return resolved;
    }
}

// ---------------------------------------------------------------------------
// Injectable scanner — the fault-injection seam. Tests may pass synthetic or
// mutated corpora; the real run builds the list straight from the working tree.
// ---------------------------------------------------------------------------
export interface CorpusFile {
    readonly path: string;
    readonly category: 'req' | 'src' | 'test' | 'doc';
    readonly contents: string;
}
export type Category = CorpusFile['category'];

export interface ScanResult {
    /** `spec#anchor` -> citing repo-relative file paths. */
    readonly hits: Map<string, Set<string>>;
    readonly filesScanned: number;
    readonly linesWithCitations: number;
    readonly unresolvedTokens: number;
}

export function scanCorpus(files: readonly CorpusFile[], index: InventoryIndex): ScanResult {
    const hits = new Map<string, Set<string>>();
    let filesScanned = 0;
    let linesWithCitations = 0;
    let unresolvedTokens = 0;
    for (const file of files) {
        filesScanned++;
        const rel = path.relative(REPO_ROOT, file.path);
        for (const line of file.contents.split('\n')) {
            const tokens = extractCitationTokens(line);
            if (tokens.length === 0) continue;
            let creditedLine = false;
            for (const token of tokens) {
                const keys = index.resolve(token);
                if (!keys || keys.length === 0) {
                    unresolvedTokens++;
                    continue;
                }
                creditedLine = true;
                for (const key of keys) {
                    let set = hits.get(key);
                    if (!set) hits.set(key, (set = new Set()));
                    set.add(rel);
                }
            }
            if (creditedLine) linesWithCitations++;
        }
    }
    return { hits, filesScanned, linesWithCitations, unresolvedTokens };
}

// ---------------------------------------------------------------------------
// Allowlist — dependency-free rigid YAML subset reader.
// Accepted shape (exactly; anything else must throw rather than be ignored):
//   # full-line comments only, values must not rely on trailing comments
//   allowlist:
//     - spec: <shortname>
//       anchor: <anchor-without-hash>
//       reason: <single-line scalar>
//       expires: YYYY-MM-DD
// ---------------------------------------------------------------------------
export interface AllowlistRow {
    readonly spec: string;
    readonly anchor: string;
    readonly reason: string;
    /** Inclusive expiry; rows with expires < today are ignored by evaluation. */
    readonly expires: string;
}

export function parseAllowlist(text: string): AllowlistRow[] {
    const rows: AllowlistRow[] = [];
    let current: Partial<Record<keyof AllowlistRow, string>> | null = null;
    let sawAllowlistKey = false;
    for (const rawLine of text.split('\n')) {
        const line = rawLine.trim();
        if (line === '' || line.startsWith('#')) continue;
        if (line === 'allowlist:') {
            sawAllowlistKey = true;
            current = null;
            continue;
        }
        if (!sawAllowlistKey) throw new Error(`allowlist yaml must start with 'allowlist:' — got: ${line}`);
        if (line.startsWith('- ')) {
            if (current) {
                if (!isCompleteRow(current)) throw new Error(`incomplete allowlist row before: ${line}`);
                rows.push(current as AllowlistRow);
            }
            current = {};
            const pair = parseKeyValue(line.slice(2));
            current[pair.key as keyof AllowlistRow] = pair.value;
            continue;
        }
        if (current) {
            const pair = parseKeyValue(line);
            current[pair.key as keyof AllowlistRow] = pair.value;
        } else {
            throw new Error(`unexpected line outside allowlist row: ${line}`);
        }
    }
    if (current && !isCompleteRow(current)) throw new Error('unterminated final allowlist row');
    if (current && isCompleteRow(current)) rows.push(current as AllowlistRow);
    return rows;
}

function parseKeyValue(line: string): { key: string; value: string } {
    const idx = line.indexOf(': ');
    if (idx <= 0) throw new Error(`malformed allowlist line (expected 'key: value'): ${line}`);
    const key = line.slice(0, idx);
    const value = line.slice(idx + 2).trim();
    if (!/^(spec|anchor|reason|expires)$/.test(key)) throw new Error(`unknown allowlist key '${key}'`);
    if (value === '') throw new Error(`empty value for allowlist key '${key}'`);
    return { key, value };
}

function isCompleteRow(row: Partial<Record<keyof AllowlistRow, string>>): row is Record<keyof AllowlistRow, string> {
    return (
        row.spec !== undefined &&
        row.anchor !== undefined &&
        row.reason !== undefined &&
        row.expires !== undefined
    );
}

/** Validate shapes/dates and drop expired rows (they resurface as violations). */
export function activeAllowlist(rows: readonly AllowlistRow[], todayISO: string): Set<string> {
    const active = new Set<string>();
    for (const row of rows) {
        assert.match(row.spec, /^[a-z0-9-]+$/, `bad spec in allowlist row: ${row.spec}`);
        assert.match(row.anchor, /^[a-z0-9][a-z0-9-]{4,}$/, `bad anchor in allowlist row: ${row.anchor}`);
        assert.match(row.expires, /^\d{4}-\d{2}-\d{2}$/, `bad expires date in allowlist row: ${row.expires}`);
        assert.ok(row.reason.length >= 20, `allowlist reason too thin for ${row.spec}#${row.anchor}`);
        if (row.expires >= todayISO) active.add(`${row.spec}#${row.anchor}`);
    }
    return active;
}

export interface Violation {
    readonly spec: string;
    readonly anchor: string;
    readonly why: string;
}

export function evaluateCoreSet(
    coreSet: readonly { spec: string; anchor: string; why: string }[],
    hits: ReadonlyMap<string, Set<string>>,
    allowed: ReadonlySet<string>,
): Violation[] {
    const violations: Violation[] = [];
    for (const entry of coreSet) {
        const key = `${entry.spec}#${entry.anchor}`;
        const cited = hits.get(key);
        if ((!cited || cited.size === 0) && !allowed.has(key)) violations.push(entry);
    }
    return violations;
}

// ---------------------------------------------------------------------------
// Real-corpus loader (working tree; this test file excluded — see header).
// ---------------------------------------------------------------------------
function walkFiles(dir: string, exts: readonly string[], acc: string[] = []): string[] {
    let ents: fs.Dirent[] = [];
    try {
        ents = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return acc;
    }
    for (const ent of ents) {
        const p = path.join(dir, ent.name);
        if (ent.isDirectory()) walkFiles(p, exts, acc);
        else if (ent.isFile() && exts.some((e) => ent.name.endsWith(e))) acc.push(p);
    }
    return acc;
}

export function buildRealCorpus(): CorpusFile[] {
    const push = (out: CorpusFile[], p: string, category: Category) => {
        if (path.resolve(p) === SELF_FILE) return; // never self-credit
        out.push({ path: p, category, contents: fs.readFileSync(p, 'utf8') });
    };
    const corpus: CorpusFile[] = [];
    for (const p of walkFiles(path.join(REPO_ROOT, 'specs'), ['.yaml', '.yml'])) {
        if (/\.req\.ya?ml$/.test(p) || /[\\/]variables[\\/].*\.ya?ml$/.test(p)) push(corpus, p, 'req');
    }
    for (const p of walkFiles(path.join(REPO_ROOT, 'src'), ['.ts'])) push(corpus, p, 'src');
    for (const p of walkFiles(path.join(REPO_ROOT, 'tests'), ['.ts'])) push(corpus, p, 'test');
    for (const p of walkFiles(path.join(REPO_ROOT, 'docs'), ['.md'])) push(corpus, p, 'doc');
    return corpus;
}

function todayUTC(): string {
    return new Date().toISOString().slice(0, 10);
}

// ===========================================================================
// Synthetic RED layer — proves the machinery fails loudly on crafted corpora
// BEFORE any real-tree state is consulted (these passed only after evaluate()
// existed; against the original stub returning [] they were red).
// ===========================================================================
describe('spec-anchor coverage matcher (synthetic)', () => {
    const SYNTH_INVENTORY: Inventory = {
        specs: {
            'css-syntax-3': {
                file: 'submodules/csswg-drafts/css-syntax-3/Overview.bs',
                anchors: [
                    { anchor: 'consume-a-token', title: 'consume a token', kind: 'dfn' },
                    { anchor: 'parse-a-component-value', title: 'parse a component value', kind: 'dfn' },
                    { anchor: 'consume-comments', title: 'consume comments', kind: 'dfn' },
                ],
            },
            'css-values-4': {
                file: 'submodules/csswg-drafts/css-values-4/Overview.bs',
                anchors: [{ anchor: 'css-wide-keywords', title: 'CSS-wide keywords', kind: 'dfn' }],
            },
        },
    };

    test('citation token extraction skips color literals and short fragments', () => {
        const text = [
            '// css-syntax-3 § 4.3.1 #consume-token rules', // 13 chars, kept
            'const c = paint("#ffffff"); // hex color literal, dropped',
            'const c2 = paint("#fff"); // too short, never matched',
            'url(docs/x.md#other-section) // doc fragment, kept',
        ].join('\n');
        assert.deepEqual(extractCitationTokens(text), ['consume-token', 'other-section']);
    });

    test('fuzzy join absorbs hyphenation drift at distance<=2 only', () => {
        assert.ok(editDistanceAtMost('consume-token', 'consume-a-token', 2));
        assert.ok(editDistanceAtMost('parse-component-value', 'parse-a-component-value', 2));
        assert.ok(editDistanceAtMost('css-wide-keyword', 'css-wide-keywords', 1));
        assert.ok(!editDistanceAtMost('consume-token', 'consume-comments', 2));
        const index = new InventoryIndex(SYNTH_INVENTORY);
        assert.deepEqual(index.resolve('consume-token'), ['css-syntax-3#consume-a-token']);
        assert.deepEqual(index.resolve('parse-component-value'), ['css-syntax-3#parse-a-component-value']);
        assert.deepEqual(index.resolve('totally-unrelated-token'), []);
    });

    test('RED: core anchor with zero citations produces a violation', () => {
        const index = new InventoryIndex(SYNTH_INVENTORY);
        // Corpus cites consume-comments but NOT consume-a-token / css-wide-keywords.
        const corpus: CorpusFile[] = [
            { path: '/repo/src/tokenizer.ts', category: 'src', contents: '// #consume-comments loop\n' },
            { path: '/repo/specs/x.req.yaml', category: 'req', contents: 'references: #consume-comments\n' },
        ];
        const scan = scanCorpus(corpus, index);
        const violations = evaluateCoreSet(
            [
                { spec: 'css-syntax-3', anchor: 'consume-comments', why: 'covered' },
                { spec: 'css-syntax-3', anchor: 'consume-a-token', why: 'zero' },
                { spec: 'css-values-4', anchor: 'css-wide-keywords', why: 'zero' },
            ],
            scan.hits,
            new Set(),
        );
        assert.deepEqual(
            violations.map((v) => `${v.spec}#${v.anchor}`),
            ['css-syntax-3#consume-a-token', 'css-values-4#css-wide-keywords'],
        );
    });

    test('unexpired allowlist row suppresses; expired row resurfaces the violation', () => {
        const rows: AllowlistRow[] = [
            {
                spec: 'css-values-4',
                anchor: 'css-wide-keywords',
                reason: 'synthetic row proving expiry mechanics',
                expires: '2026-11-30',
            },
        ];
        const active = activeAllowlist(rows, '2026-08-25');
        const core = [{ spec: 'css-values-4', anchor: 'css-wide-keywords', why: 'zero' }];
        assert.deepEqual(evaluateCoreSet(core, new Map(), active), []);
        // After expiry the debt resurfaces automatically.
        const expired = activeAllowlist(rows, '2026-12-01');
        assert.deepEqual(
            evaluateCoreSet(core, new Map(), expired).map((v) => v.anchor),
            ['css-wide-keywords'],
        );
    });

    test('malformed allowlist content throws instead of being silently ignored', () => {
        assert.throws(() => parseAllowlist('entries:\n  - spec: x\n'));
        assert.throws(() => parseAllowlist('allowlist:\n  - spec: css-values-4\n    anchor: css-wide-keywords\n'));
        assert.throws(() => parseAllowlist('allowlist:\n  - spec: css-values-4\n    anchor: css-wide-keywords\n    reason: r\n    expires: not-a-date\n    extra: 1\n'));
    });
});

// ===========================================================================
// Fault injection on the REAL corpus — the vacuity tripwire. If the scan or
// evaluation ever degrades into a no-op, stripping a heavily-cited core anchor
// from every real file MUST flip the verdict to violating.
// ===========================================================================
describe('spec-anchor coverage fault injection (real file list)', () => {
    test('erasing all citations of a core anchor flips the verdict to violation', () => {
        const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory;
        const index = new InventoryIndex(inventory);
        const victim = CORE_SET.find((c) => c.anchor === 'serialize-a-css-declaration-block');
        assert.ok(victim, 'victim anchor missing from CORE_SET');
        const realCorpus = buildRealCorpus().map((f) => ({
            ...f,
            contents: f.contents.split(victim.anchor).join('redacted-by-fault-injection'),
        }));
        const stripped = evaluateCoreSet(CORE_SET, scanCorpus(realCorpus, index).hits, new Set());
        assert.ok(
            stripped.some((v) => v.spec === victim.spec && v.anchor === victim.anchor),
            'fault injection failed: stripping #serialize-a-css-declaration-block did NOT produce a violation — the check is vacuous',
        );
    });
});

// ===========================================================================
// Real-state GREEN layer — today's tree must satisfy the CORE_SET contract.
// ===========================================================================
describe('spec-anchor coverage (real tree)', () => {
    const inventory = JSON.parse(fs.readFileSync(INVENTORY_PATH, 'utf8')) as Inventory;

    test('inventory is present, populated across all 8 audited specs, and deterministically ordered', () => {
        const specIds = Object.keys(inventory.specs).sort();
        assert.equal(specIds.length, 8);
        let total = 0;
        for (const spec of specIds) {
            const anchors = inventory.specs[spec].anchors;
            assert.ok(anchors.length > 0, `${spec} inventory empty — rerun pnpm run codegen`);
            for (let i = 1; i < anchors.length; i++) {
                assert.ok(
                    anchors[i - 1].anchor < anchors[i].anchor,
                    `${spec} inventory not sorted at ${anchors[i].anchor} — regenerate via pnpm run codegen`,
                );
            }
            total += anchors.length;
        }
        assert.ok(total >= 1200, `inventory implausibly small (${total}) — submodule or extractor regression`);
    });

    test('every CORE_SET member exists in the current-spec inventory', () => {
        const missing = CORE_SET.filter((c) => !inventory.specs[c.spec]?.anchors.some((a) => a.anchor === c.anchor));
        assert.deepEqual(
            missing.map((m) => `${m.spec}#${m.anchor}`),
            [],
            'CORE_SET drifted from the spec checkout (upstream rename?) — update entries to the current anchors',
        );
    });

    test('CORE_SET anchors each have >=1 citation somewhere (or an active allowlist row)', () => {
        const index = new InventoryIndex(inventory);
        const scan = scanCorpus(buildRealCorpus(), index);
        const rows = parseAllowlist(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
        const active = activeAllowlist(rows, todayUTC());

        const violations = evaluateCoreSet(CORE_SET, scan.hits, active);
        reportCoverage(inventory, scan);

        assert.deepEqual(
            violations.map((v) => `${v.spec}#${v.anchor} — ${v.why}`),
            [],
            'core serialization/parser anchors lost ALL citations (or allowlist rows expired)',
        );
    });
});

/** Info-tier radar: broader uncovered inventory, reported not asserted (v1). */
function reportCoverage(inventory: Inventory, scan: ScanResult): void {
    const lines: string[] = ['', 'spec-anchor coverage radar (info tier — reported, not asserted):'];
    let totalAnchors = 0;
    let totalCovered = 0;
    const uncoveredSample: string[] = [];
    for (const spec of Object.keys(inventory.specs).sort()) {
        const anchors = inventory.specs[spec].anchors;
        const covered = anchors.filter((a) => (scan.hits.get(`${spec}#${a.anchor}`)?.size ?? 0) > 0);
        totalAnchors += anchors.length;
        totalCovered += covered.length;
        for (const a of anchors) {
            if ((scan.hits.get(`${spec}#${a.anchor}`)?.size ?? 0) === 0 && uncoveredSample.length < 8) {
                uncoveredSample.push(`    ${spec}#${a.anchor}`);
            }
        }
        lines.push(
            `  ${spec.padEnd(18)} ${String(covered.length).padStart(4)}/${String(anchors.length).padStart(4)} anchored (${((covered.length / anchors.length) * 100).toFixed(1)}%)`,
        );
    }
    lines.push(`  ${'-'.repeat(42)}`);
    lines.push(`  TOTAL ${totalCovered}/${totalAnchors} (${((totalCovered / totalAnchors) * 100).toFixed(1)}%) · scanned ${scan.filesScanned} files · ${scan.linesWithCitations} citing lines`);
    lines.push('  sample uncovered (gap backlog, newest-first review recommended):');
    lines.push(...uncoveredSample);
    lines.push('  regenerate inventory: pnpm run codegen');
    console.info(lines.join('\n'));
}
