/** @license Copyright 2026 Google LLC. SPDX-License-Identifier: Apache-2.0 */
// KI ledger hygiene lint — permanent prevention (F-lint) for the 2026-08-24
// mechanical ledger hygiene pass (F1).
//
// F1 purged copy-pasted Web3 rubric boilerplate from KI-1..14, collapsed
// duplicate stale-paperwork sentences (KI-1), rewrote a stale cross-reference
// (KI-8), fixed an unbalanced quote (KI-41) and a grammar slip (KI-42),
// backfilled `sanitizer: manual:logic` on the KI-16..30 cohort, and backfilled
// release_disposition/minimization_status/attacker_input on legacy KI-1..14
// using values the Proof tool accepts (pkg/model/known_issue.go closed sets).
//
// This suite keeps those classes of rot out mechanically:
//   R-a) status:open => mitigation AND remediation non-empty (LEGACY_EXEMPT w/
//        reasons allowed).
//   R-b) stale-cross-ref: any "KI-<n> ... open" claim in title/description/
//        mitigation/remediation/notes must match that KI's ACTUAL status
//        (catches KI-8-class rot: mitigation citing "KI-7 open" after KI-7
//        was fixed).
//   R-c) Web3-marker ban: the purged copy-pasted disclaimer strings may never
//        reappear anywhere in the ledger.
//   R-d) sanitizer present on the entire KI-16..30 cohort.
//   R-e) titles <=120 chars for KI-101+ (modern convention).
//
// Seeding policy: rules are seeded GREEN against the post-F1 ledger.
// Pre-existing gaps OUTSIDE the F1 hygiene mandate (authoring substantive
// mitigation prose or compressing other agents' finding titles is content
// work, not mechanical hygiene) are carried as explicit, reasoned, SELF-
// CLEANING exemptions: every exemption asserts its own continued necessity,
// so the moment the underlying file gains the field (or is retitled), the
// exemption itself fails this suite and must be deleted. Debt is visible and
// monotonic — the same ratchet philosophy as baseline-ownership-ratchet.
//
// Deterministic by construction: pure functions over file bytes read once at
// module load; no wall-clock, no randomness, no subprocesses (AGENTS.md test
// isolation). Parsing uses a small purpose-built reader for the flat subset of
// YAML these ledgers use (fs-only, mirroring baseline-ownership-ratchet.test;
// the repo carries no yaml dependency).
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const KI_DIR = path.join(REPO_ROOT, 'proof/known-issues');

// ---------------------------------------------------------------------------
// Minimal reader for the ledger's flat YAML subset.
// ---------------------------------------------------------------------------

export interface LedgerEntry {
  readonly id: string;
  readonly file: string;
  /** Full original file text (scanned verbatim by R-c). */
  readonly raw: string;
  readonly title: string;
  readonly description: string;
  readonly mitigation: string;
  readonly remediation: string;
  readonly status: string;
  /** Empty string when absent. */
  readonly sanitizer: string;
  /** Raw text of the top-level `notes:` section ('' when absent). */
  readonly notesText: string;
}

export interface Violation {
  readonly rule: 'R-a' | 'R-b' | 'R-c' | 'R-d' | 'R-e';
  readonly id: string;
  readonly detail: string;
}

interface Section {
  readonly inline: string;
  readonly blockLines: string[];
}

/** Slice the top-level `key:` section: value on the key line + indented block. */
function topLevelSection(raw: string, key: string): Section | null {
  const lines = raw.split('\n');
  const start = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (start === -1) return null;
  const blockLines: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    // A column-0 alphabetic line begins the next top-level key.
    if (/^[A-Za-z_]/.test(lines[i])) break;
    blockLines.push(lines[i]);
  }
  return { inline: lines[start].slice(key.length + 1).trim(), blockLines };
}

function stripYamlQuotes(v: string): string {
  const t = v.trim();
  if (t.length >= 2 && t.startsWith("'") && t.endsWith("'")) {
    return t.slice(1, -1).replace(/''/g, "'");
  }
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    return t.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return t;
}

function blockScalar(blockLines: string[]): string {
  const nonEmpty = blockLines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return '';
  const indent = Math.min(...nonEmpty.map((l) => l.length - l.trimStart().length));
  return nonEmpty.map((l) => l.slice(indent)).join('\n').replace(/\n+$/, '');
}

function scalarValue(raw: string, key: string): string {
  const s = topLevelSection(raw, key);
  if (s === null) return '';
  if (/^[|>-]?$/.test(s.inline) || s.inline === '|' || s.inline === '|-' || s.inline === '>') {
    return s.inline === '' ? '' : blockScalar(s.blockLines);
  }
  return stripYamlQuotes(s.inline);
}

/**
 * Parse one KI yaml (the flat subset the ledger actually uses: top-level
 * scalars, quoted/plain single-line scalars, literal blocks, simple lists).
 * Unknown constructs simply yield '' rather than throwing — rules operate on
 * the fields below and the verbatim raw text.
 */
export function parseKiRaw(raw: string, fileName: string): LedgerEntry {
  const id = fileName.replace(/\.yaml$/, '');
  const notes = topLevelSection(raw, 'notes');
  return {
    id,
    file: fileName,
    raw,
    title: scalarValue(raw, 'title'),
    description: scalarValue(raw, 'description'),
    mitigation: scalarValue(raw, 'mitigation'),
    remediation: scalarValue(raw, 'remediation'),
    status: scalarValue(raw, 'status').toLowerCase(),
    sanitizer: scalarValue(raw, 'sanitizer').trim(),
    notesText: notes ? notes.blockLines.join('\n') : '',
  };
}

function numericId(id: string): number {
  return Number.parseInt(id.replace(/^KI-/, ''), 10);
}

function loadRealLedger(): LedgerEntry[] {
  return readdirSync(KI_DIR)
    .filter((f) => /^KI-\d+\.yaml$/.test(f))
    .sort((a, b) => numericId(a.replace(/\D/g, '')) - numericId(b.replace(/\D/g, '')))
    .map((f) => parseKiRaw(readFileSync(path.join(KI_DIR, f), 'utf8'), f));
}

const REAL_LEDGER: readonly LedgerEntry[] = loadRealLedger();

// ---------------------------------------------------------------------------
// Exemption registries — visible, reasoned, SELF-CLEANING debt.
// ---------------------------------------------------------------------------

/**
 * LEGACY_EXEMPT — entries skipped by R-a, each with a mandatory reason.
 * Doubles as the durable record of the F1.7 decision NOT to mutate a legacy
 * yaml when the tool's closed vocabularies have no honest value.
 *
 * Self-cleaning contract (enforced below):
 *  - an entry whose status is open MUST still lack mitigation/remediation;
 *  - an entry recorded for the F1.7 trio deferral MUST still lack
 *    release_disposition.
 * Fixing the file invalidates the reason -> this suite fails -> delete the
 * registry row in the same change.
 */
export const LEGACY_EXEMPT: ReadonlyMap<string, string> = new Map([
  [
    'KI-4',
    'F1.7 deferral (2026-08-24): status=withdrawn pre-rubric record; the tool ' +
      'vocabularies have no honest release_disposition value for a withdrawn ' +
      'pre-rubric finding, so the field is deliberately absent and this row ' +
      'documents that decision until the vocabulary grows one.',
  ],
]);

/**
 * Grandfathered over-length titles on KI-101+ (R-e). The exemption binds to
 * the EXACT recorded title: any retitling (including synthetic mutation)
 * escapes the grandfather clause and is judged against the cap, so owners can
 * retitle freely — the moment they do, the new title must comply.
 */
export const TITLE_GRANDFATHER: ReadonlyMap<string, { readonly title: string; readonly reason: string }> =
  new Map([
  ]);
// Bind grandfather rows to the exact on-disk titles at load time (keeps this
// file free of duplicated prose; the necessity check below fails if a title
// drifts or the cap is reached).
for (const e of REAL_LEDGER) {
  const g = TITLE_GRANDFATHER.get(e.id);
  if (g !== undefined && g.title === '') (g as { title: string }).title = e.title;
}

// ---------------------------------------------------------------------------
// Rule inputs
// ---------------------------------------------------------------------------

/** Purged copy-pasted Web3 rubric disclaimers (R-c). Never again, anywhere. */
export const WEB3_MARKERS: readonly string[] = [
  'no token balances',
  'tvl',
  'on-chain',
  'rule 2 is web3-only',
  'rule 4 is web3-only',
  'rule 7 is web3-only',
  'not theft',
  'no submission',
  'web3 rules 2/4/7',
  'non-web3 project',
];

/** Canonical replacement stamped into KI-1..14 by the F1 pass. */
export const DOMAIN_NOTE =
  'Domain note (2026-08-24): CSS parsing library — pure text-processing ' +
  'surface, no asset/value dimension; Web3 rule-set not applicable.';

/**
 * A notes bullet the ledger ITSELF marks superseded, anchored as
 * `- '[superseded YYYY-MM-DD: ...]` (date required). Such bullets are
 * historical records explicitly declared non-authoritative by the ledger's
 * own convention, so their past-tense status claims ("stays open") are not
 * live claims. Anything else claiming "open" is judged against reality.
 */
const SUPERSEDED_BULLET = /^-\s*'?\[superseded\s+\d{4}-\d{2}-\d{2}\s*:[^\]]*\]/;

function splitNotesBullets(notesText: string): string[] {
  const bullets: string[] = [];
  for (const line of notesText.split('\n')) {
    if (/^\s*-\s/.test(line)) bullets.push(line.trim());
    else if (bullets.length > 0 && line.trim() !== '') {
      bullets[bullets.length - 1] += ' ' + line.trim();
    }
  }
  return bullets;
}

/** Text scanned by R-b: the five prose fields, superseded bullets excluded. */
function crossRefScanText(e: LedgerEntry): string {
  const liveNotes = splitNotesBullets(e.notesText)
    .filter((b) => !SUPERSEDED_BULLET.test(b))
    .join('\n');
  return [e.title, e.description, e.mitigation, e.remediation, liveNotes]
    .map((t) => t.replace(/\s+/g, ' '))
    .join('\n');
}

const OPEN_CLAIM_RE = /\b(KI-\d+)\b[^.]{0,40}\bopen\b/gi;

// ---------------------------------------------------------------------------
// Rules — pure functions over a ledger snapshot (the fault-injection seam:
// tests feed synthetic/mutated snapshots to prove each rule can FAIL).
// ---------------------------------------------------------------------------

function ruleA_openTriageFields(entries: readonly LedgerEntry[]): Violation[] {
  const out: Violation[] = [];
  for (const e of entries) {
    if (e.status !== 'open') continue;
    if (LEGACY_EXEMPT.has(e.id)) continue;
    const missing =
      (e.mitigation.trim() === '' ? 'mitigation' : '') +
      (e.remediation.trim() === '' ? (e.mitigation.trim() === '' ? '+remediation' : 'remediation') : '');
    if (missing !== '') {
      out.push({ rule: 'R-a', id: e.id, detail: `status:open requires non-empty ${missing}` });
    }
  }
  return out;
}

function ruleB_staleCrossRefs(entries: readonly LedgerEntry[]): Violation[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const out: Violation[] = [];
  for (const e of entries) {
    const text = crossRefScanText(e);
    for (const m of text.matchAll(OPEN_CLAIM_RE)) {
      const claimed = m[1];
      const window = m[0].replace(/\s+/g, ' ');
      const target = byId.get(claimed);
      if (target === undefined) {
        out.push({ rule: 'R-b', id: e.id, detail: `"${window}" references missing ${claimed}` });
      } else if (target.status !== 'open') {
        out.push({
          rule: 'R-b',
          id: e.id,
          detail: `"${window}" claims ${claimed} is open but ${claimed}.yaml status=${target.status}`,
        });
      }
    }
  }
  return out;
}

function ruleC_web3Markers(entries: readonly LedgerEntry[]): Violation[] {
  const out: Violation[] = [];
  for (const e of entries) {
    const low = e.raw.toLowerCase();
    for (const marker of WEB3_MARKERS) {
      if (low.includes(marker)) {
        out.push({ rule: 'R-c', id: e.id, detail: `purged Web3 boilerplate marker present: "${marker}"` });
      }
    }
  }
  return out;
}

const SANITIZER_COHORT = Array.from({ length: 15 }, (_unused, i) => `KI-${16 + i}`);

function ruleD_sanitizerCohort(entries: readonly LedgerEntry[]): Violation[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const out: Violation[] = [];
  for (const id of SANITIZER_COHORT) {
    const e = byId.get(id);
    if (e === undefined) {
      out.push({ rule: 'R-d', id, detail: 'cohort member missing from ledger' });
    } else if (e.sanitizer === '') {
      out.push({ rule: 'R-d', id, detail: 'KI-16..30 cohort requires a sanitizer (manual:logic)' });
    }
  }
  return out;
}

const MODERN_TITLE_CAP = 120;

function ruleE_modernTitleLength(entries: readonly LedgerEntry[]): Violation[] {
  const out: Violation[] = [];
  for (const e of entries) {
    if (numericId(e.id) < 101) continue;
    if (e.title.length <= MODERN_TITLE_CAP) continue;
    const g = TITLE_GRANDFATHER.get(e.id);
    if (g !== undefined && g.title === e.title) continue; // exact-title binding
    out.push({
      rule: 'R-e',
      id: e.id,
      detail: `title length ${e.title.length} > ${MODERN_TITLE_CAP}`,
    });
  }
  return out;
}

/** Run every hygiene rule over a ledger snapshot (real or synthetic). */
export function runLedgerHygieneRules(entries: readonly LedgerEntry[]): Violation[] {
  return [
    ...ruleA_openTriageFields(entries),
    ...ruleB_staleCrossRefs(entries),
    ...ruleC_web3Markers(entries),
    ...ruleD_sanitizerCohort(entries),
    ...ruleE_modernTitleLength(entries),
  ];
}

function cloneWith(e: LedgerEntry, patch: Partial<LedgerEntry>): LedgerEntry {
  return { ...e, ...patch };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test('ledger loads: every KI yaml parses through the flat reader', () => {
  assert.ok(REAL_LEDGER.length >= 60, `expected >=60 entries, got ${REAL_LEDGER.length}`);
  for (const e of REAL_LEDGER) {
    assert.equal(e.id, e.file.replace(/\.yaml$/, ''), `id/filename mismatch in ${e.file}`);
    assert.match(e.file, /^KI-\d+\.yaml$/);
    assert.ok(['open', 'fixed', 'withdrawn'].includes(e.status), `${e.id}: bad status ${e.status}`);
  }
});

test('GREEN seeded: post-F1 ledger has zero hygiene violations', () => {
  const violations = runLedgerHygieneRules(REAL_LEDGER);
  assert.deepEqual(
    violations,
    [],
    `hygiene violations in real ledger:\n${violations.map((v) => `${v.rule} ${v.id}: ${v.detail}`).join('\n')}`,
  );
});

test('GREEN is stable across repeated runs (deterministic, no wall-clock)', () => {
  assert.deepEqual(runLedgerHygieneRules(REAL_LEDGER), runLedgerHygieneRules(REAL_LEDGER));
});

test('canonical domain note never trips the R-c marker ban', () => {
  const low = DOMAIN_NOTE.toLowerCase();
  for (const marker of WEB3_MARKERS) {
    assert.ok(!low.includes(marker), `domain note collides with banned marker "${marker}"`);
  }
});

test('LEGACY_EXEMPT rows are honest, necessary, and self-cleaning', () => {
  const byId = new Map(REAL_LEDGER.map((e) => [e.id, e]));
  for (const [id, reason] of LEGACY_EXEMPT) {
    const e = byId.get(id);
    assert.ok(e !== undefined, `LEGACY_EXEMPT row ${id} does not resolve to a ledger file`);
    assert.ok(reason.length >= 40, `${id}: exemption reason too thin`);
    assert.match(reason, /20\d\d-\d\d-\d\d|pre-rubric|owning batch/, `${id}: reason lacks dating/provenance`);
    if (e.status === 'open') {
      const stillMissing = e.mitigation.trim() === '' || e.remediation.trim() === '';
      assert.ok(stillMissing, `${id}: exempted but mitigation/remediation now present — delete the exemption row`);
    }
    if (reason.includes('release_disposition')) {
      assert.ok(!/^release_disposition:/m.test(e.raw), `${id}: disposition landed — delete the exemption row`);
    }
  }
  // The F1.7 deferral record must stay load-bearing: KI-4 stays withdrawn and
  // undispositioned exactly because the tool vocabulary has no honest value.
  const ki4 = byId.get('KI-4');
  assert.ok(ki4 !== undefined, 'KI-4 vanished from the ledger');
  assert.equal(ki4.status, 'withdrawn', 'KI-4 deferral reason presumes status=withdrawn');
});

test('TITLE_GRANDFATHER rows bind to exact on-disk titles and remain necessary', () => {
  const byId = new Map(REAL_LEDGER.map((e) => [e.id, e]));
  for (const [id, g] of TITLE_GRANDFATHER) {
    const e = byId.get(id);
    assert.ok(e !== undefined, `TITLE_GRANDFATHER row ${id} does not resolve`);
    assert.equal(g.title, e.title, `${id}: recorded title drifted from disk — re-bind or delete the row`);
    assert.ok(g.title.length > MODERN_TITLE_CAP, `${id}: title now within cap — delete the row`);
    assert.ok(g.reason.length >= 20, `${id}: reason too thin`);
    assert.ok(numericId(id) >= 101, `${id}: grandfather only exists for the modern range`);
  }
});

// --- Fault injection seam: prove each rule can FAIL (RED demonstration) ----

test('RED R-a: blanking triage fields on a real open KI is caught', () => {
  const open = REAL_LEDGER.filter((e) => e.status === 'open' && !LEGACY_EXEMPT.has(e.id));
  assert.ok(open.length >= 40, `expected a large open population, got ${open.length}`);
  const probe = open[0];
  for (const patch of [{ mitigation: '' }, { remediation: '' }, { mitigation: '', remediation: ' ' }]) {
    const violations = ruleA_openTriageFields([cloneWith(probe, patch)]);
    assert.equal(violations.length, 1, `expected exactly one R-a hit for ${probe.id}`);
    assert.equal(violations[0].rule, 'R-a');
    assert.equal(violations[0].id, probe.id);
  }
  // Specificity: a fixed KI with empty fields is intentionally NOT flagged.
  const fixed = REAL_LEDGER.find((e) => e.status === 'fixed');
  assert.ok(fixed !== undefined);
  assert.deepEqual(ruleA_openTriageFields([cloneWith(fixed, { mitigation: '', remediation: '' })]), []);
});

test('RED R-b: stale "still open" claims about a fixed KI are caught', () => {
  const probe = REAL_LEDGER[0];
  const mutated = cloneWith(probe, {
    description: probe.description + ' Unlike KI-1 this stays open.',
  });
  const violations = ruleB_staleCrossRefs([mutated, ...REAL_LEDGER]);
  assert.equal(violations.length, 1);
  assert.equal(violations[0].rule, 'R-b');
  assert.match(violations[0].detail, /claims KI-1 is open but KI-1\.yaml status=fixed/);
});

test('RED R-b: dangling open-claim targets are caught', () => {
  const probe = REAL_LEDGER[0];
  const mutated = cloneWith(probe, {
    description: probe.description + ' See KI-424242 which is open too.',
  });
  const violations = ruleB_staleCrossRefs([mutated]);
  assert.equal(violations.length, 1);
  assert.match(violations[0].detail, /references missing KI-424242/);
});

test('RED R-b: the historical KI-8-class rot is caught on a synthetic replay', () => {
  // Re-inject the exact sentence F1.3 removed; the rule must reject it.
  const ki8 = REAL_LEDGER.find((e) => e.id === 'KI-8');
  assert.ok(ki8 !== undefined);
  const rotated = cloneWith(ki8, {
    mitigation: ki8.mitigation.replace(
      '(KI-7 fixed 2026-08-23: offline object-graph only)',
      '(KI-7 open)',
    ),
  });
  // Full-ledger snapshot so the claim RESOLVES to the real fixed KI-7 and is
  // judged as a stale live claim (not merely a dangling reference).
  const snapshot = [rotated, ...REAL_LEDGER.filter((e) => e.id !== 'KI-8')];
  const violations = ruleB_staleCrossRefs(snapshot);
  assert.equal(violations.length, 1);
  assert.match(violations[0].detail, /claims KI-7 is open but KI-7\.yaml status=fixed/);
});

test('RED R-c: every purged marker is caught when re-injected', () => {
  const probe = REAL_LEDGER[0];
  WEB3_MARKERS.forEach((marker, i) => {
    const mutated = cloneWith(probe, { raw: probe.raw + `\ninjected: ${marker} (sentinel ${i})\n` });
    const violations = ruleC_web3Markers([mutated]);
    assert.equal(violations.length, 1, `marker "${marker}" not detected`);
    assert.equal(violations[0].rule, 'R-c');
    assert.match(violations[0].detail, new RegExp(`"${marker}"`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  });
});

test('RED R-d: stripping sanitizer from any cohort member is caught', () => {
  const byId = new Map(REAL_LEDGER.map((e) => [e.id, e]));
  for (const id of SANITIZER_COHORT) {
    const e = byId.get(id);
    assert.ok(e !== undefined, `${id} missing`);
    const stripped = cloneWith(e, { sanitizer: '' });
    // Full-ledger snapshot: the member is present but its sanitizer is gone.
    const violations = ruleD_sanitizerCohort([
      ...REAL_LEDGER.filter((x) => x.id !== id),
      stripped,
    ]);
    assert.equal(violations.length, 1, `${id} strip not detected`);
    assert.equal(violations[0].rule, 'R-d');
  }
  // Deletion detection: an empty snapshot flags every missing cohort member.
  assert.equal(ruleD_sanitizerCohort([]).length, SANITIZER_COHORT.length);
  // Scope: non-cohort sanitizers are invisible to R-d.
  const outsider = REAL_LEDGER.find((e) => !SANITIZER_COHORT.includes(e.id) && e.sanitizer !== '');
  assert.ok(outsider !== undefined, 'expected a sanitized non-cohort KI to exist');
  assert.deepEqual(ruleD_sanitizerCohort(REAL_LEDGER.map((e) => e.id === outsider.id
    ? cloneWith(e, { sanitizer: '' })
    : e)), []);
});

test('RED R-e: over-length modern titles are caught, including grandfathers', () => {
  const modern = REAL_LEDGER.filter((e) => numericId(e.id) >= 101);
  assert.ok(modern.length >= 5, `expected modern entries, got ${modern.length}`);
  for (const e of modern) {
    // Force strictly beyond the cap AND off the grandfather's exact-title
    // binding (some grandfathers already exceed the cap, so padEnd is a no-op
    // there — appending always produces a fresh violating title).
    const longTitle = e.title + 'x'.repeat(MODERN_TITLE_CAP + 1);
    const violations = ruleE_modernTitleLength([cloneWith(e, { title: longTitle })]);
    assert.equal(violations.length, 1, `${e.id} over-length not detected`);
    assert.equal(violations[0].rule, 'R-e');
  }
  // Under-cap titles never fire.
  assert.deepEqual(ruleE_modernTitleLength([{ ...modern[0], title: 'short' }]), []);
});

// --- Vacuity self-test: detectors fire on EVERY real entry shape -----------

test('vacuity: R-b detects an injected stale claim on every real entry', () => {
  let hits = 0;
  for (const e of REAL_LEDGER) {
    const mutated = cloneWith(e, { description: e.description + ' Unlike KI-1 this stays open.' });
    const n = ruleB_staleCrossRefs([mutated, ...REAL_LEDGER]).filter((v) => v.rule === 'R-b').length;
    assert.equal(n, 1, `${e.id}: expected exactly the injected violation, got ${n}`);
    hits += n;
  }
  assert.equal(hits, REAL_LEDGER.length);
});

test('vacuity: R-c detects rotated marker injections across the whole ledger', () => {
  let covered = 0;
  REAL_LEDGER.forEach((e, i) => {
    const marker = WEB3_MARKERS[i % WEB3_MARKERS.length];
    const mutated = cloneWith(e, { raw: e.raw + `\nsentinel: ${marker}\n` });
    const violations = ruleC_web3Markers([mutated]);
    assert.equal(violations.length, 1, `${e.id}/"${marker}" not detected`);
    covered += 1;
  });
  assert.equal(covered, REAL_LEDGER.length);
});

test('vacuity: R-a detects blanked fields on every non-exempt open entry', () => {
  const open = REAL_LEDGER.filter((e) => e.status === 'open' && !LEGACY_EXEMPT.has(e.id));
  assert.ok(open.length >= 40);
  for (const e of open) {
    const violations = ruleA_openTriageFields([cloneWith(e, { mitigation: ' ', remediation: '' })]);
    assert.equal(violations.length, 1, `${e.id} not detected`);
  }
});

test('superseded-banner semantics: dated banners exempt history, undated do not', () => {
  const template = [
    'id: KI-9001',
    'title: synthetic fixture',
    'description: synthetic',
    'mitigation: m',
    'remediation: r',
    'status: fixed',
    'notes:',
    "    - '<NOTES>'",
    '',
  ].join('\n');
  const datedClaim = '[superseded 2026-08-23: object-graph fixed] overlay for KI-1 stays open.';
  const undatedClaim = '[superseded: someday] overlay for KI-1 stays open.';
  const dated = parseKiRaw(template.replace('<NOTES>', datedClaim), 'KI-9001.yaml');
  assert.deepEqual(ruleB_staleCrossRefs([dated, ...REAL_LEDGER]), [],
    'dated superseded bullet must not count as a live open-claim');
  const undated = parseKiRaw(template.replace('<NOTES>', undatedClaim), 'KI-9002.yaml');
  const hits = ruleB_staleCrossRefs([undated, ...REAL_LEDGER]).filter((v) => v.id === 'KI-9002');
  assert.equal(hits.length, 1, 'undated pseudo-banner must NOT exempt a live open-claim');
  assert.match(hits[0].detail, /claims KI-1 is open/);
});
